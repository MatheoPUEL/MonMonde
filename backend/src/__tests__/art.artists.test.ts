import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'art-artists@example.com'
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
  await prisma.artwork.deleteMany({ where: { userId } })
  await prisma.artist.deleteMany({ where: { userId } })
})

describe('GET /api/art/artists', () => {
  it('lists artists created via artwork creation with artwork counts', async () => {
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'Work A', artistName: 'Frida Kahlo' })
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'Work B', artistName: 'Frida Kahlo' })

    const res = await request(app).get('/api/art/artists').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artists.length).toBe(1)
    expect(res.body.artists[0].name).toBe('Frida Kahlo')
    expect(res.body.artists[0].artworkCount).toBe(2)
  })

  it('filters by search', async () => {
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'Work A', artistName: 'Frida Kahlo' })
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'Work B', artistName: 'Diego Rivera' })

    const res = await request(app).get('/api/art/artists?search=Frida').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artists.length).toBe(1)
  })

  it('excludes artists with no artworks', async () => {
    await prisma.artist.create({ data: { userId, name: 'Orphan Artist' } })

    const res = await request(app).get('/api/art/artists').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.artists).toEqual([])
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/art/artists')
    expect(res.status).toBe(401)
  })
})

describe('GET /api/art/artists/:id', () => {
  it('returns artist with artworks', async () => {
    const createRes = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'Work A', artistName: 'Frida Kahlo' })
    const artistId = createRes.body.artwork.artist.id

    const res = await request(app).get(`/api/art/artists/${artistId}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artist.artworks.length).toBe(1)
  })

  it('returns 404 for non-existent artist', async () => {
    const res = await request(app).get('/api/art/artists/nonexistentid').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/art/artists/:id', () => {
  it('updates artist fields', async () => {
    const createRes = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'Work A', artistName: 'Frida Kahlo' })
    const artistId = createRes.body.artwork.artist.id

    const res = await request(app)
      .put(`/api/art/artists/${artistId}`)
      .set('Cookie', cookie)
      .send({ nationality: 'Mexicaine' })

    expect(res.status).toBe(200)
    expect(res.body.artist.nationality).toBe('Mexicaine')
  })
})
