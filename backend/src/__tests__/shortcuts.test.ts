import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'shortcuts-test@example.com'
let cookie: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

describe('POST /api/shortcuts', () => {
  it('creates a shortcut', async () => {
    const res = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'GitHub', url: 'https://github.com' })

    expect(res.status).toBe(201)
    expect(res.body.shortcut.label).toBe('GitHub')
  })

  it('returns 400 if url is missing', async () => {
    const res = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'GitHub' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/shortcuts')
      .send({ label: 'GitHub', url: 'https://github.com' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/shortcuts', () => {
  it('returns an array of shortcuts', async () => {
    const res = await request(app)
      .get('/api/shortcuts')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.shortcuts)).toBe(true)
  })
})

describe('DELETE /api/shortcuts/:id', () => {
  it('deletes a shortcut owned by the user', async () => {
    const createRes = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'ToDelete', url: 'https://example.com' })

    const id = createRes.body.shortcut.id

    const res = await request(app)
      .delete(`/api/shortcuts/${id}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 for non-existent shortcut', async () => {
    const res = await request(app)
      .delete('/api/shortcuts/nonexistentid')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/shortcuts/:id', () => {
  it('updates a shortcut owned by the user', async () => {
    const createRes = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'ToUpdate', url: 'https://example.com' })

    const id = createRes.body.shortcut.id

    const res = await request(app)
      .put(`/api/shortcuts/${id}`)
      .set('Cookie', cookie)
      .send({ label: 'Updated', url: 'https://updated.com' })

    expect(res.status).toBe(200)
    expect(res.body.shortcut.label).toBe('Updated')
  })

  it('returns 404 for non-existent shortcut', async () => {
    const res = await request(app)
      .put('/api/shortcuts/nonexistentid')
      .set('Cookie', cookie)
      .send({ label: 'Updated', url: 'https://updated.com' })

    expect(res.status).toBe(404)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .put('/api/shortcuts/someid')
      .send({ label: 'Updated', url: 'https://updated.com' })

    expect(res.status).toBe(401)
  })
})
