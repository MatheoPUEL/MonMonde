# Journal Module Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a personal journal module with rich-text entries (Tiptap), tags, mood tracking, favorites, pinned, drafts, search/filters, archives by month/year, and writing statistics.

**Architecture:** Backend adds Mood enum + JournalEntry + JournalTag Prisma models and a `/api/journal/*` router (entries CRUD, stats, archives). Frontend adds `/journal/*` pages using a full-width list → detail pattern (same as reading module), a reusable `RichEditor` Tiptap wrapper, and journal-specific components. Content stored as ProseMirror JSON string + extracted plain text for search.

**Tech Stack:** Tiptap v2 (`@tiptap/react`, `@tiptap/starter-kit` + extensions), React Router nested routes, CSS bar charts for mood stats (no chart library).

---

## File Map

```
backend/
├── prisma/schema.prisma                MODIFY — add Mood enum, JournalEntry, JournalTag, User relation
├── src/app.ts                          MODIFY — register /api/journal router
├── src/lib/journal.ts                  CREATE — extractTextFromTiptap() helper
├── src/routes/journal/
│   ├── index.ts                        CREATE — mounts entries + stats + archives sub-routers
│   ├── entries.ts                      CREATE — CRUD routes
│   ├── stats.ts                        CREATE — stats route
│   └── archives.ts                     CREATE — archives route
├── src/routes/modules.ts               MODIFY — journal available: true
└── src/__tests__/journal.entries.test.ts  CREATE

frontend/
├── src/main.tsx                        MODIFY — import journal.css
├── src/App.tsx                         MODIFY — add /journal/* route
├── src/api/journal.ts                  CREATE — types + journalApi
├── src/styles/journal.css              CREATE — all journal styles + RichEditor styles
├── src/pages/journal/
│   ├── JournalPage.tsx                 CREATE — internal router
│   ├── JournalList.tsx                 CREATE — list + search + filters + archives sidebar
│   └── EntryDetail.tsx                 CREATE — inline Tiptap edit + sidebar
└── src/components/
    ├── ui/RichEditor.tsx               CREATE — reusable Tiptap wrapper
    └── journal/
        ├── EntryCard.tsx               CREATE
        ├── MoodBadge.tsx               CREATE
        ├── MoodPicker.tsx              CREATE
        └── StatsPanel.tsx              CREATE
```

---

### Task 1: Prisma schema + Tiptap dependencies

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add Mood enum + JournalEntry + JournalTag to schema.prisma**

In `backend/prisma/schema.prisma`, add `journalEntries JournalEntry[]` to the User model, then append after the BookNote model:

```prisma
enum Mood {
  EXCELLENT
  GOOD
  NEUTRAL
  BAD
  VERY_BAD
}

model JournalEntry {
  id          String       @id @default(cuid())
  userId      String
  user        User         @relation(fields: [userId], references: [id], onDelete: Cascade)

  title       String
  content     String
  contentText String       @default("")

  mood        Mood?
  favorite    Boolean      @default(false)
  pinned      Boolean      @default(false)
  draft       Boolean      @default(false)

  tags        JournalTag[]

  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  @@index([userId])
  @@index([userId, draft])
  @@index([userId, favorite])
  @@index([userId, pinned])
  @@index([userId, mood])
  @@index([userId, createdAt])
}

model JournalTag {
  id      String       @id @default(cuid())
  name    String
  entryId String
  entry   JournalEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@unique([entryId, name])
  @@index([entryId])
}
```

- [ ] **Step 2: Run migration**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/backend"
npx prisma migrate dev --name add_journal_module
```

Expected: Migration created and applied, Prisma client regenerated.

- [ ] **Step 3: Install Tiptap packages in frontend**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npm install @tiptap/react @tiptap/pm @tiptap/starter-kit @tiptap/extension-underline @tiptap/extension-link @tiptap/extension-image @tiptap/extension-table @tiptap/extension-table-row @tiptap/extension-table-header @tiptap/extension-table-cell @tiptap/extension-placeholder
```

Expected: All packages installed, no peer dependency errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add backend/prisma/schema.prisma backend/prisma/migrations/ frontend/package.json frontend/package-lock.json
git commit -m "feat: add journal module Prisma schema and Tiptap dependencies"
```

---

### Task 2: Backend helper + router skeleton + module flag

**Files:**
- Create: `backend/src/lib/journal.ts`
- Create: `backend/src/routes/journal/index.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/modules.ts`

- [ ] **Step 1: Create backend/src/lib/journal.ts**

```typescript
interface TiptapNode {
  type: string
  text?: string
  content?: TiptapNode[]
}

function extractText(node: TiptapNode): string {
  if (node.type === 'text') return node.text ?? ''
  if (!node.content) return ''
  return node.content.map(extractText).join(' ')
}

export function extractTextFromTiptap(jsonString: string): string {
  try {
    const doc = JSON.parse(jsonString) as TiptapNode
    return extractText(doc).replace(/\s+/g, ' ').trim()
  } catch {
    return ''
  }
}
```

- [ ] **Step 2: Create backend/src/routes/journal/index.ts**

```typescript
import { Router } from 'express'
import entriesRouter from './entries'
import statsRouter from './stats'
import archivesRouter from './archives'

const router = Router()

router.use('/entries', entriesRouter)
router.use('/stats', statsRouter)
router.use('/archives', archivesRouter)

export default router
```

- [ ] **Step 3: Register journal router in backend/src/app.ts**

Add after the reading router import and use:

```typescript
import journalRouter from './routes/journal'
// ...
app.use('/api/journal', journalRouter)
```

- [ ] **Step 4: Update backend/src/routes/modules.ts — journal available: true**

Change:
```typescript
{ slug: 'journal', name: 'Journal', description: 'Notes et journaling personnel', icon: '📓', available: false },
```
To:
```typescript
{ slug: 'journal', name: 'Journal', description: 'Notes et journaling personnel', icon: '📓', available: true },
```

- [ ] **Step 5: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add backend/src/lib/journal.ts backend/src/routes/journal/index.ts backend/src/app.ts backend/src/routes/modules.ts
git commit -m "feat: add journal router skeleton and text extractor helper"
```

---

### Task 3: Journal entries CRUD routes (TDD)

**Files:**
- Create: `backend/src/__tests__/journal.entries.test.ts`
- Create: `backend/src/routes/journal/entries.ts`

- [ ] **Step 1: Create backend/src/__tests__/journal.entries.test.ts**

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'journal-test@example.com'
const TEST_EMAIL_B = 'journal-test-b@example.com'
const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}'
const CONTENT_HELLO = '{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Hello world from journal"}]}]}'

let cookie: string
let cookieB: string
let userId: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Journal User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as unknown as string[])[0]
  userId = res.body.user.id

  const resB = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Journal User B', email: TEST_EMAIL_B, password: 'password123' })
  cookieB = (resB.headers['set-cookie'] as unknown as string[])[0]
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: { in: [TEST_EMAIL, TEST_EMAIL_B] } } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.journalEntry.deleteMany({ where: { userId } })
})

describe('POST /api/journal/entries', () => {
  it('creates entry with required fields', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({ title: 'My first entry', content: EMPTY_DOC })

    expect(res.status).toBe(201)
    expect(res.body.entry.title).toBe('My first entry')
    expect(res.body.entry.draft).toBe(false)
    expect(res.body.entry.favorite).toBe(false)
    expect(res.body.entry.tags).toEqual([])
    expect(res.body.entry.mood).toBeNull()
  })

  it('creates entry with all optional fields', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({
        title: 'Full entry',
        content: CONTENT_HELLO,
        mood: 'GOOD',
        favorite: true,
        pinned: true,
        draft: true,
        tags: ['travel', 'work'],
      })

    expect(res.status).toBe(201)
    expect(res.body.entry.mood).toBe('GOOD')
    expect(res.body.entry.favorite).toBe(true)
    expect(res.body.entry.pinned).toBe(true)
    expect(res.body.entry.draft).toBe(true)
    expect(res.body.entry.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['travel', 'work'])
    )
    expect(res.body.entry.contentText).toBe('Hello world from journal')
  })

  it('returns 400 if title missing', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({ content: EMPTY_DOC })
    expect(res.status).toBe(400)
  })

  it('returns 400 if content missing', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .set('Cookie', cookie)
      .send({ title: 'No content' })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/journal/entries')
      .send({ title: 'Test', content: EMPTY_DOC })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/journal/entries', () => {
  it('returns empty list when no entries', async () => {
    const res = await request(app).get('/api/journal/entries').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.entries).toEqual([])
    expect(res.body.total).toBe(0)
  })

  it('returns entries ordered pinned first then by date desc', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'First', content: EMPTY_DOC })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Pinned', content: EMPTY_DOC, pinned: true })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Third', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries').set('Cookie', cookie)
    expect(res.body.entries[0].title).toBe('Pinned')
    expect(res.body.total).toBe(3)
  })

  it('filters by search title', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Voyage à Paris', content: EMPTY_DOC })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Travail du jour', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?search=Paris').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].title).toBe('Voyage à Paris')
  })

  it('filters by search content', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Entry', content: CONTENT_HELLO })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Other', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?search=Hello+world').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].title).toBe('Entry')
  })

  it('filters by mood', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Happy', content: EMPTY_DOC, mood: 'EXCELLENT' })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Sad', content: EMPTY_DOC, mood: 'BAD' })

    const res = await request(app).get('/api/journal/entries?mood=EXCELLENT').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].mood).toBe('EXCELLENT')
  })

  it('filters by favorite', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Fav', content: EMPTY_DOC, favorite: true })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Not fav', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?favorite=true').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].favorite).toBe(true)
  })

  it('filters by draft', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Draft', content: EMPTY_DOC, draft: true })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Published', content: EMPTY_DOC, draft: false })

    const res = await request(app).get('/api/journal/entries?draft=true').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].draft).toBe(true)
  })

  it('filters by tag', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Tagged', content: EMPTY_DOC, tags: ['travel'] })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Untagged', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/entries?tag=travel').set('Cookie', cookie)
    expect(res.body.entries.length).toBe(1)
    expect(res.body.entries[0].title).toBe('Tagged')
  })
})

describe('GET /api/journal/entries/:id', () => {
  it('returns entry by id', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Get me', content: CONTENT_HELLO })

    const res = await request(app)
      .get(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.entry.title).toBe('Get me')
  })

  it('returns 404 when entry belongs to another user', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Private', content: EMPTY_DOC })

    const res = await request(app)
      .get(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookieB)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/journal/entries/:id', () => {
  it('updates title and mood', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Original', content: EMPTY_DOC })

    const res = await request(app)
      .put(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', mood: 'GOOD' })

    expect(res.status).toBe(200)
    expect(res.body.entry.title).toBe('Updated')
    expect(res.body.entry.mood).toBe('GOOD')
  })

  it('atomically replaces tags', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Entry', content: EMPTY_DOC, tags: ['old'] })

    const res = await request(app)
      .put(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)
      .send({ tags: ['new1', 'new2'] })

    expect(res.body.entry.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['new1', 'new2'])
    )
    expect(res.body.entry.tags.find((t: { name: string }) => t.name === 'old')).toBeUndefined()
  })

  it('returns 404 for another user entry', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Mine', content: EMPTY_DOC })

    const res = await request(app)
      .put(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookieB)
      .send({ title: 'Hacked' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/journal/entries/:id', () => {
  it('deletes entry', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Delete me', content: EMPTY_DOC })

    const res = await request(app)
      .delete(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const check = await request(app)
      .get(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookie)
    expect(check.status).toBe(404)
  })

  it('returns 404 for another user entry', async () => {
    const create = await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Mine', content: EMPTY_DOC })

    const res = await request(app)
      .delete(`/api/journal/entries/${create.body.entry.id}`)
      .set('Cookie', cookieB)

    expect(res.status).toBe(404)
  })
})

describe('GET /api/journal/stats', () => {
  it('returns correct totals', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'E1', content: CONTENT_HELLO, mood: 'GOOD' })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'E2', content: CONTENT_HELLO, mood: 'EXCELLENT' })

    const res = await request(app).get('/api/journal/stats').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.totalEntries).toBe(2)
    expect(res.body.totalWords).toBeGreaterThan(0)
    expect(res.body.currentStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.longestStreak).toBeGreaterThanOrEqual(1)
    expect(res.body.moodByMonth.length).toBeGreaterThan(0)
  })

  it('excludes drafts from stats', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Draft', content: CONTENT_HELLO, draft: true })

    const res = await request(app).get('/api/journal/stats').set('Cookie', cookie)
    expect(res.body.totalEntries).toBe(0)
  })
})

describe('GET /api/journal/archives', () => {
  it('returns entries grouped by year and month', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'A', content: EMPTY_DOC })
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'B', content: EMPTY_DOC })

    const res = await request(app).get('/api/journal/archives').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.archives.length).toBeGreaterThan(0)
    expect(res.body.archives[0]).toHaveProperty('year')
    expect(res.body.archives[0]).toHaveProperty('month')
    expect(res.body.archives[0].count).toBe(2)
  })

  it('excludes drafts from archives', async () => {
    await request(app).post('/api/journal/entries').set('Cookie', cookie)
      .send({ title: 'Draft', content: EMPTY_DOC, draft: true })

    const res = await request(app).get('/api/journal/archives').set('Cookie', cookie)
    expect(res.body.archives.length).toBe(0)
  })
})
```

- [ ] **Step 2: Run tests to confirm they all fail**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/backend"
npm test -- --testPathPattern=journal --forceExit 2>&1 | tail -10
```

Expected: Tests fail with "Cannot find module '../routes/journal/entries'" or similar.

- [ ] **Step 3: Create backend/src/routes/journal/entries.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import prisma from '../../lib/prisma'
import { extractTextFromTiptap } from '../../lib/journal'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const { search, mood, favorite, pinned, draft, tag, dateFrom, dateTo, page = '1', limit = '20' } = req.query as Record<string, string>

    const where: any = { userId }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contentText: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (mood) where.mood = mood
    if (favorite === 'true') where.favorite = true
    if (pinned === 'true') where.pinned = true
    if (draft === 'true') where.draft = true
    if (tag) where.tags = { some: { name: tag } }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { tags: true },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.journalEntry.count({ where }),
    ])

    res.json({ entries, total, page: pageNum })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const { title, content, mood, favorite = false, pinned = false, draft = false, tags = [] } = req.body

    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required' })
      return
    }
    if (content === undefined || content === null) {
      res.status(400).json({ error: 'content is required' })
      return
    }

    const contentText = extractTextFromTiptap(content)

    const entry = await prisma.journalEntry.create({
      data: {
        userId,
        title: title.trim(),
        content,
        contentText,
        mood: mood || null,
        favorite,
        pinned,
        draft,
        tags: {
          create: (tags as string[]).filter(Boolean).map(name => ({ name: name.toLowerCase().trim() })),
        },
      },
      include: { tags: true },
    })

    res.status(201).json({ entry })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const entry = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, userId },
      include: { tags: true },
    })
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' })
      return
    }
    res.json({ entry })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const existing = await prisma.journalEntry.findFirst({ where: { id: req.params.id, userId } })
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' })
      return
    }

    const { title, content, mood, favorite, pinned, draft, tags } = req.body
    const data: any = {}

    if (title !== undefined) data.title = title.trim()
    if (content !== undefined) {
      data.content = content
      data.contentText = extractTextFromTiptap(content)
    }
    if (mood !== undefined) data.mood = mood || null
    if (favorite !== undefined) data.favorite = favorite
    if (pinned !== undefined) data.pinned = pinned
    if (draft !== undefined) data.draft = draft

    if (tags !== undefined) {
      const tagNames = (tags as string[]).filter(Boolean).map(n => n.toLowerCase().trim())
      const entry = await prisma.$transaction(async (tx) => {
        await tx.journalTag.deleteMany({ where: { entryId: req.params.id } })
        return tx.journalEntry.update({
          where: { id: req.params.id },
          data: { ...data, tags: { create: tagNames.map(name => ({ name })) } },
          include: { tags: true },
        })
      })
      res.json({ entry })
      return
    }

    const entry = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data,
      include: { tags: true },
    })
    res.json({ entry })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const existing = await prisma.journalEntry.findFirst({ where: { id: req.params.id, userId } })
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' })
      return
    }
    await prisma.journalEntry.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 4: Run tests — expect only stats + archives tests to fail (entries tests pass)**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/backend"
npm test -- --testPathPattern=journal --forceExit 2>&1 | tail -15
```

Expected: Entries describe blocks pass. Stats + archives fail with "route not found" (404).

- [ ] **Step 5: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add backend/src/__tests__/journal.entries.test.ts backend/src/routes/journal/entries.ts
git commit -m "feat: add journal entries CRUD routes with tests"
```

---

### Task 4: Stats + archives routes

**Files:**
- Create: `backend/src/routes/journal/stats.ts`
- Create: `backend/src/routes/journal/archives.ts`

- [ ] **Step 1: Create backend/src/routes/journal/stats.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import prisma from '../../lib/prisma'

const MOOD_VALUES: Record<string, number> = {
  EXCELLENT: 1, GOOD: 2, NEUTRAL: 3, BAD: 4, VERY_BAD: 5,
}

function getISOWeek(d: Date): string {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const week1 = new Date(date.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id

    const entries = await prisma.journalEntry.findMany({
      where: { userId, draft: false },
      select: { contentText: true, mood: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const totalEntries = entries.length

    const totalWords = entries.reduce((sum, e) => {
      return sum + e.contentText.trim().split(/\s+/).filter(Boolean).length
    }, 0)

    // Streak
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const entryDaySet = new Set(
      entries.map(e => {
        const d = new Date(e.createdAt)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
    )
    const sortedDays = Array.from(entryDaySet).sort((a, b) => a - b)

    let longestStreak = 0
    let currentRunLength = 0

    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0 || sortedDays[i] - sortedDays[i - 1] === 86400000) {
        currentRunLength++
      } else {
        currentRunLength = 1
      }
      longestStreak = Math.max(longestStreak, currentRunLength)
    }

    const lastDay = sortedDays[sortedDays.length - 1] ?? -1
    const yesterday = today.getTime() - 86400000
    const currentStreak = (lastDay === today.getTime() || lastDay === yesterday) ? currentRunLength : 0

    // Avg per week
    let avgEntriesPerWeek = 0
    if (entries.length > 0) {
      const firstEntry = new Date(entries[0].createdAt)
      const weeks = Math.max(1, (Date.now() - firstEntry.getTime()) / (7 * 86400000))
      avgEntriesPerWeek = Math.round((totalEntries / weeks) * 10) / 10
    }

    // Mood by week
    const weekGroups: Record<string, number[]> = {}
    const monthGroups: Record<string, number[]> = {}

    for (const e of entries) {
      if (!e.mood) continue
      const val = MOOD_VALUES[e.mood]
      const week = getISOWeek(new Date(e.createdAt))
      const d = new Date(e.createdAt)
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!weekGroups[week]) weekGroups[week] = []
      weekGroups[week].push(val)
      if (!monthGroups[month]) monthGroups[month] = []
      monthGroups[month].push(val)
    }

    const avg = (vals: number[]) => Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10

    const moodByWeek = Object.entries(weekGroups)
      .map(([week, vals]) => ({ week, avg: avg(vals), count: vals.length }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)

    const moodByMonth = Object.entries(monthGroups)
      .map(([month, vals]) => ({ month, avg: avg(vals), count: vals.length }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)

    res.json({ totalEntries, totalWords, currentStreak, longestStreak, avgEntriesPerWeek, moodByWeek, moodByMonth })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 2: Create backend/src/routes/journal/archives.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import prisma from '../../lib/prisma'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id

    const entries = await prisma.journalEntry.findMany({
      where: { userId, draft: false },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const groups: Record<string, number> = {}
    for (const e of entries) {
      const d = new Date(e.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      groups[key] = (groups[key] ?? 0) + 1
    }

    const archives = Object.entries(groups)
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number)
        return { year, month, count }
      })
      .sort((a, b) => b.year - a.year || b.month - a.month)

    res.json({ archives })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 3: Run all journal tests**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/backend"
npm test -- --testPathPattern=journal --forceExit 2>&1 | tail -10
```

Expected: All journal tests PASS.

- [ ] **Step 4: Run full test suite to verify no regressions**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/backend"
npm test 2>&1 | tail -10
```

Expected: All test suites PASS.

- [ ] **Step 5: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add backend/src/routes/journal/stats.ts backend/src/routes/journal/archives.ts
git commit -m "feat: add journal stats and archives routes"
```

---

### Task 5: Frontend API types + client

**Files:**
- Create: `frontend/src/api/journal.ts`

- [ ] **Step 1: Create frontend/src/api/journal.ts**

```typescript
import { apiClient } from './client'

export type Mood = 'EXCELLENT' | 'GOOD' | 'NEUTRAL' | 'BAD' | 'VERY_BAD'

export interface JournalTag {
  id: string
  name: string
  entryId: string
}

export interface JournalEntry {
  id: string
  userId: string
  title: string
  content: string
  contentText: string
  mood: Mood | null
  favorite: boolean
  pinned: boolean
  draft: boolean
  tags: JournalTag[]
  createdAt: string
  updatedAt: string
}

export interface JournalStats {
  totalEntries: number
  totalWords: number
  currentStreak: number
  longestStreak: number
  avgEntriesPerWeek: number
  moodByWeek: { week: string; avg: number; count: number }[]
  moodByMonth: { month: string; avg: number; count: number }[]
}

export interface ArchiveItem {
  year: number
  month: number
  count: number
}

export const MOOD_LABELS: Record<Mood, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Bon',
  NEUTRAL: 'Neutre',
  BAD: 'Mauvais',
  VERY_BAD: 'Très mauvais',
}

export const MOOD_EMOJIS: Record<Mood, string> = {
  EXCELLENT: '😄',
  GOOD: '🙂',
  NEUTRAL: '😐',
  BAD: '😔',
  VERY_BAD: '😞',
}

export const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}'

export const journalApi = {
  getEntries: (params?: {
    search?: string
    mood?: Mood
    favorite?: boolean
    pinned?: boolean
    draft?: boolean
    tag?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    limit?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.mood) q.set('mood', params.mood)
    if (params?.favorite) q.set('favorite', 'true')
    if (params?.pinned) q.set('pinned', 'true')
    if (params?.draft) q.set('draft', 'true')
    if (params?.tag) q.set('tag', params.tag)
    if (params?.dateFrom) q.set('dateFrom', params.dateFrom)
    if (params?.dateTo) q.set('dateTo', params.dateTo)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return apiClient<{ entries: JournalEntry[]; total: number; page: number }>(
      `/api/journal/entries${qs ? `?${qs}` : ''}`
    )
  },

  createEntry: (data: {
    title: string
    content: string
    mood?: Mood | null
    favorite?: boolean
    pinned?: boolean
    draft?: boolean
    tags?: string[]
  }) =>
    apiClient<{ entry: JournalEntry }>('/api/journal/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEntry: (id: string) =>
    apiClient<{ entry: JournalEntry }>(`/api/journal/entries/${id}`),

  updateEntry: (
    id: string,
    data: Partial<{
      title: string
      content: string
      mood: Mood | null
      favorite: boolean
      pinned: boolean
      draft: boolean
      tags: string[]
    }>
  ) =>
    apiClient<{ entry: JournalEntry }>(`/api/journal/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteEntry: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/journal/entries/${id}`, { method: 'DELETE' }),

  getStats: () => apiClient<JournalStats>('/api/journal/stats'),

  getArchives: () =>
    apiClient<{ archives: ArchiveItem[] }>('/api/journal/archives'),
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/api/journal.ts
git commit -m "feat: add journal API types and client functions"
```

---

### Task 6: journal.css + routing + stub pages

**Files:**
- Create: `frontend/src/styles/journal.css`
- Create: `frontend/src/pages/journal/JournalPage.tsx`
- Create stub: `frontend/src/pages/journal/JournalList.tsx`
- Create stub: `frontend/src/pages/journal/EntryDetail.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create frontend/src/styles/journal.css**

```css
/* ---- Layout ---- */
.journal-layout {
  display: flex;
  gap: 1.5rem;
  align-items: flex-start;
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem;
}
.journal-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1.25rem; }
.journal-header { display: flex; justify-content: space-between; align-items: flex-start; }
.journal-title { font-family: 'Playfair Display', serif; font-size: 2rem; color: var(--text-primary); margin-bottom: 0.15rem; }
.journal-count { font-size: 0.85rem; color: var(--text-muted); }

/* ---- Filters ---- */
.journal-filters { display: flex; flex-direction: column; gap: 0.625rem; }
.journal-search { width: 100%; }
.journal-filter-row { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.journal-date-input { width: 140px; font-size: 0.8rem; padding: 0.4rem 0.6rem; }

.filter-toggle {
  background: rgba(255,255,255,0.4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.75rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  transition: all var(--transition);
  white-space: nowrap;
}
.filter-toggle:hover { background: var(--accent-light); color: var(--accent); }
.filter-toggle--active { background: var(--accent-light); color: var(--accent); border-color: rgba(196,119,90,0.35); font-weight: 500; }

/* ---- Entry list ---- */
.journal-entries-list { display: flex; flex-direction: column; gap: 0.75rem; }

/* ---- Entry card ---- */
.entry-card {
  padding: 1rem 1.25rem;
  cursor: pointer;
  transition: all var(--transition);
}
.entry-card:hover { transform: translateY(-1px); box-shadow: var(--shadow-medium); }

.entry-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; }
.entry-card-meta { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.entry-card-date { font-size: 0.75rem; color: var(--text-muted); }
.entry-card-indicators { display: flex; gap: 0.375rem; align-items: center; font-size: 0.8rem; color: var(--text-muted); }
.entry-draft-badge { font-size: 0.68rem; background: rgba(196,119,90,0.12); color: var(--accent); border: 1px solid rgba(196,119,90,0.25); border-radius: 4px; padding: 0.1rem 0.4rem; font-weight: 500; }

.entry-card-title { font-family: 'Playfair Display', serif; font-size: 1.05rem; color: var(--text-primary); margin-bottom: 0.3rem; line-height: 1.3; }
.entry-card-preview { font-size: 0.825rem; color: var(--text-secondary); line-height: 1.55; margin-bottom: 0.5rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.entry-card-tags { display: flex; flex-wrap: wrap; gap: 0.3rem; }

/* ---- Mood ---- */
.entry-mood-chip {
  font-size: 0.72rem;
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  background: rgba(196,119,90,0.1);
  color: var(--text-secondary);
  border: 1px solid rgba(196,119,90,0.2);
}
.mood-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.8rem;
  padding: 0.25rem 0.625rem;
  border-radius: 20px;
  border: 1px solid;
}
.mood-picker { display: flex; gap: 0.375rem; flex-wrap: wrap; }
.mood-picker-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.2rem;
  background: rgba(255,255,255,0.4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.4rem 0.5rem;
  cursor: pointer;
  transition: all var(--transition);
  font-family: 'DM Sans', sans-serif;
  min-width: 52px;
}
.mood-picker-btn:hover { background: var(--accent-light); border-color: rgba(196,119,90,0.3); }
.mood-picker-btn--active { background: var(--accent-light); border-color: rgba(196,119,90,0.5); }
.mood-picker-emoji { font-size: 1.2rem; line-height: 1; }
.mood-picker-label { font-size: 0.6rem; color: var(--text-secondary); text-align: center; }

/* ---- Archives sidebar ---- */
.journal-archives {
  width: 160px;
  flex-shrink: 0;
  background: rgba(255,255,255,0.35);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 1rem;
  position: sticky;
  top: 1.5rem;
}
.journal-archives-title { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.75rem; }
.journal-archive-year { margin-bottom: 0.875rem; }
.journal-archive-year-label { font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.35rem; }
.journal-archive-month {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  background: none;
  border: none;
  padding: 0.25rem 0.4rem;
  font-size: 0.8rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: var(--radius-sm);
  font-family: 'DM Sans', sans-serif;
  transition: all var(--transition);
}
.journal-archive-month:hover { background: var(--accent-light); color: var(--accent); }
.journal-archive-month--active { background: var(--accent-light); color: var(--accent); font-weight: 500; }
.journal-archive-count { font-size: 0.7rem; color: var(--text-muted); }

/* ---- Stats panel ---- */
.stats-panel { padding: 1.25rem; background: rgba(255,255,255,0.35); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border: 1px solid var(--glass-border); border-radius: var(--radius-md); }
.stats-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 1rem; }
.stats-loading { display: flex; justify-content: center; padding: 2rem; }
.stats-chips { display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.stats-chip { background: rgba(255,255,255,0.6); border: 1px solid var(--glass-border); border-radius: var(--radius-sm); padding: 0.625rem 0.875rem; min-width: 80px; text-align: center; }
.stats-chip-value { font-size: 1.4rem; font-weight: 700; color: var(--text-primary); line-height: 1.2; }
.stats-chip-label { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.15rem; }
.stats-section { margin-top: 1rem; }
.stats-section-title { font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.625rem; }
.stats-bar-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.4rem; }
.stats-bar-label { font-size: 0.72rem; color: var(--text-secondary); width: 60px; flex-shrink: 0; }
.stats-bar-track { flex: 1; height: 8px; background: rgba(0,0,0,0.06); border-radius: 4px; overflow: hidden; }
.stats-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }
.stats-bar-value { font-size: 0.68rem; color: var(--text-muted); width: 36px; text-align: right; flex-shrink: 0; }

/* ---- Entry detail page ---- */
.entry-detail { max-width: 1100px; margin: 0 auto; padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem; }
.entry-detail-topbar { display: flex; justify-content: space-between; align-items: center; }
.save-indicator { font-size: 0.78rem; }
.save-indicator--saved { color: var(--text-muted); }
.save-indicator--saving { color: var(--accent); }
.save-indicator--unsaved { color: #C44B4B; }

.entry-detail-layout {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 1.5rem;
  align-items: flex-start;
}
.entry-detail-content { display: flex; flex-direction: column; gap: 0; }
.entry-title-input {
  font-family: 'Playfair Display', serif;
  font-size: 1.9rem;
  color: var(--text-primary);
  background: none;
  border: none;
  outline: none;
  width: 100%;
  padding: 0 0 0.5rem;
  border-bottom: 1px solid transparent;
  transition: border-color var(--transition);
}
.entry-title-input:focus { border-color: var(--glass-border); }
.entry-title-input::placeholder { color: var(--text-muted); }
.entry-date-line { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1rem; text-transform: capitalize; }

.entry-detail-sidebar {
  background: rgba(255,255,255,0.4);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  position: sticky;
  top: 1.5rem;
}
.entry-sidebar-section { display: flex; flex-direction: column; gap: 0.5rem; }
.entry-sidebar-meta .entry-meta-line { font-size: 0.72rem; color: var(--text-muted); }
.tags-chips { display: flex; flex-wrap: wrap; gap: 0.3rem; min-height: 1rem; }
.chip--removable { display: inline-flex; align-items: center; gap: 0.25rem; }
.chip--removable button { background: none; border: none; cursor: pointer; color: var(--text-muted); font-size: 0.8rem; padding: 0; line-height: 1; }
.chip--removable button:hover { color: #C44B4B; }

/* ---- Rich Editor ---- */
.rich-editor { border: 1px solid var(--glass-border); border-radius: var(--radius-sm); background: rgba(255,255,255,0.5); overflow: hidden; }
.rich-editor--readonly { border-color: transparent; background: none; }
.editor-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.125rem;
  padding: 0.5rem 0.625rem;
  border-bottom: 1px solid var(--glass-border);
  background: rgba(255,255,255,0.6);
}
.editor-toolbar-group { display: flex; gap: 0.125rem; }
.editor-toolbar-sep { width: 1px; height: 18px; background: var(--glass-border); margin: 0 0.25rem; }
.editor-toolbar-btn {
  background: none;
  border: 1px solid transparent;
  border-radius: 5px;
  padding: 0.25rem 0.45rem;
  font-size: 0.8rem;
  cursor: pointer;
  color: var(--text-secondary);
  font-family: 'DM Sans', sans-serif;
  font-weight: 500;
  transition: all var(--transition);
  line-height: 1;
  min-width: 26px;
  text-align: center;
}
.editor-toolbar-btn:hover { background: var(--accent-light); color: var(--accent); border-color: rgba(196,119,90,0.25); }
.editor-toolbar-btn--active { background: var(--accent-light); color: var(--accent); border-color: rgba(196,119,90,0.35); }

/* ProseMirror content */
.ProseMirror { outline: none; padding: 1rem; min-height: 320px; line-height: 1.7; color: var(--text-primary); font-size: 0.95rem; }
.ProseMirror p { margin: 0 0 0.5rem; }
.ProseMirror h1 { font-family: 'Playfair Display', serif; font-size: 1.6rem; margin: 1rem 0 0.5rem; color: var(--text-primary); }
.ProseMirror h2 { font-family: 'Playfair Display', serif; font-size: 1.25rem; margin: 0.875rem 0 0.375rem; color: var(--text-primary); }
.ProseMirror h3 { font-family: 'Playfair Display', serif; font-size: 1.05rem; margin: 0.75rem 0 0.25rem; color: var(--text-primary); }
.ProseMirror blockquote { border-left: 3px solid var(--accent); margin: 0.75rem 0; padding: 0.5rem 1rem; color: var(--text-secondary); font-style: italic; background: var(--accent-light); border-radius: 0 var(--radius-sm) var(--radius-sm) 0; }
.ProseMirror ul, .ProseMirror ol { padding-left: 1.5rem; margin: 0.5rem 0; }
.ProseMirror li { margin: 0.2rem 0; }
.ProseMirror a { color: var(--accent); text-decoration: underline; cursor: pointer; }
.ProseMirror img { max-width: 100%; border-radius: var(--radius-sm); margin: 0.5rem 0; }
.ProseMirror hr { border: none; border-top: 1px solid var(--glass-border); margin: 1.25rem 0; }
.ProseMirror table { border-collapse: collapse; width: 100%; margin: 0.75rem 0; }
.ProseMirror td, .ProseMirror th { border: 1px solid var(--glass-border); padding: 0.4rem 0.75rem; min-width: 60px; vertical-align: top; }
.ProseMirror th { background: var(--accent-light); font-weight: 600; }
.ProseMirror .selectedCell { background: rgba(196,119,90,0.08); }
.ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--text-muted);
  pointer-events: none;
  height: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .journal-layout { flex-direction: column; padding: 1rem; }
  .journal-archives { width: 100%; position: static; }
  .entry-detail-layout { grid-template-columns: 1fr; }
  .entry-detail-sidebar { position: static; }
}
```

- [ ] **Step 2: Create frontend/src/pages/journal/JournalPage.tsx**

```typescript
import { Routes, Route, Navigate } from 'react-router-dom'
import { JournalList } from './JournalList'
import { EntryDetail } from './EntryDetail'

export function JournalPage() {
  return (
    <Routes>
      <Route index element={<JournalList />} />
      <Route path=":id" element={<EntryDetail />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  )
}
```

- [ ] **Step 3: Create stub frontend/src/pages/journal/JournalList.tsx**

```typescript
export function JournalList() {
  return <div style={{ padding: '2rem' }}>Journal List — coming soon</div>
}
```

- [ ] **Step 4: Create stub frontend/src/pages/journal/EntryDetail.tsx**

```typescript
export function EntryDetail() {
  return <div style={{ padding: '2rem' }}>Entry Detail — coming soon</div>
}
```

- [ ] **Step 5: Update frontend/src/App.tsx — add /journal/* route**

Add import:
```typescript
import { JournalPage } from './pages/journal/JournalPage'
```

Add route after the `/reading/*` route:
```typescript
<Route
  path="/journal/*"
  element={
    <ProtectedRoute>
      <AppLayout>
        <JournalPage />
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 6: Update frontend/src/main.tsx — import journal.css**

Add after the reading.css import:
```typescript
import './styles/journal.css'
```

- [ ] **Step 7: Run TypeScript build to verify**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npm run build 2>&1 | tail -8
```

Expected: Build succeeds with 0 TypeScript errors.

- [ ] **Step 8: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/styles/journal.css frontend/src/pages/journal/ frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat: add journal CSS, routing, and stub pages"
```

---

### Task 7: RichEditor component

**Files:**
- Create: `frontend/src/components/ui/RichEditor.tsx`

- [ ] **Step 1: Create frontend/src/components/ui/RichEditor.tsx**

```typescript
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Link from '@tiptap/extension-link'
import Image from '@tiptap/extension-image'
import Table from '@tiptap/extension-table'
import TableRow from '@tiptap/extension-table-row'
import TableHeader from '@tiptap/extension-table-header'
import TableCell from '@tiptap/extension-table-cell'
import Placeholder from '@tiptap/extension-placeholder'

interface Props {
  content: string
  onChange?: (json: string, text: string) => void
  placeholder?: string
  readOnly?: boolean
}

interface ToolbarBtnProps {
  onClick: () => void
  active?: boolean
  title: string
  children: React.ReactNode
}

function ToolbarBtn({ onClick, active, title, children }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={`editor-toolbar-btn${active ? ' editor-toolbar-btn--active' : ''}`}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
    >
      {children}
    </button>
  )
}

export function RichEditor({ content, onChange, placeholder, readOnly = false }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      Image,
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
      Placeholder.configure({ placeholder: placeholder ?? 'Commence à écrire…' }),
    ],
    content: (() => { try { return content ? JSON.parse(content) : '' } catch { return '' } })(),
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(JSON.stringify(editor.getJSON()), editor.getText())
    },
  })

  if (!editor) return null

  function insertImage() {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'image/*'
    input.onchange = () => {
      const file = input.files?.[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = () => {
        editor.chain().focus().setImage({ src: reader.result as string }).run()
      }
      reader.readAsDataURL(file)
    }
    input.click()
  }

  function insertLink() {
    const url = window.prompt('URL du lien :')
    if (url) editor.chain().focus().setLink({ href: url }).run()
  }

  return (
    <div className={`rich-editor${readOnly ? ' rich-editor--readonly' : ''}`}>
      {!readOnly && (
        <div className="editor-toolbar">
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="Gras"><strong>B</strong></ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="Italique"><em>I</em></ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="Souligné"><u>U</u></ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="Barré"><s>S</s></ToolbarBtn>
          </div>
          <div className="editor-toolbar-sep" />
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="Titre 1">H1</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="Titre 2">H2</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="Titre 3">H3</ToolbarBtn>
          </div>
          <div className="editor-toolbar-sep" />
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="Liste à puces">•—</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="Liste numérotée">1.</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="Citation">❝</ToolbarBtn>
          </div>
          <div className="editor-toolbar-sep" />
          <div className="editor-toolbar-group">
            <ToolbarBtn onClick={insertLink} active={editor.isActive('link')} title="Lien">🔗</ToolbarBtn>
            <ToolbarBtn onClick={insertImage} active={false} title="Image">🖼</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().setHorizontalRule().run()} active={false} title="Séparateur">—</ToolbarBtn>
            <ToolbarBtn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} active={false} title="Tableau">⊞</ToolbarBtn>
          </div>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript build**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npm run build 2>&1 | tail -8
```

Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/components/ui/RichEditor.tsx
git commit -m "feat: add reusable RichEditor Tiptap component"
```

---

### Task 8: EntryCard + MoodBadge + MoodPicker

**Files:**
- Create: `frontend/src/components/journal/EntryCard.tsx`
- Create: `frontend/src/components/journal/MoodBadge.tsx`
- Create: `frontend/src/components/journal/MoodPicker.tsx`

- [ ] **Step 1: Create frontend/src/components/journal/MoodBadge.tsx**

```typescript
import { Mood, MOOD_EMOJIS, MOOD_LABELS } from '../../api/journal'

const MOOD_BG: Record<Mood, string> = {
  EXCELLENT: 'rgba(72,187,120,0.15)',
  GOOD: 'rgba(104,211,145,0.15)',
  NEUTRAL: 'rgba(160,160,160,0.15)',
  BAD: 'rgba(247,179,80,0.15)',
  VERY_BAD: 'rgba(229,100,100,0.15)',
}

const MOOD_BORDER: Record<Mood, string> = {
  EXCELLENT: 'rgba(72,187,120,0.4)',
  GOOD: 'rgba(104,211,145,0.4)',
  NEUTRAL: 'rgba(160,160,160,0.4)',
  BAD: 'rgba(247,179,80,0.4)',
  VERY_BAD: 'rgba(229,100,100,0.4)',
}

interface Props { mood: Mood }

export function MoodBadge({ mood }: Props) {
  return (
    <span
      className="mood-badge"
      style={{ background: MOOD_BG[mood], borderColor: MOOD_BORDER[mood] }}
    >
      {MOOD_EMOJIS[mood]} {MOOD_LABELS[mood]}
    </span>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/journal/MoodPicker.tsx**

```typescript
import { Mood, MOOD_EMOJIS, MOOD_LABELS } from '../../api/journal'

const MOODS: Mood[] = ['EXCELLENT', 'GOOD', 'NEUTRAL', 'BAD', 'VERY_BAD']

interface Props {
  value: Mood | null
  onChange: (mood: Mood | null) => void
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <div className="mood-picker">
      {MOODS.map(mood => (
        <button
          key={mood}
          type="button"
          className={`mood-picker-btn${value === mood ? ' mood-picker-btn--active' : ''}`}
          onClick={() => onChange(value === mood ? null : mood)}
          title={MOOD_LABELS[mood]}
        >
          <span className="mood-picker-emoji">{MOOD_EMOJIS[mood]}</span>
          <span className="mood-picker-label">{MOOD_LABELS[mood]}</span>
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/journal/EntryCard.tsx**

```typescript
import { JournalEntry, MOOD_EMOJIS, MOOD_LABELS } from '../../api/journal'
import { GlassCard } from '../ui/GlassCard'

interface Props {
  entry: JournalEntry
  onClick: () => void
}

export function EntryCard({ entry, onClick }: Props) {
  const dateStr = new Date(entry.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const preview = entry.contentText.trim().slice(0, 120)

  return (
    <GlassCard className="entry-card" onClick={onClick}>
      <div className="entry-card-header">
        <div className="entry-card-meta">
          <span className="entry-card-date">{dateStr}</span>
          {entry.mood && (
            <span className="entry-mood-chip">
              {MOOD_EMOJIS[entry.mood]} {MOOD_LABELS[entry.mood]}
            </span>
          )}
        </div>
        <div className="entry-card-indicators">
          {entry.pinned && <span title="Épinglée">📌</span>}
          {entry.favorite && <span title="Favori" style={{ color: '#C4775A' }}>★</span>}
          {entry.draft && <span className="entry-draft-badge">Brouillon</span>}
        </div>
      </div>
      <h3 className="entry-card-title">{entry.title || <em style={{ color: 'var(--text-muted)' }}>Sans titre</em>}</h3>
      {preview && (
        <p className="entry-card-preview">
          {preview}{entry.contentText.length > 120 ? '…' : ''}
        </p>
      )}
      {entry.tags.length > 0 && (
        <div className="entry-card-tags">
          {entry.tags.slice(0, 3).map(t => (
            <span key={t.id} className="chip">{t.name}</span>
          ))}
          {entry.tags.length > 3 && (
            <span className="chip">+{entry.tags.length - 3}</span>
          )}
        </div>
      )}
    </GlassCard>
  )
}
```

- [ ] **Step 4: Run TypeScript build**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npm run build 2>&1 | tail -8
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/components/journal/
git commit -m "feat: add EntryCard, MoodBadge, MoodPicker components"
```

---

### Task 9: StatsPanel component

**Files:**
- Create: `frontend/src/components/journal/StatsPanel.tsx`

- [ ] **Step 1: Create frontend/src/components/journal/StatsPanel.tsx**

```typescript
import { useEffect, useState } from 'react'
import { journalApi, JournalStats } from '../../api/journal'

function moodColor(avg: number): string {
  if (avg <= 1.5) return '#48bb78'
  if (avg <= 2.5) return '#68d391'
  if (avg <= 3.5) return '#a0a0a0'
  if (avg <= 4.5) return '#f7b350'
  return '#e56464'
}

function moodLabel(avg: number): string {
  const rounded = Math.round(avg)
  return ['', 'Exc.', 'Bon', 'Neu.', 'Mau.', 'T.Mau.'][rounded] ?? ''
}

function MoodBar({ avg, label }: { avg: number; label: string }) {
  const pct = Math.round(((5 - avg) / 4) * 100)
  return (
    <div className="stats-bar-row">
      <span className="stats-bar-label">{label}</span>
      <div className="stats-bar-track">
        <div className="stats-bar-fill" style={{ width: `${pct}%`, background: moodColor(avg) }} />
      </div>
      <span className="stats-bar-value">{moodLabel(avg)}</span>
    </div>
  )
}

export function StatsPanel() {
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    journalApi.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="stats-loading"><div className="loading-spinner" /></div>
  if (!stats) return null

  function monthLabel(m: string) {
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  }

  return (
    <div className="stats-panel">
      <h2 className="stats-title">Statistiques</h2>

      <div className="stats-chips">
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.totalEntries}</div>
          <div className="stats-chip-label">Entrées</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.totalWords.toLocaleString('fr-FR')}</div>
          <div className="stats-chip-label">Mots</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.currentStreak}</div>
          <div className="stats-chip-label">Série actuelle</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.longestStreak}</div>
          <div className="stats-chip-label">Meilleure série</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.avgEntriesPerWeek}</div>
          <div className="stats-chip-label">Entrées/sem.</div>
        </div>
      </div>

      {stats.moodByMonth.length > 0 && (
        <div className="stats-section">
          <div className="stats-section-title">Humeur par mois</div>
          {stats.moodByMonth.slice(-6).map(m => (
            <MoodBar key={m.month} avg={m.avg} label={monthLabel(m.month)} />
          ))}
        </div>
      )}

      {stats.moodByWeek.length > 0 && (
        <div className="stats-section">
          <div className="stats-section-title">Humeur par semaine</div>
          {stats.moodByWeek.slice(-8).map(w => (
            <MoodBar key={w.week} avg={w.avg} label={w.week.replace(/^\d{4}-/, '')} />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/components/journal/StatsPanel.tsx
git commit -m "feat: add StatsPanel component with mood bar charts"
```

---

### Task 10: JournalList page

**Files:**
- Modify: `frontend/src/pages/journal/JournalList.tsx`

- [ ] **Step 1: Replace stub with full JournalList.tsx**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { journalApi, JournalEntry, Mood, ArchiveItem, EMPTY_DOC } from '../../api/journal'
import { EntryCard } from '../../components/journal/EntryCard'
import { StatsPanel } from '../../components/journal/StatsPanel'

const MOODS: { value: Mood; label: string; emoji: string }[] = [
  { value: 'EXCELLENT', label: 'Excellent', emoji: '😄' },
  { value: 'GOOD', label: 'Bon', emoji: '🙂' },
  { value: 'NEUTRAL', label: 'Neutre', emoji: '😐' },
  { value: 'BAD', label: 'Mauvais', emoji: '😔' },
  { value: 'VERY_BAD', label: 'Très mauvais', emoji: '😞' },
]

const MONTH_NAMES = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

export function JournalList() {
  const navigate = useNavigate()
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [mood, setMood] = useState<Mood | ''>('')
  const [favorite, setFavorite] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [draft, setDraft] = useState(false)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [archives, setArchives] = useState<ArchiveItem[]>([])
  const [showStats, setShowStats] = useState(false)

  useEffect(() => {
    journalApi.getArchives().then(d => setArchives(d.archives)).catch(() => {})
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 400)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setLoading(true)
    journalApi.getEntries({
      search: search || undefined,
      mood: mood || undefined,
      favorite: favorite || undefined,
      pinned: pinned || undefined,
      draft: draft || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    })
      .then(d => { setEntries(d.entries); setTotal(d.total) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search, mood, favorite, pinned, draft, dateFrom, dateTo])

  async function handleNew() {
    try {
      const { entry } = await journalApi.createEntry({ title: '', content: EMPTY_DOC, draft: true })
      navigate(`/journal/${entry.id}`)
    } catch {}
  }

  function selectArchive(year: number, month: number) {
    setDateFrom(new Date(year, month - 1, 1).toISOString())
    setDateTo(new Date(year, month, 0, 23, 59, 59).toISOString())
  }

  function clearArchive() {
    setDateFrom('')
    setDateTo('')
  }

  function clearFilters() {
    setMood('')
    setFavorite(false)
    setPinned(false)
    setDraft(false)
    setDateFrom('')
    setDateTo('')
  }

  const hasFilters = !!(mood || favorite || pinned || draft || dateFrom || dateTo)

  const activeArchiveYear = dateFrom ? new Date(dateFrom).getFullYear() : null
  const activeArchiveMonth = dateFrom ? new Date(dateFrom).getMonth() + 1 : null

  return (
    <div className="journal-layout">
      <div className="journal-main">
        <div className="journal-header">
          <div>
            <h1 className="journal-title">Journal</h1>
            <div className="journal-count">{total} entrée{total !== 1 ? 's' : ''}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowStats(s => !s)}>
              📊 Stats
            </button>
            <button className="btn btn-primary" onClick={handleNew}>+ Nouvelle entrée</button>
          </div>
        </div>

        {showStats && <StatsPanel />}

        <div className="journal-filters">
          <input
            className="input-field journal-search"
            placeholder="Rechercher dans le journal…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
          />
          <div className="journal-filter-row">
            <select
              className="status-select"
              value={mood}
              onChange={e => setMood(e.target.value as Mood | '')}
            >
              <option value="">Toutes les humeurs</option>
              {MOODS.map(m => (
                <option key={m.value} value={m.value}>{m.emoji} {m.label}</option>
              ))}
            </select>
            <button
              className={`filter-toggle${favorite ? ' filter-toggle--active' : ''}`}
              onClick={() => setFavorite(f => !f)}
            >★ Favoris</button>
            <button
              className={`filter-toggle${pinned ? ' filter-toggle--active' : ''}`}
              onClick={() => setPinned(p => !p)}
            >📌 Épinglées</button>
            <button
              className={`filter-toggle${draft ? ' filter-toggle--active' : ''}`}
              onClick={() => setDraft(d => !d)}
            >✏ Brouillons</button>
            <input
              type="date"
              className="input-field journal-date-input"
              value={dateFrom ? dateFrom.slice(0, 10) : ''}
              onChange={e => setDateFrom(e.target.value ? new Date(e.target.value).toISOString() : '')}
              title="Depuis"
            />
            <input
              type="date"
              className="input-field journal-date-input"
              value={dateTo ? dateTo.slice(0, 10) : ''}
              onChange={e => setDateTo(e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : '')}
              title="Jusqu'au"
            />
            {hasFilters && (
              <button className="btn btn-ghost btn-sm" onClick={clearFilters}>✕ Réinitialiser</button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="reading-loading"><div className="loading-spinner" /></div>
        ) : entries.length === 0 ? (
          <div className="reading-empty">
            <div className="reading-empty-icon">📓</div>
            <p>
              {search || hasFilters
                ? 'Aucune entrée ne correspond à ces filtres.'
                : 'Ton journal est vide. Commence à écrire !'}
            </p>
            {!search && !hasFilters && (
              <button className="btn btn-primary" onClick={handleNew}>+ Première entrée</button>
            )}
          </div>
        ) : (
          <div className="journal-entries-list">
            {entries.map(e => (
              <EntryCard key={e.id} entry={e} onClick={() => navigate(`/journal/${e.id}`)} />
            ))}
          </div>
        )}
      </div>

      {archives.length > 0 && (
        <div className="journal-archives">
          <div className="journal-archives-title">Archives</div>
          {[...new Set(archives.map(a => a.year))].sort((a, b) => b - a).map(year => (
            <div key={year} className="journal-archive-year">
              <div className="journal-archive-year-label">{year}</div>
              {archives.filter(a => a.year === year).map(a => (
                <button
                  key={`${a.year}-${a.month}`}
                  className={`journal-archive-month${activeArchiveYear === a.year && activeArchiveMonth === a.month ? ' journal-archive-month--active' : ''}`}
                  onClick={() => selectArchive(a.year, a.month)}
                >
                  {MONTH_NAMES[a.month - 1]}
                  <span className="journal-archive-count">{a.count}</span>
                </button>
              ))}
            </div>
          ))}
          {(dateFrom || dateTo) && (
            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: '0.5rem', width: '100%' }}
              onClick={clearArchive}
            >
              Tout afficher
            </button>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript build**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npm run build 2>&1 | tail -8
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/pages/journal/JournalList.tsx
git commit -m "feat: add JournalList page with search, filters, archives sidebar, and stats"
```

---

### Task 11: EntryDetail page

**Files:**
- Modify: `frontend/src/pages/journal/EntryDetail.tsx`

- [ ] **Step 1: Replace stub with full EntryDetail.tsx**

```typescript
import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { journalApi, JournalEntry, Mood } from '../../api/journal'
import { RichEditor } from '../../components/ui/RichEditor'
import { MoodPicker } from '../../components/journal/MoodPicker'

export function EntryDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [tagInput, setTagInput] = useState('')
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    if (!id) return
    journalApi.getEntry(id)
      .then(d => setEntry(d.entry))
      .catch(() => navigate('/journal'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  function scheduleSave(updates: Partial<Parameters<typeof journalApi.updateEntry>[1]>) {
    setSaveStatus('unsaved')
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      if (!entry) return
      setSaveStatus('saving')
      try {
        const saved = await journalApi.updateEntry(entry.id, updates)
        setEntry(prev => prev ? {
          ...prev,
          updatedAt: saved.entry.updatedAt,
          tags: saved.entry.tags,
          mood: saved.entry.mood,
          favorite: saved.entry.favorite,
          pinned: saved.entry.pinned,
          draft: saved.entry.draft,
        } : prev)
        setSaveStatus('saved')
      } catch {
        setSaveStatus('unsaved')
      }
    }, 1000)
  }

  function handleTitle(title: string) {
    setEntry(prev => prev ? { ...prev, title } : prev)
    scheduleSave({ title })
  }

  function handleContent(json: string) {
    setEntry(prev => prev ? { ...prev, content: json } : prev)
    scheduleSave({ content: json })
  }

  function handleMood(mood: Mood | null) {
    setEntry(prev => prev ? { ...prev, mood } : prev)
    scheduleSave({ mood })
  }

  function handleToggle(field: 'favorite' | 'pinned' | 'draft', value: boolean) {
    setEntry(prev => prev ? { ...prev, [field]: value } : prev)
    scheduleSave({ [field]: value })
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim() && entry) {
      e.preventDefault()
      const name = tagInput.trim().toLowerCase()
      if (!entry.tags.find(t => t.name === name)) {
        const newTagNames = [...entry.tags.map(t => t.name), name]
        setEntry(prev => prev
          ? { ...prev, tags: [...prev.tags, { id: `temp-${name}`, name, entryId: entry.id }] }
          : prev
        )
        scheduleSave({ tags: newTagNames })
      }
      setTagInput('')
    }
  }

  function handleTagRemove(name: string) {
    if (!entry) return
    const newTagNames = entry.tags.filter(t => t.name !== name).map(t => t.name)
    setEntry(prev => prev ? { ...prev, tags: prev.tags.filter(t => t.name !== name) } : prev)
    scheduleSave({ tags: newTagNames })
  }

  async function handleDelete() {
    if (!entry || !confirm(`Supprimer "${entry.title || 'cette entrée'}" ?`)) return
    try { await journalApi.deleteEntry(entry.id); navigate('/journal') } catch {}
  }

  if (loading) return <div className="reading-loading"><div className="loading-spinner" /></div>
  if (!entry) return null

  const dateStr = new Date(entry.createdAt).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="entry-detail">
      <div className="entry-detail-topbar">
        <button className="book-detail-back" onClick={() => navigate('/journal')}>← Journal</button>
        <span className={`save-indicator save-indicator--${saveStatus}`}>
          {saveStatus === 'saving' ? 'Enregistrement…' : saveStatus === 'unsaved' ? '●' : 'Enregistré'}
        </span>
      </div>

      <div className="entry-detail-layout">
        <div className="entry-detail-content">
          <input
            className="entry-title-input"
            placeholder="Titre de l'entrée"
            value={entry.title}
            onChange={e => handleTitle(e.target.value)}
          />
          <div className="entry-date-line">{dateStr}</div>
          <RichEditor
            content={entry.content}
            onChange={handleContent}
            placeholder="Commence à écrire…"
          />
        </div>

        <div className="entry-detail-sidebar">
          <div className="entry-sidebar-section">
            <div className="input-label">Humeur</div>
            <MoodPicker value={entry.mood} onChange={handleMood} />
          </div>

          <div className="entry-sidebar-section">
            <div className="input-label">Tags</div>
            <div className="tags-chips">
              {entry.tags.map(t => (
                <span key={t.id} className="chip chip--removable">
                  {t.name}
                  <button type="button" onClick={() => handleTagRemove(t.name)}>×</button>
                </span>
              ))}
            </div>
            <input
              className="input-field"
              style={{ fontSize: '0.8rem', padding: '0.4rem 0.6rem' }}
              placeholder="Ajouter un tag (Entrée)…"
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
            />
          </div>

          <div className="entry-sidebar-section">
            <div className="input-label">Options</div>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={entry.favorite}
                onChange={e => handleToggle('favorite', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              ★ Favori
            </label>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={entry.pinned}
                onChange={e => handleToggle('pinned', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              📌 Épinglée
            </label>
            <label className="owned-toggle">
              <input
                type="checkbox"
                checked={entry.draft}
                onChange={e => handleToggle('draft', e.target.checked)}
                style={{ accentColor: 'var(--accent)' }}
              />
              ✏ Brouillon
            </label>
          </div>

          <div className="entry-sidebar-section entry-sidebar-meta">
            <div className="input-label">Infos</div>
            <div className="entry-meta-line">
              Créée le {new Date(entry.createdAt).toLocaleDateString('fr-FR')}
            </div>
            <div className="entry-meta-line">
              Modifiée le {new Date(entry.updatedAt).toLocaleDateString('fr-FR')}
            </div>
          </div>

          <button
            className="btn-side"
            style={{ color: '#C44B4B', marginTop: '0.5rem' }}
            onClick={handleDelete}
          >
            🗑 Supprimer
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript build**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npm run build 2>&1 | tail -8
```

Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add frontend/src/pages/journal/EntryDetail.tsx
git commit -m "feat: add EntryDetail page with Tiptap editor, auto-save, and sidebar"
```

---

### Task 12: Final wiring — all tests + docker build

- [ ] **Step 1: Run full backend test suite**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/backend"
npm test 2>&1 | tail -12
```

Expected: All test suites PASS (auth + shortcuts + reading.books + reading.notes + journal.entries).

- [ ] **Step 2: Rebuild Docker and smoke test**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
docker-compose up --build -d
```

Wait 30 seconds, then:

```bash
# Register
curl -s -c /tmp/j.txt -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Journal Test","email":"journal-smoke@test.com","password":"password123"}'

# Create an entry
curl -s -b /tmp/j.txt -X POST http://localhost/api/journal/entries \
  -H "Content-Type: application/json" \
  -d '{"title":"Premier test","content":"{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Hello journal\"}]}]}","mood":"GOOD"}'

# List entries
curl -s -b /tmp/j.txt http://localhost/api/journal/entries

# Stats
curl -s -b /tmp/j.txt http://localhost/api/journal/stats

# Archives
curl -s -b /tmp/j.txt http://localhost/api/journal/archives

# Logout
curl -s -b /tmp/j.txt -X POST http://localhost/api/auth/logout
```

Expected: All curl commands return valid JSON. Entry appears in list. Stats show totalEntries: 1. Archives show current month.

- [ ] **Step 3: Commit**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde"
git add .
git commit -m "feat: journal module phase 1 complete — all tests passing, docker verified"
```
