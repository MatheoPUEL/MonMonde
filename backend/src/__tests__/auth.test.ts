import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'auth-test@example.com'

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/auth/register', () => {
  it('creates a user and sets a cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe(TEST_EMAIL)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 409 for duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: TEST_EMAIL, password: 'password456' })

    expect(res.status).toBe(409)
  })

  it('returns 400 if fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })
  })

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(TEST_EMAIL)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns user for authenticated request', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })

    const cookie = (registerRes.headers['set-cookie'] as unknown as string[])[0]

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(TEST_EMAIL)
  })

  it('returns 401 without cookie', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
