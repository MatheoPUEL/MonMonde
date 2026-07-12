import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'import-test@example.com'
let cookie: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Import User', email: TEST_EMAIL, password: 'password123' })
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
  await prisma.routine.deleteMany({ where: { userId } })
  await prisma.citation.deleteMany({ where: { userId } })
})

describe('POST /api/import/journal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/import/journal').send({ version: '1', entries: [] })
    expect(res.status).toBe(401)
  })

  it('returns 400 if version is missing', async () => {
    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({ entries: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/version/)
  })

  it('returns 400 if version is unsupported', async () => {
    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({ version: '2', entries: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/version/)
  })

  it('imports entries and returns counts', async () => {
    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({
        version: '1',
        entries: [
          {
            title: 'Entry A',
            content: '{}',
            contentText: 'Hello',
            mood: 'GOOD',
            favorite: false,
            pinned: false,
            draft: false,
            tags: ['travel'],
            createdAt: '2026-01-15T10:00:00.000Z',
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)
    expect(res.body.skipped).toBe(0)
    expect(res.body.total).toBe(1)

    const entries = await prisma.journalEntry.findMany({ where: { userId }, include: { tags: true } })
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe('Entry A')
    expect(entries[0].tags.map(t => t.name)).toEqual(['travel'])
  })

  it('skips duplicate entries (same title, same day)', async () => {
    const createdAt = '2026-01-15T10:00:00.000Z'
    await prisma.journalEntry.create({
      data: { userId, title: 'Entry A', content: '{}', contentText: '', createdAt: new Date(createdAt) },
    })

    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({
        version: '1',
        entries: [{ title: 'Entry A', content: '{}', contentText: '', tags: [], createdAt, mood: null, favorite: false, pinned: false, draft: false }],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(0)
    expect(res.body.skipped).toBe(1)
  })
})

describe('POST /api/import/reading', () => {
  it('imports books with notes and skips duplicates by isbn', async () => {
    const res = await request(app)
      .post('/api/import/reading')
      .set('Cookie', cookie)
      .send({
        version: '1',
        books: [
          {
            title: 'Dune',
            author: 'Frank Herbert',
            isbn: '9780441013593',
            status: 'FINISHED',
            genres: ['Sci-Fi'],
            owned: false,
            favorite: false,
            rereadCount: 0,
            tags: ['scifi'],
            notes: [{ title: 'Note 1', content: 'Great', chapter: null, page: null }],
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)

    const books = await prisma.book.findMany({ where: { userId }, include: { notes: true, tags: true } })
    expect(books).toHaveLength(1)
    expect(books[0].notes).toHaveLength(1)
    expect(books[0].tags.map(t => t.name)).toEqual(['scifi'])

    const res2 = await request(app)
      .post('/api/import/reading')
      .set('Cookie', cookie)
      .send({ version: '1', books: [{ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', status: 'FINISHED', genres: [], owned: false, favorite: false, rereadCount: 0, tags: [], notes: [] }] })

    expect(res2.body.imported).toBe(0)
    expect(res2.body.skipped).toBe(1)
  })

  it('skips duplicates by title+author when isbn is absent', async () => {
    const book = { title: 'The Hobbit', author: 'Tolkien', status: 'FINISHED', genres: [], owned: false, favorite: false, rereadCount: 0, tags: [], notes: [] }

    const res1 = await request(app)
      .post('/api/import/reading')
      .set('Cookie', cookie)
      .send({ version: '1', books: [book] })
    expect(res1.body.imported).toBe(1)

    const res2 = await request(app)
      .post('/api/import/reading')
      .set('Cookie', cookie)
      .send({ version: '1', books: [book] })
    expect(res2.body.imported).toBe(0)
    expect(res2.body.skipped).toBe(1)
  })
})

describe('POST /api/import/routines', () => {
  it('imports routines with completions and skips duplicates', async () => {
    const res = await request(app)
      .post('/api/import/routines')
      .set('Cookie', cookie)
      .send({
        version: '1',
        routines: [
          {
            name: 'Morning run',
            rruleString: 'FREQ=DAILY',
            type: 'HABIT',
            color: '#C4775A',
            icon: '✅',
            active: true,
            hasQuantity: false,
            startDate: '2026-01-01T00:00:00.000Z',
            completions: [{ date: '2026-01-01T00:00:00.000Z', done: true, value: null, note: null }],
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)

    const routines = await prisma.routine.findMany({ where: { userId }, include: { completions: true } })
    expect(routines[0].completions).toHaveLength(1)
  })
})

describe('POST /api/import/citations', () => {
  it('imports citations with tags and skips duplicates by text+author', async () => {
    const res = await request(app)
      .post('/api/import/citations')
      .set('Cookie', cookie)
      .send({
        version: '1',
        citations: [
          {
            text: 'To be or not to be',
            author: 'Shakespeare',
            sourceType: 'BOOK',
            color: '#C4775A',
            favorite: false,
            viewCount: 0,
            tags: ['classic'],
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)

    const res2 = await request(app)
      .post('/api/import/citations')
      .set('Cookie', cookie)
      .send({ version: '1', citations: [{ text: 'To be or not to be', author: 'Shakespeare', sourceType: 'BOOK', color: '#C4775A', favorite: false, viewCount: 0, tags: [] }] })

    expect(res2.body.skipped).toBe(1)
  })
})
