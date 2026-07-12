import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'routines@example.com'
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
  await prisma.routine.deleteMany({ where: { userId } })
})

describe('POST /api/routines', () => {
  it('creates a HABIT with default fields', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ name: 'Morning Run', rruleString: 'FREQ=DAILY' })

    expect(res.status).toBe(201)
    expect(res.body.routine.name).toBe('Morning Run')
    expect(res.body.routine.rruleString).toBe('FREQ=DAILY')
    expect(res.body.routine.type).toBe('HABIT')
    expect(res.body.routine.active).toBe(true)
    expect(res.body.routine.color).toBe('#C4775A')
  })

  it('returns 400 if name missing', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ rruleString: 'FREQ=DAILY' })
    expect(res.status).toBe(400)
  })

  it('returns 400 if rruleString missing', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ name: 'Run' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid rruleString', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'INVALID' })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/routines', () => {
  beforeEach(async () => {
    await request(app).post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Daily', rruleString: 'FREQ=DAILY', type: 'HABIT' })
    await request(app).post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Weekly', rruleString: 'FREQ=WEEKLY', type: 'TASK' })
  })

  it('returns all routines', async () => {
    const res = await request(app).get('/api/routines').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routines.length).toBe(2)
  })

  it('filters by type', async () => {
    const res = await request(app).get('/api/routines?type=HABIT').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routines.length).toBe(1)
    expect(res.body.routines[0].type).toBe('HABIT')
  })

  it('filters by search', async () => {
    const res = await request(app).get('/api/routines?search=Weekly').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routines.length).toBe(1)
  })
})

describe('GET /api/routines/:id', () => {
  it('returns routine by id', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app).get(`/api/routines/${id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routine.id).toBe(id)
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request(app).get('/api/routines/nonexistent').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/routines/:id', () => {
  it('updates fields', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app)
      .put(`/api/routines/${id}`).set('Cookie', cookie)
      .send({ name: 'Evening Run', active: false })

    expect(res.status).toBe(200)
    expect(res.body.routine.name).toBe('Evening Run')
    expect(res.body.routine.active).toBe(false)
  })
})

describe('DELETE /api/routines/:id', () => {
  it('deletes a routine', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app).delete(`/api/routines/${id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('Auth isolation', () => {
  it("cannot access another user's routine", async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'routines-other@example.com', password: 'password123' })
    const otherCookie = (other.headers['set-cookie'] as unknown as string[])[0]

    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Mine', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app).get(`/api/routines/${id}`).set('Cookie', otherCookie)
    expect(res.status).toBe(404)

    await prisma.user.deleteMany({ where: { email: 'routines-other@example.com' } })
  })
})

describe('POST /api/routines/:id/completions (upsert)', () => {
  it('creates and upserts a completion for the same date', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id
    const date = '2024-03-15T00:00:00.000Z'

    const r1 = await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date, done: true })
    expect(r1.status).toBe(200)
    expect(r1.body.completion.done).toBe(true)

    const r2 = await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date, done: false, note: 'Skipped' })
    expect(r2.status).toBe(200)
    expect(r2.body.completion.done).toBe(false)
    expect(r2.body.completion.note).toBe('Skipped')

    const count = await prisma.routineCompletion.count({ where: { routineId } })
    expect(count).toBe(1)
  })

  it('returns 400 if date missing', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id

    const res = await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ done: true })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/routines/:id/completions', () => {
  it('returns completions with date range filter', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id

    await request(app).post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: '2024-01-01T00:00:00.000Z', done: true })
    await request(app).post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: '2024-02-01T00:00:00.000Z', done: true })

    const res = await request(app)
      .get(`/api/routines/${routineId}/completions?from=2024-01-01&to=2024-01-31`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.completions.length).toBe(1)
  })
})

describe('DELETE /api/routines/:id/completions/:date', () => {
  it('deletes a completion', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id
    const date = '2024-03-15T00:00:00.000Z'

    await request(app).post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date, done: true })

    const res = await request(app)
      .delete(`/api/routines/${routineId}/completions/${encodeURIComponent(date)}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const count = await prisma.routineCompletion.count({ where: { routineId } })
    expect(count).toBe(0)
  })
})

describe('GET /api/routines/today', () => {
  it('includes daily routine and excludes future-start routine', async () => {
    const r1 = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Daily Habit', rruleString: 'FREQ=DAILY' })

    const futureStart = new Date(Date.now() + 86400000 * 365).toISOString()
    const r2 = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Future Habit', rruleString: 'FREQ=DAILY', startDate: futureStart })

    const res = await request(app).get('/api/routines/today').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.items).toBeDefined()

    const ids = res.body.items.map((item: any) => item.routine.id)
    expect(ids).toContain(r1.body.routine.id)
    expect(ids).not.toContain(r2.body.routine.id)
  })

  it('includes completion status for today', async () => {
    const r = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Daily', rruleString: 'FREQ=DAILY' })
    const routineId = r.body.routine.id

    const todayISO = new Date().toISOString()
    await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: todayISO, done: true })

    const res = await request(app).get('/api/routines/today').set('Cookie', cookie)
    const item = res.body.items.find((i: any) => i.routine.id === routineId)
    expect(item).toBeDefined()
    expect(item.completion).not.toBeNull()
    expect(item.completion.done).toBe(true)
  })
})

describe('GET /api/routines/grid', () => {
  it('returns routines and completions for the given month', async () => {
    const r = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Grid Test', rruleString: 'FREQ=DAILY' })
    const routineId = r.body.routine.id

    await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: '2024-06-15T00:00:00.000Z', done: true })

    const res = await request(app)
      .get('/api/routines/grid?year=2024&month=6').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.year).toBe(2024)
    expect(res.body.month).toBe(6)
    expect(Array.isArray(res.body.routines)).toBe(true)
    expect(Array.isArray(res.body.completions)).toBe(true)
    expect(res.body.completions.some((c: any) => c.routineId === routineId)).toBe(true)
  })
})

describe('GET /api/routines/:id/stats', () => {
  it('returns correct stats shape and longestStreak', async () => {
    const startDate = new Date('2024-01-01T00:00:00.000Z').toISOString()
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Stats Test', rruleString: 'FREQ=DAILY', startDate })
    const routineId = createRes.body.routine.id

    for (const d of ['2024-01-01', '2024-01-02', '2024-01-03']) {
      await request(app)
        .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
        .send({ date: new Date(d).toISOString(), done: true })
    }

    const res = await request(app)
      .get(`/api/routines/${routineId}/stats`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.totalCompletions).toBe(3)
    expect(res.body.longestStreak).toBe(3)
    expect(res.body.currentStreak).toBe(0) // Jan 2024 completions, not recent
    expect(res.body.successRate).toBeGreaterThanOrEqual(0)
    expect(res.body.successRate).toBeLessThanOrEqual(1)
    expect(typeof res.body.thisMonth).toBe('number')
    expect(typeof res.body.thisYear).toBe('number')
  })
})
