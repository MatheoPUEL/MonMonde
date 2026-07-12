import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'reading-notes@example.com'
let cookie: string
let userId: string
let bookId: string

beforeAll(async () => {
  const userRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test', email: TEST_EMAIL, password: 'password123' })
  cookie = (userRes.headers['set-cookie'] as unknown as string[])[0]
  userId = userRes.body.user.id

  const bookRes = await request(app)
    .post('/api/reading/books')
    .set('Cookie', cookie)
    .send({ title: 'Note Test Book', authorName: 'Author' })
  bookId = bookRes.body.book.id
})

afterAll(async () => {
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.author.deleteMany({ where: { userId } })
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.bookNote.deleteMany({ where: { bookId } })
})

describe('POST /api/reading/books/:bookId/notes', () => {
  it('creates a note', async () => {
    const res = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Ma note', content: 'Contenu de la note', chapter: 'Chapitre 3' })

    expect(res.status).toBe(201)
    expect(res.body.note.title).toBe('Ma note')
    expect(res.body.note.chapter).toBe('Chapitre 3')
  })

  it('returns 400 if content missing', async () => {
    const res = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Ma note' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .send({ title: 'Ma note', content: 'Content' })

    expect(res.status).toBe(401)
  })

  it('returns 404 for non-existent book', async () => {
    const res = await request(app)
      .post('/api/reading/books/nonexistentbook/notes')
      .set('Cookie', cookie)
      .send({ title: 'Ma note', content: 'Content' })

    expect(res.status).toBe(404)
  })
})

describe('GET /api/reading/books/:bookId/notes', () => {
  beforeEach(async () => {
    await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Note 1', content: 'Content 1' })
  })

  it('returns notes ordered by createdAt desc', async () => {
    const res = await request(app)
      .get(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.notes)).toBe(true)
    expect(res.body.notes.length).toBe(1)
  })
})

describe('PUT /api/reading/books/:bookId/notes/:noteId', () => {
  it('updates a note', async () => {
    const createRes = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Original', content: 'Content' })
    const noteId = createRes.body.note.id

    const res = await request(app)
      .put(`/api/reading/books/${bookId}/notes/${noteId}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', content: 'New content', page: 42 })

    expect(res.status).toBe(200)
    expect(res.body.note.title).toBe('Updated')
    expect(res.body.note.page).toBe(42)
  })

  it('returns 404 for non-existent note', async () => {
    const res = await request(app)
      .put(`/api/reading/books/${bookId}/notes/nonexistent`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', content: 'Content' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/reading/books/:bookId/notes/:noteId', () => {
  it('deletes a note', async () => {
    const createRes = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'To Delete', content: 'Content' })
    const noteId = createRes.body.note.id

    const res = await request(app)
      .delete(`/api/reading/books/${bookId}/notes/${noteId}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 for non-existent note', async () => {
    const res = await request(app)
      .delete(`/api/reading/books/${bookId}/notes/nonexistent`)
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})
