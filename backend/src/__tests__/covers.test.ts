import fs from 'fs'
import path from 'path'
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'
import { COVERS_DIR } from '../lib/upload'
import { backfillCovers } from '../lib/coverBackfill'

const TEST_EMAIL = 'covers@example.com'
let cookie: string
let userId: string

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4])

type Route = { status?: number; type?: string; body?: Buffer | object }
let routes: Record<string, Route>
const fetchMock = jest.spyOn(global, 'fetch')

function respond(route: Route | undefined): Response {
  if (!route) return new Response('not found', { status: 404 })
  if (route.body && !Buffer.isBuffer(route.body)) {
    return new Response(JSON.stringify(route.body), { status: route.status ?? 200, headers: { 'content-type': 'application/json' } })
  }
  return new Response(route.body as Buffer ?? JPEG, { status: route.status ?? 200, headers: { 'content-type': route.type ?? 'image/jpeg' } })
}

const createdFiles = () => fs.readdirSync(COVERS_DIR).filter(f => f.startsWith('remote-'))
let filesBefore: Set<string>

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id
  filesBefore = new Set(createdFiles())
})

beforeEach(() => {
  routes = {}
  fetchMock.mockImplementation(async input => respond(routes[String(input)]))
})

afterEach(async () => {
  fetchMock.mockReset()
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.author.deleteMany({ where: { userId } })
  await prisma.artwork.deleteMany({ where: { userId } })
  await prisma.artist.deleteMany({ where: { userId } })
  for (const f of createdFiles()) if (!filesBefore.has(f)) fs.unlinkSync(path.join(COVERS_DIR, f))
})

afterAll(async () => {
  fetchMock.mockRestore()
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

const fileOf = (url: string) => path.join(COVERS_DIR, path.basename(url))
const addBook = (body: object) =>
  request(app).post('/api/reading/books').set('Cookie', cookie).send({ title: 'Livre', authorName: 'Auteur', ...body })

describe('storing covers', () => {
  it('copies a remote cover locally and remembers where it came from', async () => {
    routes['https://img.example/a.jpg'] = {}
    const res = await addBook({ coverUrl: 'https://img.example/a.jpg', coverType: 'url' })

    expect(res.status).toBe(201)
    expect(res.body.book.coverUrl).toMatch(/^\/uploads\/covers\/remote-.+\.jpg$/)
    expect(res.body.book.coverSourceUrl).toBe('https://img.example/a.jpg')
    expect(fs.readFileSync(fileOf(res.body.book.coverUrl))).toEqual(JPEG)
  })

  it('keeps the remote URL when the download fails, to retry later', async () => {
    routes['https://img.example/a.jpg'] = { status: 403, type: 'text/html', body: Buffer.from('challenge') }
    const res = await addBook({ coverUrl: 'https://img.example/a.jpg' })

    expect(res.body.book.coverUrl).toBe('https://img.example/a.jpg')
    expect(res.body.book.coverSourceUrl).toBe('https://img.example/a.jpg')
  })

  it('leaves the cover alone when an edit sends back the source URL', async () => {
    routes['https://img.example/a.jpg'] = {}
    const { body } = await addBook({ coverUrl: 'https://img.example/a.jpg' })
    fetchMock.mockClear()

    const res = await request(app).put(`/api/reading/books/${body.book.id}`).set('Cookie', cookie)
      .send({ title: 'Nouveau titre', coverUrl: 'https://img.example/a.jpg' })

    expect(res.body.book.coverUrl).toBe(body.book.coverUrl)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects the Google Books "image not available" placeholder', async () => {
    const google = 'https://books.google.com/books/content?id=X&printsec=frontcover&img=1'
    routes[google] = { type: 'image/png' }
    const res = await addBook({ coverUrl: google })
    expect(res.body.book.coverUrl).toBe(google)
  })
})

describe('POST /api/reading/books/:id/cover/recover', () => {
  it('downloads the source again when the local copy is gone', async () => {
    routes['https://img.example/a.jpg'] = {}
    const { body } = await addBook({ coverUrl: 'https://img.example/a.jpg' })
    fs.unlinkSync(fileOf(body.book.coverUrl))

    const res = await request(app).post(`/api/reading/books/${body.book.id}/cover/recover`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(fs.existsSync(fileOf(res.body.coverUrl))).toBe(true)
  })

  it('falls back to Google Books, then Open Library, when the source is dead', async () => {
    routes['https://www.googleapis.com/books/v1/volumes/GB1'] = { body: { volumeInfo: { imageLinks: { thumbnail: 'http://books.google.com/new.jpg' } } } }
    routes['https://books.google.com/new.jpg'] = {}
    const { body } = await addBook({ coverUrl: 'https://dead.example/x.jpg', googleBooksId: 'GB1' })

    const res = await request(app).post(`/api/reading/books/${body.book.id}/cover/recover`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    const book = await prisma.book.findUnique({ where: { id: body.book.id } })
    expect(book).toMatchObject({ coverUrl: res.body.coverUrl, coverSourceUrl: 'https://books.google.com/new.jpg' })

    const isbnOnly = await addBook({ title: 'Autre', coverUrl: 'https://dead.example/y.jpg', isbn: '978-2-07-036042-0' })
    routes['https://covers.openlibrary.org/b/isbn/9782070360420-L.jpg?default=false'] = {}
    const viaOl = await request(app).post(`/api/reading/books/${isbnOnly.body.book.id}/cover/recover`).set('Cookie', cookie)
    expect(viaOl.status).toBe(200)
  })

  it('404s when no source has an image', async () => {
    const { body } = await addBook({ coverUrl: 'https://dead.example/x.jpg' })
    const res = await request(app).post(`/api/reading/books/${body.book.id}/cover/recover`).set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('POST /api/art/artworks/:id/cover/recover', () => {
  it('asks the museum API for the current image', async () => {
    const created = await request(app).post('/api/art/artworks').set('Cookie', cookie).send({
      title: 'La Vague', artistName: 'Hokusai', sourceApi: 'aic', sourceId: '24645',
      coverUrl: 'https://www.artic.edu/iiif/2/old/full/843,/0/default.jpg',
    })
    expect(created.body.artwork.coverUrl).toMatch(/^https:/)

    routes['https://api.artic.edu/api/v1/artworks/24645?fields=image_id'] = { body: { data: { image_id: 'new' }, config: { iiif_url: 'https://www.artic.edu/iiif/2' } } }
    routes['https://www.artic.edu/iiif/2/new/full/843,/0/default.jpg'] = {}

    const res = await request(app).post(`/api/art/artworks/${created.body.artwork.id}/cover/recover`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.coverUrl).toMatch(/^\/uploads\/covers\/remote-/)
  })

  it('sends the AIC identification header so its bot challenge lets us through', async () => {
    routes['https://www.artic.edu/iiif/2/a/full/843,/0/default.jpg'] = {}
    await request(app).post('/api/art/artworks').set('Cookie', cookie)
      .send({ title: 'T', artistName: 'A', coverUrl: 'https://www.artic.edu/iiif/2/a/full/843,/0/default.jpg' })

    const headers = (fetchMock.mock.calls[0][1] as RequestInit).headers as Record<string, string>
    expect(headers['AIC-User-Agent']).toBeDefined()
  })
})

describe('backfillCovers', () => {
  it('copies covers saved before local copies existed', async () => {
    const author = await prisma.author.create({ data: { userId, name: 'Vieil auteur' } })
    const book = await prisma.book.create({
      data: { userId, title: 'Ancien', authorId: author.id, coverUrl: 'https://img.example/old.jpg' },
    })
    routes['https://img.example/old.jpg'] = {}

    await backfillCovers()

    const after = await prisma.book.findUnique({ where: { id: book.id } })
    expect(after?.coverUrl).toMatch(/^\/uploads\/covers\/remote-/)
    expect(after?.coverSourceUrl).toBe('https://img.example/old.jpg')
  })
})
