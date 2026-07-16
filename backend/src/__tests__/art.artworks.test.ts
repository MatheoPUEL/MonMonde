import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'art-artworks@example.com'
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

describe('POST /api/art/artworks', () => {
  it('creates an artwork with default values', async () => {
    const res = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'Les Nymphéas', artistName: 'Claude Monet', year: 1916 })

    expect(res.status).toBe(201)
    expect(res.body.artwork.title).toBe('Les Nymphéas')
    expect(res.body.artwork.artist.name).toBe('Claude Monet')
    expect(res.body.artwork.favorite).toBe(false)
    expect(res.body.artwork.tags).toEqual([])
  })

  it('creates an artwork with tags and movements/currents', async () => {
    const res = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({
        title: 'Impression, soleil levant', artistName: 'Claude Monet',
        movements: ['Art moderne'], currents: ['Impressionnisme'], tags: ['Marine', 'Le Havre'],
      })

    expect(res.status).toBe(201)
    expect(res.body.artwork.movements).toEqual(['Art moderne'])
    expect(res.body.artwork.currents).toEqual(['Impressionnisme'])
    expect(res.body.artwork.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['Marine', 'Le Havre'])
    )
  })

  it('returns 400 if title missing', async () => {
    const res = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ artistName: 'Claude Monet' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/art/artworks')
      .send({ title: 'Untitled', artistName: 'Unknown' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/art/artworks', () => {
  beforeEach(async () => {
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'Water Lilies', artistName: 'Claude Monet', currents: ['Impressionnisme'] })
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'The Scream', artistName: 'Edvard Munch', currents: ['Expressionnisme'] })
  })

  it('returns all artworks', async () => {
    const res = await request(app).get('/api/art/artworks').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artworks.length).toBe(2)
  })

  it('filters by search query', async () => {
    const res = await request(app)
      .get('/api/art/artworks?search=Scream')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artworks.length).toBe(1)
  })

  it('filters by current', async () => {
    const res = await request(app)
      .get('/api/art/artworks?current=Impressionnisme')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artworks.length).toBe(1)
    expect(res.body.artworks[0].title).toBe('Water Lilies')
  })
})

describe('GET /api/art/artworks/:id', () => {
  it('returns artwork with tags, notes and media', async () => {
    const createRes = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'Detail Artwork', artistName: 'Artist' })
    const id = createRes.body.artwork.id

    const res = await request(app).get(`/api/art/artworks/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.artwork.id).toBe(id)
    expect(Array.isArray(res.body.artwork.notes)).toBe(true)
    expect(Array.isArray(res.body.artwork.media)).toBe(true)
  })

  it('returns 404 for non-existent artwork', async () => {
    const res = await request(app)
      .get('/api/art/artworks/nonexistentid')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/art/artworks/:id', () => {
  it('updates artwork fields and tags', async () => {
    const createRes = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'Original', artistName: 'Artist', tags: ['Old'] })
    const id = createRes.body.artwork.id

    const res = await request(app)
      .put(`/api/art/artworks/${id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', favorite: true, tags: ['New'] })

    expect(res.status).toBe(200)
    expect(res.body.artwork.title).toBe('Updated')
    expect(res.body.artwork.favorite).toBe(true)
    expect(res.body.artwork.tags.map((t: { name: string }) => t.name)).toEqual(['New'])
  })
})

describe('DELETE /api/art/artworks/:id', () => {
  it('deletes an artwork', async () => {
    const createRes = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'To Delete', artistName: 'Artist' })
    const id = createRes.body.artwork.id

    const res = await request(app).delete(`/api/art/artworks/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('Artwork notes', () => {
  it('creates and lists notes for an artwork', async () => {
    const createRes = await request(app)
      .post('/api/art/artworks')
      .set('Cookie', cookie)
      .send({ title: 'Noted Artwork', artistName: 'Artist' })
    const id = createRes.body.artwork.id

    const noteRes = await request(app)
      .post(`/api/art/artworks/${id}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Analyse', content: 'Une composition remarquable.' })

    expect(noteRes.status).toBe(201)

    const listRes = await request(app).get(`/api/art/artworks/${id}/notes`).set('Cookie', cookie)
    expect(listRes.status).toBe(200)
    expect(listRes.body.notes.length).toBe(1)
  })
})
