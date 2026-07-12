import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'export-test@example.com'
let cookie: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Export User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.journalEntry.deleteMany({ where: { userId } })
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.author.deleteMany({ where: { userId } })
  await prisma.routine.deleteMany({ where: { userId } })
  await prisma.citation.deleteMany({ where: { userId } })
})

describe('GET /api/export/journal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/export/journal')
    expect(res.status).toBe(401)
  })

  it('returns version, exportedAt, module, and entries array', async () => {
    await prisma.journalEntry.create({
      data: {
        userId,
        title: 'Test entry',
        content: '{}',
        contentText: 'hello',
        tags: { create: [{ name: 'travel' }] },
      },
    })

    const res = await request(app).get('/api/export/journal').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.version).toBe('1')
    expect(res.body.module).toBe('journal')
    expect(typeof res.body.exportedAt).toBe('string')
    expect(Array.isArray(res.body.entries)).toBe(true)
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].title).toBe('Test entry')
    expect(res.body.entries[0].tags).toEqual(['travel'])
  })

  it('only returns data belonging to the authenticated user', async () => {
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other User', email: 'export-other@example.com', password: 'password123' })
    await prisma.journalEntry.create({ data: { userId: resB.body.user.id, title: 'Other', content: '{}', contentText: '' } })

    const res = await request(app).get('/api/export/journal').set('Cookie', cookie)
    expect(res.body.entries).toHaveLength(0)

    await prisma.user.delete({ where: { email: 'export-other@example.com' } })
  })
})

describe('GET /api/export/reading', () => {
  it('returns books with nested tags and notes', async () => {
    const bookRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert', status: 'FINISHED', tags: ['scifi'] })
    const bookId = bookRes.body.book.id
    await prisma.bookNote.create({
      data: { bookId, title: 'Chapter 1', content: 'Great start' },
    })

    const res = await request(app).get('/api/export/reading').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('reading')
    expect(res.body.books).toHaveLength(1)
    expect(res.body.books[0].tags).toEqual(['scifi'])
    expect(res.body.books[0].notes).toHaveLength(1)
    expect(res.body.books[0].notes[0].title).toBe('Chapter 1')
  })
})

describe('GET /api/export/routines', () => {
  it('returns routines with nested completions', async () => {
    await prisma.routine.create({
      data: {
        userId,
        name: 'Morning run',
        rruleString: 'FREQ=DAILY',
        completions: {
          create: [{ date: new Date('2026-01-01'), done: true }],
        },
      },
    })

    const res = await request(app).get('/api/export/routines').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('routines')
    expect(res.body.routines).toHaveLength(1)
    expect(res.body.routines[0].completions).toHaveLength(1)
  })
})

describe('GET /api/export/citations', () => {
  it('returns citations with tags', async () => {
    await prisma.citation.create({
      data: {
        userId,
        text: 'To be or not to be',
        author: 'Shakespeare',
        tags: { create: [{ name: 'classic' }] },
      },
    })

    const res = await request(app).get('/api/export/citations').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('citations')
    expect(res.body.citations).toHaveLength(1)
    expect(res.body.citations[0].tags).toEqual(['classic'])
  })
})

describe('GET /api/export/all', () => {
  it('returns all modules with correct user data', async () => {
    await prisma.journalEntry.create({
      data: { userId, title: 'All export entry', content: '{}', contentText: 'test' },
    })

    const res = await request(app).get('/api/export/all').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('all')
    expect(Array.isArray(res.body.journal.entries)).toBe(true)
    expect(res.body.journal.entries).toHaveLength(1)
    expect(res.body.journal.entries[0].title).toBe('All export entry')
    expect(Array.isArray(res.body.reading.books)).toBe(true)
    expect(Array.isArray(res.body.routines.routines)).toBe(true)
    expect(Array.isArray(res.body.citations.citations)).toBe(true)
  })
})
