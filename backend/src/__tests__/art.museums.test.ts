import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'
import * as geocode from '../lib/museumGeocode'

jest.mock('../lib/museumGeocode', () => ({
  ...jest.createMockFromModule<typeof geocode>('../lib/museumGeocode'),
  GeocodeUnavailableError: jest.requireActual('../lib/museumGeocode').GeocodeUnavailableError,
}))
const mocked = geocode as jest.Mocked<typeof geocode>

const TEST_EMAIL = 'art-museums@example.com'
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

beforeEach(() => {
  mocked.geocodeMuseum.mockResolvedValue({ latitude: 48.86, longitude: 2.34, city: 'Paris', country: 'France', wikidataId: 'Q19675' })
})

afterEach(async () => {
  jest.resetAllMocks()
  await prisma.museum.deleteMany({ where: { userId } })
  await prisma.artwork.deleteMany({ where: { userId } })
  await prisma.artist.deleteMany({ where: { userId } })
})

const addArtwork = (title: string, museum?: string) =>
  request(app).post('/api/art/artworks').set('Cookie', cookie).send({ title, artistName: 'Monet', museum })

describe('GET /api/art/museums', () => {
  it('derives museums from artworks, geocodes them once and counts artworks', async () => {
    await addArtwork('Nymphéas', 'Musée de Testville')
    await addArtwork('Impression', 'Musée de Testville')
    await addArtwork('Sans lieu')
    await addArtwork('Inconnu', 'Wikidata')

    const res = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.museums).toHaveLength(1)
    expect(res.body.museums[0]).toMatchObject({
      name: 'Musée de Testville', status: 'artworks', artworkCount: 2, visitCount: 0, latitude: 48.86, city: 'Paris',
    })

    await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(mocked.geocodeMuseum).toHaveBeenCalledTimes(1)
  })

  it('keeps a museum whose geocoding failed, without coordinates, and does not retry it', async () => {
    mocked.geocodeMuseum.mockResolvedValue(null)
    await addArtwork('Œuvre', 'Petit musée local')

    const res = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(res.body.museums[0]).toMatchObject({ name: 'Petit musée local', latitude: null })

    await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(mocked.geocodeMuseum).toHaveBeenCalledTimes(1)
  })

  it('leaves a museum pending when the lookup service is down, then retries it', async () => {
    mocked.geocodeMuseum.mockRejectedValueOnce(new geocode.GeocodeUnavailableError('429'))
    await addArtwork('Œuvre', 'Musée municipal de Testville')

    const down = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(down.status).toBe(200)
    expect(down.body.museums[0]).toMatchObject({ name: 'Musée municipal de Testville', latitude: null })
    expect(down.body.pending).toBe(0)

    const up = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(up.body.museums[0]).toMatchObject({ latitude: 48.86 })
    expect(mocked.geocodeMuseum).toHaveBeenCalledTimes(2)
  })

  it('hides museums left with no artworks, visits or wishlist', async () => {
    const created = await addArtwork('Œuvre', 'Musée d\'Orsay')
    await request(app).get('/api/art/museums').set('Cookie', cookie)
    await request(app).delete(`/api/art/artworks/${created.body.artwork.id}`).set('Cookie', cookie)

    const res = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(res.body.museums).toEqual([])
  })
})

describe('POST /api/art/museums', () => {
  it('adds a museum to visit with no artworks', async () => {
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie)
      .send({ name: 'Prado', wishlist: true })
    expect(res.status).toBe(201)
    expect(res.body.museum).toMatchObject({ name: 'Prado', status: 'wishlist', artworkCount: 0 })

    const list = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(list.body.museums.map((m: { name: string }) => m.name)).toEqual(['Prado'])
  })

  it('records a visit directly when a date is given', async () => {
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie)
      .send({ name: 'Uffizi', visitDate: '2025-05-12' })
    expect(res.body.museum).toMatchObject({ status: 'visited', visitCount: 1, wishlist: false })
  })

  it('requires a name', async () => {
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: '  ' })
    expect(res.status).toBe(400)
  })
})

describe('visits', () => {
  it('adding a visit clears the wishlist flag and deleting it reverts to wishlist=false', async () => {
    const { body } = await request(app).post('/api/art/museums').set('Cookie', cookie)
      .send({ name: 'Louvre', wishlist: true })
    const id = body.museum.id

    const visited = await request(app).post(`/api/art/museums/${id}/visits`).set('Cookie', cookie)
      .send({ date: '2026-03-01', note: 'Aile Denon' })
    expect(visited.status).toBe(201)
    expect(visited.body.museum).toMatchObject({ status: 'visited', wishlist: false, visitCount: 1 })
    expect(visited.body.museum.visits[0].note).toBe('Aile Denon')

    const visitId = visited.body.museum.visits[0].id
    const removed = await request(app).delete(`/api/art/museums/${id}/visits/${visitId}`).set('Cookie', cookie)
    expect(removed.body.museum).toMatchObject({ status: 'artworks', visitCount: 0 })
  })

  it('rejects an invalid date', async () => {
    const { body } = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Louvre' })
    const res = await request(app).post(`/api/art/museums/${body.museum.id}/visits`).set('Cookie', cookie)
      .send({ date: 'pas une date' })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/art/museums/:id', () => {
  it('returns the artworks held there', async () => {
    await addArtwork('Nymphéas', 'Orangerie')
    const list = await request(app).get('/api/art/museums').set('Cookie', cookie)

    const res = await request(app).get(`/api/art/museums/${list.body.museums[0].id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.museum.artworks.map((a: { title: string }) => a.title)).toEqual(['Nymphéas'])
  })

  it('404s for another user\'s museum', async () => {
    const other = await prisma.user.create({ data: { email: 'other-museum@example.com', password: 'x', name: 'Other' } })
    const museum = await prisma.museum.create({ data: { userId: other.id, name: 'Secret' } })
    const res = await request(app).get(`/api/art/museums/${museum.id}`).set('Cookie', cookie)
    expect(res.status).toBe(404)
    await prisma.user.delete({ where: { id: other.id } })
  })
})

describe('known museums list', () => {
  it('suggests notable museums ignoring accents, case and language', async () => {
    const res = await request(app).get('/api/art/museums/suggest?q=musee d orsay').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.suggestions[0]).toMatchObject({ name: 'Musée d\'Orsay', city: 'Paris', wikidataId: 'Q23402' })
    expect(res.body.suggestions[0].names).toBeUndefined()

    const english = await request(app).get('/api/art/museums/suggest?q=uffizi').set('Cookie', cookie)
    expect(english.body.suggestions[0].wikidataId).toBe('Q51252')

    // "musée" isn't part of the Offices' own name, but shouldn't prevent the match
    const generic = await request(app).get('/api/art/museums/suggest?q=musee des offices').set('Cookie', cookie)
    expect(generic.body.suggestions[0].wikidataId).toBe('Q51252')

    const short = await request(app).get('/api/art/museums/suggest?q=m').set('Cookie', cookie)
    expect(short.body.suggestions).toEqual([])
  })

  it('places a picked suggestion straight from the list, without a lookup', async () => {
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie)
      .send({ name: 'Musée du Louvre', wikidataId: 'Q19675', wishlist: true })
    expect(res.status).toBe(201)
    expect(res.body.museum).toMatchObject({ name: 'Musée du Louvre', city: 'Paris', wikidataId: 'Q19675', status: 'wishlist' })
    expect(res.body.museum.latitude).toBeCloseTo(48.86, 1)
    expect(mocked.geocodeMuseum).not.toHaveBeenCalled()
  })

  it('reuses a museum already on the map under another spelling', async () => {
    await addArtwork('Joconde', 'Louvre Museum')
    const list = await request(app).get('/api/art/museums').set('Cookie', cookie)
    expect(list.body.museums[0]).toMatchObject({ name: 'Louvre Museum', wikidataId: 'Q19675' })
    expect(mocked.geocodeMuseum).not.toHaveBeenCalled()

    const res = await request(app).post('/api/art/museums').set('Cookie', cookie)
      .send({ name: 'Musée du Louvre', wikidataId: 'Q19675', visitDate: '2026-01-10' })
    expect(res.body.museum).toMatchObject({ id: list.body.museums[0].id, status: 'visited', artworkCount: 1 })
  })

  it('still geocodes a free-text name that is not in the list', async () => {
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Petite galerie de quartier' })
    expect(res.body.museum.latitude).toBe(48.86)
    expect(mocked.geocodeMuseum).toHaveBeenCalledWith('Petite galerie de quartier')
  })
})

describe('official museum names', () => {
  it('files a typed name found in the list under its official spelling', async () => {
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'musee du louvre' })
    expect(res.body.museum).toMatchObject({ name: 'Musée du Louvre', wikidataId: 'Q19675' })
    expect(mocked.geocodeMuseum).not.toHaveBeenCalled()
  })

  it('uses the capitalized Wikidata label of the museum it was located at', async () => {
    mocked.geocodeMuseum.mockResolvedValue({ latitude: 48.85, longitude: 2.31, wikidataId: 'Q188977', name: 'hôtel des Invalides' })
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'les invalides' })
    expect(res.body.museum).toMatchObject({ name: 'Hôtel des Invalides', wikidataId: 'Q188977' })
  })

  it('keeps the typed name when the located place looks like something else', async () => {
    mocked.geocodeMuseum.mockResolvedValue({ latitude: 48.85, longitude: 2.31, wikidataId: 'Q1', name: 'gare de Lyon' })
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Petite galerie de quartier' })
    expect(res.body.museum.name).toBe('Petite galerie de quartier')
  })

  it('keeps a name already used on artworks, which are linked to the museum by it', async () => {
    await addArtwork('Œuvre', 'les invalides')
    mocked.geocodeMuseum.mockResolvedValue({ latitude: 48.85, longitude: 2.31, wikidataId: 'Q188977', name: 'hôtel des Invalides' })
    const res = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'les invalides', visitDate: '2026-01-10' })
    expect(res.body.museum).toMatchObject({ name: 'les invalides', artworkCount: 1, status: 'visited' })
  })
})

describe('POST /api/art/museums/:id/locate', () => {
  it('moves the museum to the picked Wikidata entity', async () => {
    const { body } = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Met' })
    mocked.locateMuseumByWikidataId.mockResolvedValue({ latitude: 40.78, longitude: -73.96, city: 'New York', country: 'États-Unis', wikidataId: 'Q160236' })

    const res = await request(app).post(`/api/art/museums/${body.museum.id}/locate`).set('Cookie', cookie)
      .send({ wikidataId: 'Q160236' })
    expect(res.status).toBe(200)
    expect(res.body.museum).toMatchObject({ latitude: 40.78, city: 'New York', wikidataId: 'Q160236' })
  })

  it('422s when the entity has no coordinates', async () => {
    const { body } = await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Met' })
    mocked.locateMuseumByWikidataId.mockResolvedValue(null)
    const res = await request(app).post(`/api/art/museums/${body.museum.id}/locate`).set('Cookie', cookie)
      .send({ wikidataId: 'Q1' })
    expect(res.status).toBe(422)
  })
})

describe('export / import', () => {
  it('round-trips visits and wishlist through the art export', async () => {
    await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Galerie Imaginaire', visitDate: '2025-05-12' })
    await request(app).post('/api/art/museums').set('Cookie', cookie).send({ name: 'Prado', wishlist: true })

    const exported = await request(app).get('/api/export/art').set('Cookie', cookie)
    expect(exported.body.museums).toHaveLength(2)

    await prisma.museum.deleteMany({ where: { userId } })
    await request(app).post('/api/import/art').set('Cookie', cookie).send(exported.body)
    // Importing twice must not duplicate visits
    await request(app).post('/api/import/art').set('Cookie', cookie).send(exported.body)

    const list = await request(app).get('/api/art/museums').set('Cookie', cookie)
    const byName = Object.fromEntries(list.body.museums.map((m: { name: string }) => [m.name, m]))
    expect(byName['Galerie Imaginaire']).toMatchObject({ status: 'visited', visitCount: 1, latitude: 48.86 })
    expect(byName.Prado).toMatchObject({ status: 'wishlist' })
  })
})
