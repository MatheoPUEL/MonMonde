# Authors DB Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remplacer `Book.author: String` par une entité `Author` en DB avec autocomplete à la saisie, page liste, page détail et enrichissement via Open Library.

**Architecture:** Nouvelle table `Author` liée à `Book` via FK `authorId`. Les livres existants sont migrés automatiquement (un `Author` par valeur unique de `book.author`). L'API expose 4 endpoints auteurs + modifie `POST /books` avec find-or-create. Le frontend ajoute autocomplete, page `/reading/authors`, page `/reading/authors/:id`.

**Tech Stack:** Prisma (PostgreSQL), Express, React + React Router, TypeScript, Open Library REST API (gratuit, sans clé)

---

## File Map

### Backend — nouveaux fichiers
- `backend/src/routes/reading/authors.ts` — CRUD auteurs + enrich
- `backend/src/lib/openlibrary.ts` — client Open Library
- `backend/src/__tests__/reading.authors.test.ts` — tests auteurs

### Backend — fichiers modifiés
- `backend/prisma/schema.prisma` — ajouter `Author`, modifier `Book`
- `backend/src/routes/reading/index.ts` — monter le router auteurs
- `backend/src/routes/reading/books.ts` — find-or-create auteur à la création

### Frontend — nouveaux fichiers
- `frontend/src/components/reading/AuthorAutocomplete.tsx` — champ autocomplete auteur
- `frontend/src/pages/reading/AuthorsPage.tsx` — liste des auteurs
- `frontend/src/pages/reading/AuthorDetail.tsx` — détail auteur + livres + bouton Enrichir

### Frontend — fichiers modifiés
- `frontend/src/api/reading.ts` — types `Author` + `authorsApi`
- `frontend/src/pages/reading/AddBookModal.tsx` — remplacer Input auteur par `AuthorAutocomplete`
- `frontend/src/pages/reading/ReadingPage.tsx` — ajouter routes authors
- `frontend/src/styles/reading.css` — styles pages auteurs

---

## Task 1 : Schéma Prisma — Ajouter Author, modifier Book

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Étape 1 : Ajouter le modèle Author et modifier Book**

Dans `backend/prisma/schema.prisma`, ajouter après le modèle `BookNote` et modifier `Book` :

```prisma
model Author {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  name          String
  bio           String?
  birthDate     DateTime?
  deathDate     DateTime?
  nationality   String?
  photoUrl      String?
  openLibraryId String?

  books         Book[]

  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@unique([userId, name])
  @@index([userId])
}
```

Dans le modèle `User`, ajouter `authors Author[]` dans les relations.

Dans le modèle `Book` :
- Remplacer `author String` par `authorId String` + `author Author @relation(fields: [authorId], references: [id])`

```prisma
  authorId      String
  author        Author        @relation(fields: [authorId], references: [id])
```

- [ ] **Étape 2 : Créer la migration sans l'appliquer**

```bash
cd backend && npx prisma migrate dev --create-only --name add_authors
```

Cela génère un fichier dans `backend/prisma/migrations/YYYYMMDD_HHMMSS_add_authors/migration.sql`.

- [ ] **Étape 3 : Éditer le SQL de migration pour inclure la migration de données**

Ouvrir le fichier de migration généré et **ajouter ces instructions SQL** après la création de la table `Author` et l'ajout de la colonne `authorId` (avant la contrainte NOT NULL) :

```sql
-- Migrate data: create one Author per unique (userId, author) combo
INSERT INTO "Author" ("id", "userId", "name", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || b."userId" || b."author"),
  b."userId",
  b."author",
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "userId", "author" FROM "Book"
) b;

-- Link books to their author
UPDATE "Book" b
SET "authorId" = a."id"
FROM "Author" a
WHERE a."userId" = b."userId" AND a."name" = b."author";
```

Puis supprimer la colonne `author` de Book dans le même fichier (Prisma l'aura probablement déjà inclus comme `ALTER TABLE "Book" DROP COLUMN "author"`).

- [ ] **Étape 4 : Appliquer la migration**

```bash
cd backend && npx prisma migrate dev
```

Expected: migration applied, `Author` table créée, livres existants liés.

- [ ] **Étape 5 : Régénérer le client Prisma**

```bash
cd backend && npx prisma generate
```

- [ ] **Étape 6 : Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add Author model and migrate Book.author to FK"
```

---

## Task 2 : Client Open Library

**Files:**
- Create: `backend/src/lib/openlibrary.ts`

- [ ] **Étape 1 : Créer le fichier**

```typescript
export interface OLAuthorResult {
  olid: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  photoUrl?: string
}

export async function searchAuthorOnOL(name: string): Promise<OLAuthorResult | null> {
  const res = await fetch(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=5`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null

  const data = await res.json() as { docs?: Array<{ key: string; name: string }> }
  const docs = data.docs ?? []

  const match = docs.find(d => d.name.toLowerCase() === name.toLowerCase()) ?? docs[0]
  if (!match) return null

  const olid = match.key.replace('/authors/', '')
  return fetchAuthorDetail(olid)
}

async function fetchAuthorDetail(olid: string): Promise<OLAuthorResult | null> {
  const res = await fetch(
    `https://openlibrary.org/authors/${olid}.json`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null

  const data = await res.json() as {
    name?: string
    bio?: string | { value: string }
    birth_date?: string
    death_date?: string
    photos?: number[]
  }

  const bio = typeof data.bio === 'string' ? data.bio : data.bio?.value
  const photoUrl = data.photos?.[0]
    ? `https://covers.openlibrary.org/a/olid/${olid}-L.jpg`
    : undefined

  return {
    olid,
    name: data.name ?? '',
    bio,
    birthDate: data.birth_date,
    deathDate: data.death_date,
    photoUrl,
  }
}
```

- [ ] **Étape 2 : Commit**

```bash
git add backend/src/lib/openlibrary.ts
git commit -m "feat: add Open Library client"
```

---

## Task 3 : Router auteurs (CRUD + enrich)

**Files:**
- Create: `backend/src/routes/reading/authors.ts`
- Modify: `backend/src/routes/reading/index.ts`

- [ ] **Étape 1 : Écrire le test (failing)**

Créer `backend/src/__tests__/reading.authors.test.ts` :

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'reading-authors@example.com'
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
  await prisma.author.deleteMany({ where: { userId } })
})

describe('GET /api/reading/authors', () => {
  it('returns empty list when no authors', async () => {
    const res = await request(app).get('/api/reading/authors').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authors).toEqual([])
  })

  it('returns authors with bookCount', async () => {
    // Create author via book creation
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert' })

    const res = await request(app).get('/api/reading/authors').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authors[0].name).toBe('Frank Herbert')
    expect(res.body.authors[0].bookCount).toBe(1)
  })

  it('filters by search', async () => {
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert' })
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Foundation', authorName: 'Isaac Asimov' })

    const res = await request(app)
      .get('/api/reading/authors?search=frank')
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.authors).toHaveLength(1)
    expect(res.body.authors[0].name).toBe('Frank Herbert')
  })
})

describe('GET /api/reading/authors/:id', () => {
  it('returns author with books', async () => {
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert' })
    const authorsRes = await request(app).get('/api/reading/authors').set('Cookie', cookie)
    const authorId = authorsRes.body.authors[0].id

    const res = await request(app)
      .get(`/api/reading/authors/${authorId}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.author.name).toBe('Frank Herbert')
    expect(res.body.author.books).toHaveLength(1)
  })

  it('returns 404 for unknown author', async () => {
    const res = await request(app)
      .get('/api/reading/authors/nonexistent')
      .set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/reading/authors/:id', () => {
  it('updates author fields', async () => {
    await request(app).post('/api/reading/books').set('Cookie', cookie)
      .send({ title: 'Dune', authorName: 'Frank Herbert' })
    const authorsRes = await request(app).get('/api/reading/authors').set('Cookie', cookie)
    const authorId = authorsRes.body.authors[0].id

    const res = await request(app)
      .put(`/api/reading/authors/${authorId}`)
      .set('Cookie', cookie)
      .send({ nationality: 'Américain', bio: 'Auteur de SF' })
    expect(res.status).toBe(200)
    expect(res.body.author.nationality).toBe('Américain')
    expect(res.body.author.bio).toBe('Auteur de SF')
  })
})

describe('401 without auth', () => {
  it('GET /api/reading/authors returns 401', async () => {
    const res = await request(app).get('/api/reading/authors')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Étape 2 : Vérifier que les tests échouent**

```bash
cd backend && npx jest reading.authors --no-coverage 2>&1 | tail -20
```

Expected: FAIL (router does not exist yet)

- [ ] **Étape 3 : Créer le router**

Créer `backend/src/routes/reading/authors.ts` :

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { searchAuthorOnOL } from '../../lib/openlibrary'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query as Record<string, string>

    const authors = await prisma.author.findMany({
      where: {
        userId: req.user!.id,
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
    })

    res.json({
      authors: authors.map(a => ({
        ...a,
        bookCount: a._count.books,
        _count: undefined,
      })),
    })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const author = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        books: {
          include: { tags: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!author) { res.status(404).json({ error: 'Author not found' }); return }

    const avgRating = author.books.filter(b => b.rating).length > 0
      ? author.books.reduce((sum, b) => sum + (b.rating ?? 0), 0) /
        author.books.filter(b => b.rating).length
      : null

    res.json({ author: { ...author, avgRating } })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Author not found' }); return }

    const { name, bio, birthDate, deathDate, nationality, photoUrl } = req.body

    const author = await prisma.author.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        ...(deathDate !== undefined && { deathDate: deathDate ? new Date(deathDate) : null }),
        ...(nationality !== undefined && { nationality }),
        ...(photoUrl !== undefined && { photoUrl }),
      },
    })
    res.json({ author })
  } catch (err) { next(err) }
})

router.post('/:id/enrich', async (req, res, next) => {
  try {
    const existing = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Author not found' }); return }

    const result = await searchAuthorOnOL(existing.name)
    if (!result) {
      res.status(404).json({ error: 'Author not found on Open Library' })
      return
    }

    const author = await prisma.author.update({
      where: { id: req.params.id },
      data: {
        ...(!existing.bio && result.bio ? { bio: result.bio } : {}),
        ...(!existing.nationality ? {} : {}),
        ...(!existing.photoUrl && result.photoUrl ? { photoUrl: result.photoUrl } : {}),
        ...(!existing.openLibraryId && result.olid ? { openLibraryId: result.olid } : {}),
        ...(result.birthDate && !existing.birthDate
          ? { birthDate: parseDateLoose(result.birthDate) }
          : {}),
        ...(result.deathDate && !existing.deathDate
          ? { deathDate: parseDateLoose(result.deathDate) }
          : {}),
      },
    })
    res.json({ author })
  } catch (err) { next(err) }
})

function parseDateLoose(dateStr: string): Date | null {
  const year = parseInt(dateStr.replace(/\D.*/, ''), 10)
  if (isNaN(year)) return null
  return new Date(Date.UTC(year, 0, 1))
}

export default router
```

- [ ] **Étape 4 : Monter le router dans `backend/src/routes/reading/index.ts`**

```typescript
import { Router } from 'express'
import searchRouter from './search'
import booksRouter from './books'
import authorsRouter from './authors'

const router = Router()

router.use('/search', searchRouter)
router.use('/books', booksRouter)
router.use('/authors', authorsRouter)

export default router
```

- [ ] **Étape 5 : Relancer les tests**

```bash
cd backend && npx jest reading.authors --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Étape 6 : Commit**

```bash
git add backend/src/routes/reading/authors.ts backend/src/routes/reading/index.ts backend/src/__tests__/reading.authors.test.ts
git commit -m "feat: add authors router with CRUD and Open Library enrich"
```

---

## Task 4 : Modifier books.ts — find-or-create auteur

**Files:**
- Modify: `backend/src/routes/reading/books.ts`
- Modify: `backend/src/__tests__/reading.books.test.ts`

Les routes `POST /books` et `PUT /books/:id` acceptent désormais `authorName` au lieu de `author`.

- [ ] **Étape 1 : Mettre à jour les tests existants**

Dans `backend/src/__tests__/reading.books.test.ts`, remplacer chaque `author: 'Frank Herbert'` (et autres valeurs) par `authorName: 'Frank Herbert'` (idem pour les autres auteurs dans le fichier). Faire un find-and-replace dans le fichier.

Aussi mettre à jour le `afterEach` pour nettoyer les auteurs :

```typescript
afterEach(async () => {
  await prisma.book.deleteMany({ where: { userId } })
  await prisma.author.deleteMany({ where: { userId } })
})
```

Et les assertions qui vérifient `author` doivent maintenant vérifier `author.name` :

```typescript
// avant
expect(res.body.book.author).toBe('Frank Herbert')
// après
expect(res.body.book.author.name).toBe('Frank Herbert')
```

- [ ] **Étape 2 : Modifier `POST /api/reading/books` dans `books.ts`**

Remplacer le début du handler `router.post('/')` :

```typescript
router.post('/', async (req, res, next) => {
  try {
    const { title, authorName, synopsis, isbn, pageCount, genres, coverUrl, coverType,
            googleBooksId, status, owned, tags } = req.body

    if (!title || !authorName) {
      res.status(400).json({ error: 'Title and authorName are required' })
      return
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      res.status(400).json({ error: 'tags must be an array of strings' })
      return
    }
    if (status !== undefined && !Object.values(ReadingStatus).includes(status)) {
      res.status(400).json({ error: 'Invalid status value' })
      return
    }

    // find-or-create author
    const author = await prisma.author.upsert({
      where: { userId_name: { userId: req.user!.id, name: authorName } },
      create: { userId: req.user!.id, name: authorName },
      update: {},
    })

    const book = await prisma.book.create({
      data: {
        userId: req.user!.id,
        title,
        authorId: author.id,
        synopsis, isbn,
        pageCount: pageCount != null ? Number(pageCount) : undefined,
        genres: genres || [],
        coverUrl, coverType, googleBooksId,
        status: status || 'WISHLIST',
        owned: owned || false,
        tags: tags?.length ? { create: (tags as string[]).map(name => ({ name })) } : undefined,
      },
      include: { tags: true, author: true },
    })

    res.status(201).json({ book })
  } catch (err) { next(err) }
})
```

- [ ] **Étape 3 : Modifier `PUT /api/reading/books/:id` pour gérer `authorName`**

Dans le handler `router.put('/:id')`, ajouter `authorName` aux champs destructurés et la logique find-or-create :

```typescript
const { title, authorName, synopsis, isbn, pageCount, genres, coverUrl, coverType,
        status, owned, rating, review, favorite, rereadCount, tags } = req.body

// ... validation existante ...

// find-or-create author if authorName provided
let authorId: string | undefined
if (authorName !== undefined) {
  const author = await prisma.author.upsert({
    where: { userId_name: { userId: req.user!.id, name: authorName } },
    create: { userId: req.user!.id, name: authorName },
    update: {},
  })
  authorId = author.id
}
```

Et dans les `prisma.book.update`, remplacer `...(author !== undefined && { author })` par `...(authorId !== undefined && { authorId })`, et ajouter `author: true` dans l'include.

- [ ] **Étape 4 : Mettre à jour les includes `{ tags: true }` vers `{ tags: true, author: true }` dans tous les `findFirst` et `update` de books.ts**

Cela assure que toutes les réponses incluent l'objet auteur complet.

- [ ] **Étape 5 : Lancer les tests**

```bash
cd backend && npx jest reading.books reading.authors --no-coverage 2>&1 | tail -30
```

Expected: PASS

- [ ] **Étape 6 : Commit**

```bash
git add backend/src/routes/reading/books.ts backend/src/__tests__/reading.books.test.ts
git commit -m "feat: books use find-or-create Author instead of plain string"
```

---

## Task 5 : Types et API frontend

**Files:**
- Modify: `frontend/src/api/reading.ts`

- [ ] **Étape 1 : Ajouter le type `Author` et `authorsApi`**

En haut du fichier, ajouter après `BookNote` :

```typescript
export interface Author {
  id: string
  userId: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  nationality?: string
  photoUrl?: string
  openLibraryId?: string
  bookCount?: number
  avgRating?: number
  books?: Book[]
  createdAt: string
  updatedAt: string
}
```

Dans l'interface `Book`, remplacer `author: string` par `author: Author` :

```typescript
  author: Author
```

Mettre à jour `BookInput` — remplacer `author: string` par `authorName: string` :

```typescript
export type BookInput = Partial<Omit<Book, 'author'>> & { title: string; authorName: string; tags?: string[] }
```

En bas du fichier, ajouter `authorsApi` :

```typescript
export const authorsApi = {
  getAll: (params?: { search?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return apiClient<{ authors: Author[] }>(`/api/reading/authors${qs ? `?${qs}` : ''}`)
  },

  getOne: (id: string) =>
    apiClient<{ author: Author }>(`/api/reading/authors/${id}`),

  update: (id: string, data: Partial<Pick<Author, 'name' | 'bio' | 'birthDate' | 'deathDate' | 'nationality' | 'photoUrl'>>) =>
    apiClient<{ author: Author }>(`/api/reading/authors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  enrich: (id: string) =>
    apiClient<{ author: Author }>(`/api/reading/authors/${id}/enrich`, {
      method: 'POST',
    }),
}
```

- [ ] **Étape 2 : Commit**

```bash
git add frontend/src/api/reading.ts
git commit -m "feat: add Author type and authorsApi to reading API"
```

---

## Task 5b : Mettre à jour les composants existants qui affichent book.author comme string

**Files:**
- Modify: `frontend/src/components/reading/BookCard.tsx`
- Modify: `frontend/src/components/reading/BookRow.tsx`
- Modify: `frontend/src/pages/reading/BookDetail.tsx`
- Modify: `frontend/src/components/citations/CitationForm.tsx`
- Modify: `frontend/src/pages/citations/CitationDetail.tsx`

Après le changement de type `Book.author: string → Author`, TypeScript signalera ces erreurs.

- [ ] **Étape 1 : BookCard.tsx line 21**

```tsx
// avant
<div className="book-card-author">{book.author}</div>
// après
<div className="book-card-author">{book.author.name}</div>
```

- [ ] **Étape 2 : BookRow.tsx line 19**

```tsx
// avant
<div className="book-row-author">{book.author}</div>
// après
<div className="book-row-author">{book.author.name}</div>
```

- [ ] **Étape 3 : BookDetail.tsx line 163**

```tsx
// avant
<div className="book-detail-author">{book.author}</div>
// après
<div className="book-detail-author">{book.author.name}</div>
```

- [ ] **Étape 4 : CitationForm.tsx line 69**

```tsx
// avant
setAuthor(a => a || book.author)
// après
setAuthor(a => a || book.author.name)
```

- [ ] **Étape 5 : CitationForm.tsx line 192**

```tsx
// avant
<div className="book-search-item-author">{b.author}</div>
// après
<div className="book-search-item-author">{b.author.name}</div>
```

- [ ] **Étape 6 : CitationDetail.tsx line 106**

```tsx
// avant
<div className="citation-detail-book-author">{citation.book.author}</div>
// après
<div className="citation-detail-book-author">{citation.book?.author?.name}</div>
```

- [ ] **Étape 7 : Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur liée à `book.author`

- [ ] **Étape 8 : Commit**

```bash
git add frontend/src/components/reading/BookCard.tsx frontend/src/components/reading/BookRow.tsx frontend/src/pages/reading/BookDetail.tsx frontend/src/components/citations/CitationForm.tsx frontend/src/pages/citations/CitationDetail.tsx
git commit -m "fix: update components to use book.author.name after Author FK change"
```

---

## Task 6 : Composant AuthorAutocomplete

**Files:**
- Create: `frontend/src/components/reading/AuthorAutocomplete.tsx`

- [ ] **Étape 1 : Créer le composant**

```typescript
import { useState, useEffect, useRef } from 'react'
import { authorsApi, type Author } from '../../api/reading'

interface Props {
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function AuthorAutocomplete({ value, onChange, required }: Props) {
  const [suggestions, setSuggestions] = useState<Author[]>([])
  const [open, setOpen] = useState(false)
  const timeout = useRef<ReturnType<typeof setTimeout>>()
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!value.trim() || value.length < 2) { setSuggestions([]); return }
    clearTimeout(timeout.current)
    timeout.current = setTimeout(async () => {
      try {
        const data = await authorsApi.getAll({ search: value })
        setSuggestions(data.authors.slice(0, 6))
        setOpen(data.authors.length > 0)
      } catch { setSuggestions([]) }
    }, 250)
    return () => clearTimeout(timeout.current)
  }, [value])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function pick(author: Author) {
    onChange(author.name)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={wrapRef} className="author-autocomplete-wrap">
      <input
        className="input-field"
        placeholder="Nom de l'auteur"
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => suggestions.length > 0 && setOpen(true)}
        required={required}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <ul className="author-suggestions">
          {suggestions.map(a => (
            <li key={a.id} className="author-suggestion-item" onMouseDown={() => pick(a)}>
              {a.photoUrl
                ? <img src={a.photoUrl} className="author-suggestion-photo" alt={a.name} />
                : <span className="author-suggestion-avatar">{a.name[0]}</span>
              }
              <span className="author-suggestion-name">{a.name}</span>
              <span className="author-suggestion-count">{a.bookCount} livre{(a.bookCount ?? 0) > 1 ? 's' : ''}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

- [ ] **Étape 2 : Ajouter les styles dans `frontend/src/styles/reading.css`**

```css
/* Author Autocomplete */
.author-autocomplete-wrap { position: relative; }

.author-suggestions {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  background: var(--bg-surface);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-medium);
  list-style: none;
  z-index: 50;
  overflow: hidden;
}

.author-suggestion-item {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  transition: background var(--transition);
}

.author-suggestion-item:hover { background: var(--accent-light); }

.author-suggestion-photo {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.author-suggestion-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 0.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.author-suggestion-name { flex: 1; font-size: 0.875rem; color: var(--text-primary); }
.author-suggestion-count { font-size: 0.75rem; color: var(--text-muted); }
```

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/components/reading/AuthorAutocomplete.tsx frontend/src/styles/reading.css
git commit -m "feat: add AuthorAutocomplete component"
```

---

## Task 7 : Intégrer AuthorAutocomplete dans AddBookModal

**Files:**
- Modify: `frontend/src/pages/reading/AddBookModal.tsx`

- [ ] **Étape 1 : Modifier le formulaire**

Dans `AddBookModal.tsx` :

1. Ajouter l'import :
```typescript
import { AuthorAutocomplete } from '../../components/reading/AuthorAutocomplete'
```

2. Dans le state `form`, renommer `author: ''` en `authorName: ''`.

3. Dans `fillFromResult`, remplacer `author: r.author` par `authorName: r.author`.

4. Dans le handler `handleSubmit`, remplacer `author: form.author` par `authorName: form.authorName`.

5. Dans le formulaire JSX, remplacer :
```tsx
<Input label="Auteur *" value={form.author} onChange={e => setForm(f => ({ ...f, author: e.target.value }))} required />
```
par :
```tsx
<div className="input-group">
  <label className="input-label">Auteur *</label>
  <AuthorAutocomplete
    value={form.authorName}
    onChange={v => setForm(f => ({ ...f, authorName: v }))}
    required
  />
</div>
```

- [ ] **Étape 2 : Vérifier que le TypeScript compile**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur

- [ ] **Étape 3 : Commit**

```bash
git add frontend/src/pages/reading/AddBookModal.tsx
git commit -m "feat: use AuthorAutocomplete in AddBookModal"
```

---

## Task 8 : Pages Auteurs

**Files:**
- Create: `frontend/src/pages/reading/AuthorsPage.tsx`
- Create: `frontend/src/pages/reading/AuthorDetail.tsx`
- Modify: `frontend/src/styles/reading.css`

- [ ] **Étape 1 : Créer AuthorsPage**

```typescript
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authorsApi, type Author } from '../../api/reading'

export function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    authorsApi.getAll({ search: search || undefined })
      .then(d => setAuthors(d.authors))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  return (
    <div className="authors-page">
      <div className="reading-header">
        <div>
          <h1 className="reading-title">Auteurs</h1>
          <p className="reading-count">{authors.length} auteur{authors.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="reading-toolbar">
        <input
          className="input-field reading-search"
          placeholder="Rechercher un auteur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="routines-loading"><div className="loading-spinner" /></div>
      ) : authors.length === 0 ? (
        <div className="routines-empty">Aucun auteur trouvé.</div>
      ) : (
        <div className="authors-grid">
          {authors.map(a => (
            <Link key={a.id} to={`/reading/authors/${a.id}`} className="author-card glass-card">
              <div className="author-card-avatar">
                {a.photoUrl
                  ? <img src={a.photoUrl} alt={a.name} className="author-card-photo" />
                  : <span className="author-card-initials">{a.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div className="author-card-info">
                <div className="author-card-name">{a.name}</div>
                <div className="author-card-meta">
                  {a.nationality && <span>{a.nationality}</span>}
                  <span>{a.bookCount} livre{(a.bookCount ?? 0) !== 1 ? 's' : ''}</span>
                  {a.avgRating != null && <span>★ {a.avgRating.toFixed(1)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Étape 2 : Créer AuthorDetail**

```typescript
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { authorsApi, type Author } from '../../api/reading'
import { BookRow } from '../../components/reading/BookRow'
import { GlassCard } from '../../components/ui/GlassCard'

export function AuthorDetail() {
  const { authorId } = useParams<{ authorId: string }>()
  const [author, setAuthor] = useState<Author | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorId) return
    authorsApi.getOne(authorId)
      .then(d => setAuthor(d.author))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authorId])

  async function handleEnrich() {
    if (!authorId) return
    setEnriching(true)
    setEnrichMsg(null)
    try {
      const data = await authorsApi.enrich(authorId)
      setAuthor(data.author)
      setEnrichMsg('Informations mises à jour.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setEnrichMsg(msg.includes('404') ? 'Auteur introuvable sur Open Library.' : 'Erreur lors de l\'enrichissement.')
    }
    setEnriching(false)
  }

  if (loading) return <div className="routines-loading"><div className="loading-spinner" /></div>
  if (!author) return <div className="routines-empty">Auteur introuvable.</div>

  const books = author.books ?? []

  return (
    <div className="author-detail">
      <Link to="/reading/authors" className="author-back-link">← Auteurs</Link>

      <GlassCard className="author-detail-header">
        <div className="author-detail-avatar">
          {author.photoUrl
            ? <img src={author.photoUrl} alt={author.name} className="author-detail-photo" />
            : <span className="author-detail-initials">{author.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div className="author-detail-info">
          <h1 className="author-detail-name">{author.name}</h1>
          {(author.birthDate || author.deathDate || author.nationality) && (
            <p className="author-detail-meta">
              {author.nationality && <span>{author.nationality}</span>}
              {author.birthDate && (
                <span>{new Date(author.birthDate).getFullYear()}
                  {author.deathDate ? ` – ${new Date(author.deathDate).getFullYear()}` : ''}
                </span>
              )}
            </p>
          )}
          {author.bio && <p className="author-detail-bio">{author.bio}</p>}
          <div className="author-detail-actions">
            <button
              className="btn btn-ghost"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              onClick={handleEnrich}
              disabled={enriching}
            >
              {enriching ? <span className="loading-spinner loading-spinner--sm" /> : '✦'} Enrichir via Open Library
            </button>
            {enrichMsg && <span className="author-enrich-msg">{enrichMsg}</span>}
          </div>
        </div>
      </GlassCard>

      <div className="author-detail-books">
        <h2 className="author-detail-section-title">
          {books.length} livre{books.length !== 1 ? 's' : ''}
          {author.avgRating != null && ` · ★ ${author.avgRating.toFixed(1)} en moyenne`}
        </h2>
        {books.map(b => (
          <BookRow key={b.id} book={b} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Étape 3 : Ajouter les styles dans `reading.css`**

```css
/* Authors Page */
.authors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 0.875rem;
  animation: fadeUp 0.45s ease both;
}

.author-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: transform var(--transition), box-shadow var(--transition);
}

.author-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-medium); }

.author-card-avatar { flex-shrink: 0; }

.author-card-photo {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
}

.author-card-initials {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 1rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
}

.author-card-name { font-weight: 600; color: var(--text-primary); font-size: 0.95rem; }
.author-card-meta { font-size: 0.78rem; color: var(--text-muted); display: flex; gap: 0.6rem; margin-top: 0.2rem; }

/* Author Detail */
.author-detail { max-width: 860px; margin: 0 auto; }

.author-back-link {
  display: inline-block;
  margin-bottom: 1.25rem;
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  transition: color var(--transition);
}
.author-back-link:hover { color: var(--accent); }

.author-detail-header {
  display: flex;
  gap: 1.5rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
  align-items: flex-start;
  animation: fadeUp 0.4s ease both;
}

.author-detail-photo {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  object-fit: cover;
  flex-shrink: 0;
}

.author-detail-initials {
  width: 96px;
  height: 96px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  font-size: 1.75rem;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.author-detail-info { flex: 1; }
.author-detail-name { font-family: 'Playfair Display', serif; font-size: 1.75rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.4rem; }
.author-detail-meta { font-size: 0.875rem; color: var(--text-muted); display: flex; gap: 0.75rem; margin-bottom: 0.75rem; }
.author-detail-bio { font-size: 0.875rem; color: var(--text-secondary); line-height: 1.6; margin-bottom: 1rem; }
.author-detail-actions { display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; }
.author-enrich-msg { font-size: 0.8rem; color: var(--text-muted); }

.author-detail-books { animation: fadeUp 0.4s ease 0.1s both; }
.author-detail-section-title { font-family: 'Playfair Display', serif; font-size: 1.1rem; color: var(--text-secondary); margin-bottom: 1rem; }
```

- [ ] **Étape 4 : Commit**

```bash
git add frontend/src/pages/reading/AuthorsPage.tsx frontend/src/pages/reading/AuthorDetail.tsx frontend/src/styles/reading.css
git commit -m "feat: add AuthorsPage and AuthorDetail pages"
```

---

## Task 9 : Routing et navigation

**Files:**
- Modify: `frontend/src/pages/reading/ReadingPage.tsx`

- [ ] **Étape 1 : Ajouter les routes authors dans ReadingPage**

```typescript
import { Routes, Route } from 'react-router-dom'
import { BookLibrary } from './BookLibrary'
import { BookDetail } from './BookDetail'
import { AuthorsPage } from './AuthorsPage'
import { AuthorDetail } from './AuthorDetail'

export function ReadingPage() {
  return (
    <Routes>
      <Route index element={<BookLibrary />} />
      <Route path="authors" element={<AuthorsPage />} />
      <Route path="authors/:authorId" element={<AuthorDetail />} />
      <Route path=":id" element={<BookDetail />} />
    </Routes>
  )
}
```

- [ ] **Étape 2 : Ajouter le lien dans BookLibrary**

Dans `frontend/src/pages/reading/BookLibrary.tsx`, dans le header, ajouter un lien vers les auteurs à côté du bouton "Ajouter" :

```tsx
import { Link } from 'react-router-dom'
// ...
<Link to="/reading/authors" className="btn btn-ghost" style={{ width: 'auto', padding: '0.65rem 1.25rem' }}>
  Auteurs
</Link>
```

- [ ] **Étape 3 : Vérifier TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: aucune erreur

- [ ] **Étape 4 : Lancer tous les tests backend**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: PASS

- [ ] **Étape 5 : Commit final**

```bash
git add frontend/src/pages/reading/ReadingPage.tsx frontend/src/pages/reading/BookLibrary.tsx
git commit -m "feat: wire authors routes and navigation link"
```

---

## Récapitulatif des commits attendus

1. `feat: add Author model and migrate Book.author to FK`
2. `feat: add Open Library client`
3. `feat: add authors router with CRUD and Open Library enrich`
4. `feat: books use find-or-create Author instead of plain string`
5. `feat: add Author type and authorsApi to reading API`
5b. `fix: update components to use book.author.name after Author FK change`
6. `feat: add AuthorAutocomplete component`
7. `feat: use AuthorAutocomplete in AddBookModal`
8. `feat: add AuthorsPage and AuthorDetail pages`
9. `feat: wire authors routes and navigation link`
