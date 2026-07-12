# Routines & Suivi — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full routines/habit-tracking module with rrule-based recurrence, completion tracking, monthly grid, annual heatmap, today view, item list, and per-routine statistics.

**Architecture:** Backend adds `Routine` + `RoutineCompletion` Prisma models and an Express router at `/api/routines`. Frontend adds pages under `/routines/*` and components under `components/routines/`, following the existing reading/journal module pattern. Recurrence is computed with the `rrule` npm package: server-side for stats/today, client-side for grid/heatmap.

**Tech Stack:** TypeScript, Express, Prisma 5 (PostgreSQL), rrule 2.x, React 18, react-router-dom 6, Vite.

---

## File Map

**Create (backend):**
- `backend/src/lib/rrule.ts` — `formatDtstart`, `isScheduled`, `validateRrule`, streak helpers
- `backend/src/routes/routines/index.ts` — requireAuth + sub-router mounting
- `backend/src/routes/routines/routines.ts` — CRUD + `GET /:id/stats`
- `backend/src/routes/routines/completions.ts` — upsert/list/delete completions (mergeParams)
- `backend/src/routes/routines/aggregate.ts` — `GET /today`, `GET /grid`
- `backend/src/__tests__/routines.test.ts` — integration tests

**Create (frontend):**
- `frontend/src/api/routines.ts` — TS types + routinesApi
- `frontend/src/styles/routines.css`
- `frontend/src/utils/rrule.ts` — formatDtstart, isScheduled, rruleToFrench
- `frontend/src/pages/routines/RoutinesPage.tsx`
- `frontend/src/pages/routines/TodayView.tsx`
- `frontend/src/pages/routines/GridView.tsx`
- `frontend/src/pages/routines/ItemList.tsx`
- `frontend/src/pages/routines/AnnualView.tsx`
- `frontend/src/pages/routines/RoutineDetail.tsx`
- `frontend/src/components/routines/CompletionCell.tsx`
- `frontend/src/components/routines/FrequencyBadge.tsx`
- `frontend/src/components/routines/StreakBadge.tsx`
- `frontend/src/components/routines/HabitGrid.tsx`
- `frontend/src/components/routines/AnnualHeatmap.tsx`
- `frontend/src/components/routines/RoutineCard.tsx`
- `frontend/src/components/routines/RoutineForm.tsx`

**Modify:**
- `backend/prisma/schema.prisma`
- `backend/src/app.ts`
- `backend/src/routes/modules.ts`
- `frontend/src/App.tsx`
- `frontend/src/main.tsx`

---

### Task 1: Install rrule + Prisma schema + migration

**Files:**
- Modify: `backend/prisma/schema.prisma`
- Run: `npm install` in backend + frontend

- [ ] **Step 1: Install rrule in both workspaces**

```bash
cd backend && npm install rrule
cd ../frontend && npm install rrule
```

- [ ] **Step 2: Add models to schema.prisma**

Add after the `JournalTag` model at the end of `backend/prisma/schema.prisma`:

```prisma
// In the User model, add the relation field:
// routines  Routine[]

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

Also add `routines  Routine[]` to the `User` model's relation fields (after `journalEntries JournalEntry[]`).

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name add_routines
```

Expected: "Your database is now in sync with your schema."

- [ ] **Step 4: Generate Prisma client**

```bash
cd backend && npx prisma generate
```

Expected: "Generated Prisma Client"

- [ ] **Step 5: Commit**

```bash
cd backend && git add prisma/schema.prisma package.json package-lock.json
cd ../frontend && git add package.json package-lock.json
cd .. && git commit -m "feat: install rrule, add Routine + RoutineCompletion schema"
```

---

### Task 2: Backend rrule lib + scaffolding (index.ts, app.ts, modules.ts)

**Files:**
- Create: `backend/src/lib/rrule.ts`
- Create: `backend/src/routes/routines/index.ts`
- Create: `backend/src/routes/routines/routines.ts` (empty router)
- Create: `backend/src/routes/routines/completions.ts` (empty router)
- Create: `backend/src/routes/routines/aggregate.ts` (empty router)
- Modify: `backend/src/app.ts`
- Modify: `backend/src/routes/modules.ts`

- [ ] **Step 1: Create backend/src/lib/rrule.ts**

```typescript
import { RRule } from 'rrule'

// "2024-01-15T10:30:00.000Z" -> "20240115T103000Z"
export function formatDtstart(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

export function validateRrule(rruleString: string): boolean {
  try {
    RRule.fromString('RRULE:' + rruleString)
    return rruleString.includes('FREQ=')
  } catch {
    return false
  }
}

export function isScheduled(rruleString: string, startDate: Date, date: Date): boolean {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
    return rule.between(start, end, true).length > 0
  } catch {
    return false
  }
}

export interface RoutineStats {
  totalCompletions: number
  successRate: number
  currentStreak: number
  longestStreak: number
  thisMonth: number
  thisYear: number
}

export function computeStats(
  rruleString: string,
  startDate: Date,
  completionDates: Date[],
  now: Date
): RoutineStats {
  const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

  const scheduledDays = rule.between(startDate, todayEnd, true).map(d => {
    const day = new Date(d)
    day.setUTCHours(0, 0, 0, 0)
    return day.getTime()
  }).sort((a, b) => a - b)

  const completedDaySet = new Set(completionDates.map(c => {
    const d = new Date(c)
    d.setUTCHours(0, 0, 0, 0)
    return d.getTime()
  }))

  const totalCompletions = completedDaySet.size > 0
    ? completionDates.length
    : 0

  const successRate = scheduledDays.length > 0
    ? Math.round((totalCompletions / scheduledDays.length) * 100) / 100
    : 0

  // Longest streak: consecutive scheduled days all completed
  let longestStreak = 0
  let currentRun = 0
  for (const dayTs of scheduledDays) {
    if (completedDaySet.has(dayTs)) {
      currentRun++
      if (currentRun > longestStreak) longestStreak = currentRun
    } else {
      currentRun = 0
    }
  }

  // Current streak: consecutive scheduled days ending today or yesterday (most recent first)
  const todayTs = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).getTime()
  const yesterdayTs = todayTs - 86400000
  let currentStreak = 0
  let started = false
  for (let i = scheduledDays.length - 1; i >= 0; i--) {
    const dayTs = scheduledDays[i]
    if (!started) {
      if (dayTs !== todayTs && dayTs !== yesterdayTs) break
      started = true
    }
    if (!completedDaySet.has(dayTs)) break
    currentStreak++
  }

  const thisMonth = completionDates.filter(c => {
    const d = new Date(c)
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
  }).length

  const thisYear = completionDates.filter(c =>
    new Date(c).getUTCFullYear() === now.getUTCFullYear()
  ).length

  return { totalCompletions, successRate, currentStreak, longestStreak, thisMonth, thisYear }
}
```

- [ ] **Step 2: Create empty sub-routers**

`backend/src/routes/routines/aggregate.ts`:
```typescript
import { Router } from 'express'
const router = Router()
export default router
```

`backend/src/routes/routines/completions.ts`:
```typescript
import { Router } from 'express'
const router = Router({ mergeParams: true })
export default router
```

`backend/src/routes/routines/routines.ts`:
```typescript
import { Router } from 'express'
const router = Router()
export default router
```

- [ ] **Step 3: Create backend/src/routes/routines/index.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import aggregateRouter from './aggregate'
import routinesCrudRouter from './routines'
import completionsRouter from './completions'

const router = Router()
router.use(requireAuth)

// Named aggregate routes (/today, /grid) MUST be before /:id catch-all
router.use('/', aggregateRouter)
router.use('/', routinesCrudRouter)
router.use('/:routineId/completions', completionsRouter)

export default router
```

- [ ] **Step 4: Register in app.ts**

Add after `import journalRouter`:
```typescript
import routinesRouter from './routes/routines'
```

Add after `app.use('/api/journal', journalRouter)`:
```typescript
app.use('/api/routines', routinesRouter)
```

- [ ] **Step 5: Update modules.ts — habits available: true**

Change `available: false` to `available: true` for the habits module:
```typescript
{ slug: 'habits', name: 'Habitudes', description: 'Routines et suivi des habitudes', icon: '✅', available: true },
```

- [ ] **Step 6: Commit**

```bash
git add backend/src/lib/rrule.ts backend/src/routes/routines/ backend/src/app.ts backend/src/routes/modules.ts
git commit -m "feat: scaffold routines router + rrule lib helpers"
```

---

### Task 3: Backend CRUD routes + tests

**Files:**
- Modify: `backend/src/routes/routines/routines.ts`
- Create: `backend/src/__tests__/routines.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/routines.test.ts`:

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'routines@example.com'
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
  await prisma.routine.deleteMany({ where: { userId } })
})

describe('POST /api/routines', () => {
  it('creates a HABIT with default fields', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ name: 'Morning Run', rruleString: 'FREQ=DAILY' })

    expect(res.status).toBe(201)
    expect(res.body.routine.name).toBe('Morning Run')
    expect(res.body.routine.rruleString).toBe('FREQ=DAILY')
    expect(res.body.routine.type).toBe('HABIT')
    expect(res.body.routine.active).toBe(true)
    expect(res.body.routine.color).toBe('#C4775A')
  })

  it('returns 400 if name missing', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ rruleString: 'FREQ=DAILY' })
    expect(res.status).toBe(400)
  })

  it('returns 400 if rruleString missing', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ name: 'Run' })
    expect(res.status).toBe(400)
  })

  it('returns 400 for invalid rruleString', async () => {
    const res = await request(app)
      .post('/api/routines')
      .set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'INVALID' })
    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/routines')
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    expect(res.status).toBe(401)
  })
})

describe('GET /api/routines', () => {
  beforeEach(async () => {
    await request(app).post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Daily', rruleString: 'FREQ=DAILY', type: 'HABIT' })
    await request(app).post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Weekly', rruleString: 'FREQ=WEEKLY', type: 'TASK' })
  })

  it('returns all routines', async () => {
    const res = await request(app).get('/api/routines').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routines.length).toBe(2)
  })

  it('filters by type', async () => {
    const res = await request(app).get('/api/routines?type=HABIT').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routines.length).toBe(1)
    expect(res.body.routines[0].type).toBe('HABIT')
  })

  it('filters by search', async () => {
    const res = await request(app).get('/api/routines?search=Weekly').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routines.length).toBe(1)
  })
})

describe('GET /api/routines/:id', () => {
  it('returns routine by id', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app).get(`/api/routines/${id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.routine.id).toBe(id)
  })

  it('returns 404 for non-existent id', async () => {
    const res = await request(app).get('/api/routines/nonexistent').set('Cookie', cookie)
    expect(res.status).toBe(404)
  })
})

describe('PUT /api/routines/:id', () => {
  it('updates fields', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app)
      .put(`/api/routines/${id}`).set('Cookie', cookie)
      .send({ name: 'Evening Run', active: false })

    expect(res.status).toBe(200)
    expect(res.body.routine.name).toBe('Evening Run')
    expect(res.body.routine.active).toBe(false)
  })
})

describe('DELETE /api/routines/:id', () => {
  it('deletes a routine', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Run', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app).delete(`/api/routines/${id}`).set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})

describe('Auth isolation', () => {
  it('cannot access another user\'s routine', async () => {
    const other = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'routines-other@example.com', password: 'password123' })
    const otherCookie = (other.headers['set-cookie'] as unknown as string[])[0]

    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Mine', rruleString: 'FREQ=DAILY' })
    const id = createRes.body.routine.id

    const res = await request(app).get(`/api/routines/${id}`).set('Cookie', otherCookie)
    expect(res.status).toBe(404)

    await prisma.user.deleteMany({ where: { email: 'routines-other@example.com' } })
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
cd backend && npx jest routines.test --no-coverage 2>&1 | tail -20
```

Expected: FAIL — 404s and other failures (routes not implemented yet).

- [ ] **Step 3: Implement backend/src/routes/routines/routines.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { validateRrule, computeStats } from '../../lib/rrule'
import { RoutineType } from '@prisma/client'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { type, active, search, category } = req.query as Record<string, string>
    const where: Record<string, unknown> = { userId: req.user!.id }

    if (type && Object.values(RoutineType).includes(type as RoutineType)) {
      where.type = type as RoutineType
    }
    if (active !== undefined) where.active = active === 'true'
    if (category) where.category = { contains: category, mode: 'insensitive' }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const routines = await prisma.routine.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json({ routines })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, description, type, category, color, icon, rruleString,
            startDate, endDate, active, hasQuantity, unit, targetCount, targetPeriod } = req.body

    if (!name) { res.status(400).json({ error: 'name is required' }); return }
    if (!rruleString) { res.status(400).json({ error: 'rruleString is required' }); return }
    if (!validateRrule(rruleString)) { res.status(400).json({ error: 'Invalid rruleString' }); return }

    const routine = await prisma.routine.create({
      data: {
        userId: req.user!.id,
        name, description, category, unit,
        type: type || 'HABIT',
        color: color || '#C4775A',
        icon: icon || '✅',
        rruleString,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        active: active !== undefined ? active : true,
        hasQuantity: hasQuantity || false,
        targetCount: targetCount != null ? Number(targetCount) : undefined,
        targetPeriod: targetPeriod || undefined,
      },
    })
    res.status(201).json({ routine })
  } catch (err) { next(err) }
})

router.get('/:id/stats', async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    const completions = await prisma.routineCompletion.findMany({
      where: { routineId: req.params.id, done: true },
      select: { date: true },
    })

    const stats = computeStats(
      routine.rruleString,
      routine.startDate,
      completions.map(c => c.date),
      new Date()
    )
    res.json(stats)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }
    res.json({ routine })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Routine not found' }); return }

    const { name, description, type, category, color, icon, rruleString,
            startDate, endDate, active, hasQuantity, unit, targetCount, targetPeriod } = req.body

    if (rruleString !== undefined && !validateRrule(rruleString)) {
      res.status(400).json({ error: 'Invalid rruleString' }); return
    }

    const routine = await prisma.routine.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(category !== undefined && { category }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(rruleString !== undefined && { rruleString }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(active !== undefined && { active }),
        ...(hasQuantity !== undefined && { hasQuantity }),
        ...(unit !== undefined && { unit }),
        ...(targetCount !== undefined && { targetCount: targetCount != null ? Number(targetCount) : null }),
        ...(targetPeriod !== undefined && { targetPeriod }),
      },
    })
    res.json({ routine })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Routine not found' }); return }
    await prisma.routine.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 4: Run CRUD tests — verify they pass**

```bash
cd backend && npx jest routines.test --no-coverage -t "POST /api/routines|GET /api/routines|PUT /api/routines|DELETE /api/routines|Auth isolation" 2>&1 | tail -15
```

Expected: All CRUD + auth tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/routines/routines.ts backend/src/__tests__/routines.test.ts
git commit -m "feat: routines CRUD routes + tests"
```

---

### Task 4: Backend completions routes + tests

**Files:**
- Modify: `backend/src/routes/routines/completions.ts`
- Modify: `backend/src/__tests__/routines.test.ts`

- [ ] **Step 1: Add completion tests to routines.test.ts**

Append to `backend/src/__tests__/routines.test.ts`:

```typescript
describe('POST /api/routines/:id/completions (upsert)', () => {
  it('creates and upserts a completion for the same date', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id
    const date = '2024-03-15T00:00:00.000Z'

    const r1 = await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date, done: true })
    expect(r1.status).toBe(200)
    expect(r1.body.completion.done).toBe(true)

    const r2 = await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date, done: false, note: 'Skipped' })
    expect(r2.status).toBe(200)
    expect(r2.body.completion.done).toBe(false)
    expect(r2.body.completion.note).toBe('Skipped')

    const count = await prisma.routineCompletion.count({ where: { routineId } })
    expect(count).toBe(1)
  })

  it('returns 400 if date missing', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id

    const res = await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ done: true })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/routines/:id/completions', () => {
  it('returns completions with date range filter', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id

    await request(app).post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: '2024-01-01T00:00:00.000Z', done: true })
    await request(app).post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: '2024-02-01T00:00:00.000Z', done: true })

    const res = await request(app)
      .get(`/api/routines/${routineId}/completions?from=2024-01-01&to=2024-01-31`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.completions.length).toBe(1)
  })
})

describe('DELETE /api/routines/:id/completions/:date', () => {
  it('deletes a completion', async () => {
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Test', rruleString: 'FREQ=DAILY' })
    const routineId = createRes.body.routine.id
    const date = '2024-03-15T00:00:00.000Z'

    await request(app).post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date, done: true })

    const res = await request(app)
      .delete(`/api/routines/${routineId}/completions/${encodeURIComponent(date)}`)
      .set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)

    const count = await prisma.routineCompletion.count({ where: { routineId } })
    expect(count).toBe(0)
  })
})
```

- [ ] **Step 2: Run new tests — verify they fail**

```bash
cd backend && npx jest routines.test --no-coverage -t "completions" 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement backend/src/routes/routines/completions.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router({ mergeParams: true })

router.get('/', async (req, res, next) => {
  try {
    const { routineId } = req.params as { routineId: string }
    const { from, to } = req.query as Record<string, string>

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: req.user!.id } })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    const where: Record<string, unknown> = { routineId }
    if (from || to) {
      where.date = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      }
    }

    const completions = await prisma.routineCompletion.findMany({
      where,
      orderBy: { date: 'asc' },
    })
    res.json({ completions })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { routineId } = req.params as { routineId: string }
    const { date, done, value, note } = req.body

    if (!date) { res.status(400).json({ error: 'date is required' }); return }

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: req.user!.id } })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    const completion = await prisma.routineCompletion.upsert({
      where: { routineId_date: { routineId, date: new Date(date) } },
      create: {
        routineId,
        date: new Date(date),
        done: done !== undefined ? done : true,
        value: value != null ? Number(value) : undefined,
        note,
      },
      update: {
        ...(done !== undefined && { done }),
        ...(value !== undefined && { value: value != null ? Number(value) : null }),
        ...(note !== undefined && { note }),
      },
    })
    res.json({ completion })
  } catch (err) { next(err) }
})

router.delete('/:date', async (req, res, next) => {
  try {
    const { routineId, date } = req.params as { routineId: string; date: string }

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: req.user!.id } })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    await prisma.routineCompletion.deleteMany({
      where: { routineId, date: new Date(decodeURIComponent(date)) },
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 4: Run completion tests — verify they pass**

```bash
cd backend && npx jest routines.test --no-coverage -t "completions|DELETE /api/routines" 2>&1 | tail -10
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/routines/completions.ts backend/src/__tests__/routines.test.ts
git commit -m "feat: routines completion routes (upsert, list, delete) + tests"
```

---

### Task 5: Backend aggregate routes + stats tests

**Files:**
- Modify: `backend/src/routes/routines/aggregate.ts`
- Modify: `backend/src/__tests__/routines.test.ts`

- [ ] **Step 1: Add aggregate tests to routines.test.ts**

Append to `backend/src/__tests__/routines.test.ts`:

```typescript
describe('GET /api/routines/today', () => {
  it('includes daily routine and excludes future-start routine', async () => {
    const r1 = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Daily Habit', rruleString: 'FREQ=DAILY' })

    const futureStart = new Date(Date.now() + 86400000 * 365).toISOString()
    const r2 = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Future Habit', rruleString: 'FREQ=DAILY', startDate: futureStart })

    const res = await request(app).get('/api/routines/today').set('Cookie', cookie)
    expect(res.status).toBe(200)
    expect(res.body.items).toBeDefined()

    const ids = res.body.items.map((item: any) => item.routine.id)
    expect(ids).toContain(r1.body.routine.id)
    expect(ids).not.toContain(r2.body.routine.id)
  })

  it('includes completion status for today', async () => {
    const r = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Daily', rruleString: 'FREQ=DAILY' })
    const routineId = r.body.routine.id

    const todayISO = new Date().toISOString()
    await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: todayISO, done: true })

    const res = await request(app).get('/api/routines/today').set('Cookie', cookie)
    const item = res.body.items.find((i: any) => i.routine.id === routineId)
    expect(item).toBeDefined()
    expect(item.completion).not.toBeNull()
    expect(item.completion.done).toBe(true)
  })
})

describe('GET /api/routines/grid', () => {
  it('returns routines and completions for the given month', async () => {
    const r = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Grid Test', rruleString: 'FREQ=DAILY' })
    const routineId = r.body.routine.id

    await request(app)
      .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
      .send({ date: '2024-06-15T00:00:00.000Z', done: true })

    const res = await request(app)
      .get('/api/routines/grid?year=2024&month=6').set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.year).toBe(2024)
    expect(res.body.month).toBe(6)
    expect(Array.isArray(res.body.routines)).toBe(true)
    expect(Array.isArray(res.body.completions)).toBe(true)
    expect(res.body.completions.some((c: any) => c.routineId === routineId)).toBe(true)
  })
})

describe('GET /api/routines/:id/stats', () => {
  it('returns correct stats shape and longestStreak', async () => {
    const startDate = new Date('2024-01-01T00:00:00.000Z').toISOString()
    const createRes = await request(app)
      .post('/api/routines').set('Cookie', cookie)
      .send({ name: 'Stats Test', rruleString: 'FREQ=DAILY', startDate })
    const routineId = createRes.body.routine.id

    for (const d of ['2024-01-01', '2024-01-02', '2024-01-03']) {
      await request(app)
        .post(`/api/routines/${routineId}/completions`).set('Cookie', cookie)
        .send({ date: new Date(d).toISOString(), done: true })
    }

    const res = await request(app)
      .get(`/api/routines/${routineId}/stats`).set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.totalCompletions).toBe(3)
    expect(res.body.longestStreak).toBe(3)
    expect(res.body.currentStreak).toBe(0) // Jan 2024 completions, not recent
    expect(res.body.successRate).toBeGreaterThanOrEqual(0)
    expect(res.body.successRate).toBeLessThanOrEqual(1)
    expect(typeof res.body.thisMonth).toBe('number')
    expect(typeof res.body.thisYear).toBe('number')
  })
})
```

- [ ] **Step 2: Run aggregate tests — verify they fail**

```bash
cd backend && npx jest routines.test --no-coverage -t "today|grid|stats" 2>&1 | tail -10
```

Expected: FAIL.

- [ ] **Step 3: Implement backend/src/routes/routines/aggregate.ts**

```typescript
import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { isScheduled } from '../../lib/rrule'

const router = Router()

router.get('/today', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const now = new Date()

    const routines = await prisma.routine.findMany({ where: { userId, active: true } })
    const dueRoutines = routines.filter(r => isScheduled(r.rruleString, r.startDate, now))

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const todayEnd = new Date(todayStart.getTime() + 86399999)

    const completions = await prisma.routineCompletion.findMany({
      where: {
        routineId: { in: dueRoutines.map(r => r.id) },
        date: { gte: todayStart, lte: todayEnd },
      },
    })

    const completionMap = new Map(completions.map(c => [c.routineId, c]))
    const items = dueRoutines.map(routine => ({
      routine,
      completion: completionMap.get(routine.id) ?? null,
      isDue: true,
    }))

    res.json({ items })
  } catch (err) { next(err) }
})

router.get('/grid', async (req, res, next) => {
  try {
    const { year, month } = req.query as Record<string, string>
    const userId = req.user!.id

    const y = Number(year) || new Date().getUTCFullYear()
    const m = Number(month) || new Date().getUTCMonth() + 1

    const monthStart = new Date(Date.UTC(y, m - 1, 1))
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))

    const routines = await prisma.routine.findMany({ where: { userId, active: true } })
    const completions = await prisma.routineCompletion.findMany({
      where: {
        routineId: { in: routines.map(r => r.id) },
        date: { gte: monthStart, lte: monthEnd },
      },
    })

    res.json({ routines, completions, year: y, month: m })
  } catch (err) { next(err) }
})

export default router
```

- [ ] **Step 4: Run all routines tests — verify all pass**

```bash
cd backend && npx jest routines.test --no-coverage 2>&1 | tail -15
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/routines/aggregate.ts backend/src/__tests__/routines.test.ts
git commit -m "feat: aggregate routes (today, grid, stats) + tests"
```

---

### Task 6: Frontend API client + CSS + App wiring

**Files:**
- Create: `frontend/src/api/routines.ts`
- Create: `frontend/src/styles/routines.css`
- Create: `frontend/src/utils/rrule.ts`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create frontend/src/utils/rrule.ts**

```typescript
import { RRule } from 'rrule'

export function formatDtstart(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

export function isScheduled(rruleString: string, startDate: Date, date: Date): boolean {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
    return rule.between(start, end, true).length > 0
  } catch {
    return false
  }
}

export function getOccurrencesInMonth(rruleString: string, startDate: Date, year: number, month: number): number[] {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    return rule.between(monthStart, monthEnd, true).map(d => d.getUTCDate())
  } catch {
    return []
  }
}

export function getOccurrencesInYear(rruleString: string, startDate: Date, year: number): Date[] {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    return rule.between(yearStart, yearEnd, true)
  } catch {
    return []
  }
}

const DAY_LABELS: Record<string, string> = {
  MO: 'Lun', TU: 'Mar', WE: 'Mer', TH: 'Jeu', FR: 'Ven', SA: 'Sam', SU: 'Dim',
}

export function rruleToFrench(rruleString: string): string {
  const parts: Record<string, string> = {}
  for (const p of rruleString.split(';')) {
    const [k, v] = p.split('=')
    if (k && v) parts[k] = v
  }
  const freq = parts['FREQ']
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1
  const byday = parts['BYDAY']
  const bymonthday = parts['BYMONTHDAY']

  if (freq === 'DAILY') {
    return interval === 1 ? 'Tous les jours' : `Tous les ${interval} jours`
  }
  if (freq === 'WEEKLY') {
    if (byday) {
      const days = byday.split(',').map(d => DAY_LABELS[d] ?? d).join(', ')
      return interval === 1 ? days : `${days} (×${interval})`
    }
    return interval === 1 ? 'Hebdomadaire' : `Toutes les ${interval} semaines`
  }
  if (freq === 'MONTHLY') {
    if (bymonthday) {
      const n = parseInt(bymonthday)
      return `Le ${n}${n === 1 ? 'er' : 'e'} du mois`
    }
    if (byday) {
      const match = byday.match(/^(-?\d+)([A-Z]{2})$/)
      if (match) {
        const n = parseInt(match[1])
        const day = DAY_LABELS[match[2]] ?? match[2]
        return n === -1 ? `Dernier ${day} du mois` : `${n}e ${day} du mois`
      }
    }
    return interval === 1 ? 'Mensuel' : `Tous les ${interval} mois`
  }
  if (freq === 'YEARLY') return 'Annuellement'
  return rruleString
}
```

- [ ] **Step 2: Create frontend/src/api/routines.ts**

```typescript
import { apiClient } from './client'

export type RoutineType = 'HABIT' | 'TASK' | 'OBLIGATION'
export type TargetPeriod = 'WEEK' | 'MONTH'

export interface Routine {
  id: string
  userId: string
  name: string
  description?: string
  type: RoutineType
  category?: string
  color: string
  icon: string
  rruleString: string
  startDate: string
  endDate?: string
  active: boolean
  hasQuantity: boolean
  unit?: string
  targetCount?: number
  targetPeriod?: TargetPeriod
  createdAt: string
  updatedAt: string
}

export interface RoutineCompletion {
  id: string
  routineId: string
  date: string
  done: boolean
  value?: number
  note?: string
  createdAt: string
  updatedAt: string
}

export interface RoutineStats {
  totalCompletions: number
  successRate: number
  currentStreak: number
  longestStreak: number
  thisMonth: number
  thisYear: number
}

export interface TodayItem {
  routine: Routine
  completion: RoutineCompletion | null
  isDue: boolean
}

export type RoutineInput = {
  name: string
  rruleString: string
  description?: string
  type?: RoutineType
  category?: string
  color?: string
  icon?: string
  startDate?: string
  endDate?: string
  active?: boolean
  hasQuantity?: boolean
  unit?: string
  targetCount?: number
  targetPeriod?: TargetPeriod
}

export const TYPE_LABELS: Record<RoutineType, string> = {
  HABIT: 'Habitude',
  TASK: 'Tâche',
  OBLIGATION: 'Obligation',
}

export const TYPE_COLORS: Record<RoutineType, string> = {
  HABIT: '#7A9E7E',
  TASK: '#C4775A',
  OBLIGATION: '#5A8AC4',
}

export const routinesApi = {
  getAll: (params?: { type?: RoutineType; active?: boolean; search?: string; category?: string }) => {
    const q = new URLSearchParams()
    if (params?.type) q.set('type', params.type)
    if (params?.active !== undefined) q.set('active', String(params.active))
    if (params?.search) q.set('search', params.search)
    if (params?.category) q.set('category', params.category)
    const qs = q.toString()
    return apiClient<{ routines: Routine[] }>(`/api/routines${qs ? `?${qs}` : ''}`)
  },

  getOne: (id: string) =>
    apiClient<{ routine: Routine }>(`/api/routines/${id}`),

  create: (data: RoutineInput) =>
    apiClient<{ routine: Routine }>('/api/routines', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<RoutineInput> & { active?: boolean }) =>
    apiClient<{ routine: Routine }>(`/api/routines/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/routines/${id}`, { method: 'DELETE' }),

  getCompletions: (id: string, params?: { from?: string; to?: string }) => {
    const q = new URLSearchParams()
    if (params?.from) q.set('from', params.from)
    if (params?.to) q.set('to', params.to)
    const qs = q.toString()
    return apiClient<{ completions: RoutineCompletion[] }>(
      `/api/routines/${id}/completions${qs ? `?${qs}` : ''}`
    )
  },

  upsertCompletion: (id: string, data: { date: string; done?: boolean; value?: number; note?: string }) =>
    apiClient<{ completion: RoutineCompletion }>(`/api/routines/${id}/completions`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteCompletion: (id: string, date: string) =>
    apiClient<{ ok: boolean }>(
      `/api/routines/${id}/completions/${encodeURIComponent(date)}`,
      { method: 'DELETE' }
    ),

  getToday: () =>
    apiClient<{ items: TodayItem[] }>('/api/routines/today'),

  getGrid: (year: number, month: number) =>
    apiClient<{ routines: Routine[]; completions: RoutineCompletion[]; year: number; month: number }>(
      `/api/routines/grid?year=${year}&month=${month}`
    ),

  getStats: (id: string) =>
    apiClient<RoutineStats>(`/api/routines/${id}/stats`),
}
```

- [ ] **Step 3: Create frontend/src/styles/routines.css**

```css
/* ========== ROUTINES MODULE ========== */

.routines-container { max-width: 1200px; margin: 0 auto; }

.routines-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--glass-border);
  padding-bottom: 0;
}

.routines-tab {
  background: none;
  border: none;
  padding: 0.6rem 1.1rem;
  font-size: 0.875rem;
  color: var(--text-muted);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.routines-tab:hover { color: var(--text-primary); }
.routines-tab.active { color: var(--text-primary); border-bottom-color: var(--text-primary); font-weight: 600; }

/* Today View */
.today-header { margin-bottom: 1.5rem; animation: fadeUp 0.4s ease both; }
.today-date { font-family: 'Playfair Display', serif; font-size: 1.75rem; color: var(--text-primary); }
.today-list { display: flex; flex-direction: column; gap: 0.75rem; }
.today-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.875rem 1.25rem;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  animation: fadeUp 0.4s ease both;
}
.today-item-icon { font-size: 1.5rem; flex-shrink: 0; }
.today-item-info { flex: 1; }
.today-item-name { font-weight: 600; color: var(--text-primary); }
.today-item-freq { font-size: 0.8rem; color: var(--text-muted); }
.today-check-btn {
  width: 38px; height: 38px; border-radius: 50%; border: 2px solid var(--glass-border);
  background: none; cursor: pointer; font-size: 1rem;
  display: flex; align-items: center; justify-content: center;
  transition: all 0.15s;
}
.today-check-btn.done { background: #48bb78; border-color: #48bb78; color: white; }
.today-check-btn:hover:not(.done) { border-color: #48bb78; background: rgba(72,187,120,0.1); }

/* Grid View */
.grid-nav { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.25rem; }
.grid-nav-btn { background: none; border: 1px solid var(--glass-border); border-radius: var(--radius-sm); padding: 0.35rem 0.75rem; cursor: pointer; }
.grid-month-label { font-family: 'Playfair Display', serif; font-size: 1.25rem; color: var(--text-primary); }

.habit-grid { overflow-x: auto; }
.habit-grid-table { border-collapse: collapse; min-width: 100%; font-size: 0.8rem; }
.habit-grid-name-cell {
  padding: 0.3rem 0.75rem 0.3rem 0.5rem;
  white-space: nowrap;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  border-left: 3px solid transparent;
}
.habit-grid-day-header {
  text-align: center;
  padding: 0.25rem 0.15rem;
  color: var(--text-muted);
  font-size: 0.72rem;
  min-width: 26px;
}
.habit-grid-day-header.today { color: var(--text-primary); font-weight: 700; }

/* Completion Cell */
.completion-cell {
  width: 22px; height: 22px;
  border: none; border-radius: 3px;
  cursor: pointer; font-size: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  transition: opacity 0.15s;
  margin: 1px;
}
.completion-cell--done { background: #48bb78; color: white; }
.completion-cell--missed { background: #e56464; color: white; }
.completion-cell--not-due { background: #EDE8E3; cursor: default; }
.completion-cell--future { background: transparent; border: 1px dashed #ccc; cursor: default; }
.completion-cell:hover:not(:disabled):not(.completion-cell--not-due) { opacity: 0.75; }

.habit-grid-legend { display: flex; gap: 1.25rem; margin-top: 0.75rem; font-size: 0.78rem; color: var(--text-muted); }

/* Annual Heatmap */
.annual-heatmap { overflow-x: auto; margin-bottom: 1.5rem; }
.heatmap-row-label { font-size: 0.78rem; color: var(--text-muted); white-space: nowrap; padding-right: 0.5rem; }
.heatmap-grid { display: flex; gap: 2px; }
.heatmap-week { display: flex; flex-direction: column; gap: 2px; }
.heatmap-cell {
  width: 11px; height: 11px; border-radius: 2px;
  cursor: default;
}
.heatmap-cell--empty { background: #EDE8E3; }
.heatmap-cell--l1 { background: #c6e48b; }
.heatmap-cell--l2 { background: #7bc96f; }
.heatmap-cell--l3 { background: #239a3b; }
.heatmap-cell--l4 { background: #196127; }

/* Routine Card */
.routine-card {
  display: flex; align-items: center; gap: 0.875rem;
  padding: 0.875rem 1.25rem;
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: box-shadow 0.15s;
  animation: fadeUp 0.4s ease both;
}
.routine-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.08); }
.routine-card-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.routine-card-info { flex: 1; }
.routine-card-name { font-weight: 600; color: var(--text-primary); }
.routine-card-meta { font-size: 0.8rem; color: var(--text-muted); display: flex; gap: 0.75rem; margin-top: 0.2rem; }

/* Frequency Badge */
.frequency-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  background: rgba(0,0,0,0.06);
  color: var(--text-muted);
}

/* Streak Badge */
.streak-badge { font-size: 0.82rem; color: var(--text-muted); }

/* Type Badge */
.type-badge {
  display: inline-block;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  color: white;
}

/* Item List */
.routines-list-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.25rem;
}
.routines-list-title { font-family: 'Playfair Display', serif; font-size: 1.75rem; }
.routines-toolbar { display: flex; gap: 0.75rem; margin-bottom: 1rem; align-items: center; }
.routines-search { flex: 1; margin-bottom: 0; }
.routines-list { display: flex; flex-direction: column; gap: 0.5rem; }

/* Stats Panel */
.stats-panel {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 1rem;
  margin: 1.25rem 0;
}
.stat-card {
  background: rgba(255,255,255,0.55);
  backdrop-filter: blur(12px);
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  padding: 1rem; text-align: center;
}
.stat-value { font-size: 1.75rem; font-weight: 700; color: var(--text-primary); }
.stat-label { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.2rem; }

/* Routine Form Modal */
.routine-form-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.35);
  display: flex; align-items: center; justify-content: center; z-index: 100;
}
.routine-form-modal {
  background: var(--glass-bg, #faf8f5);
  border-radius: var(--radius-lg, 16px);
  padding: 2rem;
  max-width: 560px; width: 90vw;
  max-height: 90vh; overflow-y: auto;
  animation: fadeUp 0.25s ease both;
}
.routine-form-title { font-family: 'Playfair Display', serif; font-size: 1.5rem; margin-bottom: 1.25rem; }
.routine-form-row { margin-bottom: 1rem; }
.routine-form-label { display: block; font-size: 0.82rem; font-weight: 600; margin-bottom: 0.35rem; color: var(--text-secondary, #666); }
.freq-presets { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.5rem; }
.freq-preset-btn {
  padding: 0.35rem 0.875rem; border: 1px solid var(--glass-border);
  border-radius: 999px; background: none; cursor: pointer; font-size: 0.82rem;
  transition: all 0.15s;
}
.freq-preset-btn.active { background: var(--text-primary); color: white; border-color: var(--text-primary); }
.weekday-toggle { display: flex; gap: 0.35rem; flex-wrap: wrap; }
.weekday-btn {
  width: 36px; height: 36px; border-radius: 50%;
  border: 1px solid var(--glass-border); background: none; cursor: pointer; font-size: 0.78rem;
  transition: all 0.15s;
}
.weekday-btn.active { background: var(--text-primary); color: white; border-color: var(--text-primary); }
.color-swatches { display: flex; gap: 0.5rem; flex-wrap: wrap; }
.color-swatch {
  width: 28px; height: 28px; border-radius: 50%; border: 2px solid transparent;
  cursor: pointer; transition: transform 0.1s;
}
.color-swatch.active, .color-swatch:hover { transform: scale(1.2); border-color: #333; }
.form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1.5rem; }
```

- [ ] **Step 4: Add /routines/* route to App.tsx**

Add after the journal import:
```typescript
import { RoutinesPage } from './pages/routines/RoutinesPage'
```

Add after the `/journal/*` Route block (before `<Route path="*" ...>`):
```tsx
<Route
  path="/routines/*"
  element={
    <ProtectedRoute>
      <AppLayout>
        <RoutinesPage />
      </AppLayout>
    </ProtectedRoute>
  }
/>
```

- [ ] **Step 5: Add CSS import to main.tsx**

Add after `import './styles/journal.css'`:
```typescript
import './styles/routines.css'
```

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/routines.ts frontend/src/utils/rrule.ts frontend/src/styles/routines.css frontend/src/App.tsx frontend/src/main.tsx
git commit -m "feat: frontend routines API client, CSS, utils, App routing"
```

---

### Task 7: Utility components (FrequencyBadge, StreakBadge, CompletionCell)

**Files:** Create under `frontend/src/components/routines/`

- [ ] **Step 1: Create FrequencyBadge.tsx**

```tsx
import { rruleToFrench } from '../../utils/rrule'

interface FrequencyBadgeProps { rruleString: string }

export function FrequencyBadge({ rruleString }: FrequencyBadgeProps) {
  return <span className="frequency-badge">{rruleToFrench(rruleString)}</span>
}
```

- [ ] **Step 2: Create StreakBadge.tsx**

```tsx
interface StreakBadgeProps { streak: number }

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null
  return (
    <span className="streak-badge" title="Série actuelle">
      🔥 {streak} jour{streak > 1 ? 's' : ''}
    </span>
  )
}
```

- [ ] **Step 3: Create CompletionCell.tsx**

```tsx
export type CellState = 'done' | 'missed' | 'not-due' | 'future'

interface CompletionCellProps {
  state: CellState
  onClick: () => void
}

export function CompletionCell({ state, onClick }: CompletionCellProps) {
  return (
    <button
      className={`completion-cell completion-cell--${state}`}
      onClick={onClick}
      disabled={state === 'future' || state === 'not-due'}
      title={state === 'done' ? 'Réalisé' : state === 'missed' ? 'Manqué' : state === 'future' ? 'À venir' : ''}
    >
      {state === 'done' && '✓'}
      {state === 'missed' && '✗'}
    </button>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/routines/
git commit -m "feat: FrequencyBadge, StreakBadge, CompletionCell components"
```

---

### Task 8: HabitGrid + AnnualHeatmap components

**Files:** Create under `frontend/src/components/routines/`

- [ ] **Step 1: Create HabitGrid.tsx**

```tsx
import type { Routine, RoutineCompletion } from '../../api/routines'
import { getOccurrencesInMonth } from '../../utils/rrule'
import { CompletionCell, type CellState } from './CompletionCell'

interface HabitGridProps {
  routines: Routine[]
  completions: RoutineCompletion[]
  year: number
  month: number
  onToggle: (routineId: string, dateISO: string) => void
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function HabitGrid({ routines, completions, year, month, onToggle }: HabitGridProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDay = today.getDate()

  // Map: routineId -> day (1-31) -> completion
  const completionMap = new Map<string, Map<number, RoutineCompletion>>()
  for (const c of completions) {
    const day = new Date(c.date).getUTCDate()
    if (!completionMap.has(c.routineId)) completionMap.set(c.routineId, new Map())
    completionMap.get(c.routineId)!.set(day, c)
  }

  // Cache scheduled days per routine
  const scheduledCache = new Map<string, Set<number>>()
  for (const r of routines) {
    const days = getOccurrencesInMonth(r.rruleString, new Date(r.startDate), year, month)
    scheduledCache.set(r.id, new Set(days))
  }

  function getCellState(routine: Routine, day: number): CellState {
    if (!scheduledCache.get(routine.id)?.has(day)) return 'not-due'

    const cellDate = new Date(Date.UTC(year, month - 1, day))
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    if (cellDate > todayUTC) return 'future'

    const completion = completionMap.get(routine.id)?.get(day)
    return completion?.done ? 'done' : 'missed'
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)

  return (
    <div className="habit-grid">
      <table className="habit-grid-table">
        <thead>
          <tr>
            <th style={{ minWidth: 160 }} />
            {days.map(d => (
              <th key={d} className={`habit-grid-day-header${isCurrentMonth && d === todayDay ? ' today' : ''}`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {routines.map(routine => (
            <tr key={routine.id}>
              <td className="habit-grid-name-cell" style={{ borderLeftColor: routine.color }}>
                {routine.icon} {routine.name}
              </td>
              {days.map(day => {
                const state = getCellState(routine, day)
                const dateISO = new Date(Date.UTC(year, month - 1, day)).toISOString()
                return (
                  <td key={day} style={{ padding: 0 }}>
                    <CompletionCell state={state} onClick={() => onToggle(routine.id, dateISO)} />
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="habit-grid-legend">
        <span><span className="completion-cell completion-cell--done" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>✓</span> Réalisé</span>
        <span><span className="completion-cell completion-cell--missed" style={{ display: 'inline-flex', verticalAlign: 'middle' }}>✗</span> Manqué</span>
        <span><span className="completion-cell completion-cell--not-due" style={{ display: 'inline-flex', verticalAlign: 'middle' }} /> Non prévu</span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create AnnualHeatmap.tsx**

```tsx
import type { Routine, RoutineCompletion } from '../../api/routines'
import { getOccurrencesInYear } from '../../utils/rrule'

interface AnnualHeatmapProps {
  routine: Routine
  completions: RoutineCompletion[]
  year: number
}

function getHeatmapLevel(scheduled: boolean, done: boolean, isFuture: boolean): string {
  if (!scheduled) return 'empty'
  if (isFuture) return 'empty'
  if (!done) return 'l1'
  return 'l4'
}

export function AnnualHeatmap({ routine, completions, year }: AnnualHeatmapProps) {
  const scheduledDates = getOccurrencesInYear(routine.rruleString, new Date(routine.startDate), year)
  const scheduledSet = new Set(scheduledDates.map(d => d.toISOString().slice(0, 10)))

  const completedSet = new Set(
    completions.filter(c => c.done).map(c => new Date(c.date).toISOString().slice(0, 10))
  )

  const today = new Date()
  const todayStr = today.toISOString().slice(0, 10)

  // Build 52 weeks × 7 days grid
  const jan1 = new Date(Date.UTC(year, 0, 1))
  const startDow = jan1.getUTCDay() // 0=Sun
  const totalDays = (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 366 : 365

  const weeks: Array<Array<{ dateStr: string; level: string } | null>> = []
  let currentWeek: Array<{ dateStr: string; level: string } | null> = Array(startDow).fill(null)

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(Date.UTC(year, 0, i + 1))
    const dateStr = d.toISOString().slice(0, 10)
    const scheduled = scheduledSet.has(dateStr)
    const done = completedSet.has(dateStr)
    const isFuture = dateStr > todayStr

    currentWeek.push({ dateStr, level: getHeatmapLevel(scheduled, done, isFuture) })
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  return (
    <div className="annual-heatmap">
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        {routine.icon} {routine.name}
      </div>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap-week">
            {week.map((cell, di) =>
              cell ? (
                <div
                  key={di}
                  className={`heatmap-cell heatmap-cell--${cell.level}`}
                  title={cell.dateStr}
                />
              ) : (
                <div key={di} style={{ width: 11, height: 11 }} />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/routines/HabitGrid.tsx frontend/src/components/routines/AnnualHeatmap.tsx
git commit -m "feat: HabitGrid + AnnualHeatmap components"
```

---

### Task 9: RoutineCard + RoutineForm components

**Files:** Create under `frontend/src/components/routines/`

- [ ] **Step 1: Create RoutineCard.tsx**

```tsx
import type { Routine } from '../../api/routines'
import { TYPE_LABELS, TYPE_COLORS } from '../../api/routines'
import { FrequencyBadge } from './FrequencyBadge'
import { StreakBadge } from './StreakBadge'

interface RoutineCardProps {
  routine: Routine
  streak?: number
  successRate?: number
  onClick: () => void
}

export function RoutineCard({ routine, streak = 0, successRate, onClick }: RoutineCardProps) {
  return (
    <div className="routine-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="routine-card-dot" style={{ background: routine.color }} />
      <div className="routine-card-icon" style={{ fontSize: '1.25rem' }}>{routine.icon}</div>
      <div className="routine-card-info">
        <div className="routine-card-name">{routine.name}</div>
        <div className="routine-card-meta">
          <span
            className="type-badge"
            style={{ background: TYPE_COLORS[routine.type] }}
          >
            {TYPE_LABELS[routine.type]}
          </span>
          <FrequencyBadge rruleString={routine.rruleString} />
          <StreakBadge streak={streak} />
          {successRate !== undefined && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {Math.round(successRate * 100)}%
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create RoutineForm.tsx**

```tsx
import { useState } from 'react'
import type { Routine, RoutineInput, RoutineType, TargetPeriod } from '../../api/routines'

const PRESET_COLORS = ['#C4775A', '#7A9E7E', '#5A8AC4', '#9B7EC8', '#E5A34A', '#E56464', '#48bb78', '#A89890']
const WEEKDAYS = [
  { key: 'MO', label: 'L' }, { key: 'TU', label: 'M' }, { key: 'WE', label: 'M' },
  { key: 'TH', label: 'J' }, { key: 'FR', label: 'V' }, { key: 'SA', label: 'S' }, { key: 'SU', label: 'D' },
]

type FreqPreset = 'daily' | 'weekly' | 'custom'

interface RoutineFormProps {
  initial?: Partial<Routine>
  onSave: (data: RoutineInput) => Promise<void>
  onClose: () => void
}

export function RoutineForm({ initial, onSave, onClose }: RoutineFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<RoutineType>(initial?.type ?? 'HABIT')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [color, setColor] = useState(initial?.color ?? '#C4775A')
  const [icon, setIcon] = useState(initial?.icon ?? '✅')
  const [rruleString, setRruleString] = useState(initial?.rruleString ?? 'FREQ=DAILY')
  const [freqPreset, setFreqPreset] = useState<FreqPreset>('daily')
  const [selectedDays, setSelectedDays] = useState<string[]>([])
  const [hasQuantity, setHasQuantity] = useState(initial?.hasQuantity ?? false)
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function applyPreset(preset: FreqPreset) {
    setFreqPreset(preset)
    if (preset === 'daily') setRruleString('FREQ=DAILY')
    if (preset === 'weekly') setRruleString('FREQ=WEEKLY')
  }

  function toggleDay(day: string) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day]
    setSelectedDays(next)
    if (next.length > 0) {
      setRruleString(`FREQ=WEEKLY;BYDAY=${next.join(',')}`)
      setFreqPreset('custom')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        description: description || undefined,
        type,
        category: category || undefined,
        color,
        icon,
        rruleString,
        hasQuantity,
        unit: hasQuantity && unit ? unit : undefined,
      })
      onClose()
    } catch (err: any) {
      setError(err.message || 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routine-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="routine-form-modal">
        <div className="routine-form-title">{initial?.id ? 'Modifier' : 'Nouvelle routine'}</div>
        <form onSubmit={handleSubmit}>
          <div className="routine-form-row">
            <label className="routine-form-label">Nom *</label>
            <input className="input" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Méditation du matin" />
          </div>

          <div className="routine-form-row">
            <label className="routine-form-label">Icône</label>
            <input className="input" value={icon} onChange={e => setIcon(e.target.value)} style={{ maxWidth: 80 }} />
          </div>

          <div className="routine-form-row">
            <label className="routine-form-label">Couleur</label>
            <div className="color-swatches">
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  className={`color-swatch${color === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="routine-form-row">
            <label className="routine-form-label">Type</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {(['HABIT', 'TASK', 'OBLIGATION'] as RoutineType[]).map(t => (
                <button key={t} type="button"
                  className={`freq-preset-btn${type === t ? ' active' : ''}`}
                  onClick={() => setType(t)}>
                  {t === 'HABIT' ? 'Habitude' : t === 'TASK' ? 'Tâche' : 'Obligation'}
                </button>
              ))}
            </div>
          </div>

          <div className="routine-form-row">
            <label className="routine-form-label">Fréquence</label>
            <div className="freq-presets">
              <button type="button" className={`freq-preset-btn${freqPreset === 'daily' ? ' active' : ''}`}
                onClick={() => applyPreset('daily')}>Quotidien</button>
              <button type="button" className={`freq-preset-btn${freqPreset === 'weekly' ? ' active' : ''}`}
                onClick={() => applyPreset('weekly')}>Hebdo</button>
              <button type="button" className={`freq-preset-btn${freqPreset === 'custom' ? ' active' : ''}`}
                onClick={() => setFreqPreset('custom')}>Personnalisé</button>
            </div>
            {freqPreset === 'custom' && (
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Jours de la semaine</div>
                <div className="weekday-toggle">
                  {WEEKDAYS.map(d => (
                    <button key={d.key} type="button"
                      className={`weekday-btn${selectedDays.includes(d.key) ? ' active' : ''}`}
                      onClick={() => toggleDay(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <input className="input" value={rruleString}
                    onChange={e => setRruleString(e.target.value)}
                    placeholder="FREQ=WEEKLY;BYDAY=MO,TH" style={{ fontSize: '0.8rem' }} />
                </div>
              </div>
            )}
          </div>

          <div className="routine-form-row">
            <label className="routine-form-label">Catégorie</label>
            <input className="input" value={category} onChange={e => setCategory(e.target.value)} placeholder="Sport, Santé, Travail…" />
          </div>

          <div className="routine-form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input type="checkbox" checked={hasQuantity} onChange={e => setHasQuantity(e.target.checked)} />
              <span className="routine-form-label" style={{ margin: 0 }}>Validation quantitative</span>
            </label>
            {hasQuantity && (
              <input className="input" value={unit} onChange={e => setUnit(e.target.value)}
                placeholder="Unité (km, pages, min…)" style={{ marginTop: '0.5rem' }} />
            )}
          </div>

          {error && <div style={{ color: '#e56464', fontSize: '0.85rem', marginBottom: '0.75rem' }}>{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/routines/RoutineCard.tsx frontend/src/components/routines/RoutineForm.tsx
git commit -m "feat: RoutineCard + RoutineForm components"
```

---

### Task 10: TodayView + GridView pages

**Files:** Create under `frontend/src/pages/routines/`

- [ ] **Step 1: Create TodayView.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesApi, type TodayItem } from '../../api/routines'
import { FrequencyBadge } from '../../components/routines/FrequencyBadge'

export function TodayView() {
  const [items, setItems] = useState<TodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await routinesApi.getToday()
      setItems(data.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleCompletion(item: TodayItem) {
    const todayISO = new Date().toISOString()
    if (item.completion?.done) {
      await routinesApi.deleteCompletion(item.routine.id, item.completion.date)
    } else {
      await routinesApi.upsertCompletion(item.routine.id, { date: todayISO, done: true })
    }
    await load()
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div className="routines-container">
      <div className="today-header">
        <div className="today-date" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {items.length === 0 ? 'Aucune routine prévue aujourd\'hui' : `${items.filter(i => i.completion?.done).length} / ${items.length} complétées`}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
          <div>Rien de prévu aujourd'hui</div>
        </div>
      ) : (
        <div className="today-list">
          {items.map(item => (
            <div key={item.routine.id} className="today-item">
              <div className="today-item-icon">{item.routine.icon}</div>
              <div className="today-item-info" onClick={() => navigate(`/routines/${item.routine.id}`)} style={{ cursor: 'pointer' }}>
                <div className="today-item-name">{item.routine.name}</div>
                <div className="today-item-freq">
                  <FrequencyBadge rruleString={item.routine.rruleString} />
                  {item.routine.category && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {item.routine.category}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={`today-check-btn${item.completion?.done ? ' done' : ''}`}
                onClick={() => toggleCompletion(item)}
              >
                {item.completion?.done ? '✓' : ''}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create GridView.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { routinesApi, type Routine, type RoutineCompletion } from '../../api/routines'
import { HabitGrid } from '../../components/routines/HabitGrid'

export function GridView() {
  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [routines, setRoutines] = useState<Routine[]>([])
  const [completions, setCompletions] = useState<RoutineCompletion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await routinesApi.getGrid(year, month)
      setRoutines(data.routines)
      setCompletions(data.completions)
    } finally {
      setLoading(false)
    }
  }, [year, month])

  useEffect(() => { load() }, [load])

  async function handleToggle(routineId: string, dateISO: string) {
    const existing = completions.find(c => c.routineId === routineId && new Date(c.date).toISOString().slice(0, 10) === dateISO.slice(0, 10))
    if (existing?.done) {
      await routinesApi.deleteCompletion(routineId, existing.date)
    } else {
      await routinesApi.upsertCompletion(routineId, { date: dateISO, done: true })
    }
    await load()
  }

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
  }

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })

  return (
    <div className="routines-container">
      <div className="grid-nav">
        <button className="grid-nav-btn" onClick={prevMonth}>←</button>
        <span className="grid-month-label" style={{ textTransform: 'capitalize' }}>{monthLabel}</span>
        <button className="grid-nav-btn" onClick={nextMonth}>→</button>
      </div>
      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
      ) : routines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Aucune routine active. Créez-en une dans Éléments.
        </div>
      ) : (
        <HabitGrid
          routines={routines}
          completions={completions}
          year={year}
          month={month}
          onToggle={handleToggle}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/routines/TodayView.tsx frontend/src/pages/routines/GridView.tsx
git commit -m "feat: TodayView + GridView pages"
```

---

### Task 11: ItemList + AnnualView pages

**Files:** Create under `frontend/src/pages/routines/`

- [ ] **Step 1: Create ItemList.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesApi, type Routine, type RoutineType } from '../../api/routines'
import { RoutineCard } from '../../components/routines/RoutineCard'
import { RoutineForm } from '../../components/routines/RoutineForm'

export function ItemList() {
  const [routines, setRoutines] = useState<Routine[]>([])
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<RoutineType | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = {
        ...(search && { search }),
        ...(typeFilter && { type: typeFilter as RoutineType }),
      }
      const data = await routinesApi.getAll(Object.keys(params).length ? params : undefined)
      setRoutines(data.routines)
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => { load() }, [load])

  return (
    <div className="routines-container">
      <div className="routines-list-header">
        <div className="routines-list-title">Routines</div>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>+ Ajouter</button>
      </div>

      <div className="routines-toolbar">
        <input
          className="input routines-search"
          placeholder="Rechercher…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input" style={{ width: 'auto' }} value={typeFilter} onChange={e => setTypeFilter(e.target.value as RoutineType | '')}>
          <option value="">Tous les types</option>
          <option value="HABIT">Habitudes</option>
          <option value="TASK">Tâches</option>
          <option value="OBLIGATION">Obligations</option>
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
      ) : routines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✅</div>
          <div>Aucune routine. Créez-en une !</div>
        </div>
      ) : (
        <div className="routines-list">
          {routines.map(r => (
            <RoutineCard key={r.id} routine={r} onClick={() => navigate(`/routines/${r.id}`)} />
          ))}
        </div>
      )}

      {showForm && (
        <RoutineForm
          onSave={async (data) => {
            await routinesApi.create(data)
            await load()
          }}
          onClose={() => setShowForm(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Create AnnualView.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { routinesApi, type Routine, type RoutineCompletion } from '../../api/routines'
import { AnnualHeatmap } from '../../components/routines/AnnualHeatmap'

export function AnnualView() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [routines, setRoutines] = useState<Routine[]>([])
  const [completionsByRoutine, setCompletionsByRoutine] = useState<Map<string, RoutineCompletion[]>>(new Map())
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const data = await routinesApi.getAll({ active: true })
      setRoutines(data.routines)

      const yearStart = new Date(Date.UTC(year, 0, 1)).toISOString()
      const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59)).toISOString()

      const map = new Map<string, RoutineCompletion[]>()
      await Promise.all(data.routines.map(async r => {
        const cData = await routinesApi.getCompletions(r.id, { from: yearStart, to: yearEnd })
        map.set(r.id, cData.completions)
      }))
      setCompletionsByRoutine(new Map(map))
    } finally {
      setLoading(false)
    }
  }, [year])

  useEffect(() => { load() }, [load])

  return (
    <div className="routines-container">
      <div className="grid-nav" style={{ marginBottom: '1.5rem' }}>
        <button className="grid-nav-btn" onClick={() => setYear(y => y - 1)}>←</button>
        <span className="grid-month-label">{year}</span>
        <button className="grid-nav-btn" onClick={() => setYear(y => y + 1)}>→</button>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
      ) : routines.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          Aucune routine active.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {routines.map(r => (
            <AnnualHeatmap
              key={r.id}
              routine={r}
              completions={completionsByRoutine.get(r.id) ?? []}
              year={year}
            />
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/routines/ItemList.tsx frontend/src/pages/routines/AnnualView.tsx
git commit -m "feat: ItemList + AnnualView pages"
```

---

### Task 12: RoutineDetail page

**Files:** Create `frontend/src/pages/routines/RoutineDetail.tsx`

- [ ] **Step 1: Create RoutineDetail.tsx**

```tsx
import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { routinesApi, type Routine, type RoutineStats, type RoutineCompletion } from '../../api/routines'
import { FrequencyBadge } from '../../components/routines/FrequencyBadge'
import { StreakBadge } from '../../components/routines/StreakBadge'
import { RoutineForm } from '../../components/routines/RoutineForm'
import { TYPE_LABELS, TYPE_COLORS } from '../../api/routines'

export function RoutineDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [routine, setRoutine] = useState<Routine | null>(null)
  const [stats, setStats] = useState<RoutineStats | null>(null)
  const [recentCompletions, setRecentCompletions] = useState<RoutineCompletion[]>([])
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const [rData, sData] = await Promise.all([
        routinesApi.getOne(id),
        routinesApi.getStats(id),
      ])
      setRoutine(rData.routine)
      setStats(sData)

      const now = new Date()
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString()
      const cData = await routinesApi.getCompletions(id, { from: thirtyDaysAgo })
      setRecentCompletions(cData.completions)
    } catch {
      navigate('/routines/list')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  async function handleDelete() {
    if (!id || !confirm('Supprimer cette routine ?')) return
    await routinesApi.delete(id)
    navigate('/routines/list')
  }

  if (loading || !routine) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div className="routines-container" style={{ maxWidth: 720 }}>
      <button onClick={() => navigate('/routines/list')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
        ← Retour
      </button>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.25rem' }}>
        <div style={{ fontSize: '2.5rem' }}>{routine.icon}</div>
        <div>
          <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '1.75rem', margin: 0 }}>{routine.name}</h1>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <span className="type-badge" style={{ background: TYPE_COLORS[routine.type] }}>{TYPE_LABELS[routine.type]}</span>
            <FrequencyBadge rruleString={routine.rruleString} />
            {stats && <StreakBadge streak={stats.currentStreak} />}
            {routine.category && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{routine.category}</span>}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={() => setShowEdit(true)}>Modifier</button>
          <button className="btn" style={{ background: '#e56464', color: 'white', border: 'none', borderRadius: 'var(--radius-sm)', padding: '0.5rem 0.875rem', cursor: 'pointer' }} onClick={handleDelete}>
            Supprimer
          </button>
        </div>
      </div>

      {routine.description && (
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>{routine.description}</p>
      )}

      {stats && (
        <div className="stats-panel">
          <div className="stat-card">
            <div className="stat-value">{stats.totalCompletions}</div>
            <div className="stat-label">Complétions</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{Math.round(stats.successRate * 100)}%</div>
            <div className="stat-label">Taux de réussite</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.currentStreak}</div>
            <div className="stat-label">Série actuelle</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.longestStreak}</div>
            <div className="stat-label">Record</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.thisMonth}</div>
            <div className="stat-label">Ce mois</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{stats.thisYear}</div>
            <div className="stat-label">Cette année</div>
          </div>
        </div>
      )}

      {recentCompletions.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontFamily: 'Playfair Display, serif', marginBottom: '0.75rem' }}>30 derniers jours</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {recentCompletions.slice(0, 15).map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.85rem' }}>
                <span style={{ color: c.done ? '#48bb78' : '#e56464' }}>{c.done ? '✓' : '✗'}</span>
                <span style={{ color: 'var(--text-muted)' }}>
                  {new Date(c.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {c.note && <span style={{ color: 'var(--text-secondary)' }}>{c.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {showEdit && (
        <RoutineForm
          initial={routine}
          onSave={async (data) => {
            await routinesApi.update(routine.id, data)
            await load()
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/pages/routines/RoutineDetail.tsx
git commit -m "feat: RoutineDetail page with stats panel + edit/delete"
```

---

### Task 13: RoutinesPage tab router (wires everything together)

**Files:** Create `frontend/src/pages/routines/RoutinesPage.tsx`

- [ ] **Step 1: Create RoutinesPage.tsx**

```tsx
import { Routes, Route, NavLink, useLocation, Navigate } from 'react-router-dom'
import { TodayView } from './TodayView'
import { GridView } from './GridView'
import { ItemList } from './ItemList'
import { AnnualView } from './AnnualView'
import { RoutineDetail } from './RoutineDetail'

const TABS = [
  { to: '/routines/today', label: "Aujourd'hui" },
  { to: '/routines/grid', label: 'Grille' },
  { to: '/routines/list', label: 'Éléments' },
  { to: '/routines/annual', label: 'Annuel' },
]

export function RoutinesPage() {
  const location = useLocation()
  const isDetail = /^\/routines\/[^/]+$/.test(location.pathname) &&
    !['today', 'grid', 'list', 'annual'].includes(location.pathname.split('/')[2])

  return (
    <div>
      {!isDetail && (
        <div className="routines-tabs">
          {TABS.map(tab => (
            <NavLink
              key={tab.to}
              to={tab.to}
              className={({ isActive }) => `routines-tab${isActive ? ' active' : ''}`}
            >
              {tab.label}
            </NavLink>
          ))}
        </div>
      )}
      <Routes>
        <Route index element={<Navigate to="today" replace />} />
        <Route path="today" element={<TodayView />} />
        <Route path="grid" element={<GridView />} />
        <Route path="list" element={<ItemList />} />
        <Route path="annual" element={<AnnualView />} />
        <Route path=":id" element={<RoutineDetail />} />
      </Routes>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Expected: No errors (or only pre-existing errors unrelated to routines).

- [ ] **Step 3: Run all backend tests to confirm no regressions**

```bash
cd backend && npx jest --no-coverage 2>&1 | tail -20
```

Expected: All test suites PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/routines/RoutinesPage.tsx
git commit -m "feat: RoutinesPage tab router — completes routines module"
```

---

## Self-Review

### Spec coverage

| Requirement | Task |
|---|---|
| Prisma models (Routine, RoutineCompletion, enums) | Task 1 |
| rrule installed + helpers | Tasks 1, 2 |
| CRUD API + validation | Task 3 |
| Completion upsert/list/delete | Task 4 |
| `/today` aggregate | Task 5 |
| `/grid` aggregate | Task 5 |
| `/stats` (streak, rate, totals) | Task 3 (GET /:id/stats) |
| modules.ts habits available: true | Task 2 |
| API client + types | Task 6 |
| FrequencyBadge (rrule → French) | Task 7 |
| StreakBadge | Task 7 |
| CompletionCell (4 states) | Task 7 |
| HabitGrid | Task 8 |
| AnnualHeatmap | Task 8 |
| RoutineCard | Task 9 |
| RoutineForm (create/edit) | Task 9 |
| TodayView | Task 10 |
| GridView | Task 10 |
| ItemList | Task 11 |
| AnnualView | Task 11 |
| RoutineDetail + stats panel | Task 12 |
| RoutinesPage (tabs + router) + App.tsx | Tasks 6 + 13 |
| Auth isolation test | Task 3 |
| rrule validation (400) | Task 3 |

All spec requirements covered.

### Placeholder scan

No TBD, TODO, or "implement later" found.

### Type consistency

- `RoutineCompletion` used consistently across completions.ts, api/routines.ts, HabitGrid, AnnualHeatmap, TodayView, GridView, RoutineDetail.
- `routinesApi.upsertCompletion` / `routinesApi.deleteCompletion` / `routinesApi.getCompletions` match between API client and usages.
- `CellState` exported from CompletionCell.tsx, imported in HabitGrid.tsx.
- `formatDtstart` defined independently in `backend/src/lib/rrule.ts` and `frontend/src/utils/rrule.ts` (same implementation, no shared dep needed since separate workspaces).
- `computeStats` in backend lib used only by `GET /:id/stats` in routines.ts ✓
- `@@unique([routineId, date])` → Prisma generates `routineId_date` compound key, used correctly in `upsertCompletion` ✓
