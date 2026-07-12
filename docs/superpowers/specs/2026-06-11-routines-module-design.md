# Routines & Suivi — Design Spec

**Date:** 2026-06-11
**Scope:** Full routines module — habits, recurring tasks, periodic obligations, rrule-based recurrence, simple + quantitative validation, monthly tracker grid, annual heatmap, today view, item list, per-item statistics.

---

## Goal

Add a routines and habit-tracking module where the user can define habits/tasks/obligations with custom recurrence rules, validate them daily, and visualize progress through a monthly tracker grid, an annual heatmap, and per-item statistics.

---

## Architecture

### Pattern
Follows the existing reading/journal module pattern:
- Backend: new Prisma models + Express router at `/api/routines/*`
- Frontend: new pages under `/routines/*`, new components under `components/routines/`
- Same auth middleware (`requireAuth`), same `apiClient`, same `GlassCard`/`Input`/`Button` UI components

### Recurrence Engine
`rrule` npm package (RFC 5545 / iCalendar standard). Handles all recurrence types from the spec — daily, every N days, specific weekdays, monthly, last weekday of month, etc.

- Stored as an rrule string in `Routine.rruleString` (e.g. `FREQ=WEEKLY;BYDAY=MO,TH`)
- Backend uses `rrule` to compute whether a given date is a scheduled occurrence, and to generate occurrence lists for stats and grid
- Frontend uses `rrule` to generate the monthly grid and annual heatmap occurrences client-side

### Grid State Model
The monthly tracker grid uses 3 visually distinct states per cell:
- **Done** (scheduled + completed) → green `#48bb78` with ✓
- **Missed** (scheduled + not completed, in the past) → red `#e56464` with ✗
- **Not due** (not scheduled on this day) → neutral `#EDE8E3` empty square
- **Future** (scheduled but not yet due) → light outline, no icon

---

## Data Models

```prisma
enum RoutineType {
  HABIT
  TASK
  OBLIGATION
}

enum TargetPeriod {
  WEEK
  MONTH
}

model Routine {
  id           String      @id @default(cuid())
  userId       String
  user         User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  name         String
  description  String?
  type         RoutineType @default(HABIT)
  category     String?
  color        String      @default("#C4775A")
  icon         String      @default("✅")

  rruleString  String
  startDate    DateTime    @default(now())
  endDate      DateTime?
  active       Boolean     @default(true)

  hasQuantity  Boolean     @default(false)
  unit         String?
  targetCount  Int?
  targetPeriod TargetPeriod?

  completions  RoutineCompletion[]

  createdAt    DateTime    @default(now())
  updatedAt    DateTime    @updatedAt

  @@index([userId])
  @@index([userId, active])
  @@index([userId, type])
}

model RoutineCompletion {
  id        String   @id @default(cuid())
  routineId String
  routine   Routine  @relation(fields: [routineId], references: [id], onDelete: Cascade)

  date      DateTime
  done      Boolean  @default(true)
  value     Float?
  note      String?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([routineId, date])
  @@index([routineId])
  @@index([routineId, date])
}
```

`User` model gains `routines Routine[]`.

---

## Backend API

Router mounted at `/api/routines` in `app.ts`. All routes require `requireAuth`.

### Routines CRUD

**`GET /api/routines`**
Query: `type`, `active` (bool), `search` (name/category), `category`.
Returns: `{ routines: Routine[] }`

**`POST /api/routines`**
Body: `{ name, description?, type?, category?, color?, icon?, rruleString, startDate?, endDate?, active?, hasQuantity?, unit?, targetCount?, targetPeriod? }`
Validates: `name` required, `rruleString` required and parseable by rrule.
Returns: `{ routine: Routine }` — 201

**`GET /api/routines/:id`**
Returns: `{ routine: Routine }` — 404 if not found or different user.

**`PUT /api/routines/:id`**
Body: partial Routine fields. Returns: `{ routine: Routine }`

**`DELETE /api/routines/:id`**
Returns: `{ ok: true }`

### Completions

**`GET /api/routines/:id/completions`**
Query: `from` (ISO date), `to` (ISO date).
Returns: `{ completions: RoutineCompletion[] }`

**`POST /api/routines/:id/completions`**
Body: `{ date, done?, value?, note? }`
Upserts by `(routineId, date)` — creating or updating.
Returns: `{ completion: RoutineCompletion }`

**`DELETE /api/routines/:id/completions/:date`**
Deletes the completion for that date. Returns: `{ ok: true }`

### Aggregate endpoints

**`GET /api/routines/today`**
Returns all active routines scheduled for today (computed via rrule) with their completion status for today.
Response: `{ items: Array<{ routine: Routine, completion: RoutineCompletion | null, isDue: boolean }> }`

**`GET /api/routines/grid`**
Query: `year`, `month`.
Returns all active routines + all their completions for the given month in a single query.
Response: `{ routines: Routine[], completions: RoutineCompletion[], year: number, month: number }`
The frontend computes the grid cells from this data using rrule.

**`GET /api/routines/:id/stats`**
Computes: total completions, success rate (completions / scheduled occurrences since startDate), current streak, longest streak, completions this month, completions this year.
Response:
```json
{
  "totalCompletions": 42,
  "successRate": 0.87,
  "currentStreak": 5,
  "longestStreak": 14,
  "thisMonth": 18,
  "thisYear": 124
}
```
Streak = consecutive scheduled days with `done: true` ending today or yesterday.

---

## Frontend

### Routing
```
/routines               → RoutinesPage (default: TodayView)
/routines/today         → TodayView
/routines/grid          → GridView
/routines/list          → ItemList
/routines/annual        → AnnualView
/routines/:id           → RoutineDetail
```

Added to `App.tsx` as protected route under `AppLayout`. `modules.ts` backend: `habits` available set to `true`.

### Navigation
Horizontal tab bar at top of module: **Aujourd'hui | Grille | Éléments | Annuel**

### Pages

**`RoutinesPage.tsx`** — internal router + tab bar navigation.

**`TodayView.tsx`**
- Header with today's date
- List of routines due today with `CompletionCell` (one-click check/uncheck)
- Shows current streak badge per item
- Shows routines due this week but not today in a secondary section
- Empty state when nothing is due

**`GridView.tsx`**
- Month/year navigation (← →)
- `HabitGrid` component: rows = active routines, columns = days 1–31
- Column headers: day numbers, current day highlighted
- Each cell computed from rrule + completions data
- Clicking a cell opens a quick popover to validate/unvalidate
- Legend at bottom: ✓ Réalisé / ✗ Manqué / □ Non prévu

**`ItemList.tsx`**
- Search bar + filters (type: HABIT/TASK/OBLIGATION, active/inactive)
- `RoutineCard` per item showing name, type badge, frequency text, streak, success rate
- "+ Ajouter" button → opens `RoutineForm` modal
- Click on card → navigate to `RoutineDetail`

**`AnnualView.tsx`**
- Year selector (← →)
- For each active routine: one row of 365/366 squares colored by completion density
- Color scale: white → light green → dark green (GitHub-style) based on completion vs scheduled
- Hovering a cell shows the date and completion status
- Pure CSS (no chart library)

**`RoutineDetail.tsx`**
- Full info: name, type, frequency (human-readable from rrule), category, color, icon
- Edit button → opens `RoutineForm`
- Stats panel: total, success rate, streaks, this month, this year
- Last 30 days mini-grid
- Full completion history list (paginated)
- Delete with confirm()

### Components

**`HabitGrid.tsx`** (`components/routines/`)
Props: `routines: Routine[]`, `completions: RoutineCompletion[]`, `year: number`, `month: number`, `onToggle(routineId, date): void`.
Renders the full monthly grid. Uses rrule to determine if each (routine, day) cell is scheduled. Computes cell state (done/missed/not-due/future) from completions data.

**`CompletionCell.tsx`** (`components/routines/`)
A single clickable cell: renders based on state. One click toggles done/undone (calls onToggle).

**`AnnualHeatmap.tsx`** (`components/routines/`)
Props: `routine: Routine`, `completions: RoutineCompletion[]`, `year: number`.
Renders 52 weeks × 7 days of colored squares in CSS grid.

**`RoutineCard.tsx`** (`components/routines/`)
Shows: color/icon dot, name, type badge, `FrequencyBadge`, streak, success rate %.

**`FrequencyBadge.tsx`** (`components/routines/`)
Converts rrule string to human-readable French text:
`FREQ=DAILY` → "Tous les jours", `FREQ=WEEKLY;BYDAY=MO,TH` → "Lun, Jeu", etc.

**`StreakBadge.tsx`** (`components/routines/`)
Shows current streak as a flame badge: 🔥 5 jours.

**`RoutineForm.tsx`** (`components/routines/`)
Modal for create/edit. Fields:
- Name, description, type (HABIT/TASK/OBLIGATION), category, color picker (preset colors), icon (emoji input)
- Frequency builder: preset buttons (Quotidien, Hebdo, Mensuel) + advanced (days of week checkboxes, "tous les N jours", "le N du mois", "dernier X du mois")
- Start date, end date (optional), active toggle
- Quantitative validation toggle: unit, target count, target period

### API Client

`frontend/src/api/routines.ts` — types + `routinesApi` object mirroring all backend routes.

### Styles

`frontend/src/styles/routines.css` — all routines styles.
Imported in `main.tsx`.

---

## rrule Usage

### Determining if a date is scheduled:
```typescript
import { RRule } from 'rrule'

function isScheduled(rruleString: string, startDate: Date, date: Date): boolean {
  const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
  const occurrences = rule.between(
    new Date(date.setHours(0,0,0,0)),
    new Date(date.setHours(23,59,59,999)),
    true
  )
  return occurrences.length > 0
}
```

### Generating all occurrences in a month:
```typescript
const rule = RRule.fromString(`DTSTART:${dtstart}\nRRULE:${rruleString}`)
const occurrences = rule.between(monthStart, monthEnd, true)
```

### rrule string examples:
- Daily: `FREQ=DAILY`
- Every 3 days: `FREQ=DAILY;INTERVAL=3`
- Mon + Thu: `FREQ=WEEKLY;BYDAY=MO,TH`
- Every 2 weeks: `FREQ=WEEKLY;INTERVAL=2`
- Monthly on 1st: `FREQ=MONTHLY;BYMONTHDAY=1`
- Last Friday: `FREQ=MONTHLY;BYDAY=-1FR`
- Annually: `FREQ=YEARLY`

---

## Dependencies

```
backend:  rrule (for stats and today computation)
frontend: rrule (for grid and heatmap generation)
```

---

## Testing

`backend/src/__tests__/routines.test.ts`:
- CRUD lifecycle (create, read, update, delete)
- Completion upsert (create + update on same date)
- `/today` returns correct routines based on rrule + current date
- `/grid` returns correct data structure
- `/stats` calculates streak, success rate, totals correctly
- Auth isolation (user A cannot access user B's routines)
- rrule validation (invalid string returns 400)

---

## File Map

```
backend/
├── prisma/schema.prisma                    MODIFY — add RoutineType, TargetPeriod enums, Routine, RoutineCompletion, User relation
├── src/app.ts                              MODIFY — register /api/routines
├── src/routes/routines/
│   ├── index.ts                            CREATE — mounts sub-routers
│   ├── routines.ts                         CREATE — CRUD routes
│   ├── completions.ts                      CREATE — completion routes
│   └── aggregate.ts                        CREATE — today + grid + stats routes
├── src/routes/modules.ts                   MODIFY — habits available: true
└── src/__tests__/routines.test.ts          CREATE

frontend/
├── src/main.tsx                            MODIFY — import routines.css
├── src/App.tsx                             MODIFY — add /routines/* route
├── src/api/routines.ts                     CREATE — types + routinesApi
├── src/styles/routines.css                 CREATE
├── src/pages/routines/
│   ├── RoutinesPage.tsx                    CREATE — tab router
│   ├── TodayView.tsx                       CREATE
│   ├── GridView.tsx                        CREATE
│   ├── ItemList.tsx                        CREATE
│   ├── AnnualView.tsx                      CREATE
│   └── RoutineDetail.tsx                   CREATE
└── src/components/routines/
    ├── HabitGrid.tsx                       CREATE
    ├── CompletionCell.tsx                  CREATE
    ├── AnnualHeatmap.tsx                   CREATE
    ├── RoutineCard.tsx                     CREATE
    ├── RoutineForm.tsx                     CREATE — create/edit modal
    ├── FrequencyBadge.tsx                  CREATE
    └── StreakBadge.tsx                     CREATE
```
