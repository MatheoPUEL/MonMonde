import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'settings-test@example.com'

async function createUserAndGetCookie() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Settings User', email: TEST_EMAIL, password: 'password123' })
  return (res.headers['set-cookie'] as unknown as string[])[0]
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.user.deleteMany({ where: { email: 'new-settings@example.com' } })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('PATCH /api/auth/me', () => {
  it('updates name and email', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: 'Updated Name', email: 'new-settings@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Updated Name')
    expect(res.body.user.email).toBe('new-settings@example.com')
  })

  it('returns 409 if new email is already taken', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'new-settings@example.com', password: 'password123' })
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ email: 'new-settings@example.com' })

    expect(res.status).toBe(409)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/auth/me').send({ name: 'X' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/me/password', () => {
  it('changes password with correct current password', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 with wrong current password', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' })

    expect(res.status).toBe(400)
  })

  it('returns 400 if new password is too short', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'password123', newPassword: 'short' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/me/password')
      .send({ currentPassword: 'x', newPassword: 'y' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/auth/me/avatar', () => {
  it('clears avatarUrl', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .delete('/api/auth/me/avatar')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.user.avatarUrl).toBeNull()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/auth/me/avatar')
    expect(res.status).toBe(401)
  })
})
