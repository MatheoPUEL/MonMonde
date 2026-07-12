# Import / Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add JSON export and import (merge) for all four modules (Journal, Reading, Routines, Citations) plus a global "export all" button on the Dashboard.

**Architecture:** Dedicated backend routes `GET /api/export/:module` and `POST /api/import/:module` protected by existing `requireAuth` middleware; frontend calls them via `apiClient` and triggers browser downloads for exports. Import uses client-side JSON parsing to show a count modal, then POSTs the data; the backend runs inserts inside a Prisma transaction with per-module deduplication.

**Tech Stack:** Express/TypeScript (backend), React/TypeScript + Vite (frontend), Prisma (PostgreSQL), supertest (tests)

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `backend/src/routes/export.ts` | Create | All export routes |
| `backend/src/routes/import.ts` | Create | All import routes |
| `backend/src/__tests__/export.test.ts` | Create | Backend export tests |
| `backend/src/__tests__/import.test.ts` | Create | Backend import tests |
| `backend/src/app.ts` | Modify | Register routes + set 10 MB JSON limit |
| `frontend/src/api/export.ts` | Create | `exportModule()` and `exportAll()` helpers |
| `frontend/src/api/import.ts` | Create | `importModule()` helper |
| `frontend/src/components/ui/ImportExportButtons.tsx` | Create | Download + upload icon buttons |
| `frontend/src/components/ui/ImportResultModal.tsx` | Create | Count preview → confirm → result modal |
| `frontend/src/styles/globals.css` | Modify | Minimal styles for new UI components |
| `frontend/src/pages/journal/JournalList.tsx` | Modify | Add `<ImportExportButtons module="journal">` |
| `frontend/src/pages/reading/BookLibrary.tsx` | Modify | Add `<ImportExportButtons module="reading">` |
| `frontend/src/pages/routines/ItemList.tsx` | Modify | Add `<ImportExportButtons module="routines">` |
| `frontend/src/pages/citations/CitationList.tsx` | Modify | Add `<ImportExportButtons module="citations">` |
| `frontend/src/pages/Dashboard.tsx` | Modify | Add "Exporter tout" button |

---

## Task 1 — Backend export routes

**Files:**
- Create: `backend/src/routes/export.ts`
- Create: `backend/src/__tests__/export.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing tests**

```ts
// backend/src/__tests__/export.test.ts
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'export-test@example.com'
let cookie: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Export User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.journalEntry.deleteMany({ where: { userId } })
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.routine.deleteMany({ where: { userId } })
  await prisma.citation.deleteMany({ where: { userId } })
})

describe('GET /api/export/journal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).get('/api/export/journal')
    expect(res.status).toBe(401)
  })

  it('returns version, exportedAt, module, and entries array', async () => {
    await prisma.journalEntry.create({
      data: {
        userId,
        title: 'Test entry',
        content: '{}',
        contentText: 'hello',
        tags: { create: [{ name: 'travel' }] },
      },
    })

    const res = await request(app).get('/api/export/journal').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.version).toBe('1')
    expect(res.body.module).toBe('journal')
    expect(typeof res.body.exportedAt).toBe('string')
    expect(Array.isArray(res.body.entries)).toBe(true)
    expect(res.body.entries).toHaveLength(1)
    expect(res.body.entries[0].title).toBe('Test entry')
    expect(res.body.entries[0].tags).toEqual(['travel'])
  })

  it('only returns data belonging to the authenticated user', async () => {
    const resB = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other User', email: 'export-other@example.com', password: 'password123' })
    const cookieB = (resB.headers['set-cookie'] as unknown as string[])[0]
    await prisma.journalEntry.create({ data: { userId: resB.body.user.id, title: 'Other', content: '{}', contentText: '' } })

    const res = await request(app).get('/api/export/journal').set('Cookie', cookie)
    expect(res.body.entries).toHaveLength(0)

    await prisma.user.delete({ where: { email: 'export-other@example.com' } })
  })
})

describe('GET /api/export/reading', () => {
  it('returns books with nested tags and notes', async () => {
    await prisma.book.create({
      data: {
        userId,
        title: 'Dune',
        author: 'Frank Herbert',
        status: 'FINISHED',
        tags: { create: [{ name: 'scifi' }] },
        notes: { create: [{ title: 'Chapter 1', content: 'Great start' }] },
      },
    })

    const res = await request(app).get('/api/export/reading').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('reading')
    expect(res.body.books).toHaveLength(1)
    expect(res.body.books[0].tags).toEqual(['scifi'])
    expect(res.body.books[0].notes).toHaveLength(1)
    expect(res.body.books[0].notes[0].title).toBe('Chapter 1')
  })
})

describe('GET /api/export/routines', () => {
  it('returns routines with nested completions', async () => {
    const routine = await prisma.routine.create({
      data: {
        userId,
        name: 'Morning run',
        rruleString: 'FREQ=DAILY',
        completions: {
          create: [{ date: new Date('2026-01-01'), done: true }],
        },
      },
    })

    const res = await request(app).get('/api/export/routines').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('routines')
    expect(res.body.routines).toHaveLength(1)
    expect(res.body.routines[0].completions).toHaveLength(1)
  })
})

describe('GET /api/export/citations', () => {
  it('returns citations with tags', async () => {
    await prisma.citation.create({
      data: {
        userId,
        text: 'To be or not to be',
        author: 'Shakespeare',
        tags: { create: [{ name: 'classic' }] },
      },
    })

    const res = await request(app).get('/api/export/citations').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('citations')
    expect(res.body.citations).toHaveLength(1)
    expect(res.body.citations[0].tags).toEqual(['classic'])
  })
})

describe('GET /api/export/all', () => {
  it('returns all modules in a single payload', async () => {
    const res = await request(app).get('/api/export/all').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.module).toBe('all')
    expect(Array.isArray(res.body.journal.entries)).toBe(true)
    expect(Array.isArray(res.body.reading.books)).toBe(true)
    expect(Array.isArray(res.body.routines.routines)).toBe(true)
    expect(Array.isArray(res.body.citations.citations)).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd backend && npx jest --testPathPattern="export.test" --no-coverage
```
Expected: FAIL — routes do not exist yet.

- [ ] **Step 3: Create the export route file**

```ts
// backend/src/routes/export.ts
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()
router.use(requireAuth)

function now() {
  return new Date().toISOString()
}

router.get('/journal', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const entries = await prisma.journalEntry.findMany({
      where: { userId },
      include: { tags: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'journal',
      entries: entries.map(e => ({
        id: e.id,
        title: e.title,
        content: e.content,
        contentText: e.contentText,
        mood: e.mood,
        favorite: e.favorite,
        pinned: e.pinned,
        draft: e.draft,
        tags: e.tags.map(t => t.name),
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    })
  } catch (err) { next(err) }
})

router.get('/reading', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const books = await prisma.book.findMany({
      where: { userId },
      include: { tags: true, notes: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'reading',
      books: books.map(b => ({
        id: b.id,
        title: b.title,
        author: b.author,
        synopsis: b.synopsis,
        isbn: b.isbn,
        pageCount: b.pageCount,
        genres: b.genres,
        coverUrl: b.coverUrl,
        coverType: b.coverType,
        googleBooksId: b.googleBooksId,
        status: b.status,
        owned: b.owned,
        rating: b.rating,
        review: b.review,
        favorite: b.favorite,
        rereadCount: b.rereadCount,
        currentPage: b.currentPage,
        startedAt: b.startedAt?.toISOString() ?? null,
        finishedAt: b.finishedAt?.toISOString() ?? null,
        tags: b.tags.map(t => t.name),
        notes: b.notes.map(n => ({
          id: n.id,
          title: n.title,
          content: n.content,
          chapter: n.chapter,
          page: n.page,
          createdAt: n.createdAt.toISOString(),
          updatedAt: n.updatedAt.toISOString(),
        })),
        createdAt: b.createdAt.toISOString(),
        updatedAt: b.updatedAt.toISOString(),
      })),
    })
  } catch (err) { next(err) }
})

router.get('/routines', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const routines = await prisma.routine.findMany({
      where: { userId },
      include: { completions: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'routines',
      routines: routines.map(r => ({
        id: r.id,
        name: r.name,
        description: r.description,
        type: r.type,
        category: r.category,
        color: r.color,
        icon: r.icon,
        rruleString: r.rruleString,
        startDate: r.startDate.toISOString(),
        endDate: r.endDate?.toISOString() ?? null,
        active: r.active,
        hasQuantity: r.hasQuantity,
        unit: r.unit,
        targetCount: r.targetCount,
        targetPeriod: r.targetPeriod,
        completions: r.completions.map(c => ({
          date: c.date.toISOString(),
          done: c.done,
          value: c.value,
          note: c.note,
        })),
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
      })),
    })
  } catch (err) { next(err) }
})

router.get('/citations', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const citations = await prisma.citation.findMany({
      where: { userId },
      include: { tags: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'citations',
      citations: citations.map(c => ({
        id: c.id,
        text: c.text,
        author: c.author,
        sourceType: c.sourceType,
        source: c.source,
        page: c.page,
        chapter: c.chapter,
        comment: c.comment,
        color: c.color,
        favorite: c.favorite,
        viewCount: c.viewCount,
        tags: c.tags.map(t => t.name),
        createdAt: c.createdAt.toISOString(),
        updatedAt: c.updatedAt.toISOString(),
      })),
    })
  } catch (err) { next(err) }
})

router.get('/all', async (req, res, next) => {
  try {
    const userId = req.user!.id

    const [entries, books, routines, citations] = await Promise.all([
      prisma.journalEntry.findMany({ where: { userId }, include: { tags: true }, orderBy: { createdAt: 'asc' } }),
      prisma.book.findMany({ where: { userId }, include: { tags: true, notes: true }, orderBy: { createdAt: 'asc' } }),
      prisma.routine.findMany({ where: { userId }, include: { completions: { orderBy: { date: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
      prisma.citation.findMany({ where: { userId }, include: { tags: true }, orderBy: { createdAt: 'asc' } }),
    ])

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'all',
      journal: {
        entries: entries.map(e => ({
          id: e.id, title: e.title, content: e.content, contentText: e.contentText,
          mood: e.mood, favorite: e.favorite, pinned: e.pinned, draft: e.draft,
          tags: e.tags.map(t => t.name),
          createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
        })),
      },
      reading: {
        books: books.map(b => ({
          id: b.id, title: b.title, author: b.author, synopsis: b.synopsis, isbn: b.isbn,
          pageCount: b.pageCount, genres: b.genres, coverUrl: b.coverUrl, coverType: b.coverType,
          googleBooksId: b.googleBooksId, status: b.status, owned: b.owned, rating: b.rating,
          review: b.review, favorite: b.favorite, rereadCount: b.rereadCount,
          currentPage: b.currentPage,
          startedAt: b.startedAt?.toISOString() ?? null, finishedAt: b.finishedAt?.toISOString() ?? null,
          tags: b.tags.map(t => t.name),
          notes: b.notes.map(n => ({ id: n.id, title: n.title, content: n.content, chapter: n.chapter, page: n.page, createdAt: n.createdAt.toISOString(), updatedAt: n.updatedAt.toISOString() })),
          createdAt: b.createdAt.toISOString(), updatedAt: b.updatedAt.toISOString(),
        })),
      },
      routines: {
        routines: routines.map(r => ({
          id: r.id, name: r.name, description: r.description, type: r.type, category: r.category,
          color: r.color, icon: r.icon, rruleString: r.rruleString,
          startDate: r.startDate.toISOString(), endDate: r.endDate?.toISOString() ?? null,
          active: r.active, hasQuantity: r.hasQuantity, unit: r.unit,
          targetCount: r.targetCount, targetPeriod: r.targetPeriod,
          completions: r.completions.map(c => ({ date: c.date.toISOString(), done: c.done, value: c.value, note: c.note })),
          createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString(),
        })),
      },
      citations: {
        citations: citations.map(c => ({
          id: c.id, text: c.text, author: c.author, sourceType: c.sourceType, source: c.source,
          page: c.page, chapter: c.chapter, comment: c.comment, color: c.color,
          favorite: c.favorite, viewCount: c.viewCount,
          tags: c.tags.map(t => t.name),
          createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString(),
        })),
      },
    })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 4: Register the export router in app.ts and set 10 MB limit**

In `backend/src/app.ts`, make two changes:

Change:
```ts
app.use(express.json())
```
To:
```ts
app.use(express.json({ limit: '10mb' }))
```

Add after the existing router imports:
```ts
import exportRouter from './routes/export'
```

Add after the existing `app.use('/api/citations', citationsRouter)` line:
```ts
app.use('/api/export', exportRouter)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && npx jest --testPathPattern="export.test" --no-coverage
```
Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
cd backend && git add src/routes/export.ts src/__tests__/export.test.ts src/app.ts
git commit -m "feat: add JSON export routes for all modules"
```

---

## Task 2 — Backend import routes

**Files:**
- Create: `backend/src/routes/import.ts`
- Create: `backend/src/__tests__/import.test.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write failing tests**

```ts
// backend/src/__tests__/import.test.ts
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'import-test@example.com'
let cookie: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Import User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.journalEntry.deleteMany({ where: { userId } })
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.routine.deleteMany({ where: { userId } })
  await prisma.citation.deleteMany({ where: { userId } })
})

describe('POST /api/import/journal', () => {
  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/import/journal').send({ version: '1', entries: [] })
    expect(res.status).toBe(401)
  })

  it('returns 400 if version is missing', async () => {
    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({ entries: [] })
    expect(res.status).toBe(400)
    expect(res.body.error).toMatch(/version/)
  })

  it('imports entries and returns counts', async () => {
    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({
        version: '1',
        entries: [
          {
            title: 'Entry A',
            content: '{}',
            contentText: 'Hello',
            mood: 'GOOD',
            favorite: false,
            pinned: false,
            draft: false,
            tags: ['travel'],
            createdAt: '2026-01-15T10:00:00.000Z',
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)
    expect(res.body.skipped).toBe(0)
    expect(res.body.total).toBe(1)

    const entries = await prisma.journalEntry.findMany({ where: { userId }, include: { tags: true } })
    expect(entries).toHaveLength(1)
    expect(entries[0].title).toBe('Entry A')
    expect(entries[0].tags.map(t => t.name)).toEqual(['travel'])
  })

  it('skips duplicate entries (same title, same day)', async () => {
    const createdAt = '2026-01-15T10:00:00.000Z'
    await prisma.journalEntry.create({
      data: { userId, title: 'Entry A', content: '{}', contentText: '', createdAt: new Date(createdAt) },
    })

    const res = await request(app)
      .post('/api/import/journal')
      .set('Cookie', cookie)
      .send({
        version: '1',
        entries: [{ title: 'Entry A', content: '{}', contentText: '', tags: [], createdAt, mood: null, favorite: false, pinned: false, draft: false }],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(0)
    expect(res.body.skipped).toBe(1)
  })
})

describe('POST /api/import/reading', () => {
  it('imports books with notes and skips duplicates by isbn', async () => {
    const res = await request(app)
      .post('/api/import/reading')
      .set('Cookie', cookie)
      .send({
        version: '1',
        books: [
          {
            title: 'Dune',
            author: 'Frank Herbert',
            isbn: '9780441013593',
            status: 'FINISHED',
            genres: ['Sci-Fi'],
            owned: false,
            favorite: false,
            rereadCount: 0,
            tags: ['scifi'],
            notes: [{ title: 'Note 1', content: 'Great', chapter: null, page: null }],
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)

    const books = await prisma.book.findMany({ where: { userId }, include: { notes: true, tags: true } })
    expect(books).toHaveLength(1)
    expect(books[0].notes).toHaveLength(1)
    expect(books[0].tags.map(t => t.name)).toEqual(['scifi'])

    const res2 = await request(app)
      .post('/api/import/reading')
      .set('Cookie', cookie)
      .send({ version: '1', books: [{ title: 'Dune', author: 'Frank Herbert', isbn: '9780441013593', status: 'FINISHED', genres: [], owned: false, favorite: false, rereadCount: 0, tags: [], notes: [] }] })

    expect(res2.body.imported).toBe(0)
    expect(res2.body.skipped).toBe(1)
  })
})

describe('POST /api/import/routines', () => {
  it('imports routines with completions and skips duplicates', async () => {
    const res = await request(app)
      .post('/api/import/routines')
      .set('Cookie', cookie)
      .send({
        version: '1',
        routines: [
          {
            name: 'Morning run',
            rruleString: 'FREQ=DAILY',
            type: 'HABIT',
            color: '#C4775A',
            icon: '✅',
            active: true,
            hasQuantity: false,
            startDate: '2026-01-01T00:00:00.000Z',
            completions: [{ date: '2026-01-01T00:00:00.000Z', done: true, value: null, note: null }],
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)

    const routines = await prisma.routine.findMany({ where: { userId }, include: { completions: true } })
    expect(routines[0].completions).toHaveLength(1)
  })
})

describe('POST /api/import/citations', () => {
  it('imports citations with tags and skips duplicates by text+author', async () => {
    const res = await request(app)
      .post('/api/import/citations')
      .set('Cookie', cookie)
      .send({
        version: '1',
        citations: [
          {
            text: 'To be or not to be',
            author: 'Shakespeare',
            sourceType: 'BOOK',
            color: '#C4775A',
            favorite: false,
            viewCount: 0,
            tags: ['classic'],
          },
        ],
      })

    expect(res.status).toBe(200)
    expect(res.body.imported).toBe(1)

    const res2 = await request(app)
      .post('/api/import/citations')
      .set('Cookie', cookie)
      .send({ version: '1', citations: [{ text: 'To be or not to be', author: 'Shakespeare', sourceType: 'BOOK', color: '#C4775A', favorite: false, viewCount: 0, tags: [] }] })

    expect(res2.body.skipped).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to see them fail**

```bash
cd backend && npx jest --testPathPattern="import.test" --no-coverage
```
Expected: FAIL — routes do not exist yet.

- [ ] **Step 3: Create the import route file**

```ts
// backend/src/routes/import.ts
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { RoutineType, SourceType, ReadingStatus, Mood } from '@prisma/client'

const router = Router()
router.use(requireAuth)

function validateVersion(body: Record<string, unknown>, res: import('express').Response): boolean {
  if (!body.version) {
    res.status(400).json({ error: 'version field is required' })
    return false
  }
  if (body.version !== '1') {
    res.status(400).json({ error: 'Unsupported export version' })
    return false
  }
  return true
}

router.post('/journal', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; entries?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const entries = body.entries ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const createdAt = new Date(entry.createdAt as string)
        const dayStart = new Date(createdAt)
        dayStart.setUTCHours(0, 0, 0, 0)
        const dayEnd = new Date(createdAt)
        dayEnd.setUTCHours(23, 59, 59, 999)

        const existing = await tx.journalEntry.findFirst({
          where: {
            userId,
            title: entry.title as string,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        })

        if (existing) { skipped++; continue }

        const tags = (entry.tags as string[]) ?? []
        await tx.journalEntry.create({
          data: {
            userId,
            title: entry.title as string,
            content: entry.content as string,
            contentText: (entry.contentText as string) ?? '',
            mood: (entry.mood as Mood | null) ?? null,
            favorite: (entry.favorite as boolean) ?? false,
            pinned: (entry.pinned as boolean) ?? false,
            draft: (entry.draft as boolean) ?? false,
            createdAt,
            tags: { create: tags.filter(Boolean).map(name => ({ name })) },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: entries.length })
  } catch (err) { next(err) }
})

router.post('/reading', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; books?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const books = body.books ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const book of books) {
        const isbn = book.isbn as string | undefined
        const existing = await tx.book.findFirst({
          where: isbn
            ? { userId, isbn }
            : { userId, title: book.title as string, author: book.author as string },
        })

        if (existing) { skipped++; continue }

        const tags = (book.tags as string[]) ?? []
        const notes = (book.notes as Record<string, unknown>[]) ?? []

        await tx.book.create({
          data: {
            userId,
            title: book.title as string,
            author: book.author as string,
            synopsis: (book.synopsis as string) ?? null,
            isbn: isbn ?? null,
            pageCount: book.pageCount != null ? Number(book.pageCount) : null,
            genres: (book.genres as string[]) ?? [],
            coverUrl: (book.coverUrl as string) ?? null,
            coverType: (book.coverType as string) ?? null,
            googleBooksId: (book.googleBooksId as string) ?? null,
            status: (book.status as ReadingStatus) ?? 'WISHLIST',
            owned: (book.owned as boolean) ?? false,
            rating: book.rating != null ? Number(book.rating) : null,
            review: (book.review as string) ?? null,
            favorite: (book.favorite as boolean) ?? false,
            rereadCount: (book.rereadCount as number) ?? 0,
            currentPage: book.currentPage != null ? Number(book.currentPage) : null,
            startedAt: book.startedAt ? new Date(book.startedAt as string) : null,
            finishedAt: book.finishedAt ? new Date(book.finishedAt as string) : null,
            tags: { create: tags.filter(Boolean).map(name => ({ name })) },
            notes: {
              create: notes.map(n => ({
                title: n.title as string,
                content: n.content as string,
                chapter: (n.chapter as string) ?? null,
                page: n.page != null ? Number(n.page) : null,
              })),
            },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: books.length })
  } catch (err) { next(err) }
})

router.post('/routines', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; routines?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const routines = body.routines ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const routine of routines) {
        const existing = await tx.routine.findFirst({
          where: { userId, name: routine.name as string, rruleString: routine.rruleString as string },
        })

        if (existing) { skipped++; continue }

        const completions = (routine.completions as Record<string, unknown>[]) ?? []

        await tx.routine.create({
          data: {
            userId,
            name: routine.name as string,
            description: (routine.description as string) ?? null,
            type: (routine.type as RoutineType) ?? 'HABIT',
            category: (routine.category as string) ?? null,
            color: (routine.color as string) ?? '#C4775A',
            icon: (routine.icon as string) ?? '✅',
            rruleString: routine.rruleString as string,
            startDate: routine.startDate ? new Date(routine.startDate as string) : new Date(),
            endDate: routine.endDate ? new Date(routine.endDate as string) : null,
            active: (routine.active as boolean) ?? true,
            hasQuantity: (routine.hasQuantity as boolean) ?? false,
            unit: (routine.unit as string) ?? null,
            targetCount: routine.targetCount != null ? Number(routine.targetCount) : null,
            targetPeriod: (routine.targetPeriod as import('@prisma/client').TargetPeriod) ?? null,
            completions: {
              create: completions.map(c => ({
                date: new Date(c.date as string),
                done: (c.done as boolean) ?? true,
                value: c.value != null ? Number(c.value) : null,
                note: (c.note as string) ?? null,
              })),
            },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: routines.length })
  } catch (err) { next(err) }
})

router.post('/citations', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; citations?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const citations = body.citations ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const citation of citations) {
        const existing = await tx.citation.findFirst({
          where: {
            userId,
            text: citation.text as string,
            author: (citation.author as string | null) ?? null,
          },
        })

        if (existing) { skipped++; continue }

        const tags = (citation.tags as string[]) ?? []

        await tx.citation.create({
          data: {
            userId,
            text: citation.text as string,
            author: (citation.author as string) ?? null,
            sourceType: (citation.sourceType as SourceType) ?? 'OTHER',
            source: (citation.source as string) ?? null,
            page: citation.page != null ? Number(citation.page) : null,
            chapter: (citation.chapter as string) ?? null,
            comment: (citation.comment as string) ?? null,
            color: (citation.color as string) ?? '#C4775A',
            favorite: (citation.favorite as boolean) ?? false,
            viewCount: (citation.viewCount as number) ?? 0,
            tags: { create: tags.filter(Boolean).map(name => ({ name })) },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: citations.length })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 4: Register the import router in app.ts**

In `backend/src/app.ts`, add after `import exportRouter from './routes/export'`:
```ts
import importRouter from './routes/import'
```

Add after `app.use('/api/export', exportRouter)`:
```ts
app.use('/api/import', importRouter)
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
cd backend && npx jest --testPathPattern="import.test" --no-coverage
```
Expected: All tests pass.

- [ ] **Step 6: Run full test suite to check for regressions**

```bash
cd backend && npx jest --no-coverage
```
Expected: All existing tests still pass.

- [ ] **Step 7: Commit**

```bash
cd backend && git add src/routes/import.ts src/__tests__/import.test.ts src/app.ts
git commit -m "feat: add JSON import routes with merge deduplication for all modules"
```

---

## Task 3 — Frontend API layer

**Files:**
- Create: `frontend/src/api/export.ts`
- Create: `frontend/src/api/import.ts`

- [ ] **Step 1: Create export.ts**

```ts
// frontend/src/api/export.ts
import { apiClient } from './client'

const MODULES = ['journal', 'reading', 'routines', 'citations', 'all'] as const
type ExportModule = typeof MODULES[number]

export async function exportModule(module: ExportModule): Promise<void> {
  const data = await apiClient<object>(`/api/export/${module}`)
  const filename = module === 'all'
    ? `monmonde-${today()}.json`
    : `${module}-${today()}.json`
  download(data, filename)
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function download(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Create import.ts**

```ts
// frontend/src/api/import.ts
import { apiClient } from './client'

export interface ImportResult {
  imported: number
  skipped: number
  total: number
}

export type ImportableModule = 'journal' | 'reading' | 'routines' | 'citations'

export async function importModule(module: ImportableModule, data: object): Promise<ImportResult> {
  return apiClient<ImportResult>(`/api/import/${module}`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export function countItems(module: ImportableModule, data: Record<string, unknown>): number {
  const key: Record<ImportableModule, string> = {
    journal: 'entries',
    reading: 'books',
    routines: 'routines',
    citations: 'citations',
  }
  const arr = data[key[module]]
  return Array.isArray(arr) ? arr.length : 0
}
```

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/api/export.ts src/api/import.ts
git commit -m "feat: add frontend export and import API helpers"
```

---

## Task 4 — Frontend UI components

**Files:**
- Create: `frontend/src/components/ui/ImportExportButtons.tsx`
- Create: `frontend/src/components/ui/ImportResultModal.tsx`
- Modify: `frontend/src/styles/globals.css`

- [ ] **Step 1: Create ImportResultModal.tsx**

```tsx
// frontend/src/components/ui/ImportResultModal.tsx
import { useState } from 'react'
import { importModule, countItems, ImportResult, ImportableModule } from '../../api/import'

interface Props {
  module: ImportableModule
  data: Record<string, unknown>
  onClose: () => void
  onDone: () => void
}

export function ImportResultModal({ module, data, onClose, onDone }: Props) {
  const [state, setState] = useState<'confirm' | 'loading' | 'done' | 'error'>('confirm')
  const [result, setResult] = useState<ImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const itemCount = countItems(module, data)

  async function handleConfirm() {
    setState('loading')
    try {
      const r = await importModule(module, data)
      setResult(r)
      setState('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue')
      setState('error')
    }
  }

  function handleDone() {
    onDone()
    onClose()
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box glass-card" onClick={e => e.stopPropagation()}>
        {state === 'confirm' && (
          <>
            <h3 className="modal-title">Importer les données</h3>
            <p className="modal-body">
              {itemCount} élément{itemCount !== 1 ? 's' : ''} trouvé{itemCount !== 1 ? 's' : ''} dans ce fichier.
              <br />
              Les doublons seront ignorés.
            </p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
              <button className="btn btn-primary" onClick={handleConfirm}>Importer</button>
            </div>
          </>
        )}

        {state === 'loading' && (
          <div className="modal-loading">
            <div className="loading-spinner" />
            <p>Import en cours…</p>
          </div>
        )}

        {state === 'done' && result && (
          <>
            <h3 className="modal-title">Import terminé</h3>
            <p className="modal-body">
              <strong>{result.imported}</strong> élément{result.imported !== 1 ? 's' : ''} ajouté{result.imported !== 1 ? 's' : ''}
              {result.skipped > 0 && `, ${result.skipped} ignoré${result.skipped !== 1 ? 's' : ''} (doublons)`}
            </p>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={handleDone}>Fermer</button>
            </div>
          </>
        )}

        {state === 'error' && (
          <>
            <h3 className="modal-title">Erreur</h3>
            <p className="modal-body modal-error">{error}</p>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={onClose}>Fermer</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ImportExportButtons.tsx**

```tsx
// frontend/src/components/ui/ImportExportButtons.tsx
import { useRef, useState } from 'react'
import { exportModule } from '../../api/export'
import { ImportableModule } from '../../api/import'
import { ImportResultModal } from './ImportResultModal'

interface Props {
  module: ImportableModule
  onImportDone?: () => void
}

export function ImportExportButtons({ module, onImportDone }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importData, setImportData] = useState<Record<string, unknown> | null>(null)
  const [exportLoading, setExportLoading] = useState(false)
  const [parseError, setParseError] = useState<string | null>(null)

  async function handleExport() {
    setExportLoading(true)
    try {
      await exportModule(module)
    } catch {
      // silently ignore
    } finally {
      setExportLoading(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setParseError(null)
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string) as Record<string, unknown>
        setImportData(data)
      } catch {
        setParseError('Fichier JSON invalide')
      }
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
    reader.readAsText(file)
  }

  return (
    <>
      <div className="io-buttons">
        <button
          className="btn btn-ghost btn-icon"
          onClick={handleExport}
          disabled={exportLoading}
          title="Exporter"
          aria-label="Exporter"
        >
          {exportLoading ? <div className="loading-spinner loading-spinner--sm" /> : '↓'}
        </button>
        <button
          className="btn btn-ghost btn-icon"
          onClick={() => fileInputRef.current?.click()}
          title="Importer"
          aria-label="Importer"
        >
          ↑
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
      </div>

      {parseError && (
        <div className="io-parse-error">{parseError}</div>
      )}

      {importData && (
        <ImportResultModal
          module={module}
          data={importData}
          onClose={() => setImportData(null)}
          onDone={() => onImportDone?.()}
        />
      )}
    </>
  )
}
```

- [ ] **Step 3: Add minimal CSS to globals.css**

Append at the end of `frontend/src/styles/globals.css`:

```css
/* Import / Export */
.io-buttons {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.btn-icon {
  width: 2rem;
  height: 2rem;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  border-radius: var(--radius-sm);
}

.io-parse-error {
  font-size: 0.75rem;
  color: var(--color-error, #e05252);
  margin-top: 0.25rem;
}

.loading-spinner--sm {
  width: 0.875rem;
  height: 0.875rem;
  border-width: 2px;
}

/* Modal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-box {
  padding: 1.5rem;
  max-width: 20rem;
  width: 90%;
}

.modal-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.125rem;
  margin-bottom: 0.75rem;
}

.modal-body {
  font-size: 0.9rem;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
  line-height: 1.5;
}

.modal-error {
  color: var(--color-error, #e05252);
}

.modal-actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
}

.modal-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem 0;
}
```

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/components/ui/ImportExportButtons.tsx src/components/ui/ImportResultModal.tsx src/styles/globals.css
git commit -m "feat: add ImportExportButtons and ImportResultModal UI components"
```

---

## Task 5 — Wire to Journal

**Files:**
- Modify: `frontend/src/pages/journal/JournalList.tsx`

- [ ] **Step 1: Add import and component to JournalList.tsx**

At the top of the file, add the import after the existing imports:
```ts
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
```

Find this block in the JSX:
```tsx
<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
  <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => setShowStats(s => !s)}>
    📊 Stats
  </button>
  <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleNew}>+ Nouvelle entrée</button>
</div>
```

Replace with:
```tsx
<div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
  <ImportExportButtons module="journal" onImportDone={() => {
    journalApi.getEntries().then(d => { setEntries(d.entries); setTotal(d.total) }).catch(() => {})
  }} />
  <button className="btn btn-ghost" style={{ width: 'auto' }} onClick={() => setShowStats(s => !s)}>
    📊 Stats
  </button>
  <button className="btn btn-primary" style={{ width: 'auto' }} onClick={handleNew}>+ Nouvelle entrée</button>
</div>
```

- [ ] **Step 2: Verify in browser**

Start the app and navigate to `/journal`. Confirm two icon buttons (↓ ↑) appear in the header. Click ↓ to download a JSON file. Click ↑, select a JSON file, and confirm the import modal appears.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/journal/JournalList.tsx
git commit -m "feat: add import/export buttons to Journal module"
```

---

## Task 6 — Wire to Reading

**Files:**
- Modify: `frontend/src/pages/reading/BookLibrary.tsx`

- [ ] **Step 1: Add import to BookLibrary.tsx**

At the top, add after existing imports:
```ts
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
```

Find this exact block in the JSX:
```tsx
<header className="reading-header">
  <div>
    <h1 className="reading-title">Lectures</h1>
    <p className="reading-count">{books.length} livre{books.length !== 1 ? 's' : ''}</p>
  </div>
  <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
    + Ajouter un livre
  </Button>
</header>
```

Replace with:
```tsx
<header className="reading-header">
  <div>
    <h1 className="reading-title">Lectures</h1>
    <p className="reading-count">{books.length} livre{books.length !== 1 ? 's' : ''}</p>
  </div>
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <ImportExportButtons module="reading" onImportDone={fetchBooks} />
    <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
      + Ajouter un livre
    </Button>
  </div>
</header>
```

- [ ] **Step 2: Verify in browser**

Navigate to `/reading`. Confirm the ↓ ↑ buttons appear in the header. Export downloads a JSON with books.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/reading/BookLibrary.tsx
git commit -m "feat: add import/export buttons to Reading module"
```

---

## Task 7 — Wire to Routines

**Files:**
- Modify: `frontend/src/pages/routines/ItemList.tsx`

- [ ] **Step 1: Add ImportExportButtons to ItemList.tsx**

Add import at the top:
```ts
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
```

Find this exact block in the JSX:
```tsx
<header className="routines-list-header">
  <div>
    <h1 className="routines-list-title">Routines</h1>
    <p className="routines-count">{routines.length} routine{routines.length !== 1 ? 's' : ''}</p>
  </div>
  <button className="btn btn-primary btn-add-routine" onClick={() => setShowForm(true)}>
    + Ajouter
  </button>
</header>
```

Replace with:
```tsx
<header className="routines-list-header">
  <div>
    <h1 className="routines-list-title">Routines</h1>
    <p className="routines-count">{routines.length} routine{routines.length !== 1 ? 's' : ''}</p>
  </div>
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <ImportExportButtons module="routines" onImportDone={load} />
    <button className="btn btn-primary btn-add-routine" onClick={() => setShowForm(true)}>
      + Ajouter
    </button>
  </div>
</header>
```

- [ ] **Step 2: Verify in browser**

Navigate to `/routines/list`. Confirm the ↓ ↑ buttons appear. Export downloads a JSON with routines and their completions.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/routines/ItemList.tsx
git commit -m "feat: add import/export buttons to Routines module"
```

---

## Task 8 — Wire to Citations

**Files:**
- Modify: `frontend/src/pages/citations/CitationList.tsx`

- [ ] **Step 1: Add ImportExportButtons to CitationList.tsx**

Add import at the top:
```ts
import { ImportExportButtons } from '../../components/ui/ImportExportButtons'
```

Find this exact block in the JSX:
```tsx
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
```

Replace with:
```tsx
<header className="citations-list-header">
  <div>
    <h1 className="citations-list-title">Citations</h1>
    <p className="citations-count">
      {citations.length} citation{citations.length !== 1 ? 's' : ''}
    </p>
  </div>
  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
    <ImportExportButtons module="citations" onImportDone={load} />
    <button className="btn btn-primary" style={{ width: 'auto', padding: '0.65rem 1.25rem' }} onClick={() => setShowForm(true)}>
      + Ajouter
    </button>
  </div>
</header>
```

- [ ] **Step 2: Verify in browser**

Navigate to `/citations/list`. Confirm the ↓ ↑ buttons appear. Export downloads a JSON with citations and their tags.

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/pages/citations/CitationList.tsx
git commit -m "feat: add import/export buttons to Citations module"
```

---

## Task 9 — Dashboard global export

**Files:**
- Modify: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add global export to Dashboard.tsx**

Add import at the top:
```ts
import { exportModule } from '../api/export'
```

Add a `useState` for loading state:
```ts
const [exporting, setExporting] = useState(false)
```

Find the `<section className="dashboard-modules">` block. After the closing `</div>` of `modules-grid`, add:

```tsx
<div className="dashboard-export">
  <button
    className="btn btn-ghost"
    style={{ width: 'auto' }}
    disabled={exporting}
    onClick={async () => {
      setExporting(true)
      try { await exportModule('all') } catch {} finally { setExporting(false) }
    }}
  >
    {exporting ? '…' : '↓'} Exporter tout
  </button>
</div>
```

- [ ] **Step 2: Add minimal dashboard export styles to globals.css**

Append to `frontend/src/styles/globals.css`:
```css
.dashboard-export {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
```

- [ ] **Step 3: Verify in browser**

Go to the Dashboard. Confirm "↓ Exporter tout" button is visible. Click it — a `monmonde-YYYY-MM-DD.json` file downloads containing all four modules.

- [ ] **Step 4: Commit**

```bash
cd frontend && git add src/pages/Dashboard.tsx src/styles/globals.css
git commit -m "feat: add global export button to Dashboard"
```

---

## Done

All 9 tasks complete. The feature is fully implemented:
- `GET /api/export/{journal|reading|routines|citations|all}` — JSON export
- `POST /api/import/{journal|reading|routines|citations}` — merge import with deduplication
- ↓ ↑ icon buttons in each module header
- "Exporter tout" on the Dashboard
