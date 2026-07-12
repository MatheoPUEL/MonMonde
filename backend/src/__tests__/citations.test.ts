import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'citations@example.com'
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
  await prisma.citation.deleteMany({ where: { userId } })
})

describe('POST /api/citations', () => {
  it('creates a citation with defaults', async () => {
    const res = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Test quote' })

    expect(res.status).toBe(201)
    expect(res.body.citation.text).toBe('Test quote')
    expect(res.body.citation.sourceType).toBe('OTHER')
    expect(res.body.citation.favorite).toBe(false)
    expect(res.body.citation.viewCount).toBe(0)
    expect(res.body.citation.tags).toEqual([])
  })

  it('creates a citation with tags', async () => {
    const res = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Tagged quote', tags: ['Philo', 'Stoïcisme'] })

    expect(res.status).toBe(201)
    expect(res.body.citation.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['Philo', 'Stoïcisme'])
    )
  })

  it('returns 400 if text is missing', async () => {
    const res = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ author: 'Someone' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/citations')
      .send({ text: 'No auth' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/citations', () => {
  beforeEach(async () => {
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Book quote', sourceType: 'BOOK', author: 'Camus', tags: ['Philo'] })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Internet quote', sourceType: 'INTERNET', favorite: true })
  })

  it('returns all citations', async () => {
    const res = await request(app).get('/api/citations').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(2)
    expect(res.body.total).toBe(2)
  })

  it('filters by sourceType', async () => {
    const res = await request(app)
      .get('/api/citations?sourceType=BOOK')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
    expect(res.body.citations[0].sourceType).toBe('BOOK')
  })

  it('filters by favorite', async () => {
    const res = await request(app)
      .get('/api/citations?favorite=true')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
  })

  it('filters by tag', async () => {
    const res = await request(app)
      .get('/api/citations?tag=Philo')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
  })

  it('searches across text and author', async () => {
    const res = await request(app)
      .get('/api/citations?search=Camus')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
  })
})

describe('GET /api/citations/stats', () => {
  beforeEach(async () => {
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q1', sourceType: 'BOOK', author: 'Camus', favorite: true })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q2', sourceType: 'BOOK', author: 'Camus' })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q3', sourceType: 'INTERNET' })
  })

  it('returns correct totals and bySourceType', async () => {
    const res = await request(app).get('/api/citations/stats').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.favorites).toBe(1)
    expect(res.body.bySourceType['BOOK']).toBe(2)
    expect(res.body.bySourceType['INTERNET']).toBe(1)
    expect(res.body.byAuthor[0]).toEqual({ author: 'Camus', count: 2 })
    expect(Array.isArray(res.body.mostViewed)).toBe(true)
    expect(Array.isArray(res.body.timeline)).toBe(true)
  })
})

describe('GET /api/citations/tags', () => {
  beforeEach(async () => {
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q', tags: ['Philo', 'Stoïcisme'] })
  })

  it('returns distinct tag names', async () => {
    const res = await request(app).get('/api/citations/tags').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.tags).toEqual(expect.arrayContaining(['Philo', 'Stoïcisme']))
  })
})

describe('GET /api/citations/:id', () => {
  it('returns citation and increments viewCount', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'View me' })
    const id = createRes.body.citation.id

    const res1 = await request(app).get(`/api/citations/${id}`).set('Cookie', cookie)
    expect(res1.status).toBe(200)
    expect(res1.body.citation.viewCount).toBe(1)

    const res2 = await request(app).get(`/api/citations/${id}`).set('Cookie', cookie)
    expect(res2.body.citation.viewCount).toBe(2)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/citations/unknownid').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/citations/:id', () => {
  it('updates text and tags', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Original', tags: ['Old'] })
    const id = createRes.body.citation.id

    const res = await request(app)
      .put(`/api/citations/${id}`)
      .set('Cookie', cookie)
      .send({ text: 'Updated', tags: ['New'] })

    expect(res.status).toBe(200)
    expect(res.body.citation.text).toBe('Updated')
    expect(res.body.citation.tags.map((t: { name: string }) => t.name)).toEqual(['New'])
  })
})

describe('DELETE /api/citations/:id', () => {
  it('deletes a citation', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Delete me' })
    const id = createRes.body.citation.id

    const res = await request(app).delete(`/api/citations/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('PATCH /api/citations/:id/favorite', () => {
  it('toggles favorite', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Fav me', favorite: false })
    const id = createRes.body.citation.id

    const res = await request(app)
      .patch(`/api/citations/${id}/favorite`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citation.favorite).toBe(true)

    const res2 = await request(app)
      .patch(`/api/citations/${id}/favorite`)
      .set('Cookie', cookie)
    expect(res2.body.citation.favorite).toBe(false)
  })
})

describe('GET /api/reading/books/:id/citations', () => {
  it('returns citations linked to a book', async () => {
    const bookRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Test Book', authorName: 'Author' })
    const bookId = bookRes.body.book.id

    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Book citation', sourceType: 'BOOK', bookId })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Unlinked citation' })

    const res = await request(app)
      .get(`/api/reading/books/${bookId}/citations`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
    expect(res.body.citations[0].text).toBe('Book citation')

    await prisma.book.deleteMany({ where: { userId } })
    await prisma.author.deleteMany({ where: { userId } })
  })
})
