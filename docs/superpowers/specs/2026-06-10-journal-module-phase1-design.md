# Journal Personnel — Phase 1 Design Spec

**Date:** 2026-06-10
**Scope:** Core journal module — CRUD entries, Tiptap rich editor, tags, favorites, pinned, draft, search/filters, archives, statistics, mood tracking.
**Out of scope (Phase 2):** Export PDF/Markdown, locked entries with PIN.

---

## Goal

Add a personal journal module where the user can write rich-text entries, organize them with tags and moods, search and filter them, navigate archives by month/year, and view writing statistics.

---

## Architecture

### Pattern
Follows the existing reading module pattern:
- Backend: new Prisma models + Express router at `/api/journal/*`
- Frontend: new pages under `/journal/*`, new components under `components/journal/`, one new reusable UI component `RichEditor` under `components/ui/`
- Same auth middleware (`requireAuth`), same `apiClient`, same `GlassCard`/`Input`/`Button` UI components

### Content Storage Strategy
Tiptap content is stored in two fields on `JournalEntry`:
- `content` (String) — ProseMirror JSON, used for re-editing in Tiptap
- `contentText` (String) — plain text extracted from the JSON, used for full-text search

Plain text is extracted server-side on create/update by walking the ProseMirror JSON and concatenating all `text` leaf nodes.

---

## Data Models

```prisma
enum Mood {
  EXCELLENT
  GOOD
  NEUTRAL
  BAD
  VERY_BAD
}

model JournalEntry {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  title       String
  content     String    // ProseMirror JSON as string
  contentText String    @default("")  // plain text for search

  mood        Mood?
  favorite    Boolean   @default(false)
  pinned      Boolean   @default(false)
  draft       Boolean   @default(false)

  tags        JournalTag[]

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

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

`User` model gains `journalEntries JournalEntry[]`.

---

## Backend API

Router mounted at `/api/journal` in `app.ts`. All routes require `requireAuth`.

### Entries

**`GET /api/journal/entries`**
Query params: `search` (title + contentText), `mood`, `favorite` (boolean), `pinned` (boolean), `draft` (boolean), `tag`, `dateFrom` (ISO), `dateTo` (ISO), `page` (default 1), `limit` (default 20).
Returns entries ordered by `pinned DESC, createdAt DESC` (pinned entries float to top within results).
Response: `{ entries: JournalEntry[], total: number, page: number }`

**`POST /api/journal/entries`**
Body: `{ title, content, mood?, favorite?, pinned?, draft?, tags? }`
Extracts `contentText` from `content` JSON server-side.
Response: `{ entry: JournalEntry }`

**`GET /api/journal/entries/:id`**
Response: `{ entry: JournalEntry }` (includes tags). 404 if not found or not owned by user.

**`PUT /api/journal/entries/:id`**
Body: partial entry fields. Re-extracts `contentText` if `content` changes.
Response: `{ entry: JournalEntry }`

**`DELETE /api/journal/entries/:id`**
Response: `{ ok: true }`

### Stats

**`GET /api/journal/stats`**
Computes and returns:
```json
{
  "totalEntries": 42,
  "totalWords": 18500,
  "currentStreak": 5,
  "longestStreak": 14,
  "avgEntriesPerWeek": 3.2,
  "moodByWeek": [{ "week": "2026-W23", "avg": 2.4 }, ...],
  "moodByMonth": [{ "month": "2026-06", "avg": 2.1, "count": 8 }, ...]
}
```
Streak = consecutive calendar days (in user's local timezone, approximated as UTC) with at least one non-draft entry ending today or yesterday.
Mood numeric values: EXCELLENT=1, GOOD=2, NEUTRAL=3, BAD=4, VERY_BAD=5 (lower = better).
`moodByWeek` and `moodByMonth` cover only entries that have a mood set, last 12 weeks / 12 months.

### Archives

**`GET /api/journal/archives`**
Returns entry counts grouped by year and month, descending.
Response: `{ archives: [{ year: 2026, month: 6, count: 8 }, ...] }`

---

## Frontend

### Routing

```
/journal              → JournalList (default view)
/journal/:id          → EntryDetail
```

Added to `App.tsx` as a protected route under `AppLayout`, same pattern as `/reading/*`.
`modules.ts` backend: `journal` available set to `true`.

### Pages

**`JournalPage.tsx`** — internal router, same pattern as `ReadingPage`.

**`JournalList.tsx`**
- Header: title "Journal", button "+ Nouvelle entrée" (creates a draft entry and navigates to its detail)
- Search bar (debounced 400ms, searches title + content)
- Filter row: mood selector, toggles for Favoris / Épinglées / Brouillons, date range inputs
- Archive sidebar or collapsible panel: month/year navigation from `/api/journal/archives`. Clicking a month sets `dateFrom`/`dateTo` filters.
- Entry list: `EntryCard` components, pinned entries shown with a visual indicator at top of results
- Empty state with call to action

**`EntryDetail.tsx`**
- Inline editing: the page is always in edit mode (no separate view/edit toggle). Title is an editable `<h1>`-style input. Content is the Tiptap `RichEditor`.
- Auto-save: debounced 1000ms after last keystroke, saves to backend. Shows "Enregistré" / "Enregistrement..." indicator.
- Sidebar panel (right column on desktop, collapsed on mobile):
  - `MoodPicker`
  - Tags input (same chip pattern as reading module)
  - Toggles: Favori, Épinglée, Brouillon
  - Created/updated timestamps
  - Delete button (with `confirm()` dialog)
- Back button → `/journal`

### Components

**`RichEditor.tsx`** (`components/ui/`)
Reusable Tiptap wrapper. Props: `content` (JSON string), `onChange(json: string, text: string)`, `placeholder?`, `readOnly?`.
Tiptap extensions included:
- `StarterKit` (headings H1–H3, paragraph, bold, italic, strike, code, blockquote, bulletList, orderedList, hardBreak, horizontalRule)
- `Underline`
- `Link` (with `openOnClick: false`, auto-detection)
- `Image` (inline, base64 for now — no separate upload endpoint in Phase 1)
- `Table` + `TableRow` + `TableHeader` + `TableCell`
Toolbar: icon buttons for each formatting action. Styled to match app theme (warm tones).

**`EntryCard.tsx`** (`components/journal/`)
Card showing: title, date (relative or absolute), mood badge, first ~120 chars of `contentText` as preview, tags (up to 3, then "+N"), pinned indicator (📌), draft badge, favorite star.

**`MoodBadge.tsx`** (`components/journal/`)
Chip with emoji + label per mood:
- EXCELLENT → 😄 Excellent
- GOOD → 🙂 Bon
- NEUTRAL → 😐 Neutre
- BAD → 😔 Mauvais
- VERY_BAD → 😞 Très mauvais

**`MoodPicker.tsx`** (`components/journal/`)
Row of 5 clickable mood buttons. Selected mood is highlighted. Clicking the active mood deselects it (sets mood to null).

**`StatsPanel.tsx`** (`components/journal/`)
Shown as a collapsible section or separate route `/journal/stats` accessible from the list header.
Displays:
- 4 stat chips: total entries, total words, current streak, longest streak
- Avg entries/week
- Mood by week: horizontal CSS bar chart (no external library), last 8 weeks
- Mood by month: same style, last 6 months
Bar colors follow mood value (green → red gradient).

### API Client

`frontend/src/api/journal.ts` — types + `journalApi` object mirroring the backend routes.

### Styles

`frontend/src/styles/journal.css` — all journal-specific styles.
`RichEditor` has its own scoped styles for the toolbar and editor content area (ProseMirror).
`main.tsx` imports `journal.css`.

---

## Reused Components

| Component | Reused as-is |
|-----------|-------------|
| `GlassCard` | Entry cards, sidebar panels |
| `Input` | Search bar, tag input, date range |
| `Button` | Actions throughout |
| `AppLayout` | Wraps all journal pages |
| `apiClient` | All API calls |

`RichEditor` is new but designed for reuse in other modules (book notes, reviews, etc.).

---

## Tiptap Dependencies

```
@tiptap/react
@tiptap/pm
@tiptap/starter-kit
@tiptap/extension-underline
@tiptap/extension-link
@tiptap/extension-image
@tiptap/extension-table
@tiptap/extension-table-row
@tiptap/extension-table-header
@tiptap/extension-table-cell
```

---

## Testing

Backend tests in `backend/src/__tests__/journal.entries.test.ts`:
- CRUD lifecycle (create, read, update, delete)
- Search by title and content
- Filter by mood, favorite, pinned, draft, date range, tag
- Stats calculation (streak, word count, mood averages)
- Archives grouping
- Auth isolation (user A cannot access user B's entries)

---

## File Map

```
backend/
├── prisma/schema.prisma                MODIFY — add Mood enum, JournalEntry, JournalTag
├── src/
│   ├── app.ts                          MODIFY — register /api/journal
│   ├── lib/journal.ts                  CREATE — extractTextFromTiptap() helper
│   └── routes/journal/
│       ├── index.ts                    CREATE — mounts entries + stats + archives
│       ├── entries.ts                  CREATE — CRUD routes
│       ├── stats.ts                    CREATE — stats route
│       └── archives.ts                 CREATE — archives route
├── src/__tests__/
│   └── journal.entries.test.ts         CREATE
└── src/routes/modules.ts               MODIFY — journal available: true

frontend/
├── src/
│   ├── main.tsx                        MODIFY — import journal.css
│   ├── App.tsx                         MODIFY — add /journal/* route
│   ├── api/journal.ts                  CREATE — types + API functions
│   ├── styles/journal.css              CREATE — all journal styles
│   ├── pages/journal/
│   │   ├── JournalPage.tsx             CREATE — internal router
│   │   ├── JournalList.tsx             CREATE — list + search + filters + archives
│   │   └── EntryDetail.tsx             CREATE — inline edit with Tiptap + sidebar
│   └── components/
│       ├── ui/RichEditor.tsx           CREATE — reusable Tiptap wrapper
│       └── journal/
│           ├── EntryCard.tsx           CREATE
│           ├── MoodBadge.tsx           CREATE
│           ├── MoodPicker.tsx          CREATE
│           └── StatsPanel.tsx          CREATE
```
