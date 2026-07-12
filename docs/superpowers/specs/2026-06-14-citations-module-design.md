# Citations Module — Design Spec
_Date: 2026-06-14_

## Overview

A dedicated module for managing quotes from any source (books, articles, podcasts, films, people, etc.). Citations are standalone entities with optional links to books in the Reading module. The module lives at `/citations` and adds a Citations tab to `BookDetail`.

## Decisions Made

| Question | Decision |
|---|---|
| Detail view | Dedicated page (like BookDetail) |
| Card style | Colored left-strip card |
| Tags | Separate `CitationTag` model (like `JournalTag`) |
| View tracking | `viewCount` field, incremented on `GET /:id` |
| Architecture | Independent module with optional `bookId` FK |

---

## 1. Database Schema

### New enum

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
```

### Citation model

```prisma
model Citation {
  id         String     @id @default(cuid())
  userId     String
  user       User       @relation(fields: [userId], references: [id], onDelete: Cascade)

  text       String
  author     String?
  sourceType SourceType @default(OTHER)
  source     String?          // free-text title (article, podcast, film…)

  // Book link (optional — only when sourceType = BOOK)
  bookId     String?
  book       Book?      @relation(fields: [bookId], references: [id], onDelete: SetNull)
  page       Int?
  chapter    String?

  comment    String?          // personal reflection
  color      String    @default("#C4775A")
  favorite   Boolean   @default(false)
  viewCount  Int       @default(0)

  tags       CitationTag[]

  createdAt  DateTime  @default(now())
  updatedAt  DateTime  @updatedAt

  @@index([userId])
  @@index([userId, favorite])
  @@index([userId, sourceType])
  @@index([bookId])
}
```

### CitationTag model

```prisma
model CitationTag {
  id         String   @id @default(cuid())
  name       String
  citationId String
  citation   Citation @relation(fields: [citationId], references: [id], onDelete: Cascade)

  @@unique([citationId, name])
  @@index([citationId])
}
```

### Relations added to existing models

```prisma
model User {
  // ...existing fields...
  citations  Citation[]
}

model Book {
  // ...existing fields...
  citations  Citation[]
}
```

---

## 2. Backend Routes

Router mounted at `/api/citations` in `app.ts`.

### Citation CRUD — `routes/citations/citations.ts`

| Method | Path | Description |
|---|---|---|
| GET | `/api/citations` | List with search + filters |
| POST | `/api/citations` | Create |
| GET | `/api/citations/stats` | Aggregate stats (registered before `/:id`) |
| GET | `/api/citations/tags` | Distinct tag names for autocomplete |
| GET | `/api/citations/:id` | Detail + increment viewCount |
| PUT | `/api/citations/:id` | Update |
| DELETE | `/api/citations/:id` | Delete |
| PATCH | `/api/citations/:id/favorite` | Toggle favorite |

#### GET /api/citations — Query params

| Param | Type | Description |
|---|---|---|
| `search` | string | Searches `text`, `author`, `source`, `comment` |
| `sourceType` | SourceType | Filter by source type |
| `favorite` | boolean | `true` to show favorites only |
| `tag` | string | Filter by tag name |
| `bookId` | string | Filter by linked book |

Response: `{ citations: Citation[], total: number }`

#### GET /api/citations/stats — Response shape

```ts
{
  total: number
  favorites: number
  bySourceType: Record<SourceType, number>
  byAuthor: Array<{ author: string; count: number }>  // top 10
  mostViewed: Array<Citation>                          // top 5 by viewCount
  timeline: Array<{ month: string; count: number }>   // last 12 months (YYYY-MM)
}
```

#### GET /api/citations/:id

Returns the citation and **atomically increments `viewCount`** using `prisma.citation.update({ data: { viewCount: { increment: 1 } } })`.

### Book citations — `routes/reading/books.ts` (addition)

```
GET /api/reading/books/:id/citations
```

Returns all citations linked to a specific book, ordered by `createdAt desc`. Used by `BookDetail` Citations tab.

Response: `{ citations: Citation[]; total: number }`

---

## 3. Frontend Structure

```
frontend/src/
  api/
    citations.ts                  CitationType, Citation, citationsApi
  pages/citations/
    CitationsPage.tsx             Tab router: /citations → /citations/list
    CitationList.tsx              Search + filters + CitationCard list
    CitationDetail.tsx            Full detail page, edit/delete actions
  components/citations/
    CitationCard.tsx              Colored-strip card (list item)
    CitationForm.tsx              Create/edit modal overlay
    CitationStatsPanel.tsx        Stats page (charts + counters)
  styles/
    citations.css                 All citations module styles
```

### Routing

```
/citations              → <Navigate to="list" />
/citations/list         → <CitationList />
/citations/stats        → <CitationStatsPanel />
/citations/:id          → <CitationDetail />
```

`CitationsPage` renders the tab bar (`Liste` / `Stats`) and hides it on the detail route (same pattern as `RoutinesPage`).

### CitationCard

Colored left strip (user-chosen `color` field, default `#C4775A`). Displays:
- Citation text truncated to 2 lines (CSS `line-clamp: 2`)
- Author · source type badge
- Tags (first 3, then `+N`)
- Favorite star

### CitationForm (modal)

Fields in order:
1. **Texte** — textarea, required
2. **Auteur** — text input, optional
3. **Type de source** — button group (9 options)
4. **Source** — text input (label = "Livre" when sourceType=BOOK shows a search-in-library input instead; on book select, sets `bookId` and pre-fills `source` with book title)
5. **Page** + **Chapitre** — only visible when sourceType=BOOK
6. **Commentaire** — textarea, optional
7. **Tags** — tag input with autocomplete from existing user tags
8. **Couleur** — color swatches (same palette as RoutineForm)
9. **Favori** — checkbox

Book search (when sourceType=BOOK): calls `GET /api/reading/books?search=` with debounce, shows results as a dropdown list, selecting a book sets `bookId` and `source`.

### CitationDetail page

Layout:
- `← Citations` back button
- Citation text block (large, serif, left border in citation color)
- Author · sourceType badge · source name · page/chapter if set
- Tags row
- Comment section ("Mon commentaire")
- Book link card if `bookId` set (shows book cover + title, links to `/reading/books/:id`)
- Edit / Delete buttons

### CitationStatsPanel

Grid of stat cards (same `.stats-panel` / `.stat-card` CSS as RoutineDetail):
- Total citations
- Favoris
- Par type de source (badge list: sourceType name + count)
- Top auteurs (top 5)
- Citations les plus consultées (top 5, with viewCount)
- Évolution mensuelle (simple list of last 12 months with counts)

---

## 4. Navigation

Add to `backend/src/routes/modules.ts`:

```ts
{ slug: 'citations', name: 'Citations', description: 'Tes citations et extraits', icon: '💬', available: true }
```

Add to `frontend/src/App.tsx` (or router file):

```tsx
<Route path="/citations/*" element={<CitationsPage />} />
```

---

## 5. BookDetail Integration

### Backend

New route `GET /api/reading/books/:id/citations` added to `routes/reading/books.ts`.

### Frontend — BookDetail tab bar

BookDetail currently has no explicit tabs — sections are stacked vertically. Add a tab bar above the right column with:

```
Informations | Notes (N) | Citations (N)
```

- **Informations** (default): current content (synopsis, progress, avis)
- **Notes (N)**: existing notes section (moved into tab)
- **Citations (N)**: fetches `/api/reading/books/:id/citations`, renders compact `CitationCard` list, includes a "+ Ajouter une citation" button that opens `CitationForm` pre-filled with `sourceType=BOOK` and `bookId`.

The `N` count is fetched alongside the book data — add `_count: { select: { notes: true, citations: true } }` to the Prisma `include` in `GET /api/reading/books/:id`.

---

## 6. Key Constraints

- `page` and `chapter` fields are only meaningful when `sourceType = BOOK`; the form shows/hides them based on type selection.
- `bookId` uses `onDelete: SetNull` — deleting a book does not delete its citations, just unlinks them.
- `viewCount` is incremented server-side only (never writable from the client directly).
- Tag autocomplete queries `GET /api/citations/tags` (distinct tag names for the user, registered before `/:id`).
- `GET /api/citations/stats` must also be registered before `/:id` in Express to avoid "stats" being parsed as an id parameter.
- Search is server-side (`contains`, case-insensitive) consistent with journal and routines.
- The `color` field on Citation is for the card's left strip; default `#C4775A` (same as RoutineForm palette).
