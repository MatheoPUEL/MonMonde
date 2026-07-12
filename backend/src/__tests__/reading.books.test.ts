import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'reading-books@example.com'
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

describe('POST /api/reading/books', () => {
  it('creates a book with default WISHLIST status', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert', pageCount: 412 })

    expect(res.status).toBe(201)
    expect(res.body.book.title).toBe('Dune')
    expect(res.body.book.status).toBe('WISHLIST')
    expect(res.body.book.tags).toEqual([])
  })

  it('creates a book with tags', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert', tags: ['SF', 'Classique'] })

    expect(res.status).toBe(201)
    expect(res.body.book.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['SF', 'Classique'])
    )
  })

  it('returns 400 if title missing', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ authorName: 'Frank Herbert' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .send({ title: 'Dune', authorName: 'Frank Herbert' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/reading/books', () => {
  beforeEach(async () => {
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Book READING', authorName: 'Author', status: 'READING' })
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Book FINISHED', authorName: 'Author', status: 'FINISHED' })
  })

  it('returns all books', async () => {
    const res = await request(app).get('/api/reading/books').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.books.length).toBe(2)
  })

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/reading/books?status=READING')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.books.length).toBe(1)
    expect(res.body.books[0].status).toBe('READING')
  })

  it('filters by search query', async () => {
    const res = await request(app)
      .get('/api/reading/books?search=FINISHED')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.books.length).toBe(1)
  })
})

describe('GET /api/reading/books/:id', () => {
  it('returns book with tags and notes', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Detail Book', authorName: 'Author' })
    const id = createRes.body.book.id

    const res = await request(app).get(`/api/reading/books/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.book.id).toBe(id)
    expect(Array.isArray(res.body.book.notes)).toBe(true)
  })

  it('returns 404 for non-existent book', async () => {
    const res = await request(app)
      .get('/api/reading/books/nonexistentid')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/reading/books/:id', () => {
  it('updates book fields and tags', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Original', authorName: 'Author', tags: ['Old'] })
    const id = createRes.body.book.id

    const res = await request(app)
      .put(`/api/reading/books/${id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', status: 'READING', tags: ['New'] })

    expect(res.status).toBe(200)
    expect(res.body.book.title).toBe('Updated')
    expect(res.body.book.status).toBe('READING')
    expect(res.body.book.tags.map((t: { name: string }) => t.name)).toEqual(['New'])
  })
})

describe('DELETE /api/reading/books/:id', () => {
  it('deletes a book', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'To Delete', authorName: 'Author' })
    const id = createRes.body.book.id

    const res = await request(app).delete(`/api/reading/books/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('PUT /api/reading/books/:id/progress', () => {
  it('updates current page', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Progress Book', authorName: 'Author', pageCount: 300, status: 'READING' })
    const id = createRes.body.book.id

    const res = await request(app)
      .put(`/api/reading/books/${id}/progress`)
      .set('Cookie', cookie)
      .send({ currentPage: 150 })

    expect(res.status).toBe(200)
    expect(res.body.book.currentPage).toBe(150)
  })

  it('auto-sets FINISHED when currentPage >= pageCount', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Finish Book', authorName: 'Author', pageCount: 300, status: 'READING' })
    const id = createRes.body.book.id

    const res = await request(app)
      .put(`/api/reading/books/${id}/progress`)
      .set('Cookie', cookie)
      .send({ currentPage: 300 })

    expect(res.status).toBe(200)
    expect(res.body.book.status).toBe('FINISHED')
  })
})
