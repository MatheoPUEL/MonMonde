import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'reading-authors@example.com'
let cookie: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.author.deleteMany({ where: { userId } })
})

describe('GET /api/reading/authors', () => {
  it('returns empty list when no authors', async () => {
    const res = await request(app).get('/api/reading/authors').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authors).toEqual([])
  })

  it('returns authors with bookCount', async () => {
    const author = await prisma.author.create({
      data: { userId, name: 'Frank Herbert' },
    })
    await prisma.book.create({
      data: { userId, title: 'Dune', authorId: author.id, genres: [] },
    })

    const res = await request(app).get('/api/reading/authors').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authors[0].name).toBe('Frank Herbert')
    expect(res.body.authors[0].bookCount).toBe(1)
  })

  it('filters by search', async () => {
    await prisma.author.create({ data: { userId, name: 'Frank Herbert' } })
    await prisma.author.create({ data: { userId, name: 'Isaac Asimov' } })

    const res = await request(app)
      .get('/api/reading/authors?search=frank')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authors).toHaveLength(1)
    expect(res.body.authors[0].name).toBe('Frank Herbert')
  })
})

describe('GET /api/reading/authors/:id', () => {
  it('returns author with books', async () => {
    const author = await prisma.author.create({
      data: { userId, name: 'Frank Herbert' },
    })
    await prisma.book.create({
      data: { userId, title: 'Dune', authorId: author.id, genres: [] },
    })

    const res = await request(app)
      .get(`/api/reading/authors/${author.id}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.author.name).toBe('Frank Herbert')
    expect(res.body.author.books).toHaveLength(1)
  })

  it('returns 404 for unknown author', async () => {
    const res = await request(app)
      .get('/api/reading/authors/nonexistent')
      .set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/reading/authors/:id', () => {
  it('updates author fields', async () => {
    const author = await prisma.author.create({
      data: { userId, name: 'Frank Herbert' },
    })

    const res = await request(app)
      .put(`/api/reading/authors/${author.id}`)
      .set('Cookie', cookie)
      .send({ nationality: 'Américain', bio: 'Auteur de SF' })
    expect(res.status).toBe(200)
    expect(res.body.author.nationality).toBe('Américain')
    expect(res.body.author.bio).toBe('Auteur de SF')
  })
})

describe('GET /api/reading/authors/:id avgRating', () => {
  it('returns null avgRating when no books have ratings', async () => {
    const author = await prisma.author.create({ data: { userId, name: 'Test Author' } })
    await prisma.book.create({ data: { userId, title: 'Book 1', authorId: author.id, genres: [] } })

    const res = await request(app)
      .get(`/api/reading/authors/${author.id}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.author.avgRating).toBeNull()
  })

  it('correctly computes avgRating from rated books', async () => {
    const author = await prisma.author.create({ data: { userId, name: 'Rated Author' } })
    await prisma.book.create({ data: { userId, title: 'Book A', authorId: author.id, genres: [], rating: 4 } })
    await prisma.book.create({ data: { userId, title: 'Book B', authorId: author.id, genres: [], rating: 2 } })

    const res = await request(app)
      .get(`/api/reading/authors/${author.id}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.author.avgRating).toBe(3)
  })

  it('excludes books with null rating from avgRating', async () => {
    const author = await prisma.author.create({ data: { userId, name: 'Mixed Author' } })
    await prisma.book.create({ data: { userId, title: 'Rated', authorId: author.id, genres: [], rating: 5 } })
    await prisma.book.create({ data: { userId, title: 'Unrated', authorId: author.id, genres: [] } })

    const res = await request(app)
      .get(`/api/reading/authors/${author.id}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.author.avgRating).toBe(5)
  })
})

describe('401 without auth', () => {
  it('GET /api/reading/authors returns 401', async () => {
    const res = await request(app).get('/api/reading/authors')
    expect(res.status).toBe(401)
  })
})
