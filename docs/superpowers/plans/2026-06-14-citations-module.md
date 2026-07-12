# Citations Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full Citations module — CRUD, search/filter, stats, book integration — following all existing project patterns.

**Architecture:** Independent `Citation` model with optional `bookId` FK. Backend at `/api/citations`, frontend at `/citations/*`. BookDetail gains a Citations tab via a new `/api/reading/books/:id/citations` route.

**Tech Stack:** TypeScript · Express · Prisma (PostgreSQL) · React · React Router · CSS modules (single `citations.css`)

**Spec:** `docs/superpowers/specs/2026-06-14-citations-module-design.md`

---

## File Map

**Backend — create:**
- `backend/src/routes/citations/citations.ts` — CRUD + stats + tags routes
- `backend/src/routes/citations/index.ts` — router wiring + requireAuth
- `backend/src/__tests__/citations.test.ts` — integration tests

**Backend — modify:**
- `backend/prisma/schema.prisma` — add SourceType enum, Citation, CitationTag, relations on User + Book
- `backend/src/app.ts` — mount `/api/citations`
- `backend/src/routes/modules.ts` — add citations module entry
- `backend/src/routes/reading/books.ts` — add `GET /:id/citations` route

**Frontend — create:**
- `frontend/src/api/citations.ts` — types + `citationsApi`
- `frontend/src/components/citations/CitationCard.tsx`
- `frontend/src/components/citations/CitationForm.tsx`
- `frontend/src/components/citations/CitationStatsPanel.tsx`
- `frontend/src/pages/citations/CitationsPage.tsx`
- `frontend/src/pages/citations/CitationList.tsx`
- `frontend/src/pages/citations/CitationDetail.tsx`
- `frontend/src/styles/citations.css`

**Frontend — modify:**
- `frontend/src/App.tsx` — add `/citations/*` route
- `frontend/src/pages/reading/BookDetail.tsx` — add tab bar + Citations tab

---

## Task 1: Prisma Schema

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add SourceType enum and Citation + CitationTag models**

In `backend/prisma/schema.prisma`, add after the last `model` block:

```prisma
enum SourceType {
  BOOK
  ARTICLE
  INTERNET
  PODCAST
  FILM
  SERIES
  VIDEO
  PERSON
  OTHER
}

model Citation {
  id         String     @id @default(cuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  text       String
  author     String?
  sourceType SourceType @default(OTHER)
  source     String?

  bookId     String?
  book       Book?      @relation(fields: [bookId], references: [id], onDelete: SetNull)
  page       Int?
  chapter    String?

  comment    String?
  color      String     @default("#C4775A")
  favorite   Boolean    @default(false)
  viewCount  Int        @default(0)

  tags       CitationTag[]

  createdAt  DateTime   @default(now())
  updatedAt  DateTime   @updatedAt

  @@index([userId])
  @@index([userId, favorite])
  @@index([userId, sourceType])
  @@index([bookId])
}

model CitationTag {
  id         String   @id @default(cuid())
  name       String
  citationId String
  citation   Citation @relation(fields: [citationId], references: [id], onDelete: Cascade)

  @@unique([citationId, name])
  @@index([citationId])
}
```

- [ ] **Step 2: Add relations to User and Book**

In the `User` model block, add:
```prisma
citations      Citation[]
```

In the `Book` model block, add:
```prisma
citations      Citation[]
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_citations_module
```

Expected: `The following migration(s) have been created and applied from new schema changes: migrations/..._add_citations_module`

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd backend && npx tsc --noEmit
```

Expected: no output (exit 0)

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Citation + CitationTag schema models"
```

---

## Task 2: Backend Citations Router (CRUD)

**Files:**
- Create: `backend/src/routes/citations/citations.ts`
- Create: `backend/src/routes/citations/index.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create `citations.ts`**

Create `backend/src/routes/citations/citations.ts`:

```ts
import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { SourceType } from '@prisma/client'

const router = Router()

const CITATION_INCLUDE = {
  tags: true,
  book: { select: { id: true, title: true, coverUrl: true, author: true } },
} as const

// GET /api/citations
router.get('/', async (req, res, next) => {
  try {
    const { search, sourceType, favorite, tag, bookId } = req.query as Record<string, string>
    const userId = req.user!.id

    const where: Record<string, unknown> = { userId }
    if (sourceType && Object.values(SourceType).includes(sourceType as SourceType)) {
      where.sourceType = sourceType as SourceType
    }
    if (favorite === 'true') where.favorite = true
    if (bookId) where.bookId = bookId
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { comment: { contains: search, mode: 'insensitive' } },
      ]
    }

    let citations = await prisma.citation.findMany({
      where,
      include: CITATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    if (tag) {
      citations = citations.filter(c =>
        c.tags.some(t => t.name.toLowerCase() === tag.toLowerCase())
      )
    }

    res.json({ citations, total: citations.length })
  } catch (err) { next(err) }
})

// GET /api/citations/stats — registered BEFORE /:id
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user!.id

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const [total, favorites, bySourceTypeRaw, byAuthorRaw, mostViewed, recentForTimeline] =
      await Promise.all([
        prisma.citation.count({ where: { userId } }),
        prisma.citation.count({ where: { userId, favorite: true } }),
        prisma.citation.groupBy({
          by: ['sourceType'],
          where: { userId },
          _count: { _all: true },
        }),
        prisma.citation.groupBy({
          by: ['author'],
          where: { userId, author: { not: null } },
          _count: { _all: true },
        }),
        prisma.citation.findMany({
          where: { userId },
          include: CITATION_INCLUDE,
          orderBy: { viewCount: 'desc' },
          take: 5,
        }),
        prisma.citation.findMany({
          where: { userId, createdAt: { gte: twelveMonthsAgo } },
          select: { createdAt: true },
        }),
      ])

    const bySourceType: Record<string, number> = {}
    for (const row of bySourceTypeRaw) {
      bySourceType[row.sourceType] = row._count._all
    }

    const byAuthor = byAuthorRaw
      .filter(r => r.author)
      .map(r => ({ author: r.author as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const timelineMap = new Map<string, number>()
    for (const c of recentForTimeline) {
      const month = c.createdAt.toISOString().slice(0, 7)
      timelineMap.set(month, (timelineMap.get(month) ?? 0) + 1)
    }
    const timeline = Array.from(timelineMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    res.json({ total, favorites, bySourceType, byAuthor, mostViewed, timeline })
  } catch (err) { next(err) }
})

// GET /api/citations/tags — registered BEFORE /:id
router.get('/tags', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const tags = await prisma.citationTag.findMany({
      where: { citation: { userId } },
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    })
    res.json({ tags: tags.map(t => t.name) })
  } catch (err) { next(err) }
})

// GET /api/citations/:id — increments viewCount
router.get('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }

    const citation = await prisma.citation.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } },
      include: CITATION_INCLUDE,
    })
    res.json({ citation })
  } catch (err) { next(err) }
})

// POST /api/citations
router.post('/', async (req, res, next) => {
  try {
    const { text, author, sourceType, source, bookId, page, chapter, comment, color, favorite, tags } = req.body
    if (!text?.trim()) { res.status(400).json({ error: 'text is required' }); return }

    const citation = await prisma.citation.create({
      data: {
        userId: req.user!.id,
        text: text.trim(),
        author: author || undefined,
        sourceType: sourceType || 'OTHER',
        source: source || undefined,
        bookId: bookId || undefined,
        page: page != null ? Number(page) : undefined,
        chapter: chapter || undefined,
        comment: comment || undefined,
        color: color || '#C4775A',
        favorite: favorite ?? false,
        tags: Array.isArray(tags) && tags.length
          ? { create: tags.map((name: string) => ({ name: name.trim() })) }
          : undefined,
      },
      include: CITATION_INCLUDE,
    })
    res.status(201).json({ citation })
  } catch (err) { next(err) }
})

// PUT /api/citations/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }

    const { text, author, sourceType, source, bookId, page, chapter, comment, color, favorite, tags } = req.body

    const citation = await prisma.citation.update({
      where: { id: req.params.id },
      data: {
        ...(text !== undefined && { text: text.trim() }),
        ...(author !== undefined && { author }),
        ...(sourceType !== undefined && { sourceType }),
        ...(source !== undefined && { source }),
        ...(bookId !== undefined && { bookId: bookId || null }),
        ...(page !== undefined && { page: page != null ? Number(page) : null }),
        ...(chapter !== undefined && { chapter }),
        ...(comment !== undefined && { comment }),
        ...(color !== undefined && { color }),
        ...(favorite !== undefined && { favorite }),
        ...(tags !== undefined && {
          tags: {
            deleteMany: {},
            create: (tags as string[]).map(name => ({ name: name.trim() })),
          },
        }),
      },
      include: CITATION_INCLUDE,
    })
    res.json({ citation })
  } catch (err) { next(err) }
})

// DELETE /api/citations/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }
    await prisma.citation.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// PATCH /api/citations/:id/favorite
router.patch('/:id/favorite', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }
    const citation = await prisma.citation.update({
      where: { id: req.params.id },
      data: { favorite: !existing.favorite },
      include: CITATION_INCLUDE,
    })
    res.json({ citation })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 2: Create `index.ts`**

Create `backend/src/routes/citations/index.ts`:

```ts
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import citationsRouter from './citations'

const router = Router()

router.use(requireAuth)
router.use('/', citationsRouter)

export default router
```

- [ ] **Step 3: Mount in app.ts**

In `backend/src/app.ts`, add after the existing imports:
```ts
import citationsRouter from './routes/citations'
```

And after `app.use('/api/routines', routinesRouter)`:
```ts
app.use('/api/citations', citationsRouter)
```

- [ ] **Step 4: Add book citations route to books.ts**

In `backend/src/routes/reading/books.ts`, add this route **before** `router.get('/:id', ...)` (to avoid `:id` catching `/citations` literally):

```ts
// GET /api/reading/books/:id/citations
router.get('/:id/citations', async (req, res, next) => {
  try {
    const book = await prisma.book.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    })
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const citations = await prisma.citation.findMany({
      where: { bookId: req.params.id },
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ citations, total: citations.length })
  } catch (err) { next(err) }
})
```

- [ ] **Step 5: Verify TypeScript**

```bash
cd backend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/citations/ backend/src/app.ts backend/src/routes/reading/books.ts
git commit -m "feat: add citations backend routes (CRUD + stats + tags + book integration)"
```

---

## Task 3: Backend Tests

**Files:**
- Create: `backend/src/__tests__/citations.test.ts`

- [ ] **Step 1: Write the test file**

Create `backend/src/__tests__/citations.test.ts`:

```ts
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'citations@example.com'
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
  await prisma.citation.deleteMany({ where: { userId } })
})

describe('POST /api/citations', () => {
  it('creates a citation with defaults', async () => {
    const res = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Test quote' })

    expect(res.status).toBe(201)
    expect(res.body.citation.text).toBe('Test quote')
    expect(res.body.citation.sourceType).toBe('OTHER')
    expect(res.body.citation.favorite).toBe(false)
    expect(res.body.citation.viewCount).toBe(0)
    expect(res.body.citation.tags).toEqual([])
  })

  it('creates a citation with tags', async () => {
    const res = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Tagged quote', tags: ['Philo', 'Stoïcisme'] })

    expect(res.status).toBe(201)
    expect(res.body.citation.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['Philo', 'Stoïcisme'])
    )
  })

  it('returns 400 if text is missing', async () => {
    const res = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ author: 'Someone' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/citations')
      .send({ text: 'No auth' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/citations', () => {
  beforeEach(async () => {
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Book quote', sourceType: 'BOOK', author: 'Camus', tags: ['Philo'] })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Internet quote', sourceType: 'INTERNET', favorite: true })
  })

  it('returns all citations', async () => {
    const res = await request(app).get('/api/citations').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(2)
    expect(res.body.total).toBe(2)
  })

  it('filters by sourceType', async () => {
    const res = await request(app)
      .get('/api/citations?sourceType=BOOK')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
    expect(res.body.citations[0].sourceType).toBe('BOOK')
  })

  it('filters by favorite', async () => {
    const res = await request(app)
      .get('/api/citations?favorite=true')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
  })

  it('filters by tag', async () => {
    const res = await request(app)
      .get('/api/citations?tag=Philo')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
  })

  it('searches across text and author', async () => {
    const res = await request(app)
      .get('/api/citations?search=Camus')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
  })
})

describe('GET /api/citations/stats', () => {
  beforeEach(async () => {
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q1', sourceType: 'BOOK', author: 'Camus', favorite: true })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q2', sourceType: 'BOOK', author: 'Camus' })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q3', sourceType: 'INTERNET' })
  })

  it('returns correct totals and bySourceType', async () => {
    const res = await request(app).get('/api/citations/stats').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.total).toBe(3)
    expect(res.body.favorites).toBe(1)
    expect(res.body.bySourceType['BOOK']).toBe(2)
    expect(res.body.bySourceType['INTERNET']).toBe(1)
    expect(res.body.byAuthor[0]).toEqual({ author: 'Camus', count: 2 })
    expect(Array.isArray(res.body.mostViewed)).toBe(true)
    expect(Array.isArray(res.body.timeline)).toBe(true)
  })
})

describe('GET /api/citations/tags', () => {
  beforeEach(async () => {
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Q', tags: ['Philo', 'Stoïcisme'] })
  })

  it('returns distinct tag names', async () => {
    const res = await request(app).get('/api/citations/tags').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.tags).toEqual(expect.arrayContaining(['Philo', 'Stoïcisme']))
  })
})

describe('GET /api/citations/:id', () => {
  it('returns citation and increments viewCount', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'View me' })
    const id = createRes.body.citation.id

    const res1 = await request(app).get(`/api/citations/${id}`).set('Cookie', cookie)
    expect(res1.status).toBe(200)
    expect(res1.body.citation.viewCount).toBe(1)

    const res2 = await request(app).get(`/api/citations/${id}`).set('Cookie', cookie)
    expect(res2.body.citation.viewCount).toBe(2)
  })

  it('returns 404 for unknown id', async () => {
    const res = await request(app).get('/api/citations/unknownid').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/citations/:id', () => {
  it('updates text and tags', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Original', tags: ['Old'] })
    const id = createRes.body.citation.id

    const res = await request(app)
      .put(`/api/citations/${id}`)
      .set('Cookie', cookie)
      .send({ text: 'Updated', tags: ['New'] })

    expect(res.status).toBe(200)
    expect(res.body.citation.text).toBe('Updated')
    expect(res.body.citation.tags.map((t: { name: string }) => t.name)).toEqual(['New'])
  })
})

describe('DELETE /api/citations/:id', () => {
  it('deletes a citation', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Delete me' })
    const id = createRes.body.citation.id

    const res = await request(app).delete(`/api/citations/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('PATCH /api/citations/:id/favorite', () => {
  it('toggles favorite', async () => {
    const createRes = await request(app)
      .post('/api/citations')
      .set('Cookie', cookie)
      .send({ text: 'Fav me', favorite: false })
    const id = createRes.body.citation.id

    const res = await request(app)
      .patch(`/api/citations/${id}/favorite`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citation.favorite).toBe(true)

    const res2 = await request(app)
      .patch(`/api/citations/${id}/favorite`)
      .set('Cookie', cookie)
    expect(res2.body.citation.favorite).toBe(false)
  })
})

describe('GET /api/reading/books/:id/citations', () => {
  it('returns citations linked to a book', async () => {
    const bookRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Test Book', author: 'Author' })
    const bookId = bookRes.body.book.id

    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Book citation', sourceType: 'BOOK', bookId })
    await request(app).post('/api/citations').set('Cookie', cookie)
      .send({ text: 'Unlinked citation' })

    const res = await request(app)
      .get(`/api/reading/books/${bookId}/citations`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.citations.length).toBe(1)
    expect(res.body.citations[0].text).toBe('Book citation')

    await prisma.book.deleteMany({ where: { userId } })
  })
})
```

- [ ] **Step 2: Run the tests**

```bash
cd backend && npx jest citations --runInBand --forceExit
```

Expected: all tests PASS

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/citations.test.ts
git commit -m "test: add citations backend integration tests"
```

---

## Task 4: Module Registration

**Files:**
- Modify: `backend/src/routes/modules.ts`

- [ ] **Step 1: Add citations to the module list**

In `backend/src/routes/modules.ts`, add to the `MODULES` array:

```ts
{ slug: 'citations', name: 'Citations', description: 'Tes citations et extraits', icon: '💬', available: true },
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/routes/modules.ts
git commit -m "feat: register citations module in sidebar"
```

---

## Task 5: Frontend API Client

**Files:**
- Create: `frontend/src/api/citations.ts`

- [ ] **Step 1: Create the API client**

Create `frontend/src/api/citations.ts`:

```ts
import { apiClient } from './client'

export type SourceType =
  | 'BOOK' | 'ARTICLE' | 'INTERNET' | 'PODCAST'
  | 'FILM' | 'SERIES' | 'VIDEO' | 'PERSON' | 'OTHER'

export interface CitationTag {
  id: string
  name: string
}

export interface CitationBook {
  id: string
  title: string
  author: string
  coverUrl?: string
}

export interface Citation {
  id: string
  userId: string
  text: string
  author?: string
  sourceType: SourceType
  source?: string
  bookId?: string
  book?: CitationBook | null
  page?: number
  chapter?: string
  comment?: string
  color: string
  favorite: boolean
  viewCount: number
  tags: CitationTag[]
  createdAt: string
  updatedAt: string
}

export interface CitationStats {
  total: number
  favorites: number
  bySourceType: Partial<Record<SourceType, number>>
  byAuthor: Array<{ author: string; count: number }>
  mostViewed: Citation[]
  timeline: Array<{ month: string; count: number }>
}

export type CitationInput = {
  text: string
  author?: string
  sourceType?: SourceType
  source?: string
  bookId?: string | null
  page?: number | null
  chapter?: string
  comment?: string
  color?: string
  favorite?: boolean
  tags?: string[]
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  BOOK: 'Livre',
  ARTICLE: 'Article',
  INTERNET: 'Internet',
  PODCAST: 'Podcast',
  FILM: 'Film',
  SERIES: 'Série',
  VIDEO: 'Vidéo',
  PERSON: 'Personne',
  OTHER: 'Autre',
}

export const SOURCE_TYPE_ICONS: Record<SourceType, string> = {
  BOOK: '📚',
  ARTICLE: '📰',
  INTERNET: '🌐',
  PODCAST: '🎙️',
  FILM: '🎬',
  SERIES: '📺',
  VIDEO: '▶️',
  PERSON: '🧑',
  OTHER: '💬',
}

export const PRESET_COLORS = [
  '#C4775A', '#7A9E7E', '#5A8AC4', '#9B7EC8',
  '#E5A34A', '#E56464', '#48bb78', '#A89890',
]

export const citationsApi = {
  getAll: (params?: {
    search?: string
    sourceType?: SourceType
    favorite?: boolean
    tag?: string
    bookId?: string
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.sourceType) q.set('sourceType', params.sourceType)
    if (params?.favorite) q.set('favorite', 'true')
    if (params?.tag) q.set('tag', params.tag)
    if (params?.bookId) q.set('bookId', params.bookId)
    const qs = q.toString()
    return apiClient<{ citations: Citation[]; total: number }>(
      `/api/citations${qs ? `?${qs}` : ''}`
    )
  },

  getOne: (id: string) =>
    apiClient<{ citation: Citation }>(`/api/citations/${id}`),

  create: (data: CitationInput) =>
    apiClient<{ citation: Citation }>('/api/citations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CitationInput>) =>
    apiClient<{ citation: Citation }>(`/api/citations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/citations/${id}`, { method: 'DELETE' }),

  toggleFavorite: (id: string) =>
    apiClient<{ citation: Citation }>(`/api/citations/${id}/favorite`, {
      method: 'PATCH',
    }),

  getStats: () =>
    apiClient<CitationStats>('/api/citations/stats'),

  getTags: () =>
    apiClient<{ tags: string[] }>('/api/citations/tags'),

  getByBook: (bookId: string) =>
    apiClient<{ citations: Citation[]; total: number }>(
      `/api/reading/books/${bookId}/citations`
    ),
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/citations.ts
git commit -m "feat: add citations API client types and methods"
```

---

## Task 6: CSS + CitationCard

**Files:**
- Create: `frontend/src/styles/citations.css`
- Create: `frontend/src/components/citations/CitationCard.tsx`

- [ ] **Step 1: Create citations.css**

Create `frontend/src/styles/citations.css`:

```css
/* ========== CITATIONS MODULE ========== */

.citations-container { max-width: 900px; margin: 0 auto; }

/* Tabs */
.citations-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 0;
}
.citations-tab {
  background: none;
  border: none;
  padding: 0.6rem 1.1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
  text-decoration: none;
  display: inline-block;
}
.citations-tab:hover { color: var(--text-primary); }
.citations-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); font-weight: 600; }

/* List header */
.citations-list-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.25rem;
  animation: fadeUp 0.4s ease both;
}
.citations-list-title { font-family: 'Playfair Display', serif; font-size: 2rem; font-weight: 700; color: var(--text-primary); letter-spacing: -0.02em; }
.citations-count { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem; }

/* Toolbar */
.citations-toolbar { display: flex; gap: 0.875rem; margin-bottom: 0.875rem; animation: fadeUp 0.4s ease 0.05s both; }
.citations-search { flex: 1; margin-bottom: 0; }
.citations-filters { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1.25rem; animation: fadeUp 0.4s ease 0.1s both; }
.citations-list { display: flex; flex-direction: column; gap: 0.625rem; }
.citations-empty { text-align: center; padding: 3rem; color: var(--text-muted); }
.citations-loading { display: flex; justify-content: center; padding: 3rem; }

/* Citation Card */
.citation-card {
  display: flex;
  border-radius: var(--radius-md);
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  overflow: hidden;
  cursor: pointer;
  transition: all var(--transition);
  animation: fadeUp 0.4s ease both;
}
.citation-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-medium); }

.citation-card-strip {
  width: 4px;
  flex-shrink: 0;
}

.citation-card-body {
  flex: 1;
  padding: 0.875rem 1.1rem;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.citation-card-text {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 0.9rem;
  color: var(--text-primary);
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.citation-card-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}
.citation-card-meta-left { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.citation-card-author { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
.citation-card-source { font-size: 0.75rem; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px; }
.citation-card-meta-right { display: flex; align-items: center; gap: 0.35rem; flex-shrink: 0; }

/* Source badge */
.citation-source-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: #EDE8E3;
  border-radius: 99px;
  padding: 0.15rem 0.5rem;
  font-size: 0.72rem;
  color: #666;
  white-space: nowrap;
}

/* Tags */
.citation-tag {
  display: inline-block;
  background: rgba(196,119,90,0.12);
  color: var(--accent, #C4775A);
  border-radius: 99px;
  padding: 0.15rem 0.5rem;
  font-size: 0.7rem;
}
.citation-tag--more { background: rgba(0,0,0,0.06); color: var(--text-muted); }

/* Favorite button */
.citation-fav-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  color: #ccc;
  padding: 0;
  line-height: 1;
  transition: color 0.15s;
}
.citation-fav-btn.active { color: #E5A34A; }
.citation-fav-btn:hover { color: #E5A34A; }

/* Citation Detail */
.citation-detail { max-width: 720px; margin: 0 auto; }
.citation-detail-back { background: none; border: none; cursor: pointer; color: var(--text-muted); margin-bottom: 1rem; font-size: 0.875rem; }

.citation-detail-quote {
  border-left: 4px solid var(--accent, #C4775A);
  padding: 1rem 1.25rem;
  background: rgba(255,255,255,0.6);
  backdrop-filter: blur(12px);
  border-radius: 0 var(--radius-md) var(--radius-md) 0;
  margin-bottom: 1.25rem;
  animation: fadeUp 0.35s ease both;
}
.citation-detail-text {
  font-family: 'Playfair Display', serif;
  font-style: italic;
  font-size: 1.2rem;
  line-height: 1.7;
  color: var(--text-primary);
}

.citation-detail-meta {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  animation: fadeUp 0.35s ease 0.05s both;
}
.citation-detail-author {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--text-primary);
}
.citation-detail-source-text {
  font-size: 0.85rem;
  color: var(--text-muted);
}
.citation-detail-location {
  font-size: 0.78rem;
  color: var(--text-muted);
  background: #EDE8E3;
  border-radius: 99px;
  padding: 0.2rem 0.6rem;
}

.citation-detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.375rem;
  margin-bottom: 1.25rem;
  animation: fadeUp 0.35s ease 0.08s both;
}
.citation-detail-tag {
  background: rgba(196,119,90,0.12);
  color: var(--accent, #C4775A);
  border-radius: 99px;
  padding: 0.25rem 0.75rem;
  font-size: 0.78rem;
}

.citation-detail-section { margin-bottom: 1.25rem; animation: fadeUp 0.35s ease 0.1s both; }
.citation-detail-section-title { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem; }
.citation-detail-comment { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; }

.citation-detail-book-link {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: inherit;
  transition: all var(--transition);
}
.citation-detail-book-link:hover { transform: translateY(-1px); box-shadow: var(--shadow-medium); }
.citation-detail-book-cover {
  width: 36px;
  height: 52px;
  border-radius: 3px;
  object-fit: cover;
  background: #EDE8E3;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.25rem;
  flex-shrink: 0;
}
.citation-detail-book-info { flex: 1; }
.citation-detail-book-title { font-weight: 600; font-size: 0.88rem; color: var(--text-primary); }
.citation-detail-book-author { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.15rem; }

.citation-detail-actions { display: flex; gap: 0.75rem; margin-top: 1.5rem; }

/* Form */
.citation-form-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.citation-form-modal {
  background: var(--bg-base, #faf8f5);
  border-radius: var(--radius-lg, 16px);
  padding: 2rem;
  max-width: 560px; width: 90vw;
  max-height: 90vh; overflow-y: auto;
  animation: fadeUp 0.25s ease both;
  box-shadow: 0 8px 40px rgba(0,0,0,0.18);
}
.citation-form-title { font-family: 'Playfair Display', serif; font-size: 1.5rem; margin-bottom: 1.5rem; color: var(--text-primary); }
.citation-form-row { margin-bottom: 1.1rem; }
.citation-form-label { display: block; font-size: 0.8rem; font-weight: 500; margin-bottom: 0.4rem; color: var(--text-secondary); }
.citation-form-error { color: #e56464; font-size: 0.82rem; margin-bottom: 0.75rem; }

/* Book search dropdown */
.book-search-results {
  position: absolute;
  top: 100%;
  left: 0; right: 0;
  background: var(--bg-base, #faf8f5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-medium);
  z-index: 10;
  max-height: 200px;
  overflow-y: auto;
}
.book-search-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.85rem;
  transition: background 0.1s;
}
.book-search-item:hover { background: rgba(0,0,0,0.04); }
.book-search-item-title { font-weight: 500; color: var(--text-primary); }
.book-search-item-author { font-size: 0.75rem; color: var(--text-muted); }

/* Tag input */
.tag-input-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.6rem;
  background: rgba(255,255,255,0.5);
  cursor: text;
  position: relative;
}
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  background: rgba(196,119,90,0.15);
  color: var(--accent, #C4775A);
  border-radius: 99px;
  padding: 0.15rem 0.5rem;
  font-size: 0.78rem;
}
.tag-chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  color: inherit;
  font-size: 0.85rem;
  line-height: 1;
}
.tag-input-field {
  border: none;
  outline: none;
  background: none;
  font-size: 0.85rem;
  font-family: 'DM Sans', sans-serif;
  min-width: 80px;
  flex: 1;
}
.tag-suggestions {
  position: absolute;
  top: 100%;
  left: 0; right: 0;
  background: var(--bg-base, #faf8f5);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-medium);
  z-index: 10;
  max-height: 150px;
  overflow-y: auto;
}
.tag-suggestion-item {
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  font-size: 0.82rem;
  color: var(--text-secondary);
}
.tag-suggestion-item:hover { background: rgba(0,0,0,0.04); }

/* Source type button group */
.source-type-grid { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.source-type-btn {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.7rem;
  border: 1px solid var(--glass-border);
  border-radius: 99px;
  background: rgba(255,255,255,0.5);
  cursor: pointer;
  font-size: 0.78rem;
  font-family: 'DM Sans', sans-serif;
  color: var(--text-secondary);
  transition: all 0.15s;
}
.source-type-btn:hover { border-color: var(--accent); color: var(--accent); }
.source-type-btn.active { background: var(--accent); color: white; border-color: var(--accent); }

/* Stats */
.citations-stats-panel {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 1.5rem;
  animation: fadeUp 0.4s ease both;
}
.citations-stat-card {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  text-align: center;
}
.citations-stat-value { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); }
.citations-stat-label { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; }

.citations-stats-section { margin-bottom: 1.5rem; animation: fadeUp 0.4s ease 0.05s both; }
.citations-stats-section-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; margin-bottom: 0.75rem; color: var(--text-primary); }
.citations-stats-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--glass-border);
  font-size: 0.85rem;
}
.citations-stats-row:last-child { border-bottom: none; }
.citations-stats-row-label { flex: 1; color: var(--text-secondary); }
.citations-stats-row-count { font-weight: 600; color: var(--text-primary); }
```

- [ ] **Step 2: Import CSS in main.tsx**

In `frontend/src/main.tsx` (or wherever other CSS is imported), add:
```ts
import './styles/citations.css'
```

_Check how other CSS files are imported — follow the same pattern. If they are imported in their respective page files, add the import to `CitationsPage.tsx` in Task 9 instead and skip this step._

- [ ] **Step 3: Create CitationCard.tsx**

Create `frontend/src/components/citations/CitationCard.tsx`:

```tsx
import type { Citation } from '../../api/citations'
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from '../../api/citations'

interface CitationCardProps {
  citation: Citation
  onClick: () => void
  onFavoriteToggle: (id: string) => void
}

export function CitationCard({ citation, onClick, onFavoriteToggle }: CitationCardProps) {
  const visibleTags = citation.tags.slice(0, 3)
  const extraCount = citation.tags.length - visibleTags.length

  return (
    <div className="citation-card" onClick={onClick}>
      <div className="citation-card-strip" style={{ background: citation.color }} />
      <div className="citation-card-body">
        <div className="citation-card-text">
          «&nbsp;{citation.text}&nbsp;»
        </div>
        <div className="citation-card-meta">
          <div className="citation-card-meta-left">
            {citation.author && (
              <span className="citation-card-author">{citation.author}</span>
            )}
            <span className="citation-source-badge">
              {SOURCE_TYPE_ICONS[citation.sourceType]}&nbsp;{SOURCE_TYPE_LABELS[citation.sourceType]}
            </span>
            {citation.source && (
              <span className="citation-card-source">{citation.source}</span>
            )}
          </div>
          <div className="citation-card-meta-right">
            {visibleTags.map(t => (
              <span key={t.id} className="citation-tag">{t.name}</span>
            ))}
            {extraCount > 0 && (
              <span className="citation-tag citation-tag--more">+{extraCount}</span>
            )}
            <button
              className={`citation-fav-btn${citation.favorite ? ' active' : ''}`}
              onClick={e => { e.stopPropagation(); onFavoriteToggle(citation.id) }}
              title={citation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              {citation.favorite ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/citations.css frontend/src/components/citations/CitationCard.tsx frontend/src/main.tsx
git commit -m "feat: add citations CSS and CitationCard component"
```

---

## Task 7: CitationForm Modal

**Files:**
- Create: `frontend/src/components/citations/CitationForm.tsx`

- [ ] **Step 1: Create CitationForm.tsx**

Create `frontend/src/components/citations/CitationForm.tsx`:

```tsx
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Citation, CitationInput, SourceType } from '../../api/citations'
import { citationsApi, SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS, PRESET_COLORS } from '../../api/citations'
import { readingApi, type Book } from '../../api/reading'

const SOURCE_TYPES: SourceType[] = [
  'BOOK', 'ARTICLE', 'INTERNET', 'PODCAST', 'FILM', 'SERIES', 'VIDEO', 'PERSON', 'OTHER',
]

interface CitationFormProps {
  initial?: Partial<Citation>
  defaultBookId?: string
  onSave: (data: CitationInput) => Promise<void>
  onClose: () => void
}

export function CitationForm({ initial, defaultBookId, onSave, onClose }: CitationFormProps) {
  const [text, setText] = useState(initial?.text ?? '')
  const [author, setAuthor] = useState(initial?.author ?? '')
  const [sourceType, setSourceType] = useState<SourceType>(initial?.sourceType ?? 'OTHER')
  const [source, setSource] = useState(initial?.source ?? '')
  const [bookId, setBookId] = useState<string | null>(initial?.bookId ?? defaultBookId ?? null)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookSearch, setBookSearch] = useState(initial?.book?.title ?? '')
  const [bookResults, setBookResults] = useState<Book[]>([])
  const [showBookResults, setShowBookResults] = useState(false)
  const [page, setPage] = useState<string>(initial?.page != null ? String(initial.page) : '')
  const [chapter, setChapter] = useState(initial?.chapter ?? '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [tags, setTags] = useState<string[]>(initial?.tags?.map(t => (typeof t === 'string' ? t : t.name)) ?? [])
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [color, setColor] = useState(initial?.color ?? '#C4775A')
  const [favorite, setFavorite] = useState(initial?.favorite ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bookSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    citationsApi.getTags().then(d => setAllTags(d.tags)).catch(() => {})
  }, [])

  const searchBooks = useCallback((q: string) => {
    if (bookSearchRef.current) clearTimeout(bookSearchRef.current)
    if (!q.trim()) { setBookResults([]); setShowBookResults(false); return }
    bookSearchRef.current = setTimeout(async () => {
      try {
        const d = await readingApi.getBooks({ search: q })
        setBookResults(d.books.slice(0, 6))
        setShowBookResults(true)
      } catch {}
    }, 300)
  }, [])

  function handleBookSearchChange(val: string) {
    setBookSearch(val)
    if (!val) { setBookId(null); setSelectedBook(null) }
    searchBooks(val)
  }

  function selectBook(book: Book) {
    setBookId(book.id)
    setSelectedBook(book)
    setBookSearch(book.title)
    setSource(book.title)
    setAuthor(a => a || book.author)
    setShowBookResults(false)
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().replace(/,$/, '')
      if (newTag && !tags.includes(newTag)) {
        setTags(prev => [...prev, newTag])
      }
      setTagInput('')
      setTagSuggestions([])
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  function handleTagInputChange(val: string) {
    setTagInput(val)
    if (val.trim()) {
      setTagSuggestions(
        allTags.filter(t => t.toLowerCase().includes(val.toLowerCase()) && !tags.includes(t))
      )
    } else {
      setTagSuggestions([])
    }
  }

  function addSuggestion(tag: string) {
    if (!tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagInput('')
    setTagSuggestions([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) { setError('Le texte de la citation est requis'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        text: text.trim(),
        author: author || undefined,
        sourceType,
        source: source || undefined,
        bookId: bookId || null,
        page: page ? Number(page) : null,
        chapter: chapter || undefined,
        comment: comment || undefined,
        color,
        favorite,
        tags,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="citation-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="citation-form-modal">
        <div className="citation-form-title">
          {initial?.id ? 'Modifier la citation' : 'Nouvelle citation'}
        </div>
        <form onSubmit={handleSubmit}>

          {/* Texte */}
          <div className="citation-form-row">
            <label className="citation-form-label">Texte *</label>
            <textarea
              className="input-field"
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="« La meilleure façon de prédire l'avenir est de l'inventer. »"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Auteur */}
          <div className="citation-form-row">
            <label className="citation-form-label">Auteur</label>
            <input
              className="input-field"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Alan Kay"
            />
          </div>

          {/* Type de source */}
          <div className="citation-form-row">
            <label className="citation-form-label">Type de source</label>
            <div className="source-type-grid">
              {SOURCE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`source-type-btn${sourceType === t ? ' active' : ''}`}
                  onClick={() => setSourceType(t)}
                >
                  {SOURCE_TYPE_ICONS[t]} {SOURCE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {/* Source (conditionnel) */}
          {sourceType === 'BOOK' ? (
            <div className="citation-form-row">
              <label className="citation-form-label">Livre</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  value={bookSearch}
                  onChange={e => handleBookSearchChange(e.target.value)}
                  placeholder="Rechercher dans ta bibliothèque…"
                  onFocus={() => bookSearch && setShowBookResults(true)}
                />
                {showBookResults && bookResults.length > 0 && (
                  <div className="book-search-results">
                    {bookResults.map(b => (
                      <div key={b.id} className="book-search-item" onClick={() => selectBook(b)}>
                        <div>
                          <div className="book-search-item-title">{b.title}</div>
                          <div className="book-search-item-author">{b.author}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedBook && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  ✓ Lié à <strong>{selectedBook.title}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="citation-form-row">
              <label className="citation-form-label">Source</label>
              <input
                className="input-field"
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="Titre de l'article, nom du podcast…"
              />
            </div>
          )}

          {/* Page + Chapitre (BOOK seulement) */}
          {sourceType === 'BOOK' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="citation-form-row" style={{ flex: 1 }}>
                <label className="citation-form-label">Page</label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={page}
                  onChange={e => setPage(e.target.value)}
                  placeholder="42"
                />
              </div>
              <div className="citation-form-row" style={{ flex: 1 }}>
                <label className="citation-form-label">Chapitre</label>
                <input
                  className="input-field"
                  value={chapter}
                  onChange={e => setChapter(e.target.value)}
                  placeholder="III"
                />
              </div>
            </div>
          )}

          {/* Commentaire */}
          <div className="citation-form-row">
            <label className="citation-form-label">Commentaire personnel</label>
            <textarea
              className="input-field"
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Ce que tu retiens, les liens avec d'autres idées…"
              style={{ resize: 'vertical' }}
            />
          </div>

          {/* Tags */}
          <div className="citation-form-row">
            <label className="citation-form-label">Tags</label>
            <div className="tag-input-wrap" onClick={() => document.getElementById('tag-input-field')?.focus()}>
              {tags.map(t => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" className="tag-chip-remove" onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                </span>
              ))}
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  id="tag-input-field"
                  className="tag-input-field"
                  value={tagInput}
                  onChange={e => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={tags.length === 0 ? 'Philo, Stoïcisme…' : ''}
                />
                {tagSuggestions.length > 0 && (
                  <div className="tag-suggestions">
                    {tagSuggestions.map(s => (
                      <div key={s} className="tag-suggestion-item" onClick={() => addSuggestion(s)}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Couleur */}
          <div className="citation-form-row">
            <label className="citation-form-label">Couleur de la bande</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    cursor: 'pointer', border: `2px solid ${color === c ? 'rgba(0,0,0,0.35)' : 'transparent'}`,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.1s',
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Favori */}
          <div className="citation-form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />
              Marquer comme favori
            </label>
          </div>

          {error && <div className="citation-form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost form-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary form-btn" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/citations/CitationForm.tsx
git commit -m "feat: add CitationForm modal with book search and tag autocomplete"
```

---

## Task 8: CitationList Page

**Files:**
- Create: `frontend/src/pages/citations/CitationList.tsx`

- [ ] **Step 1: Create CitationList.tsx**

Create `frontend/src/pages/citations/CitationList.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { citationsApi, type Citation, type SourceType, SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from '../../api/citations'
import { CitationCard } from '../../components/citations/CitationCard'
import { CitationForm } from '../../components/citations/CitationForm'

const SOURCE_FILTERS: Array<{ value: SourceType | ''; label: string }> = [
  { value: '', label: 'Toutes' },
  { value: 'BOOK', label: '📚 Livres' },
  { value: 'ARTICLE', label: '📰 Articles' },
  { value: 'INTERNET', label: '🌐 Internet' },
  { value: 'PODCAST', label: '🎙️ Podcasts' },
  { value: 'FILM', label: '🎬 Films' },
  { value: 'SERIES', label: '📺 Séries' },
  { value: 'VIDEO', label: '▶️ Vidéos' },
  { value: 'PERSON', label: '🧑 Personnes' },
]

export function CitationList() {
  const [citations, setCitations] = useState<Citation[]>([])
  const [search, setSearch] = useState('')
  const [sourceFilter, setSourceFilter] = useState<SourceType | ''>('')
  const [favoriteOnly, setFavoriteOnly] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params: Parameters<typeof citationsApi.getAll>[0] = {}
      if (search) params.search = search
      if (sourceFilter) params.sourceType = sourceFilter as SourceType
      if (favoriteOnly) params.favorite = true
      const data = await citationsApi.getAll(params)
      setCitations(data.citations)
    } finally {
      setLoading(false)
    }
  }, [search, sourceFilter, favoriteOnly])

  useEffect(() => { load() }, [load])

  async function handleFavoriteToggle(id: string) {
    try {
      const { citation } = await citationsApi.toggleFavorite(id)
      setCitations(prev => prev.map(c => c.id === id ? citation : c))
    } catch {}
  }

  return (
    <div className="citations-container">
      <header className="citations-list-header">
        <div>
          <h1 className="citations-list-title">Citations</h1>
          <p className="citations-count">
            {citations.length} citation{citations.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button className="btn btn-primary" style={{ width: 'auto', padding: '0.65rem 1.25rem' }} onClick={() => setShowForm(true)}>
          + Ajouter
        </button>
      </header>

      <div className="citations-toolbar">
        <input
          className="input-field citations-search"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button
          className={`btn${favoriteOnly ? ' btn-primary' : ' btn-secondary'}`}
          style={{ width: 'auto', padding: '0.6rem 0.875rem', flexShrink: 0 }}
          onClick={() => setFavoriteOnly(f => !f)}
          title="Favoris uniquement"
        >
          {favoriteOnly ? '★' : '☆'}
        </button>
      </div>

      <div className="citations-filters">
        {SOURCE_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip${sourceFilter === f.value ? ' filter-chip--active' : ''}`}
            onClick={() => setSourceFilter(f.value as SourceType | '')}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="citations-loading"><div className="loading-spinner" /></div>
      ) : citations.length === 0 ? (
        <div className="citations-empty">
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
          <p>{search || sourceFilter || favoriteOnly ? 'Aucune citation trouvée.' : 'Aucune citation. Ajoutez-en une !'}</p>
          {!search && !sourceFilter && !favoriteOnly && (
            <button className="btn btn-primary" style={{ marginTop: '1rem', width: 'auto', padding: '0.65rem 1.25rem' }} onClick={() => setShowForm(true)}>
              Ajouter ma première citation
            </button>
          )}
        </div>
      ) : (
        <div className="citations-list">
          {citations.map(c => (
            <CitationCard
              key={c.id}
              citation={c}
              onClick={() => navigate(`/citations/${c.id}`)}
              onFavoriteToggle={handleFavoriteToggle}
            />
          ))}
        </div>
      )}

      {showForm && (
        <CitationForm
          onSave={async data => {
            await citationsApi.create(data)
            await load()
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/citations/CitationList.tsx
git commit -m "feat: add CitationList page with search and source type filters"
```

---

## Task 9: CitationDetail Page

**Files:**
- Create: `frontend/src/pages/citations/CitationDetail.tsx`

- [ ] **Step 1: Create CitationDetail.tsx**

Create `frontend/src/pages/citations/CitationDetail.tsx`:

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { citationsApi, type Citation, SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from '../../api/citations'
import { CitationForm } from '../../components/citations/CitationForm'

export function CitationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [citation, setCitation] = useState<Citation | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await citationsApi.getOne(id)
      setCitation(data.citation)
    } catch {
      navigate('/citations/list')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!id || !citation || !confirm('Supprimer cette citation définitivement ?')) return
    await citationsApi.delete(id)
    navigate('/citations/list')
  }

  async function handleFavoriteToggle() {
    if (!id) return
    const { citation: updated } = await citationsApi.toggleFavorite(id)
    setCitation(updated)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
  if (!citation) return null

  const locationParts = [
    citation.chapter ? `Ch. ${citation.chapter}` : null,
    citation.page ? `p. ${citation.page}` : null,
  ].filter(Boolean).join(' · ')

  return (
    <div className="citation-detail">
      <button className="citation-detail-back" onClick={() => navigate('/citations/list')}>
        ← Citations
      </button>

      {/* Quote block */}
      <div
        className="citation-detail-quote"
        style={{ borderLeftColor: citation.color }}
      >
        <div className="citation-detail-text">«&nbsp;{citation.text}&nbsp;»</div>
      </div>

      {/* Meta row */}
      <div className="citation-detail-meta">
        {citation.author && (
          <span className="citation-detail-author">{citation.author}</span>
        )}
        <span className="citation-source-badge">
          {SOURCE_TYPE_ICONS[citation.sourceType]}&nbsp;{SOURCE_TYPE_LABELS[citation.sourceType]}
        </span>
        {citation.source && (
          <span className="citation-detail-source-text">{citation.source}</span>
        )}
        {locationParts && (
          <span className="citation-detail-location">{locationParts}</span>
        )}
        <button
          onClick={handleFavoriteToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem', color: citation.favorite ? '#E5A34A' : '#ccc' }}
          title={citation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          {citation.favorite ? '★' : '☆'}
        </button>
      </div>

      {/* Tags */}
      {citation.tags.length > 0 && (
        <div className="citation-detail-tags">
          {citation.tags.map(t => (
            <span key={t.id} className="citation-detail-tag">{t.name}</span>
          ))}
        </div>
      )}

      {/* Comment */}
      {citation.comment && (
        <div className="citation-detail-section">
          <div className="citation-detail-section-title">Mon commentaire</div>
          <div className="citation-detail-comment">{citation.comment}</div>
        </div>
      )}

      {/* Book link */}
      {citation.book && (
        <div className="citation-detail-section">
          <div className="citation-detail-section-title">Livre lié</div>
          <Link to={`/reading/books/${citation.book.id}`} className="citation-detail-book-link">
            <div className="citation-detail-book-cover">
              {citation.book.coverUrl
                ? <img src={citation.book.coverUrl} alt={citation.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
                : '📚'}
            </div>
            <div className="citation-detail-book-info">
              <div className="citation-detail-book-title">{citation.book.title}</div>
              <div className="citation-detail-book-author">{citation.book.author}</div>
            </div>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>→</span>
          </Link>
        </div>
      )}

      {/* Actions */}
      <div className="citation-detail-actions">
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.6rem 1.25rem' }} onClick={() => setShowEdit(true)}>
          Modifier
        </button>
        <button
          onClick={handleDelete}
          style={{ background: '#e56464', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.875rem', cursor: 'pointer', fontSize: '0.875rem' }}
        >
          Supprimer
        </button>
      </div>

      {showEdit && (
        <CitationForm
          initial={citation}
          onSave={async data => {
            await citationsApi.update(citation.id, data)
            await load()
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/citations/CitationDetail.tsx
git commit -m "feat: add CitationDetail page"
```

---

## Task 10: CitationStatsPanel

**Files:**
- Create: `frontend/src/components/citations/CitationStatsPanel.tsx`

- [ ] **Step 1: Create CitationStatsPanel.tsx**

Create `frontend/src/components/citations/CitationStatsPanel.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { citationsApi, type CitationStats, SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS, type SourceType } from '../../api/citations'

export function CitationStatsPanel() {
  const [stats, setStats] = useState<CitationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    citationsApi.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
  if (!stats) return null

  const sourceTypeEntries = Object.entries(stats.bySourceType) as [SourceType, number][]

  return (
    <div className="citations-container">
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', marginBottom: '1.5rem', animation: 'fadeUp 0.4s ease both' }}>
        Statistiques
      </h1>

      {/* Top stat cards */}
      <div className="citations-stats-panel">
        <div className="citations-stat-card">
          <div className="citations-stat-value">{stats.total}</div>
          <div className="citations-stat-label">Citations</div>
        </div>
        <div className="citations-stat-card">
          <div className="citations-stat-value">{stats.favorites}</div>
          <div className="citations-stat-label">Favoris</div>
        </div>
        <div className="citations-stat-card">
          <div className="citations-stat-value">{Object.keys(stats.bySourceType).length}</div>
          <div className="citations-stat-label">Types de source</div>
        </div>
      </div>

      {/* By source type */}
      {sourceTypeEntries.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Par type de source</div>
          {sourceTypeEntries
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="citations-stats-row">
                <span className="citations-stats-row-label">
                  {SOURCE_TYPE_ICONS[type]} {SOURCE_TYPE_LABELS[type]}
                </span>
                <span className="citations-stats-row-count">{count}</span>
              </div>
            ))}
        </div>
      )}

      {/* Top authors */}
      {stats.byAuthor.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Top auteurs</div>
          {stats.byAuthor.slice(0, 5).map(({ author, count }) => (
            <div key={author} className="citations-stats-row">
              <span className="citations-stats-row-label">{author}</span>
              <span className="citations-stats-row-count">{count}</span>
            </div>
          ))}
        </div>
      )}

      {/* Most viewed */}
      {stats.mostViewed.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Citations les plus consultées</div>
          {stats.mostViewed.map(c => (
            <div
              key={c.id}
              className="citations-stats-row"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/citations/${c.id}`)}
            >
              <span className="citations-stats-row-label" style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                «&nbsp;{c.text}&nbsp;»
              </span>
              <span className="citations-stats-row-count">{c.viewCount} vues</span>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {stats.timeline.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Évolution mensuelle</div>
          {stats.timeline.map(({ month, count }) => (
            <div key={month} className="citations-stats-row">
              <span className="citations-stats-row-label">{month}</span>
              <span className="citations-stats-row-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/citations/CitationStatsPanel.tsx
git commit -m "feat: add CitationStatsPanel"
```

---

## Task 11: CitationsPage + Routing

**Files:**
- Create: `frontend/src/pages/citations/CitationsPage.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create CitationsPage.tsx**

Create `frontend/src/pages/citations/CitationsPage.tsx`:

```tsx
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { CitationList } from './CitationList'
import { CitationDetail } from './CitationDetail'
import { CitationStatsPanel } from '../../components/citations/CitationStatsPanel'
import '../../styles/citations.css'

const TABS = [
  { to: '/citations/list', label: 'Liste' },
  { to: '/citations/stats', label: 'Statistiques' },
]

const TAB_SLUGS = ['list', 'stats']

export function CitationsPage() {
  const location = useLocation()
  const segment = location.pathname.split('/')[2]
  const isDetail = !!segment && !TAB_SLUGS.includes(segment)

  return (
    <div>
      {!isDetail && (
        <div className="citations-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `citations-tab${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      )}
      <Routes>
        <Route index element={<Navigate to="list" replace />} />
        <Route path="list" element={<CitationList />} />
        <Route path="stats" element={<CitationStatsPanel />} />
        <Route path=":id" element={<CitationDetail />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 2: Add /citations route to App.tsx**

In `frontend/src/App.tsx`, add import:
```ts
import { CitationsPage } from './pages/citations/CitationsPage'
```

Add route after the `/routines/*` route block:
```tsx
<Route
  path="/citations/*"
  element={
    <ProtectedRoute>
      <AppLayout>
        <CitationsPage />
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 3: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/citations/CitationsPage.tsx frontend/src/App.tsx
git commit -m "feat: add CitationsPage router and /citations/* route"
```

---

## Task 12: BookDetail Integration

**Files:**
- Modify: `frontend/src/pages/reading/BookDetail.tsx`

The current BookDetail has no tab bar — sections are stacked vertically. This task adds a three-tab bar (`Informations | Notes (N) | Citations (N)`) at the top of the right column, moves the existing notes section into its tab, and adds a Citations tab.

- [ ] **Step 1: Update BookDetail.tsx**

In `frontend/src/pages/reading/BookDetail.tsx`:

**Add imports** at the top:
```ts
import { citationsApi, type Citation } from '../../api/citations'
import { CitationCard } from '../../components/citations/CitationCard'
import { CitationForm } from '../../components/citations/CitationForm'
```

**Add state variables** inside the component (after existing state):
```ts
const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'citations'>('info')
const [citations, setCitations] = useState<Citation[]>([])
const [citationsLoaded, setCitationsLoaded] = useState(false)
const [showCitationForm, setShowCitationForm] = useState(false)
```

**Add citations loader** (call when switching to citations tab):
```ts
async function loadCitations() {
  if (!book || citationsLoaded) return
  try {
    const data = await citationsApi.getByBook(book.id)
    setCitations(data.citations)
    setCitationsLoaded(true)
  } catch {}
}

function handleTabChange(tab: 'info' | 'notes' | 'citations') {
  setActiveTab(tab)
  if (tab === 'citations') loadCitations()
}
```

**Add favorite toggle for citation cards**:
```ts
async function handleCitationFavoriteToggle(citationId: string) {
  const { citation } = await citationsApi.toggleFavorite(citationId)
  setCitations(prev => prev.map(c => c.id === citationId ? citation : c))
}
```

**Replace the right column content** in the JSX. Find the `<div className="book-detail-right">` block and replace its inner content with:

```tsx
<h1 className="book-detail-title">{book.title}</h1>
<div className="book-detail-author">{book.author}</div>

<div className="chips-row">
  <BookStatusBadge status={book.status} />
  {book.genres.map(g => <span key={g} className="chip">{g}</span>)}
  {book.tags.map(t => <span key={t.id} className="chip">{t.name}</span>)}
</div>

{book.isbn && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ISBN: {book.isbn}</div>}
{book.pageCount && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{book.pageCount} pages</div>}

{/* Tab bar */}
<div className="routines-tabs" style={{ marginTop: '1.25rem' }}>
  <button
    className={`routines-tab${activeTab === 'info' ? ' active' : ''}`}
    onClick={() => handleTabChange('info')}
  >
    Informations
  </button>
  <button
    className={`routines-tab${activeTab === 'notes' ? ' active' : ''}`}
    onClick={() => handleTabChange('notes')}
  >
    Notes {notes.length > 0 && `(${notes.length})`}
  </button>
  <button
    className={`routines-tab${activeTab === 'citations' ? ' active' : ''}`}
    onClick={() => handleTabChange('citations')}
  >
    Citations {citationsLoaded && citations.length > 0 && `(${citations.length})`}
  </button>
</div>

{/* Informations tab */}
{activeTab === 'info' && (
  <>
    {book.synopsis && (
      <div className="book-detail-section">
        <div className="book-detail-section-title">Synopsis</div>
        <div className="book-detail-synopsis">{book.synopsis}</div>
      </div>
    )}
    {(book.status === 'READING' || book.currentPage != null) && (
      <div className="book-detail-section">
        <div className="book-detail-section-title">
          Progression {progress != null ? `— ${progress}%` : ''}
        </div>
        <ProgressUpdateForm book={book} onUpdated={setBook} />
      </div>
    )}
    <div className="book-detail-section">
      <div className="book-detail-section-title">Mon avis</div>
      <textarea
        className="input-field"
        rows={4}
        placeholder="Ton avis sur ce livre..."
        value={review}
        onChange={e => setReview(e.target.value)}
        onBlur={saveReview}
        style={{ resize: 'vertical' }}
      />
      {savingReview && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Enregistrement...</div>}
    </div>
  </>
)}

{/* Notes tab */}
{activeTab === 'notes' && (
  <div className="book-detail-section">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
      <div className="book-detail-section-title" style={{ marginBottom: 0 }}>Notes</div>
      <button className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.875rem', fontSize: '0.82rem' }} onClick={() => setShowNoteForm(true)}>
        + Note
      </button>
    </div>
    {notes.length === 0 ? (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune note.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {notes.map(n => (
          <NoteCard
            key={n.id}
            note={n}
            onUpdate={async data => {
              const updated = await readingApi.updateNote(book.id, n.id, data)
              setNotes(prev => prev.map(x => x.id === n.id ? updated.note : x))
            }}
            onDelete={async () => {
              await readingApi.deleteNote(book.id, n.id)
              setNotes(prev => prev.filter(x => x.id !== n.id))
            }}
          />
        ))}
      </div>
    )}
    {showNoteForm && (
      <NoteForm
        onSave={async data => {
          const { note } = await readingApi.createNote(book.id, data)
          setNotes(prev => [note, ...prev])
          setShowNoteForm(false)
        }}
        onClose={() => setShowNoteForm(false)}
      />
    )}
  </div>
)}

{/* Citations tab */}
{activeTab === 'citations' && (
  <div className="book-detail-section" style={{ marginTop: '0.75rem' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
      <div className="book-detail-section-title" style={{ marginBottom: 0 }}>Citations</div>
      <button className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.875rem', fontSize: '0.82rem' }} onClick={() => setShowCitationForm(true)}>
        + Citation
      </button>
    </div>
    {citations.length === 0 ? (
      <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune citation liée à ce livre.</div>
    ) : (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {citations.map(c => (
          <CitationCard
            key={c.id}
            citation={c}
            onClick={() => window.open(`/citations/${c.id}`, '_self')}
            onFavoriteToggle={handleCitationFavoriteToggle}
          />
        ))}
      </div>
    )}
    {showCitationForm && (
      <CitationForm
        defaultBookId={book.id}
        onSave={async data => {
          const { citation } = await citationsApi.create({ ...data, sourceType: 'BOOK', bookId: book.id })
          setCitations(prev => [citation, ...prev])
          setShowCitationForm(false)
        }}
        onClose={() => setShowCitationForm(false)}
      />
    )}
  </div>
)}
```

Also remove the old inline notes/review sections that were previously outside any tab, since they're now inside the tab content.

- [ ] **Step 2: TypeScript check**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/reading/BookDetail.tsx
git commit -m "feat: add Citations tab to BookDetail"
```

---

## Self-Review Checklist

Spec coverage verified:
- [x] CRUD (create, read, update, delete) — Tasks 2, 8, 9
- [x] Favorite toggle — Tasks 2, 8, 9
- [x] Tags with autocomplete — Tasks 2, 7
- [x] Search (text, author, source, comment) — Tasks 2, 8
- [x] Filters (sourceType, favorite, tag, bookId) — Tasks 2, 8
- [x] Book search + link in form — Task 7
- [x] page + chapter fields (BOOK only) — Tasks 2, 7
- [x] Personal comment — Tasks 2, 7, 9
- [x] viewCount increment on GET /:id — Tasks 2, 3
- [x] Stats endpoint (total, favorites, bySourceType, byAuthor, mostViewed, timeline) — Task 2
- [x] Tags endpoint for autocomplete — Task 2
- [x] Colored left-strip card — Tasks 6
- [x] CitationDetail as dedicated page — Task 9
- [x] CitationsPage with Liste/Stats tabs — Task 11
- [x] Module registered in sidebar — Task 4
- [x] BookDetail Citations tab — Task 12
- [x] `/api/reading/books/:id/citations` route — Task 2
- [x] Tests for all backend routes — Task 3
