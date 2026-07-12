import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'journal-test@example.com'
const TEST_EMAIL_B = 'journal-test-b@example.com'
const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}'
const CONTENT_HELLO = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello world from journal"}]}]}'

let cookie: string
let cookieB: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Journal User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id

  const resB = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Journal User B', email: TEST_EMAIL_B, password: 'password123' })
  cookieB = (resB.headers['set-cookie'] as unknown as string[])[0]
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_B] } } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.journalEntry.deleteMany({ where: { userId } })
})

describe('POST /api/journal/entries', () => {
  it('creates entry with required fields', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({ title: 'My first entry', content: EMPTY_DOC })

    expect(res.status).toBe(201)
    expect(res.body.entry.title).toBe('My first entry')
    expect(res.body.entry.draft).toBe(false)
    expect(res.body.entry.favorite).toBe(false)
    expect(res.body.entry.tags).toEqual([])
    expect(res.body.entry.mood).toBeNull()
  })

  it('creates entry with all optional fields', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({
        title: 'Full entry',
        content: CONTENT_HELLO,
        mood: 'GOOD',
        favorite: true,
        pinned: true,
        draft: true,
        tags: ['travel', 'work'],
      })

    expect(res.status).toBe(201)
    expect(res.body.entry.mood).toBe('GOOD')
    expect(res.body.entry.favorite).toBe(true)
    expect(res.body.entry.pinned).toBe(true)
    expect(res.body.entry.draft).toBe(true)
    expect(res.body.entry.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['travel', 'work'])
    )
    expect(res.body.entry.contentText).toBe('Hello world from journal')
  })

  it('returns 400 if title missing', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({ content: EMPTY_DOC })
    expect(res.status).toBe(400)
  })

  it('returns 400 if content missing', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({ title: 'No content' })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .send({ title: 'Test', content: EMPTY_DOC })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/journal/entries', () => {
  it('returns empty list when no entries', async () => {
    const res = await request(app).get('/api/journal/entries').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('returns entries ordered pinned first then by date desc', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'First', content: EMPTY_DOC })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Pinned', content: EMPTY_DOC, pinned: true })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Third', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries').set('Cookie', cookie)
    expect(res.body.entries[0].title).toBe('Pinned')
    expect(res.body.total).toBe(3)
  })

  it('filters by search title', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Voyage à Paris', content: EMPTY_DOC })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Travail du jour', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?search=Paris').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].title).toBe('Voyage à Paris')
  })

  it('filters by search content', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Entry', content: CONTENT_HELLO })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Other', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?search=Hello+world').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].title).toBe('Entry')
  })

  it('filters by mood', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Happy', content: EMPTY_DOC, mood: 'EXCELLENT' })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Sad', content: EMPTY_DOC, mood: 'BAD' })

    const res = await request(app).get('/api/journal/entries?mood=EXCELLENT').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].mood).toBe('EXCELLENT')
  })

  it('filters by favorite', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Fav', content: EMPTY_DOC, favorite: true })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Not fav', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?favorite=true').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].favorite).toBe(true)
  })

  it('filters by draft', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Draft', content: EMPTY_DOC, draft: true })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Published', content: EMPTY_DOC, draft: false })

    const res = await request(app).get('/api/journal/entries?draft=true').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].draft).toBe(true)
  })

  it('filters by tag', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Tagged', content: EMPTY_DOC, tags: ['travel'] })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Untagged', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?tag=travel').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].title).toBe('Tagged')
  })
})

describe('GET /api/journal/entries/:id', () => {
  it('returns entry by id', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Get me', content: CONTENT_HELLO })

    const res = await request(app)
      .get(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.entry.title).toBe('Get me')
  })

  it('returns 404 when entry belongs to another user', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Private', content: EMPTY_DOC })

    const res = await request(app)
      .get(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookieB)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/journal/entries/:id', () => {
  it('updates title and mood', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Original', content: EMPTY_DOC })

    const res = await request(app)
      .put(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', mood: 'GOOD' })

    expect(res.status).toBe(200)
    expect(res.body.entry.title).toBe('Updated')
    expect(res.body.entry.mood).toBe('GOOD')
  })

  it('atomically replaces tags', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Entry', content: EMPTY_DOC, tags: ['old'] })

    const res = await request(app)
      .put(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)
      .send({ tags: ['new1', 'new2'] })

    expect(res.body.entry.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['new1', 'new2'])
    )
    expect(res.body.entry.tags.find((t: { name: string }) => t.name === 'old')).toBeUndefined()
  })

  it('returns 404 for another user entry', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Mine', content: EMPTY_DOC })

    const res = await request(app)
      .put(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookieB)
      .send({ title: 'Hacked' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/journal/entries/:id', () => {
  it('deletes entry', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Delete me', content: EMPTY_DOC })

    const res = await request(app)
      .delete(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const check = await request(app)
      .get(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)
    expect(check.status).toBe(404)
  })

  it('returns 404 for another user entry', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Mine', content: EMPTY_DOC })

    const res = await request(app)
      .delete(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookieB)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/journal/stats', () => {
  it('returns correct totals', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'E1', content: CONTENT_HELLO, mood: 'GOOD' })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'E2', content: CONTENT_HELLO, mood: 'EXCELLENT' })

    const res = await request(app).get('/api/journal/stats').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.totalEntries).toBe(2)
    expect(res.body.totalWords).toBeGreaterThan(0)
    expect(res.body.currentStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.longestStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.moodByMonth.length).toBeGreaterThan(0)
  })

  it('excludes drafts from stats', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Draft', content: CONTENT_HELLO, draft: true })

    const res = await request(app).get('/api/journal/stats').set('Cookie', cookie)
    expect(res.body.totalEntries).toBe(0)
  })
})

describe('GET /api/journal/archives', () => {
  it('returns entries grouped by year and month', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'A', content: EMPTY_DOC })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'B', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/archives').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.archives.length).toBeGreaterThan(0)
    expect(res.body.archives[0]).toHaveProperty('year')
    expect(res.body.archives[0]).toHaveProperty('month')
    expect(res.body.archives[0].count).toBe(2)
  })

  it('excludes drafts from archives', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Draft', content: EMPTY_DOC, draft: true })

    const res = await request(app).get('/api/journal/archives').set('Cookie', cookie)
    expect(res.body.archives.length).toBe(0)
  })
})
