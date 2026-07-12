# Reading Module Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete personal book library with reading tracking, notes, ratings, and Google Books auto-fill.

**Architecture:** Backend adds 3 new Prisma models (Book, BookTag, BookNote) and a `/api/reading/*` router with Google Books proxy and multer file uploads. Frontend adds `/reading/*` pages with grid/list library view, book detail, add modal, and note management. All book data is stored locally — Google Books is only used to pre-fill the add form.

**Tech Stack:** multer (file uploads), Node 20 native fetch (Google Books proxy), React Router nested routes, localStorage for view preference

---

## File Map

```
backend/
├── prisma/schema.prisma                  MODIFY — add Book, BookTag, BookNote, ReadingStatus
├── package.json                          MODIFY — add multer, @types/multer
├── src/
│   ├── app.ts                            MODIFY — serve /uploads static, register /api/reading
│   ├── lib/upload.ts                     CREATE — multer diskStorage config
│   └── routes/reading/
│       ├── index.ts                      CREATE — mounts search + books + notes
│       ├── search.ts                     CREATE — GET /search?q= → Google Books proxy
│       ├── books.ts                      CREATE — CRUD + progress + cover upload
│       └── notes.ts                      CREATE — CRUD notes per book
├── src/__tests__/
│   ├── reading.books.test.ts             CREATE
│   └── reading.notes.test.ts             CREATE
└── src/routes/modules.ts                 MODIFY — reading available: true

docker-compose.yml                        MODIFY — add uploads_data volume

frontend/
├── src/
│   ├── main.tsx                          MODIFY — import reading.css
│   ├── App.tsx                           MODIFY — add /reading/* route
│   ├── api/reading.ts                    CREATE — types + API functions
│   ├── styles/reading.css                CREATE — all reading module styles
│   ├── pages/reading/
│   │   ├── ReadingPage.tsx               CREATE — internal router
│   │   ├── BookLibrary.tsx               CREATE — grid/list + search/filter
│   │   ├── BookDetail.tsx                CREATE — full book view
│   │   └── AddBookModal.tsx              CREATE — Google Books search + form
│   └── components/reading/
│       ├── BookCard.tsx                  CREATE — grid card
│       ├── BookRow.tsx                   CREATE — list row
│       ├── BookStatusBadge.tsx           CREATE — colored status chip
│       ├── ProgressBar.tsx               CREATE — progress bar + %
│       ├── StarRating.tsx                CREATE — interactive 1-5 stars
│       ├── NoteCard.tsx                  CREATE — note display
│       ├── NoteForm.tsx                  CREATE — note add/edit form
│       └── ProgressUpdateForm.tsx        CREATE — update current page
```

---

### Task 1: Backend — Prisma schema + multer dependency

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Modify: `backend/package.json`

- [ ] **Step 1: Add multer to backend**

```bash
cd backend && npm install multer && npm install --save-dev @types/multer
```

- [ ] **Step 2: Update backend/prisma/schema.prisma**

Add `books Book[]` to the User model, then add these new models at the end of the file:

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String
  name      String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  shortcuts Shortcut[]
  books     Book[]
}

enum ReadingStatus {
  WISHLIST
  TO_READ
  READING
  FINISHED
  ABANDONED
}

model Book {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id], onDelete: Cascade)

  title         String
  author        String
  synopsis      String?
  isbn          String?
  pageCount     Int?
  genres        String[]
  coverUrl      String?
  coverType     String?
  googleBooksId String?

  status        ReadingStatus @default(WISHLIST)
  owned         Boolean       @default(false)

  rating        Int?
  review        String?

  favorite      Boolean       @default(false)
  rereadCount   Int           @default(0)
  tags          BookTag[]

  currentPage   Int?
  startedAt     DateTime?
  finishedAt    DateTime?

  notes         BookNote[]
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt

  @@index([userId])
  @@index([userId, status])
}

model BookTag {
  id     String @id @default(cuid())
  name   String
  bookId String
  book   Book   @relation(fields: [bookId], references: [id], onDelete: Cascade)

  @@unique([bookId, name])
  @@index([bookId])
}

model BookNote {
  id        String   @id @default(cuid())
  bookId    String
  book      Book     @relation(fields: [bookId], references: [id], onDelete: Cascade)

  title     String
  content   String
  chapter   String?
  page      Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([bookId])
}
```

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_reading_module
```

Expected: migration file created, tables `Book`, `BookTag`, `BookNote`, enum `ReadingStatus` created.

- [ ] **Step 4: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/ backend/package.json backend/package-lock.json
git commit -m "feat: add reading module Prisma schema — Book, BookTag, BookNote"
```

---

### Task 2: Backend — Multer config + static serving + docker volume

**Files:**
- Create: `backend/src/lib/upload.ts`
- Modify: `backend/src/app.ts`
- Modify: `backend/.env`
- Modify: `docker-compose.yml`

- [ ] **Step 1: Create backend/src/lib/upload.ts**

```typescript
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads', 'covers')

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`
    cb(null, unique)
  },
})

export const uploadCover = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp']
    if (allowed.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'))
    }
  },
})

export const UPLOADS_BASE = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads')
```

- [ ] **Step 2: Update backend/src/app.ts — add static serving**

Full updated `backend/src/app.ts`:

```typescript
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import authRouter from './routes/auth'
import modulesRouter from './routes/modules'
import shortcutsRouter from './routes/shortcuts'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

// Serve uploaded files
const uploadsDir = process.env.UPLOADS_DIR
  ? path.dirname(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.use('/api/auth', authRouter)
app.use('/api/modules', modulesRouter)
app.use('/api/shortcuts', shortcutsRouter)

// Global error handler
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
```

- [ ] **Step 3: Add UPLOADS_DIR to backend/.env**

Append to `backend/.env`:

```
UPLOADS_DIR=./uploads/covers
```

- [ ] **Step 4: Add uploads volume to docker-compose.yml**

In the `backend` service, add volumes. Updated backend service section:

```yaml
  backend:
    build: ./backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-monmonde}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-monmonde}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required}
      NODE_ENV: production
      PORT: 3001
      FRONTEND_URL: ${FRONTEND_URL:-http://localhost}
      UPLOADS_DIR: /app/uploads/covers
    depends_on:
      postgres:
        condition: service_healthy
    volumes:
      - uploads_data:/app/uploads
```

Also add `uploads_data:` to the top-level `volumes:` section:

```yaml
volumes:
  postgres_data:
  uploads_data:
```

- [ ] **Step 5: Commit**

```bash
git add backend/src/lib/upload.ts backend/src/app.ts docker-compose.yml
git commit -m "feat: add multer upload config and static file serving"
```

---

### Task 3: Backend — Reading router skeleton + modules.ts update

**Files:**
- Create: `backend/src/routes/reading/index.ts`
- Modify: `backend/src/routes/modules.ts`
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Create backend/src/routes/reading/index.ts**

```typescript
import { Router } from 'express'
import searchRouter from './search'
import booksRouter from './books'

const router = Router()

router.use('/search', searchRouter)
router.use('/books', booksRouter)

export default router
```

- [ ] **Step 2: Register reading router in app.ts**

Add import and route to `backend/src/app.ts` (after shortcutsRouter line):

```typescript
import readingRouter from './routes/reading'

// Add after shortcuts line:
app.use('/api/reading', readingRouter)
```

Full updated `backend/src/app.ts`:

```typescript
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import path from 'path'
import fs from 'fs'
import authRouter from './routes/auth'
import modulesRouter from './routes/modules'
import shortcutsRouter from './routes/shortcuts'
import readingRouter from './routes/reading'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

const uploadsDir = process.env.UPLOADS_DIR
  ? path.dirname(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true })
app.use('/uploads', express.static(uploadsDir))

app.use('/api/auth', authRouter)
app.use('/api/modules', modulesRouter)
app.use('/api/shortcuts', shortcutsRouter)
app.use('/api/reading', readingRouter)

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
})

export default app
```

- [ ] **Step 3: Update modules.ts — reading available: true**

```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

const MODULES = [
  { slug: 'projects', name: 'Projets', description: 'Gérez vos projets et tâches', icon: '📋', available: false },
  { slug: 'journal', name: 'Journal', description: 'Notes et journaling personnel', icon: '📓', available: false },
  { slug: 'finances', name: 'Finances', description: 'Budget, dépenses et objectifs', icon: '💰', available: false },
  { slug: 'habits', name: 'Habitudes', description: 'Routines et suivi des habitudes', icon: '✅', available: false },
  { slug: 'reading', name: 'Lectures', description: 'Livres lus et en cours', icon: '📚', available: true },
]

router.get('/', requireAuth, (_req, res) => {
  res.json({ modules: MODULES })
})

export default router
```

- [ ] **Step 4: Commit**

```bash
git add backend/src/routes/reading/ backend/src/routes/modules.ts backend/src/app.ts
git commit -m "feat: register reading router, set reading module available"
```

---

### Task 4: Backend — Search route (Google Books proxy) + test

**Files:**
- Create: `backend/src/routes/reading/search.ts`

- [ ] **Step 1: Create backend/src/routes/reading/search.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'

const router = Router()

interface GoogleBook {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
    pageCount?: number
    categories?: string[]
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=10&langRestrict=fr`
    const response = await fetch(url)

    if (!response.ok) {
      res.status(502).json({ error: 'Google Books API unavailable' })
      return
    }

    const data = await response.json() as { items?: GoogleBook[] }

    const books = (data.items || []).map((item) => ({
      googleBooksId: item.id,
      title: item.volumeInfo.title || 'Sans titre',
      author: item.volumeInfo.authors?.join(', ') || 'Auteur inconnu',
      synopsis: item.volumeInfo.description,
      coverUrl: (item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail)
        ?.replace('http:', 'https:'),
      isbn: item.volumeInfo.industryIdentifiers
        ?.find(i => i.type === 'ISBN_13' || i.type === 'ISBN_10')?.identifier,
      pageCount: item.volumeInfo.pageCount,
      genres: item.volumeInfo.categories || [],
    }))

    res.json({ books })
  } catch (err) {
    next(err)
  }
})

export default router
```

- [ ] **Step 2: Quick manual test (dev server must be running)**

```bash
cd backend && npm run dev &
sleep 3

# Register + get cookie
curl -s -c /tmp/test-cookies.txt -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Dev","email":"dev@test.com","password":"password123"}' > /dev/null

# Test search
curl -s -b /tmp/test-cookies.txt \
  "http://localhost:3001/api/reading/search?q=dune+frank+herbert" | head -c 300

# Cleanup
curl -s -b /tmp/test-cookies.txt -X POST http://localhost:3001/api/auth/logout > /dev/null
kill %1
```

Expected: JSON with `books` array containing Dune entries.

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/reading/search.ts
git commit -m "feat: add Google Books search proxy"
```

---

### Task 5: Backend — Books routes (TDD)

**Files:**
- Create: `backend/src/__tests__/reading.books.test.ts`
- Create: `backend/src/routes/reading/books.ts`

- [ ] **Step 1: Write failing tests**

Create `backend/src/__tests__/reading.books.test.ts`:

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'reading-books@example.com'
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
  await prisma.book.deleteMany({ where: { userId } })
})

describe('POST /api/reading/books', () => {
  it('creates a book with default WISHLIST status', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Dune', author: 'Frank Herbert', pageCount: 412 })

    expect(res.status).toBe(201)
    expect(res.body.book.title).toBe('Dune')
    expect(res.body.book.status).toBe('WISHLIST')
    expect(res.body.book.tags).toEqual([])
  })

  it('creates a book with tags', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Dune', author: 'Frank Herbert', tags: ['SF', 'Classique'] })

    expect(res.status).toBe(201)
    expect(res.body.book.tags.map((t: { name: string }) => t.name)).toEqual(
      expect.arrayContaining(['SF', 'Classique'])
    )
  })

  it('returns 400 if title missing', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ author: 'Frank Herbert' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/reading/books')
      .send({ title: 'Dune', author: 'Frank Herbert' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/reading/books', () => {
  beforeEach(async () => {
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Book READING', author: 'Author', status: 'READING' })
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Book FINISHED', author: 'Author', status: 'FINISHED' })
  })

  it('returns all books', async () => {
    const res = await request(app).get('/api/reading/books').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.books.length).toBe(2)
  })

  it('filters by status', async () => {
    const res = await request(app)
      .get('/api/reading/books?status=READING')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.books.length).toBe(1)
    expect(res.body.books[0].status).toBe('READING')
  })

  it('filters by search query', async () => {
    const res = await request(app)
      .get('/api/reading/books?search=FINISHED')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.books.length).toBe(1)
  })
})

describe('GET /api/reading/books/:id', () => {
  it('returns book with tags and notes', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Detail Book', author: 'Author' })
    const id = createRes.body.book.id

    const res = await request(app).get(`/api/reading/books/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.book.id).toBe(id)
    expect(Array.isArray(res.body.book.notes)).toBe(true)
  })

  it('returns 404 for another user book', async () => {
    const res = await request(app)
      .get('/api/reading/books/nonexistentid')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})

describe('PUT /api/reading/books/:id', () => {
  it('updates book fields and tags', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Original', author: 'Author', tags: ['Old'] })
    const id = createRes.body.book.id

    const res = await request(app)
      .put(`/api/reading/books/${id}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', status: 'READING', tags: ['New'] })

    expect(res.status).toBe(200)
    expect(res.body.book.title).toBe('Updated')
    expect(res.body.book.status).toBe('READING')
    expect(res.body.book.tags.map((t: { name: string }) => t.name)).toEqual(['New'])
  })
})

describe('DELETE /api/reading/books/:id', () => {
  it('deletes a book', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'To Delete', author: 'Author' })
    const id = createRes.body.book.id

    const res = await request(app).delete(`/api/reading/books/${id}`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('PUT /api/reading/books/:id/progress', () => {
  it('updates current page', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Progress Book', author: 'Author', pageCount: 300, status: 'READING' })
    const id = createRes.body.book.id

    const res = await request(app)
      .put(`/api/reading/books/${id}/progress`)
      .set('Cookie', cookie)
      .send({ currentPage: 150 })

    expect(res.status).toBe(200)
    expect(res.body.book.currentPage).toBe(150)
  })

  it('auto-sets FINISHED when currentPage >= pageCount', async () => {
    const createRes = await request(app)
      .post('/api/reading/books')
      .set('Cookie', cookie)
      .send({ title: 'Finish Book', author: 'Author', pageCount: 300, status: 'READING' })
    const id = createRes.body.book.id

    const res = await request(app)
      .put(`/api/reading/books/${id}/progress`)
      .set('Cookie', cookie)
      .send({ currentPage: 300 })

    expect(res.status).toBe(200)
    expect(res.body.book.status).toBe('FINISHED')
  })
})
```

- [ ] **Step 2: Run tests — confirm FAIL**

```bash
cd backend && npm test -- --testPathPattern=reading.books
```

Expected: FAIL — Cannot POST /api/reading/books

- [ ] **Step 3: Create backend/src/routes/reading/books.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { uploadCover } from '../../lib/upload'
import { ReadingStatus } from '@prisma/client'
import notesRouter from './notes'

const router = Router({ mergeParams: true })

router.use(requireAuth)
router.use('/:bookId/notes', notesRouter)

router.get('/', async (req, res, next) => {
  try {
    const { status, search, tag, favorite } = req.query as Record<string, string>

    const where: Record<string, unknown> = { userId: req.user!.id }

    if (status && Object.values(ReadingStatus).includes(status as ReadingStatus)) {
      where.status = status as ReadingStatus
    }
    if (favorite === 'true') where.favorite = true
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ]
    }

    let books = await prisma.book.findMany({
      where,
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    })

    if (tag) {
      books = books.filter(b => b.tags.some(t => t.name.toLowerCase() === tag.toLowerCase()))
    }

    res.json({ books })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { title, author, synopsis, isbn, pageCount, genres, coverUrl, coverType,
            googleBooksId, status, owned, tags } = req.body

    if (!title || !author) {
      res.status(400).json({ error: 'Title and author are required' })
      return
    }

    const book = await prisma.book.create({
      data: {
        userId: req.user!.id,
        title, author, synopsis, isbn,
        pageCount: pageCount != null ? Number(pageCount) : undefined,
        genres: genres || [],
        coverUrl, coverType, googleBooksId,
        status: status || 'WISHLIST',
        owned: owned || false,
        tags: tags?.length ? { create: (tags as string[]).map(name => ({ name })) } : undefined,
      },
      include: { tags: true },
    })

    res.status(201).json({ book })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const book = await prisma.book.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { tags: true, notes: { orderBy: { createdAt: 'desc' } } },
    })
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }
    res.json({ book })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }

    const { title, author, synopsis, isbn, pageCount, genres, coverUrl, coverType,
            status, owned, rating, review, favorite, rereadCount, tags } = req.body

    if (tags !== undefined) {
      await prisma.bookTag.deleteMany({ where: { bookId: req.params.id } })
    }

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(author !== undefined && { author }),
        ...(synopsis !== undefined && { synopsis }),
        ...(isbn !== undefined && { isbn }),
        ...(pageCount !== undefined && { pageCount: Number(pageCount) }),
        ...(genres !== undefined && { genres }),
        ...(coverUrl !== undefined && { coverUrl }),
        ...(coverType !== undefined && { coverType }),
        ...(status !== undefined && { status }),
        ...(owned !== undefined && { owned }),
        ...(rating !== undefined && { rating: rating != null ? Number(rating) : null }),
        ...(review !== undefined && { review }),
        ...(favorite !== undefined && { favorite }),
        ...(rereadCount !== undefined && { rereadCount: Number(rereadCount) }),
        ...(tags !== undefined && { tags: { create: (tags as string[]).map(name => ({ name })) } }),
      },
      include: { tags: true },
    })

    res.json({ book })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }
    await prisma.book.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.put('/:id/progress', async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }

    const { currentPage, startedAt, finishedAt } = req.body

    const currentPageNum = currentPage != null ? Number(currentPage) : undefined
    const autoFinish =
      currentPageNum != null &&
      existing.pageCount != null &&
      currentPageNum >= existing.pageCount &&
      existing.status === 'READING'

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...(currentPageNum !== undefined && { currentPage: currentPageNum }),
        ...(startedAt !== undefined && { startedAt: startedAt ? new Date(startedAt) : null }),
        ...(finishedAt !== undefined && { finishedAt: finishedAt ? new Date(finishedAt) : null }),
        ...(autoFinish && { status: 'FINISHED' }),
      },
      include: { tags: true },
    })

    res.json({ book })
  } catch (err) { next(err) }
})

router.post('/:id/cover', uploadCover.single('cover'), async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }

    const coverUrl = `/uploads/covers/${req.file.filename}`
    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { coverUrl, coverType: 'upload' },
      include: { tags: true },
    })

    res.json({ book, coverUrl })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 4: Create backend/src/routes/reading/notes.ts** (needed by books.ts import)

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const router = Router({ mergeParams: true })

router.use(requireAuth)

async function verifyOwnership(bookId: string, userId: string) {
  return prisma.book.findFirst({ where: { id: bookId, userId } })
}

router.get('/', async (req, res, next) => {
  try {
    const book = await verifyOwnership(req.params.bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }
    const notes = await prisma.bookNote.findMany({
      where: { bookId: req.params.bookId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notes })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const book = await verifyOwnership(req.params.bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const { title, content, chapter, page } = req.body
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' })
      return
    }

    const note = await prisma.bookNote.create({
      data: {
        bookId: req.params.bookId,
        title, content, chapter,
        page: page != null ? Number(page) : undefined,
      },
    })
    res.status(201).json({ note })
  } catch (err) { next(err) }
})

router.put('/:noteId', async (req, res, next) => {
  try {
    const book = await verifyOwnership(req.params.bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const existing = await prisma.bookNote.findFirst({
      where: { id: req.params.noteId, bookId: req.params.bookId },
    })
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return }

    const { title, content, chapter, page } = req.body
    const note = await prisma.bookNote.update({
      where: { id: req.params.noteId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(chapter !== undefined && { chapter }),
        ...(page !== undefined && { page: page != null ? Number(page) : null }),
      },
    })
    res.json({ note })
  } catch (err) { next(err) }
})

router.delete('/:noteId', async (req, res, next) => {
  try {
    const book = await verifyOwnership(req.params.bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const existing = await prisma.bookNote.findFirst({
      where: { id: req.params.noteId, bookId: req.params.bookId },
    })
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return }

    await prisma.bookNote.delete({ where: { id: req.params.noteId } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 5: Run books tests — confirm PASS**

```bash
cd backend && npm test -- --testPathPattern=reading.books
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/reading/books.ts backend/src/routes/reading/notes.ts backend/src/__tests__/reading.books.test.ts
git commit -m "feat: add reading books CRUD routes with progress tracking"
```

---

### Task 6: Backend — Notes routes tests

**Files:**
- Create: `backend/src/__tests__/reading.notes.test.ts`

- [ ] **Step 1: Write tests**

Create `backend/src/__tests__/reading.notes.test.ts`:

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'reading-notes@example.com'
let cookie: string
let userId: string
let bookId: string

beforeAll(async () => {
  const userRes = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test', email: TEST_EMAIL, password: 'password123' })
  cookie = (userRes.headers['set-cookie'] as unknown as string[])[0]
  userId = userRes.body.user.id

  const bookRes = await request(app)
    .post('/api/reading/books')
    .set('Cookie', cookie)
    .send({ title: 'Note Test Book', author: 'Author' })
  bookId = bookRes.body.book.id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

afterEach(async () => {
  await prisma.bookNote.deleteMany({ where: { bookId } })
})

describe('POST /api/reading/books/:bookId/notes', () => {
  it('creates a note', async () => {
    const res = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Ma note', content: 'Contenu de la note', chapter: 'Chapitre 3' })

    expect(res.status).toBe(201)
    expect(res.body.note.title).toBe('Ma note')
    expect(res.body.note.chapter).toBe('Chapitre 3')
  })

  it('returns 400 if content missing', async () => {
    const res = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Ma note' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .send({ title: 'Ma note', content: 'Content' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/reading/books/:bookId/notes', () => {
  beforeEach(async () => {
    await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Note 1', content: 'Content 1' })
  })

  it('returns notes ordered by createdAt desc', async () => {
    const res = await request(app)
      .get(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.notes)).toBe(true)
    expect(res.body.notes.length).toBe(1)
  })
})

describe('PUT /api/reading/books/:bookId/notes/:noteId', () => {
  it('updates a note', async () => {
    const createRes = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'Original', content: 'Content' })
    const noteId = createRes.body.note.id

    const res = await request(app)
      .put(`/api/reading/books/${bookId}/notes/${noteId}`)
      .set('Cookie', cookie)
      .send({ title: 'Updated', content: 'New content', page: 42 })

    expect(res.status).toBe(200)
    expect(res.body.note.title).toBe('Updated')
    expect(res.body.note.page).toBe(42)
  })
})

describe('DELETE /api/reading/books/:bookId/notes/:noteId', () => {
  it('deletes a note', async () => {
    const createRes = await request(app)
      .post(`/api/reading/books/${bookId}/notes`)
      .set('Cookie', cookie)
      .send({ title: 'To Delete', content: 'Content' })
    const noteId = createRes.body.note.id

    const res = await request(app)
      .delete(`/api/reading/books/${bookId}/notes/${noteId}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 for non-existent note', async () => {
    const res = await request(app)
      .delete(`/api/reading/books/${bookId}/notes/nonexistent`)
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run ALL backend tests**

```bash
cd backend && npm test
```

Expected: All tests PASS (auth + shortcuts + reading.books + reading.notes). Total ~30+ tests.

- [ ] **Step 3: Commit**

```bash
git add backend/src/__tests__/reading.notes.test.ts
git commit -m "feat: add reading notes routes with tests"
```

---

### Task 7: Frontend — Reading API types + client

**Files:**
- Create: `frontend/src/api/reading.ts`

- [ ] **Step 1: Create frontend/src/api/reading.ts**

```typescript
import { apiClient } from './client'

export type ReadingStatus = 'WISHLIST' | 'TO_READ' | 'READING' | 'FINISHED' | 'ABANDONED'

export interface BookTag {
  id: string
  name: string
}

export interface BookNote {
  id: string
  bookId: string
  title: string
  content: string
  chapter?: string
  page?: number
  createdAt: string
  updatedAt: string
}

export interface Book {
  id: string
  userId: string
  title: string
  author: string
  synopsis?: string
  isbn?: string
  pageCount?: number
  genres: string[]
  coverUrl?: string
  coverType?: string
  googleBooksId?: string
  status: ReadingStatus
  owned: boolean
  rating?: number
  review?: string
  favorite: boolean
  rereadCount: number
  tags: BookTag[]
  notes?: BookNote[]
  currentPage?: number
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface GoogleBookResult {
  googleBooksId: string
  title: string
  author: string
  synopsis?: string
  coverUrl?: string
  isbn?: string
  pageCount?: number
  genres: string[]
}

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  WISHLIST: 'Liste de souhaits',
  TO_READ: 'À lire',
  READING: 'En cours',
  FINISHED: 'Terminé',
  ABANDONED: 'Abandonné',
}

export const STATUS_COLORS: Record<ReadingStatus, string> = {
  WISHLIST: '#A89890',
  TO_READ: '#7A9E7E',
  READING: '#C4775A',
  FINISHED: '#5A8AC4',
  ABANDONED: '#C4A45A',
}

export type BookInput = Partial<Book> & { title: string; author: string; tags?: string[] }

export const readingApi = {
  search: (q: string) =>
    apiClient<{ books: GoogleBookResult[] }>(`/api/reading/search?q=${encodeURIComponent(q)}`),

  getBooks: (params?: { status?: ReadingStatus; search?: string; tag?: string; favorite?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.search) q.set('search', params.search)
    if (params?.tag) q.set('tag', params.tag)
    if (params?.favorite) q.set('favorite', 'true')
    const qs = q.toString()
    return apiClient<{ books: Book[] }>(`/api/reading/books${qs ? `?${qs}` : ''}`)
  },

  getBook: (id: string) =>
    apiClient<{ book: Book }>(`/api/reading/books/${id}`),

  createBook: (data: BookInput) =>
    apiClient<{ book: Book }>('/api/reading/books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBook: (id: string, data: Partial<Book> & { tags?: string[] }) =>
    apiClient<{ book: Book }>(`/api/reading/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBook: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/reading/books/${id}`, { method: 'DELETE' }),

  updateProgress: (id: string, data: { currentPage?: number; startedAt?: string; finishedAt?: string }) =>
    apiClient<{ book: Book }>(`/api/reading/books/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadCover: async (id: string, file: File): Promise<{ book: Book; coverUrl: string }> => {
    const form = new FormData()
    form.append('cover', file)
    const res = await fetch(`/api/reading/books/${id}/cover`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(body.error || 'Upload failed')
    }
    return res.json()
  },

  getNotes: (bookId: string) =>
    apiClient<{ notes: BookNote[] }>(`/api/reading/books/${bookId}/notes`),

  createNote: (bookId: string, data: { title: string; content: string; chapter?: string; page?: number }) =>
    apiClient<{ note: BookNote }>(`/api/reading/books/${bookId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNote: (bookId: string, noteId: string, data: Partial<Pick<BookNote, 'title' | 'content' | 'chapter' | 'page'>>) =>
    apiClient<{ note: BookNote }>(`/api/reading/books/${bookId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNote: (bookId: string, noteId: string) =>
    apiClient<{ ok: boolean }>(`/api/reading/books/${bookId}/notes/${noteId}`, { method: 'DELETE' }),
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/api/reading.ts
git commit -m "feat: add reading module API types and client functions"
```

---

### Task 8: Frontend — Reading CSS + App.tsx route + ReadingPage

**Files:**
- Create: `frontend/src/styles/reading.css`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`
- Create: `frontend/src/pages/reading/ReadingPage.tsx`

- [ ] **Step 1: Create frontend/src/styles/reading.css**

```css
/* ========== READING MODULE ========== */

.reading-library { max-width: 1100px; margin: 0 auto; }

.reading-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1.5rem;
  animation: fadeUp 0.45s ease both;
}

.reading-title {
  font-family: 'Playfair Display', serif;
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.reading-count { color: var(--text-muted); font-size: 0.85rem; margin-top: 0.2rem; }
.btn-add-book { width: auto; padding: 0.65rem 1.25rem; }

.reading-toolbar {
  display: flex;
  gap: 0.875rem;
  margin-bottom: 1rem;
  align-items: center;
  animation: fadeUp 0.45s ease 0.05s both;
}

.reading-search { flex: 1; margin-bottom: 0; }

.reading-view-toggle { display: flex; gap: 0.25rem; flex-shrink: 0; }

.view-btn {
  background: rgba(255,255,255,0.4);
  backdrop-filter: blur(8px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 1.1rem;
  transition: all var(--transition);
  color: var(--text-secondary);
  line-height: 1;
}

.view-btn--active { background: var(--accent-light); color: var(--accent); border-color: rgba(196,119,90,0.3); }

.reading-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 2rem;
  animation: fadeUp 0.45s ease 0.1s both;
}

.filter-chip {
  background: rgba(255,255,255,0.4);
  border: 1px solid var(--glass-border);
  border-radius: 20px;
  padding: 0.3rem 0.875rem;
  font-size: 0.78rem;
  cursor: pointer;
  transition: all var(--transition);
  color: var(--text-secondary);
  font-family: 'DM Sans', sans-serif;
}

.filter-chip--active {
  background: var(--accent-light);
  color: var(--accent);
  border-color: rgba(196,119,90,0.3);
  font-weight: 500;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(158px, 1fr));
  gap: 1.25rem;
  animation: fadeUp 0.45s ease 0.15s both;
}

.books-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  animation: fadeUp 0.45s ease 0.15s both;
}

.reading-loading { display: flex; justify-content: center; padding: 4rem; }

.reading-empty {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--text-secondary);
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  align-items: center;
}

.reading-empty-icon { font-size: 3rem; opacity: 0.5; }
.reading-empty p { font-family: 'Playfair Display', serif; font-style: italic; }

/* BookCard */
.book-card {
  cursor: pointer;
  padding: 0;
  overflow: hidden;
  transition: transform var(--transition), box-shadow var(--transition);
}

.book-card:hover { transform: translateY(-3px); box-shadow: var(--shadow-medium); }

.book-cover-wrap {
  width: 100%;
  aspect-ratio: 2/3;
  overflow: hidden;
  background: linear-gradient(135deg, var(--accent-light), rgba(196,119,90,0.04));
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
}

.book-cover-wrap img { width: 100%; height: 100%; object-fit: cover; display: block; }

.book-card-info { padding: 0.75rem; }

.book-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 0.875rem;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.3;
  margin-bottom: 0.2rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-card-author {
  font-size: 0.72rem;
  color: var(--text-secondary);
  margin-bottom: 0.5rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 0.5rem; }

/* BookRow */
.book-row {
  cursor: pointer;
  padding: 1rem 1.25rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: transform var(--transition), box-shadow var(--transition);
}

.book-row:hover { transform: translateX(2px); box-shadow: var(--shadow-medium); }

.book-row-cover {
  width: 44px;
  height: 66px;
  flex-shrink: 0;
  border-radius: 4px;
  overflow: hidden;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.book-row-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }
.book-row-info { flex: 1; min-width: 0; }

.book-row-title {
  font-family: 'Playfair Display', serif;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-row-author { font-size: 0.78rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
.book-row-meta { display: flex; align-items: center; gap: 0.75rem; flex-shrink: 0; }

/* BookStatusBadge */
.status-badge {
  font-size: 0.62rem;
  padding: 0.15rem 0.55rem;
  border-radius: 20px;
  font-weight: 500;
  letter-spacing: 0.02em;
  white-space: nowrap;
  opacity: 0.9;
}

/* ProgressBar */
.progress-bar-wrap { display: flex; align-items: center; gap: 0.5rem; }

.progress-bar-track {
  flex: 1;
  min-width: 60px;
  height: 4px;
  background: rgba(196,119,90,0.15);
  border-radius: 2px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.4s ease;
}

.progress-bar-label { font-size: 0.68rem; color: var(--text-muted); white-space: nowrap; }

/* StarRating */
.star-rating { display: flex; gap: 0.15rem; line-height: 1; }

.star {
  font-size: 1rem;
  cursor: pointer;
  transition: transform var(--transition);
  color: rgba(196,119,90,0.25);
  user-select: none;
}

.star--filled { color: var(--accent); }
.star--readonly { cursor: default; }
.star:hover:not(.star--readonly) { transform: scale(1.2); }

/* BookDetail */
.book-detail { max-width: 960px; margin: 0 auto; }

.book-detail-back {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--text-secondary);
  font-size: 0.85rem;
  cursor: pointer;
  margin-bottom: 2rem;
  background: none;
  border: none;
  font-family: 'DM Sans', sans-serif;
  transition: color var(--transition);
  padding: 0;
}

.book-detail-back:hover { color: var(--accent); }

.book-detail-layout {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 2.5rem;
  align-items: start;
}

.book-detail-left { display: flex; flex-direction: column; gap: 1rem; }

.book-detail-cover {
  width: 100%;
  aspect-ratio: 2/3;
  border-radius: var(--radius-md);
  overflow: hidden;
  background: var(--accent-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.book-detail-cover img { width: 100%; height: 100%; object-fit: cover; display: block; }

.book-detail-side-actions { display: flex; flex-direction: column; gap: 0.625rem; }

.btn-side {
  background: rgba(255,255,255,0.4);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  font-size: 0.8rem;
  color: var(--text-secondary);
  font-family: 'DM Sans', sans-serif;
  transition: all var(--transition);
  text-align: left;
}

.btn-side:hover { background: var(--accent-light); color: var(--accent); border-color: rgba(196,119,90,0.3); }
.btn-side--active { background: var(--accent-light); color: var(--accent); border-color: rgba(196,119,90,0.3); font-weight: 500; }

.book-detail-right { min-width: 0; }
.book-detail-title { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-weight: 700; color: var(--text-primary); line-height: 1.25; margin-bottom: 0.3rem; }
.book-detail-author { color: var(--text-secondary); font-size: 1rem; margin-bottom: 1rem; }

.chips-row { display: flex; flex-wrap: wrap; gap: 0.375rem; margin-bottom: 0.75rem; }

.chip {
  background: var(--accent-light);
  color: var(--accent);
  padding: 0.2rem 0.6rem;
  border-radius: 20px;
  font-size: 0.7rem;
  font-weight: 500;
}

.book-detail-section { margin-top: 2rem; }

.book-detail-section-title {
  font-family: 'Playfair Display', serif;
  font-size: 1rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid rgba(255,255,255,0.4);
}

.book-detail-synopsis { font-size: 0.9rem; color: var(--text-secondary); line-height: 1.7; }

.progress-update-inline { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.progress-page-input { width: 80px; padding: 0.5rem 0.75rem; text-align: center; }
.progress-page-label { font-size: 0.85rem; color: var(--text-secondary); }
.btn-update-progress { width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; }

.notes-list { display: flex; flex-direction: column; gap: 0.75rem; }
.notes-add-btn { width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; margin-bottom: 1rem; }

/* NoteCard */
.note-card { padding: 1.25rem; }
.note-card-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; margin-bottom: 0.5rem; }
.note-card-title { font-family: 'Playfair Display', serif; font-size: 0.95rem; font-weight: 700; color: var(--text-primary); }
.note-card-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.note-card-content { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; white-space: pre-wrap; margin-bottom: 0.5rem; }
.note-card-ref { font-size: 0.7rem; color: var(--text-muted); font-style: italic; }
.note-card-date { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.375rem; }

.btn-icon {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 0.8rem;
  padding: 0.25rem 0.4rem;
  border-radius: var(--radius-sm);
  transition: all var(--transition);
  font-family: 'DM Sans', sans-serif;
  line-height: 1;
}

.btn-icon:hover { background: var(--accent-light); color: var(--accent); }

/* NoteForm */
.note-form { display: flex; flex-direction: column; gap: 0.875rem; }
.note-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
.note-form-actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
.btn-sm { width: auto; padding: 0.5rem 1rem; font-size: 0.875rem; }

/* AddBookModal */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(44,24,16,0.3);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}

.modal-card {
  width: 100%;
  max-width: 560px;
  max-height: 90vh;
  overflow-y: auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.modal-header { display: flex; justify-content: space-between; align-items: center; }

.modal-title { font-family: 'Playfair Display', serif; font-size: 1.3rem; color: var(--text-primary); }

.modal-close {
  background: none;
  border: none;
  font-size: 1.4rem;
  cursor: pointer;
  color: var(--text-muted);
  transition: color var(--transition);
  line-height: 1;
  padding: 0;
}

.modal-close:hover { color: var(--text-primary); }

.search-input-wrap { position: relative; }
.search-spinner { position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; border: 2px solid var(--accent-light); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.7s linear infinite; }

.search-results {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
  max-height: 280px;
  overflow-y: auto;
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  background: rgba(255,255,255,0.3);
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem;
  cursor: pointer;
  transition: background var(--transition);
}

.search-result-item:hover { background: var(--accent-light); }

.search-result-cover {
  width: 36px;
  height: 54px;
  object-fit: cover;
  border-radius: 3px;
  background: var(--accent-light);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  overflow: hidden;
}

.search-result-cover img { width: 100%; height: 100%; object-fit: cover; }
.search-result-title { font-size: 0.875rem; font-weight: 500; color: var(--text-primary); }
.search-result-author { font-size: 0.75rem; color: var(--text-secondary); }
.search-no-results { padding: 1rem; text-align: center; color: var(--text-muted); font-size: 0.85rem; }

.manual-toggle {
  background: none;
  border: none;
  color: var(--accent);
  font-size: 0.8rem;
  cursor: pointer;
  font-family: 'DM Sans', sans-serif;
  text-decoration: underline;
  padding: 0;
}

.add-form { display: flex; flex-direction: column; gap: 0.875rem; }
.add-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }

.status-select {
  width: 100%;
  padding: 0.65rem 0.9rem;
  background: rgba(255,255,255,0.6);
  border: 1px solid rgba(255,255,255,0.7);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  outline: none;
  cursor: pointer;
  transition: border-color var(--transition);
  appearance: none;
}

.status-select:focus { border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-light); }

.tags-input-wrap { display: flex; flex-direction: column; gap: 0.375rem; }
.tags-chips { display: flex; flex-wrap: wrap; gap: 0.375rem; min-height: 28px; }

.tag-chip {
  background: var(--accent-light);
  color: var(--accent);
  padding: 0.15rem 0.5rem 0.15rem 0.6rem;
  border-radius: 20px;
  font-size: 0.72rem;
  font-weight: 500;
  display: flex;
  align-items: center;
  gap: 0.3rem;
}

.tag-chip-remove {
  background: none;
  border: none;
  cursor: pointer;
  color: var(--accent);
  font-size: 0.85rem;
  line-height: 1;
  padding: 0;
  opacity: 0.7;
}

.tag-chip-remove:hover { opacity: 1; }

.owned-toggle { display: flex; align-items: center; gap: 0.625rem; cursor: pointer; font-size: 0.875rem; color: var(--text-secondary); }
.owned-toggle input[type="checkbox"] { accent-color: var(--accent); width: 16px; height: 16px; cursor: pointer; }

.cover-options { display: flex; flex-direction: column; gap: 0.5rem; }
.cover-radio-group { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--text-secondary); }
.cover-radio-group label { display: flex; align-items: center; gap: 0.375rem; cursor: pointer; }
.cover-radio-group input[type="radio"] { accent-color: var(--accent); cursor: pointer; }

/* Responsive reading */
@media (max-width: 767px) {
  .book-detail-layout { grid-template-columns: 1fr; }
  .book-detail-cover-wrap { display: flex; justify-content: center; }
  .book-detail-cover { max-width: 160px; margin: 0 auto; }
  .books-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.875rem; }
  .reading-header { flex-direction: column; gap: 0.875rem; align-items: stretch; }
  .btn-add-book { width: 100%; }
  .add-form-row { grid-template-columns: 1fr; }
  .note-form-row { grid-template-columns: 1fr; }
  .book-row-meta { display: none; }
}
```

- [ ] **Step 2: Import reading.css in main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/globals.css'
import './styles/reading.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 3: Create frontend/src/pages/reading/ReadingPage.tsx**

```typescript
import { Routes, Route } from 'react-router-dom'
import { BookLibrary } from './BookLibrary'
import { BookDetail } from './BookDetail'

export function ReadingPage() {
  return (
    <Routes>
      <Route index element={<BookLibrary />} />
      <Route path=":id" element={<BookDetail />} />
    </Routes>
  )
}
```

- [ ] **Step 4: Add /reading route in App.tsx**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ReadingPage } from './pages/reading/ReadingPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <Dashboard />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/reading/*"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReadingPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/styles/reading.css frontend/src/main.tsx frontend/src/App.tsx frontend/src/pages/reading/ReadingPage.tsx
git commit -m "feat: add reading CSS, route, and ReadingPage router"
```

---

### Task 9: Frontend — Shared reading components

**Files:**
- Create: `frontend/src/components/reading/BookStatusBadge.tsx`
- Create: `frontend/src/components/reading/ProgressBar.tsx`
- Create: `frontend/src/components/reading/StarRating.tsx`
- Create: `frontend/src/components/reading/BookCard.tsx`
- Create: `frontend/src/components/reading/BookRow.tsx`

- [ ] **Step 1: Create BookStatusBadge.tsx**

```typescript
import { ReadingStatus, STATUS_LABELS, STATUS_COLORS } from '../../api/reading'

export function BookStatusBadge({ status }: { status: ReadingStatus }) {
  return (
    <span
      className="status-badge"
      style={{ background: STATUS_COLORS[status] + '22', color: STATUS_COLORS[status] }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
```

- [ ] **Step 2: Create ProgressBar.tsx**

```typescript
interface ProgressBarProps {
  currentPage?: number
  pageCount?: number
  showLabel?: boolean
}

export function ProgressBar({ currentPage, pageCount, showLabel = true }: ProgressBarProps) {
  if (!currentPage || !pageCount) return null

  const pct = Math.min(100, Math.round((currentPage / pageCount) * 100))

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="progress-bar-label">{pct}%</span>}
    </div>
  )
}
```

- [ ] **Step 3: Create StarRating.tsx**

```typescript
interface StarRatingProps {
  value?: number
  onChange?: (v: number) => void
  readonly?: boolean
  size?: 'sm' | 'md'
}

export function StarRating({ value = 0, onChange, readonly = false, size = 'md' }: StarRatingProps) {
  return (
    <div className="star-rating" style={{ fontSize: size === 'sm' ? '0.85rem' : '1rem' }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          className={`star ${n <= value ? 'star--filled' : ''} ${readonly ? 'star--readonly' : ''}`}
          onClick={() => !readonly && onChange?.(n)}
        >
          ★
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Create BookCard.tsx**

```typescript
import { useNavigate } from 'react-router-dom'
import { Book } from '../../api/reading'
import { BookStatusBadge } from './BookStatusBadge'
import { ProgressBar } from './ProgressBar'
import { StarRating } from './StarRating'

export function BookCard({ book }: { book: Book }) {
  const navigate = useNavigate()

  return (
    <div className="glass-card book-card" onClick={() => navigate(`/reading/${book.id}`)}>
      <div className="book-cover-wrap">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} loading="lazy" />
        ) : (
          '📚'
        )}
      </div>
      <div className="book-card-info">
        <div className="book-card-title">{book.title}</div>
        <div className="book-card-author">{book.author}</div>
        <div className="book-card-footer">
          <BookStatusBadge status={book.status} />
          {book.rating ? <StarRating value={book.rating} readonly size="sm" /> : null}
        </div>
        {book.status === 'READING' && (
          <div style={{ marginTop: '0.5rem' }}>
            <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Create BookRow.tsx**

```typescript
import { useNavigate } from 'react-router-dom'
import { Book } from '../../api/reading'
import { BookStatusBadge } from './BookStatusBadge'
import { ProgressBar } from './ProgressBar'
import { StarRating } from './StarRating'

export function BookRow({ book }: { book: Book }) {
  const navigate = useNavigate()

  return (
    <div className="glass-card book-row" onClick={() => navigate(`/reading/${book.id}`)}>
      <div className="book-row-cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} loading="lazy" />
        ) : '📚'}
      </div>
      <div className="book-row-info">
        <div className="book-row-title">{book.title}</div>
        <div className="book-row-author">{book.author}</div>
        {book.status === 'READING' && (
          <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
        )}
      </div>
      <div className="book-row-meta">
        <BookStatusBadge status={book.status} />
        {book.rating ? <StarRating value={book.rating} readonly size="sm" /> : null}
        {book.favorite ? <span title="Favori" style={{ color: 'var(--accent)' }}>★</span> : null}
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/reading/
git commit -m "feat: add BookCard, BookRow, BookStatusBadge, ProgressBar, StarRating"
```

---

### Task 10: Frontend — BookLibrary page

**Files:**
- Create: `frontend/src/pages/reading/BookLibrary.tsx`

- [ ] **Step 1: Create frontend/src/pages/reading/BookLibrary.tsx**

```typescript
import { useState, useEffect, useCallback } from 'react'
import { readingApi, Book, ReadingStatus } from '../../api/reading'
import { BookCard } from '../../components/reading/BookCard'
import { BookRow } from '../../components/reading/BookRow'
import { AddBookModal } from './AddBookModal'
import { Button } from '../../components/ui/Button'

type ViewMode = 'grid' | 'list'
const VIEW_KEY = 'reading_view'

const STATUS_FILTERS: Array<{ value: ReadingStatus | ''; label: string }> = [
  { value: '', label: 'Tous' },
  { value: 'WISHLIST', label: 'Souhaits' },
  { value: 'TO_READ', label: 'À lire' },
  { value: 'READING', label: 'En cours' },
  { value: 'FINISHED', label: 'Terminé' },
  { value: 'ABANDONED', label: 'Abandonné' },
]

export function BookLibrary() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState<ReadingStatus | ''>('')
  const [showFavorites, setShowFavorites] = useState(false)
  const [view, setView] = useState<ViewMode>(() => (localStorage.getItem(VIEW_KEY) as ViewMode) || 'grid')
  const [showAddModal, setShowAddModal] = useState(false)

  const fetchBooks = useCallback(async () => {
    try {
      const data = await readingApi.getBooks({
        status: status || undefined,
        search: search || undefined,
        favorite: showFavorites || undefined,
      })
      setBooks(data.books)
    } catch {}
  }, [status, search, showFavorites])

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true)
      await fetchBooks()
      setLoading(false)
    }, 300)
    return () => clearTimeout(t)
  }, [fetchBooks])

  function setViewMode(v: ViewMode) {
    setView(v)
    localStorage.setItem(VIEW_KEY, v)
  }

  return (
    <div className="reading-library">
      <header className="reading-header">
        <div>
          <h1 className="reading-title">Lectures</h1>
          <p className="reading-count">{books.length} livre{books.length !== 1 ? 's' : ''}</p>
        </div>
        <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
          + Ajouter un livre
        </Button>
      </header>

      <div className="reading-toolbar">
        <input
          className="input-field reading-search"
          placeholder="Titre, auteur, ISBN..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="reading-view-toggle">
          <button className={`view-btn ${view === 'grid' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grille">⊞</button>
          <button className={`view-btn ${view === 'list' ? 'view-btn--active' : ''}`} onClick={() => setViewMode('list')} aria-label="Liste">≡</button>
        </div>
      </div>

      <div className="reading-filters">
        {STATUS_FILTERS.map(f => (
          <button
            key={f.value}
            className={`filter-chip ${status === f.value ? 'filter-chip--active' : ''}`}
            onClick={() => setStatus(f.value)}
          >
            {f.label}
          </button>
        ))}
        <button
          className={`filter-chip ${showFavorites ? 'filter-chip--active' : ''}`}
          onClick={() => setShowFavorites(v => !v)}
        >
          ★ Favoris
        </button>
      </div>

      {loading ? (
        <div className="reading-loading"><div className="loading-spinner" /></div>
      ) : books.length === 0 ? (
        <div className="reading-empty">
          <div className="reading-empty-icon">📚</div>
          <p>{search || status ? 'Aucun livre trouvé.' : 'Ta bibliothèque est vide.'}</p>
          {!search && !status && (
            <Button onClick={() => setShowAddModal(true)} className="btn-add-book">
              Ajouter mon premier livre
            </Button>
          )}
        </div>
      ) : view === 'grid' ? (
        <div className="books-grid">
          {books.map(b => <BookCard key={b.id} book={b} />)}
        </div>
      ) : (
        <div className="books-list">
          {books.map(b => <BookRow key={b.id} book={b} />)}
        </div>
      )}

      {showAddModal && (
        <AddBookModal
          onClose={() => setShowAddModal(false)}
          onAdded={book => { setBooks(prev => [book, ...prev]); setShowAddModal(false) }}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/reading/BookLibrary.tsx
git commit -m "feat: add BookLibrary page with search, filters, and view toggle"
```

---

### Task 11: Frontend — AddBookModal

**Files:**
- Create: `frontend/src/pages/reading/AddBookModal.tsx`

- [ ] **Step 1: Create frontend/src/pages/reading/AddBookModal.tsx**

```typescript
import { useState, useEffect, useRef } from 'react'
import { readingApi, Book, GoogleBookResult, ReadingStatus, STATUS_LABELS } from '../../api/reading'
import { GlassCard } from '../../components/ui/GlassCard'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'

interface Props {
  onClose: () => void
  onAdded: (book: Book) => void
}

export function AddBookModal({ onClose, onAdded }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GoogleBookResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manual, setManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>('url')
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const [form, setForm] = useState({
    title: '', author: '', synopsis: '', isbn: '', pageCount: '',
    coverUrl: '', googleBooksId: '', genres: [] as string[],
    status: 'WISHLIST' as ReadingStatus, owned: false,
  })

  useEffect(() => {
    if (!query.trim() || manual) { setResults([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await readingApi.search(query)
        setResults(data.books)
      } catch {}
      setSearching(false)
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [query, manual])

  function fillFromResult(r: GoogleBookResult) {
    setForm({
      title: r.title, author: r.author,
      synopsis: r.synopsis || '', isbn: r.isbn || '',
      pageCount: r.pageCount?.toString() || '',
      coverUrl: r.coverUrl || '', googleBooksId: r.googleBooksId,
      genres: r.genres, status: 'WISHLIST', owned: false,
    })
    setResults([])
    setQuery('')
    setManual(true)
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const t = tagInput.trim()
      if (!tags.includes(t)) setTags(prev => [...prev, t])
      setTagInput('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.author) return
    setLoading(true)
    try {
      const { book } = await readingApi.createBook({
        ...form,
        pageCount: form.pageCount ? Number(form.pageCount) : undefined,
        coverUrl: coverMode === 'url' ? form.coverUrl || undefined : undefined,
        coverType: coverMode === 'url' ? 'url' : undefined,
        tags,
      })

      if (coverMode === 'upload' && fileRef.current?.files?.[0]) {
        try {
          const uploaded = await readingApi.uploadCover(book.id, fileRef.current.files[0])
          onAdded(uploaded.book)
        } catch {
          onAdded(book)
        }
      } else {
        onAdded(book)
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Ajouter un livre</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {!manual ? (
          <>
            <div className="search-input-wrap">
              <Input
                placeholder="Rechercher un titre, auteur ou ISBN..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {searching && <div className="search-spinner" />}
            </div>

            {results.length > 0 && (
              <div className="search-results">
                {results.map(r => (
                  <div key={r.googleBooksId} className="search-result-item" onClick={() => fillFromResult(r)}>
                    <div className="search-result-cover">
                      {r.coverUrl ? <img src={r.coverUrl} alt={r.title} /> : '📚'}
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-title">{r.title}</div>
                      <div className="search-result-author">{r.author}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query && !searching && results.length === 0 && (
              <div className="search-no-results">Aucun résultat. <button className="manual-toggle" onClick={() => setManual(true)}>Saisie manuelle</button></div>
            )}

            <button className="manual-toggle" onClick={() => setManual(true)}>Saisie manuelle →</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="add-form">
            <div className="add-form-row">
              <Input label="Titre *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              <Input label="Auteur *" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} required />
            </div>

            <div className="input-group">
              <label className="input-label">Synopsis</label>
              <textarea
                className="input-field"
                rows={3}
                value={form.synopsis}
                onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="add-form-row">
              <Input label="ISBN" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
              <Input label="Nombre de pages" type="number" min="1" value={form.pageCount} onChange={e => setForm(f => ({ ...f, pageCount: e.target.value }))} />
            </div>

            <div className="input-group">
              <label className="input-label">Statut</label>
              <select className="status-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ReadingStatus }))}>
                {(Object.keys(STATUS_LABELS) as ReadingStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className="input-group cover-options">
              <label className="input-label">Couverture</label>
              <div className="cover-radio-group">
                <label><input type="radio" name="coverMode" value="url" checked={coverMode === 'url'} onChange={() => setCoverMode('url')} /> URL externe</label>
                <label><input type="radio" name="coverMode" value="upload" checked={coverMode === 'upload'} onChange={() => setCoverMode('upload')} /> Upload</label>
              </div>
              {coverMode === 'url' ? (
                <Input placeholder="https://..." value={form.coverUrl} onChange={e => setForm(f => ({ ...f, coverUrl: e.target.value }))} />
              ) : (
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="input-field" style={{ padding: '0.5rem' }} />
              )}
            </div>

            <div className="tags-input-wrap">
              <label className="input-label">Tags</label>
              <div className="tags-chips">
                {tags.map(t => (
                  <span key={t} className="tag-chip">
                    {t}
                    <button type="button" className="tag-chip-remove" onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                  </span>
                ))}
              </div>
              <input
                className="input-field"
                placeholder="Ajouter un tag (Entrée pour valider)"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
              />
            </div>

            <label className="owned-toggle">
              <input type="checkbox" checked={form.owned} onChange={e => setForm(f => ({ ...f, owned: e.target.checked }))} />
              Je possède ce livre
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" className="btn-sm" onClick={() => setManual(false)}>← Retour</Button>
              <Button type="submit" loading={loading} className="btn-sm">Ajouter</Button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/reading/AddBookModal.tsx
git commit -m "feat: add AddBookModal with Google Books search and manual form"
```

---

### Task 12: Frontend — NoteCard, NoteForm, ProgressUpdateForm

**Files:**
- Create: `frontend/src/components/reading/NoteCard.tsx`
- Create: `frontend/src/components/reading/NoteForm.tsx`
- Create: `frontend/src/components/reading/ProgressUpdateForm.tsx`

- [ ] **Step 1: Create NoteCard.tsx**

```typescript
import { BookNote, readingApi } from '../../api/reading'

interface Props {
  note: BookNote
  bookId: string
  onUpdated: (note: BookNote) => void
  onDeleted: (noteId: string) => void
}

export function NoteCard({ note, bookId, onUpdated, onDeleted }: Props) {
  async function handleDelete() {
    if (!confirm('Supprimer cette note ?')) return
    try {
      await readingApi.deleteNote(bookId, note.id)
      onDeleted(note.id)
    } catch {}
  }

  const ref = note.chapter
    ? `${note.chapter}${note.page ? ` · p.${note.page}` : ''}`
    : note.page ? `p.${note.page}` : null

  return (
    <div className="glass-card note-card">
      <div className="note-card-header">
        <div className="note-card-title">{note.title}</div>
        <div className="note-card-actions">
          <button className="btn-icon" onClick={handleDelete} title="Supprimer">🗑</button>
        </div>
      </div>
      <div className="note-card-content">{note.content}</div>
      {ref && <div className="note-card-ref">📖 {ref}</div>}
      <div className="note-card-date">
        {new Date(note.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create NoteForm.tsx**

```typescript
import { useState } from 'react'
import { BookNote, readingApi } from '../../api/reading'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface Props {
  bookId: string
  onCreated: (note: BookNote) => void
  onCancel: () => void
}

export function NoteForm({ bookId, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [chapter, setChapter] = useState('')
  const [page, setPage] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !content) return
    setLoading(true)
    try {
      const { note } = await readingApi.createNote(bookId, {
        title, content,
        chapter: chapter || undefined,
        page: page ? Number(page) : undefined,
      })
      onCreated(note)
    } catch {}
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card note-form" style={{ padding: '1.25rem' }}>
      <Input label="Titre *" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
      <div className="input-group">
        <label className="input-label">Contenu *</label>
        <textarea
          className="input-field"
          rows={4}
          value={content}
          onChange={e => setContent(e.target.value)}
          required
          style={{ resize: 'vertical' }}
        />
      </div>
      <div className="note-form-row">
        <Input label="Chapitre (libre)" placeholder="ex: Chapitre 3" value={chapter} onChange={e => setChapter(e.target.value)} />
        <Input label="Page" type="number" min="1" value={page} onChange={e => setPage(e.target.value)} />
      </div>
      <div className="note-form-actions">
        <Button type="button" variant="ghost" className="btn-sm" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading} className="btn-sm">Enregistrer</Button>
      </div>
    </form>
  )
}
```

- [ ] **Step 3: Create ProgressUpdateForm.tsx**

```typescript
import { useState } from 'react'
import { Book, readingApi } from '../../api/reading'
import { Button } from '../ui/Button'
import { ProgressBar } from './ProgressBar'

interface Props {
  book: Book
  onUpdated: (book: Book) => void
}

export function ProgressUpdateForm({ book, onUpdated }: Props) {
  const [page, setPage] = useState(book.currentPage?.toString() || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!page) return
    setLoading(true)
    try {
      const { book: updated } = await readingApi.updateProgress(book.id, {
        currentPage: Number(page),
      })
      onUpdated(updated)
    } catch {}
    setLoading(false)
  }

  return (
    <div>
      <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
      <form onSubmit={handleSubmit} className="progress-update-inline" style={{ marginTop: '0.75rem' }}>
        <input
          className="input-field progress-page-input"
          type="number"
          min="0"
          max={book.pageCount}
          value={page}
          onChange={e => setPage(e.target.value)}
          placeholder="Page"
        />
        {book.pageCount && <span className="progress-page-label">/ {book.pageCount} pages</span>}
        <Button type="submit" loading={loading} className="btn-update-progress">Mettre à jour</Button>
      </form>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/reading/NoteCard.tsx frontend/src/components/reading/NoteForm.tsx frontend/src/components/reading/ProgressUpdateForm.tsx
git commit -m "feat: add NoteCard, NoteForm, ProgressUpdateForm components"
```

---

### Task 13: Frontend — BookDetail page

**Files:**
- Create: `frontend/src/pages/reading/BookDetail.tsx`

- [ ] **Step 1: Create frontend/src/pages/reading/BookDetail.tsx**

```typescript
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { readingApi, Book, BookNote, ReadingStatus, STATUS_LABELS } from '../../api/reading'
import { GlassCard } from '../../components/ui/GlassCard'
import { StarRating } from '../../components/reading/StarRating'
import { ProgressUpdateForm } from '../../components/reading/ProgressUpdateForm'
import { NoteCard } from '../../components/reading/NoteCard'
import { NoteForm } from '../../components/reading/NoteForm'
import { BookStatusBadge } from '../../components/reading/BookStatusBadge'

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [notes, setNotes] = useState<BookNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [review, setReview] = useState('')
  const [savingReview, setSavingReview] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([readingApi.getBook(id), readingApi.getNotes(id)])
      .then(([bookData, notesData]) => {
        setBook(bookData.book)
        setReview(bookData.book.review || '')
        setNotes(notesData.notes)
      })
      .catch(() => navigate('/reading'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function update(data: Parameters<typeof readingApi.updateBook>[1]) {
    if (!book) return
    try {
      const { book: updated } = await readingApi.updateBook(book.id, data)
      setBook(updated)
    } catch {}
  }

  async function saveReview() {
    if (!book) return
    setSavingReview(true)
    try { await update({ review }) } finally { setSavingReview(false) }
  }

  async function handleDelete() {
    if (!book || !confirm(`Supprimer "${book.title}" ?`)) return
    try { await readingApi.deleteBook(book.id); navigate('/reading') } catch {}
  }

  if (loading) return <div className="reading-loading"><div className="loading-spinner" /></div>
  if (!book) return null

  const progress = book.currentPage && book.pageCount
    ? Math.round((book.currentPage / book.pageCount) * 100)
    : null

  return (
    <div className="book-detail">
      <button className="book-detail-back" onClick={() => navigate('/reading')}>← Bibliothèque</button>

      <div className="book-detail-layout">
        {/* Left column */}
        <div className="book-detail-left">
          <div className="book-detail-cover-wrap">
            <div className="book-detail-cover">
              {book.coverUrl ? <img src={book.coverUrl} alt={book.title} /> : '📚'}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Statut</label>
            <select
              className="status-select"
              value={book.status}
              onChange={e => update({ status: e.target.value as ReadingStatus })}
            >
              {(Object.keys(STATUS_LABELS) as ReadingStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <label className="owned-toggle" style={{ fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={book.owned}
              onChange={e => update({ owned: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            Je possède ce livre
          </label>

          <div>
            <label className="input-label" style={{ marginBottom: '0.375rem', display: 'block' }}>Ma note</label>
            <StarRating value={book.rating || 0} onChange={v => update({ rating: v })} />
          </div>

          <div className="book-detail-side-actions">
            <button
              className={`btn-side ${book.favorite ? 'btn-side--active' : ''}`}
              onClick={() => update({ favorite: !book.favorite })}
            >
              {book.favorite ? '★' : '☆'} Favori
            </button>
            <button
              className="btn-side"
              onClick={() => update({ rereadCount: book.rereadCount + 1 })}
            >
              🔁 Relecture ({book.rereadCount})
            </button>
            <button
              className="btn-side"
              style={{ color: '#C44B4B' }}
              onClick={handleDelete}
            >
              🗑 Supprimer
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="book-detail-right">
          <h1 className="book-detail-title">{book.title}</h1>
          <div className="book-detail-author">{book.author}</div>

          <div className="chips-row">
            <BookStatusBadge status={book.status} />
            {book.genres.map(g => <span key={g} className="chip">{g}</span>)}
            {book.tags.map(t => <span key={t.id} className="chip">{t.name}</span>)}
          </div>

          {book.isbn && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ISBN: {book.isbn}</div>}
          {book.pageCount && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{book.pageCount} pages</div>}

          {book.synopsis && (
            <div className="book-detail-section">
              <div className="book-detail-section-title">Synopsis</div>
              <div className="book-detail-synopsis">{book.synopsis}</div>
            </div>
          )}

          {/* Progression */}
          {(book.status === 'READING' || book.currentPage != null) && (
            <div className="book-detail-section">
              <div className="book-detail-section-title">
                Progression {progress != null ? `— ${progress}%` : ''}
              </div>
              <ProgressUpdateForm book={book} onUpdated={setBook} />
            </div>
          )}

          {/* Avis */}
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

          {/* Notes */}
          <div className="book-detail-section">
            <div className="book-detail-section-title">Notes ({notes.length})</div>

            {!showNoteForm && (
              <button className="btn btn-ghost notes-add-btn" onClick={() => setShowNoteForm(true)}>
                + Ajouter une note
              </button>
            )}

            {showNoteForm && (
              <NoteForm
                bookId={book.id}
                onCreated={note => { setNotes(prev => [note, ...prev]); setShowNoteForm(false) }}
                onCancel={() => setShowNoteForm(false)}
              />
            )}

            <div className="notes-list" style={{ marginTop: showNoteForm ? '1rem' : '0' }}>
              {notes.map(n => (
                <NoteCard
                  key={n.id}
                  note={n}
                  bookId={book.id}
                  onUpdated={updated => setNotes(prev => prev.map(x => x.id === updated.id ? updated : x))}
                  onDeleted={noteId => setNotes(prev => prev.filter(x => x.id !== noteId))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript build to verify no errors**

```bash
cd frontend && npm run build
```

Expected: Build succeeds, 0 TypeScript errors.

- [ ] **Step 3: Start dev servers and smoke test the full flow**

```bash
# Terminal 1
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`, log in, click "Lectures" in the sidebar.

Expected:
- `/reading` loads with empty library + "Ajouter mon premier livre" button
- Click "+ Ajouter un livre" → modal opens
- Type "dune" in search → Google Books results appear
- Click a result → form pre-fills
- Click "Ajouter" → book appears in library
- Click the book → detail page with all sections
- Update progress, add a note → data persists on refresh

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/reading/BookDetail.tsx
git commit -m "feat: add BookDetail page with notes, progress, rating, and review"
```

---

### Task 14: Final wiring — verify all tests pass + docker build

- [ ] **Step 1: Run all backend tests**

```bash
cd backend && npm test
```

Expected: All test suites PASS (~35 tests total: auth + shortcuts + reading.books + reading.notes).

- [ ] **Step 2: Rebuild Docker and smoke test**

```bash
# From repo root
docker-compose up --build -d
```

Wait 30s then:

```bash
# Register
curl -s -c /tmp/c.txt -X POST http://localhost/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"smoke2@test.com","password":"password123"}'

# Create a book
curl -s -b /tmp/c.txt -X POST http://localhost/api/reading/books \
  -H "Content-Type: application/json" \
  -d '{"title":"Dune","author":"Frank Herbert","status":"READING","pageCount":412}'

# List books
curl -s -b /tmp/c.txt http://localhost/api/reading/books

# Search Google Books
curl -s -b /tmp/c.txt "http://localhost/api/reading/search?q=dune"
```

Expected: All curl commands return valid JSON, reading module fully functional in Docker.

- [ ] **Step 3: Cleanup test user**

```bash
curl -s -b /tmp/c.txt -X POST http://localhost/api/auth/logout
```

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "chore: finalize reading module — all tests pass, docker build verified"
```
