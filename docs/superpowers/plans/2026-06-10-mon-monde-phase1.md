# Mon Monde — Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundation of Mon Monde — auth (signup/login), a dashboard with placeholder module cards, and a sidebar with navigation and customizable shortcuts.

**Architecture:** Monorepo with React+Vite frontend and Express+Prisma+PostgreSQL backend, both Docker services. Nginx serves the frontend and proxies `/api/*` to the backend. Auth uses httpOnly JWT cookies. All module data will be associated to users via `userId` FK — this is the universal rule for all future modules.

**Tech Stack:** Node.js 20, Express 4, Prisma 5, PostgreSQL 16, bcryptjs, jsonwebtoken, React 18, React Router 6, Vite 6, TypeScript 5, Docker Compose

---

## File Map

```
mon-monde/
├── .env.example
├── docker-compose.yml
├── backend/
│   ├── Dockerfile
│   ├── start.sh                          # migrate deploy + node dist/index.js
│   ├── package.json
│   ├── tsconfig.json
│   ├── jest.config.ts
│   ├── .env                              # local dev only, gitignored
│   ├── prisma/
│   │   └── schema.prisma
│   └── src/
│       ├── app.ts                        # Express setup (no listen — for testing)
│       ├── index.ts                      # server start
│       ├── lib/
│       │   └── prisma.ts
│       ├── middleware/
│       │   └── auth.ts                   # JWT cookie verification
│       ├── routes/
│       │   ├── auth.ts                   # register, login, logout, me
│       │   ├── modules.ts                # static module list
│       │   └── shortcuts.ts             # CRUD shortcuts
│       └── __tests__/
│           ├── auth.test.ts
│           └── shortcuts.test.ts
└── frontend/
    ├── Dockerfile
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── api/
        │   └── client.ts
        ├── context/
        │   └── AuthContext.tsx
        ├── routes/
        │   └── ProtectedRoute.tsx
        ├── components/
        │   ├── layout/
        │   │   ├── AppLayout.tsx
        │   │   ├── Sidebar.tsx
        │   │   └── ModuleCard.tsx
        │   └── ui/
        │       ├── GlassCard.tsx
        │       ├── Button.tsx
        │       └── Input.tsx
        ├── pages/
        │   ├── Login.tsx
        │   ├── Register.tsx
        │   └── Dashboard.tsx
        └── styles/
            ├── theme.css                 # CSS variables only
            └── globals.css              # reset + fonts + all component styles
```

---

### Task 1: Root scaffolding

**Files:**
- Create: `docker-compose.yml`
- Create: `.env.example`

- [ ] **Step 1: Create docker-compose.yml**

```yaml
# docker-compose.yml
version: '3.9'

services:
  postgres:
    image: postgres:16-alpine
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-monmonde}
      POSTGRES_USER: ${POSTGRES_USER:-monmonde}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-monmonde}"]
      interval: 5s
      timeout: 5s
      retries: 5

  backend:
    build: ./backend
    restart: unless-stopped
    environment:
      DATABASE_URL: postgresql://${POSTGRES_USER:-monmonde}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB:-monmonde}
      JWT_SECRET: ${JWT_SECRET:?JWT_SECRET required}
      NODE_ENV: production
      PORT: 3001
    depends_on:
      postgres:
        condition: service_healthy

  frontend:
    build: ./frontend
    restart: unless-stopped
    ports:
      - "80:80"
    depends_on:
      - backend

volumes:
  postgres_data:
```

- [ ] **Step 2: Create .env.example**

```
POSTGRES_DB=monmonde
POSTGRES_USER=monmonde
POSTGRES_PASSWORD=changeme
JWT_SECRET=change_this_to_a_random_secret_at_least_32_chars
```

- [ ] **Step 3: Commit**

```bash
git add docker-compose.yml .env.example
git commit -m "feat: add docker-compose and env example"
```

---

### Task 2: Backend — package.json + tsconfig + jest config

**Files:**
- Create: `backend/package.json`
- Create: `backend/tsconfig.json`
- Create: `backend/jest.config.ts`
- Create: `backend/.env`

- [ ] **Step 1: Create backend/package.json**

```json
{
  "name": "mon-monde-backend",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest --runInBand --forceExit"
  },
  "dependencies": {
    "@prisma/client": "^5.22.0",
    "bcryptjs": "^2.4.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "express": "^4.21.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.6",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.14",
    "@types/jsonwebtoken": "^9.0.8",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.2",
    "dotenv": "^16.4.7",
    "jest": "^29.7.0",
    "prisma": "^5.22.0",
    "supertest": "^7.0.0",
    "ts-jest": "^29.2.5",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

- [ ] **Step 2: Create backend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist", "src/__tests__"]
}
```

- [ ] **Step 3: Create backend/jest.config.ts**

```typescript
import type { Config } from 'jest'

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  testMatch: ['**/__tests__/**/*.test.ts'],
}

export default config
```

- [ ] **Step 4: Create backend/.env** (local dev + test DB connection)

```
DATABASE_URL=postgresql://monmonde:changeme@localhost:5432/monmonde
JWT_SECRET=dev_secret_at_least_32_chars_long_replace_me
```

- [ ] **Step 5: Install dependencies**

```bash
cd backend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 6: Commit**

```bash
git add backend/package.json backend/tsconfig.json backend/jest.config.ts
git commit -m "feat: add backend project config"
```

---

### Task 3: Backend — Prisma schema + migration

**Files:**
- Create: `backend/prisma/schema.prisma`

- [ ] **Step 1: Create backend/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String
  name      String
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  shortcuts Shortcut[]
}

model Shortcut {
  id        String   @id @default(cuid())
  label     String
  url       String
  icon      String?
  order     Int      @default(0)
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())

  @@index([userId])
}
```

- [ ] **Step 2: Start postgres locally for development**

```bash
# From repo root
docker-compose up -d postgres
```

Wait for it to be healthy (5–10 seconds).

- [ ] **Step 3: Run migration**

```bash
cd backend && npx prisma migrate dev --name init
```

Expected: `migrations/` folder created, tables `User` and `Shortcut` exist in the database.

- [ ] **Step 4: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `@prisma/client` types generated, no errors.

- [ ] **Step 5: Commit**

```bash
git add backend/prisma/
git commit -m "feat: add prisma schema with User and Shortcut models"
```

---

### Task 4: Backend — Express app entry points

**Files:**
- Create: `backend/src/lib/prisma.ts`
- Create: `backend/src/app.ts`
- Create: `backend/src/index.ts`

- [ ] **Step 1: Create backend/src/lib/prisma.ts**

```typescript
import { PrismaClient } from '@prisma/client'

export const prisma = new PrismaClient()
```

- [ ] **Step 2: Create backend/src/app.ts**

```typescript
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

export default app
```

- [ ] **Step 3: Create backend/src/index.ts**

```typescript
import app from './app'

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
```

- [ ] **Step 4: Verify dev server starts**

```bash
cd backend && npm run dev
```

Expected: `Server running on port 3001`. Stop with Ctrl+C.

- [ ] **Step 5: Commit**

```bash
git add backend/src/
git commit -m "feat: add express app skeleton"
```

---

### Task 5: Backend — Auth middleware

**Files:**
- Create: `backend/src/middleware/auth.ts`

- [ ] **Step 1: Create backend/src/middleware/auth.ts**

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'

interface JwtPayload {
  userId: string
}

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; name: string; email: string }
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.token
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  try {
    const { userId } = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true },
    })
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    req.user = user
    next()
  } catch {
    res.status(401).json({ error: 'Unauthorized' })
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/middleware/auth.ts
git commit -m "feat: add JWT auth middleware"
```

---

### Task 6: Backend — Auth routes (TDD)

**Files:**
- Create: `backend/src/__tests__/auth.test.ts`
- Create: `backend/src/routes/auth.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/auth.test.ts`:

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'auth-test@example.com'

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('POST /api/auth/register', () => {
  it('creates a user and sets a cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })

    expect(res.status).toBe(201)
    expect(res.body.user.email).toBe(TEST_EMAIL)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 409 for duplicate email', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })

    const res = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: TEST_EMAIL, password: 'password456' })

    expect(res.status).toBe(409)
  })

  it('returns 400 if fields are missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: TEST_EMAIL })

    expect(res.status).toBe(400)
  })
})

describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })
  })

  it('logs in with valid credentials', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(TEST_EMAIL)
    expect(res.headers['set-cookie']).toBeDefined()
  })

  it('returns 401 for wrong password', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: TEST_EMAIL, password: 'wrongpassword' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/auth/me', () => {
  it('returns user for authenticated request', async () => {
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })

    const cookie = (registerRes.headers['set-cookie'] as string[])[0]

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(TEST_EMAIL)
  })

  it('returns 401 without cookie', async () => {
    const res = await request(app).get('/api/auth/me')
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/logout', () => {
  it('clears the cookie', async () => {
    const res = await request(app).post('/api/auth/logout')
    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test -- --testPathPattern=auth
```

Expected: FAIL — `Cannot POST /api/auth/register` (routes not registered yet).

- [ ] **Step 3: Create backend/src/routes/auth.ts**

```typescript
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'

const router = Router()

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body
  if (!name || !email || !password) {
    res.status(400).json({ error: 'Name, email and password required' })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    res.status(409).json({ error: 'Email already in use' })
    return
  }

  const hashed = await bcrypt.hash(password, 12)
  const user = await prisma.user.create({
    data: { name, email, password: hashed },
    select: { id: true, name: true, email: true },
  })

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.cookie('token', token, COOKIE_OPTIONS)
  res.status(201).json({ user })
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' })
    return
  }

  const user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const valid = await bcrypt.compare(password, user.password)
  if (!valid) {
    res.status(401).json({ error: 'Invalid credentials' })
    return
  }

  const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
  res.cookie('token', token, COOKIE_OPTIONS)
  res.json({ user: { id: user.id, name: user.name, email: user.email } })
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

export default router
```

- [ ] **Step 4: Register the router in app.ts**

Add to `backend/src/app.ts` after the middleware lines:

```typescript
import authRouter from './routes/auth'

// Add after cookieParser line:
app.use('/api/auth', authRouter)
```

Full updated `backend/src/app.ts`:

```typescript
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRouter from './routes/auth'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)

export default app
```

- [ ] **Step 5: Run tests to confirm they pass**

```bash
cd backend && npm test -- --testPathPattern=auth
```

Expected: All 7 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/auth.ts backend/src/app.ts backend/src/__tests__/auth.test.ts
git commit -m "feat: add auth routes with register, login, logout, me"
```

---

### Task 7: Backend — Modules route

**Files:**
- Create: `backend/src/routes/modules.ts`

- [ ] **Step 1: Create backend/src/routes/modules.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'

const router = Router()

const MODULES = [
  { slug: 'projects', name: 'Projets', description: 'Gérez vos projets et tâches', icon: '📋', available: false },
  { slug: 'journal', name: 'Journal', description: 'Notes et journaling personnel', icon: '📓', available: false },
  { slug: 'finances', name: 'Finances', description: 'Budget, dépenses et objectifs', icon: '💰', available: false },
  { slug: 'habits', name: 'Habitudes', description: 'Routines et suivi des habitudes', icon: '✅', available: false },
  { slug: 'reading', name: 'Lectures', description: 'Livres lus et en cours', icon: '📚', available: false },
]

router.get('/', requireAuth, (_req, res) => {
  res.json({ modules: MODULES })
})

export default router
```

- [ ] **Step 2: Register router in app.ts**

```typescript
import modulesRouter from './routes/modules'

// Add after authRouter line:
app.use('/api/modules', modulesRouter)
```

Full updated `backend/src/app.ts`:

```typescript
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
import authRouter from './routes/auth'
import modulesRouter from './routes/modules'

const app = express()

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json())
app.use(cookieParser())

app.use('/api/auth', authRouter)
app.use('/api/modules', modulesRouter)

export default app
```

- [ ] **Step 3: Commit**

```bash
git add backend/src/routes/modules.ts backend/src/app.ts
git commit -m "feat: add modules route with static module list"
```

---

### Task 8: Backend — Shortcuts routes (TDD)

**Files:**
- Create: `backend/src/__tests__/shortcuts.test.ts`
- Create: `backend/src/routes/shortcuts.ts`

- [ ] **Step 1: Write the failing tests**

Create `backend/src/__tests__/shortcuts.test.ts`:

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'

const TEST_EMAIL = 'shortcuts-test@example.com'
let cookie: string

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Test User', email: TEST_EMAIL, password: 'password123' })
  cookie = (res.headers['set-cookie'] as string[])[0]
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.$disconnect()
})

describe('POST /api/shortcuts', () => {
  it('creates a shortcut', async () => {
    const res = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'GitHub', url: 'https://github.com' })

    expect(res.status).toBe(201)
    expect(res.body.shortcut.label).toBe('GitHub')
  })

  it('returns 400 if url is missing', async () => {
    const res = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'GitHub' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/shortcuts')
      .send({ label: 'GitHub', url: 'https://github.com' })

    expect(res.status).toBe(401)
  })
})

describe('GET /api/shortcuts', () => {
  it('returns an array of shortcuts', async () => {
    const res = await request(app)
      .get('/api/shortcuts')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(Array.isArray(res.body.shortcuts)).toBe(true)
  })
})

describe('DELETE /api/shortcuts/:id', () => {
  it('deletes a shortcut owned by the user', async () => {
    const createRes = await request(app)
      .post('/api/shortcuts')
      .set('Cookie', cookie)
      .send({ label: 'ToDelete', url: 'https://example.com' })

    const id = createRes.body.shortcut.id

    const res = await request(app)
      .delete(`/api/shortcuts/${id}`)
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 404 for non-existent shortcut', async () => {
    const res = await request(app)
      .delete('/api/shortcuts/nonexistentid')
      .set('Cookie', cookie)

    expect(res.status).toBe(404)
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
cd backend && npm test -- --testPathPattern=shortcuts
```

Expected: FAIL — `Cannot GET /api/shortcuts`.

- [ ] **Step 3: Create backend/src/routes/shortcuts.ts**

```typescript
import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res) => {
  const shortcuts = await prisma.shortcut.findMany({
    where: { userId: req.user!.id },
    orderBy: { order: 'asc' },
  })
  res.json({ shortcuts })
})

router.post('/', async (req, res) => {
  const { label, url, icon } = req.body
  if (!label || !url) {
    res.status(400).json({ error: 'Label and url required' })
    return
  }

  const count = await prisma.shortcut.count({ where: { userId: req.user!.id } })
  const shortcut = await prisma.shortcut.create({
    data: { label, url, icon, order: count, userId: req.user!.id },
  })
  res.status(201).json({ shortcut })
})

router.put('/:id', async (req, res) => {
  const { label, url, icon } = req.body
  const existing = await prisma.shortcut.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  })
  if (!existing) {
    res.status(404).json({ error: 'Shortcut not found' })
    return
  }

  const shortcut = await prisma.shortcut.update({
    where: { id: req.params.id },
    data: { label, url, icon },
  })
  res.json({ shortcut })
})

router.delete('/:id', async (req, res) => {
  const existing = await prisma.shortcut.findFirst({
    where: { id: req.params.id, userId: req.user!.id },
  })
  if (!existing) {
    res.status(404).json({ error: 'Shortcut not found' })
    return
  }

  await prisma.shortcut.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
```

- [ ] **Step 4: Register router in app.ts**

Full updated `backend/src/app.ts`:

```typescript
import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'
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

app.use('/api/auth', authRouter)
app.use('/api/modules', modulesRouter)
app.use('/api/shortcuts', shortcutsRouter)

export default app
```

- [ ] **Step 5: Run all tests to confirm they pass**

```bash
cd backend && npm test
```

Expected: All tests PASS (auth + shortcuts).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/shortcuts.ts backend/src/app.ts backend/src/__tests__/shortcuts.test.ts
git commit -m "feat: add shortcuts CRUD routes"
```

---

### Task 9: Backend — Dockerfile + start script

**Files:**
- Create: `backend/Dockerfile`
- Create: `backend/start.sh`

- [ ] **Step 1: Create backend/start.sh**

```bash
#!/bin/sh
npx prisma migrate deploy
node dist/index.js
```

- [ ] **Step 2: Create backend/Dockerfile**

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
RUN chmod +x start.sh
EXPOSE 3001
CMD ["./start.sh"]
```

- [ ] **Step 3: Commit**

```bash
git add backend/Dockerfile backend/start.sh
git commit -m "feat: add backend Dockerfile with migration on startup"
```

---

### Task 10: Frontend — Project setup

**Files:**
- Create: `frontend/package.json`
- Create: `frontend/vite.config.ts`
- Create: `frontend/tsconfig.json`
- Create: `frontend/index.html`
- Create: `frontend/src/main.tsx`

- [ ] **Step 1: Create frontend/package.json**

```json
{
  "name": "mon-monde-frontend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.28.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.0.3"
  }
}
```

- [ ] **Step 2: Create frontend/vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
})
```

- [ ] **Step 3: Create frontend/tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create frontend/index.html**

```html
<!doctype html>
<html lang="fr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Mon Monde</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Create frontend/src/main.tsx**

```typescript
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/theme.css'
import './styles/globals.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 6: Install dependencies**

```bash
cd frontend && npm install
```

Expected: `node_modules/` created, no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/vite.config.ts frontend/tsconfig.json frontend/index.html frontend/src/main.tsx
git commit -m "feat: add frontend project setup"
```

---

### Task 11: Frontend — Design system CSS

**Files:**
- Create: `frontend/src/styles/theme.css`
- Create: `frontend/src/styles/globals.css`

- [ ] **Step 1: Create frontend/src/styles/theme.css**

```css
:root {
  /* Colors */
  --bg-base: #F5EFE6;
  --bg-surface: #FAF6F0;
  --bg-glass: rgba(255, 255, 255, 0.35);
  --glass-blur: 12px;
  --glass-border: rgba(255, 255, 255, 0.5);

  --accent: #C4775A;
  --accent-hover: #B06548;
  --accent-light: rgba(196, 119, 90, 0.12);

  --text-primary: #2C1810;
  --text-secondary: #7A6458;
  --text-muted: #A89890;

  --shadow-soft: 0 4px 24px rgba(196, 119, 90, 0.08);
  --shadow-medium: 0 8px 32px rgba(196, 119, 90, 0.12);

  --radius-sm: 8px;
  --radius-md: 16px;
  --radius-lg: 24px;

  --sidebar-width: 260px;
  --transition: 0.2s ease;
}
```

- [ ] **Step 2: Create frontend/src/styles/globals.css**

```css
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;1,400&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap');

*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html, body, #root {
  height: 100%;
}

body {
  font-family: 'DM Sans', sans-serif;
  font-weight: 400;
  background-color: var(--bg-base);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  line-height: 1.6;
}

body::before {
  content: '';
  position: fixed;
  inset: 0;
  background:
    radial-gradient(ellipse at 15% 60%, rgba(196, 119, 90, 0.07) 0%, transparent 55%),
    radial-gradient(ellipse at 85% 15%, rgba(250, 246, 240, 0.8) 0%, transparent 50%),
    radial-gradient(ellipse at 55% 85%, rgba(196, 119, 90, 0.04) 0%, transparent 40%);
  pointer-events: none;
  z-index: 0;
}

#root {
  position: relative;
  z-index: 1;
  height: 100%;
}

/* Glass card */
.glass-card {
  background: var(--bg-glass);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border: 1px solid var(--glass-border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-soft);
}

/* Layout */
.app-layout {
  display: flex;
  height: 100%;
  overflow: hidden;
}

.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 2.5rem 3rem;
}

/* Sidebar */
.sidebar {
  width: var(--sidebar-width);
  height: 100%;
  background: rgba(255, 255, 255, 0.22);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-right: 1px solid rgba(255, 255, 255, 0.4);
  display: flex;
  flex-direction: column;
  padding: 1.5rem 0.875rem;
  flex-shrink: 0;
  overflow-y: auto;
}

.sidebar-header {
  padding: 0 0.5rem;
  margin-bottom: 2rem;
}

.sidebar-logo {
  font-family: 'Playfair Display', serif;
  font-size: 1.2rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.01em;
}

.sidebar-section-label {
  display: block;
  font-size: 0.68rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding: 0 0.5rem;
  margin-bottom: 0.5rem;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  margin-bottom: 2rem;
}

.sidebar-nav-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0.75rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.875rem;
  transition: all var(--transition);
}

.sidebar-nav-item:hover:not(.sidebar-nav-item--disabled) {
  background: var(--accent-light);
  color: var(--accent);
}

.sidebar-nav-item--active {
  background: var(--accent-light);
  color: var(--accent);
  font-weight: 500;
}

.sidebar-nav-item--disabled {
  opacity: 0.45;
  cursor: default;
  pointer-events: none;
}

.sidebar-nav-icon {
  font-size: 1.05rem;
  flex-shrink: 0;
}

.sidebar-nav-label {
  flex: 1;
}

.sidebar-badge {
  font-size: 0.6rem;
  background: var(--accent-light);
  color: var(--accent);
  padding: 0.1rem 0.45rem;
  border-radius: 20px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.sidebar-shortcuts {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.sidebar-shortcut {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  text-decoration: none;
  color: var(--text-secondary);
  font-size: 0.85rem;
  transition: all var(--transition);
}

.sidebar-shortcut:hover {
  background: var(--accent-light);
  color: var(--accent);
}

.sidebar-add-shortcut {
  background: none;
  border: 1px dashed rgba(196, 119, 90, 0.28);
  color: var(--text-muted);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  cursor: pointer;
  text-align: left;
  transition: all var(--transition);
  margin-top: 0.25rem;
  font-family: 'DM Sans', sans-serif;
  width: 100%;
}

.sidebar-add-shortcut:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-light);
}

.sidebar-footer {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.4);
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.sidebar-user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.sidebar-avatar {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 600;
  flex-shrink: 0;
}

.sidebar-user-info {
  flex: 1;
  overflow: hidden;
}

.sidebar-user-name {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-user-email {
  display: block;
  font-size: 0.72rem;
  color: var(--text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.sidebar-logout {
  width: 100%;
  background: none;
  border: none;
  color: var(--text-muted);
  font-size: 0.78rem;
  cursor: pointer;
  text-align: left;
  padding: 0.375rem 0.5rem;
  border-radius: var(--radius-sm);
  transition: color var(--transition);
  font-family: 'DM Sans', sans-serif;
}

.sidebar-logout:hover {
  color: #C44B4B;
}

/* Input */
.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.input-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.input-field {
  width: 100%;
  padding: 0.65rem 0.9rem;
  background: rgba(255, 255, 255, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.7);
  border-radius: var(--radius-sm);
  color: var(--text-primary);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  transition: border-color var(--transition), box-shadow var(--transition);
  outline: none;
}

.input-field:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-light);
}

.input-field::placeholder {
  color: var(--text-muted);
}

.input-field.input-error-field {
  border-color: rgba(196, 75, 75, 0.5);
}

.input-error-msg {
  font-size: 0.78rem;
  color: #C44B4B;
}

/* Button */
.btn {
  width: 100%;
  padding: 0.75rem 1.25rem;
  border: none;
  border-radius: var(--radius-sm);
  font-family: 'DM Sans', sans-serif;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: all var(--transition);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(196, 119, 90, 0.28);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid rgba(196, 119, 90, 0.2);
}

.btn-ghost:hover:not(:disabled) {
  background: var(--accent-light);
  color: var(--accent);
}

.btn-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Auth page */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
}

.auth-container {
  width: 100%;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  gap: 2rem;
  animation: fadeUp 0.5s ease both;
}

.auth-brand {
  text-align: center;
}

.auth-title {
  font-family: 'Playfair Display', serif;
  font-size: 2.75rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.auth-subtitle {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-top: 0.25rem;
  font-family: 'Playfair Display', serif;
  font-style: italic;
}

.auth-card {
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.auth-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.4rem;
  font-weight: 400;
  color: var(--text-primary);
}

.auth-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.auth-error {
  color: #C44B4B;
  font-size: 0.875rem;
  background: rgba(196, 75, 75, 0.07);
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(196, 75, 75, 0.15);
}

.auth-link {
  text-align: center;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.auth-link a {
  color: var(--accent);
  text-decoration: none;
  font-weight: 500;
}

.auth-link a:hover {
  color: var(--accent-hover);
}

/* Dashboard */
.dashboard {
  max-width: 920px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 3rem;
  animation: fadeUp 0.45s ease both;
}

.dashboard-greeting {
  font-family: 'Playfair Display', serif;
  font-size: 2.1rem;
  font-weight: 700;
  color: var(--text-primary);
  letter-spacing: -0.02em;
}

.dashboard-date {
  color: var(--text-secondary);
  font-size: 0.95rem;
  margin-top: 0.2rem;
  font-family: 'Playfair Display', serif;
  font-style: italic;
}

.dashboard-modules {
  animation: fadeUp 0.45s ease 0.08s both;
}

.dashboard-section-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem;
  font-weight: 400;
  color: var(--text-secondary);
  margin-bottom: 1.25rem;
}

.modules-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 1rem;
}

/* Module card */
.module-card {
  padding: 1.5rem;
  cursor: default;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  transition: transform var(--transition), box-shadow var(--transition);
  position: relative;
  animation: fadeUp 0.45s ease both;
}

.module-card--available {
  cursor: pointer;
}

.module-card--available:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-medium);
}

.module-card-icon {
  font-size: 1.75rem;
  line-height: 1;
}

.module-card-name {
  font-family: 'Playfair Display', serif;
  font-size: 1rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-top: 0.25rem;
}

.module-card-description {
  font-size: 0.78rem;
  color: var(--text-secondary);
  line-height: 1.45;
}

.module-card-badge {
  position: absolute;
  top: 0.875rem;
  right: 0.875rem;
  font-size: 0.6rem;
  background: var(--accent-light);
  color: var(--accent);
  padding: 0.15rem 0.5rem;
  border-radius: 20px;
  font-weight: 500;
  letter-spacing: 0.03em;
}

/* Loading */
.loading-screen {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-spinner {
  width: 32px;
  height: 32px;
  border: 2.5px solid var(--accent-light);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

/* Animations */
@keyframes fadeUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/styles/
git commit -m "feat: add design system — cozy beige palette, glassmorphism, Playfair Display"
```

---

### Task 12: Frontend — UI components

**Files:**
- Create: `frontend/src/components/ui/GlassCard.tsx`
- Create: `frontend/src/components/ui/Button.tsx`
- Create: `frontend/src/components/ui/Input.tsx`

- [ ] **Step 1: Create frontend/src/components/ui/GlassCard.tsx**

```typescript
interface GlassCardProps {
  children: React.ReactNode
  className?: string
  onClick?: () => void
  style?: React.CSSProperties
}

export function GlassCard({ children, className = '', onClick, style }: GlassCardProps) {
  return (
    <div className={`glass-card ${className}`} onClick={onClick} style={style}>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/ui/Button.tsx**

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'ghost'
  loading?: boolean
}

export function Button({ variant = 'primary', loading, children, disabled, className = '', ...props }: ButtonProps) {
  return (
    <button
      className={`btn btn-${variant} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <span className="btn-spinner" /> : children}
    </button>
  )
}
```

- [ ] **Step 3: Create frontend/src/components/ui/Input.tsx**

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, id, ...props }: InputProps) {
  return (
    <div className="input-group">
      {label && <label htmlFor={id} className="input-label">{label}</label>}
      <input
        id={id}
        className={`input-field ${error ? 'input-error-field' : ''}`}
        {...props}
      />
      {error && <span className="input-error-msg">{error}</span>}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/
git commit -m "feat: add GlassCard, Button, Input UI components"
```

---

### Task 13: Frontend — API client + AuthContext

**Files:**
- Create: `frontend/src/api/client.ts`
- Create: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Create frontend/src/api/client.ts**

```typescript
export async function apiClient<T = unknown>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Request failed' }))
    throw new Error(body.error || 'Request failed')
  }

  return res.json()
}
```

- [ ] **Step 2: Create frontend/src/context/AuthContext.tsx**

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from '../api/client'

interface User {
  id: string
  name: string
  email: string
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    apiClient<{ user: User }>('/api/auth/me')
      .then(data => setUser(data.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string) {
    const data = await apiClient<{ user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    })
    setUser(data.user)
  }

  async function register(name: string, email: string, password: string) {
    const data = await apiClient<{ user: User }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    })
    setUser(data.user)
  }

  async function logout() {
    await apiClient('/api/auth/logout', { method: 'POST' })
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/ frontend/src/context/
git commit -m "feat: add API client and AuthContext"
```

---

### Task 14: Frontend — Router + ProtectedRoute + App.tsx

**Files:**
- Create: `frontend/src/routes/ProtectedRoute.tsx`
- Create: `frontend/src/App.tsx`

- [ ] **Step 1: Create frontend/src/routes/ProtectedRoute.tsx**

```typescript
import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

- [ ] **Step 2: Create frontend/src/App.tsx**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'

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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/routes/ frontend/src/App.tsx
git commit -m "feat: add router with protected route and auth redirect"
```

---

### Task 15: Frontend — Auth pages (Login + Register)

**Files:**
- Create: `frontend/src/pages/Login.tsx`
- Create: `frontend/src/pages/Register.tsx`

- [ ] **Step 1: Create frontend/src/pages/Login.tsx**

```typescript
import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connexion échouée')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="auth-title">Mon Monde</h1>
          <p className="auth-subtitle">Votre vie, centralisée.</p>
        </div>
        <GlassCard className="auth-card">
          <h2 className="auth-card-title">Connexion</h2>
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="Email"
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Mot de passe"
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            {error && <p className="auth-error">{error}</p>}
            <Button type="submit" loading={loading}>Se connecter</Button>
          </form>
          <p className="auth-link">
            Pas encore de compte ?{' '}
            <Link to="/register">S'inscrire</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/pages/Register.tsx**

```typescript
import { useState, FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { GlassCard } from '../components/ui/GlassCard'
import { Input } from '../components/ui/Input'
import { Button } from '../components/ui/Button'

export function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await register(name, email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Inscription échouée')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container">
        <div className="auth-brand">
          <h1 className="auth-title">Mon Monde</h1>
          <p className="auth-subtitle">Commencez à centraliser votre vie.</p>
        </div>
        <GlassCard className="auth-card">
          <h2 className="auth-card-title">Créer un compte</h2>
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="Prénom"
              type="text"
              id="name"
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoComplete="given-name"
            />
            <Input
              label="Email"
              type="email"
              id="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
            <Input
              label="Mot de passe"
              type="password"
              id="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={8}
              autoComplete="new-password"
            />
            {error && <p className="auth-error">{error}</p>}
            <Button type="submit" loading={loading}>Créer mon compte</Button>
          </form>
          <p className="auth-link">
            Déjà un compte ?{' '}
            <Link to="/login">Se connecter</Link>
          </p>
        </GlassCard>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/Login.tsx frontend/src/pages/Register.tsx
git commit -m "feat: add Login and Register pages"
```

---

### Task 16: Frontend — AppLayout + Sidebar

**Files:**
- Create: `frontend/src/components/layout/AppLayout.tsx`
- Create: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Create frontend/src/components/layout/AppLayout.tsx**

```typescript
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  )
}
```

- [ ] **Step 2: Create frontend/src/components/layout/Sidebar.tsx**

```typescript
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import { apiClient } from '../../api/client'

interface Module {
  slug: string
  name: string
  icon: string
  available: boolean
}

interface Shortcut {
  id: string
  label: string
  url: string
  icon?: string
}

export function Sidebar() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [modules, setModules] = useState<Module[]>([])
  const [shortcuts, setShortcuts] = useState<Shortcut[]>([])

  useEffect(() => {
    apiClient<{ modules: Module[] }>('/api/modules')
      .then(d => setModules(d.modules))
      .catch(() => {})
    apiClient<{ shortcuts: Shortcut[] }>('/api/shortcuts')
      .then(d => setShortcuts(d.shortcuts))
      .catch(() => {})
  }, [])

  const initials = user?.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">Mon Monde</span>
      </div>

      <nav className="sidebar-nav">
        <span className="sidebar-section-label">Modules</span>
        {modules.map(mod => (
          <Link
            key={mod.slug}
            to={mod.available ? `/${mod.slug}` : '#'}
            className={[
              'sidebar-nav-item',
              !mod.available ? 'sidebar-nav-item--disabled' : '',
              location.pathname === `/${mod.slug}` ? 'sidebar-nav-item--active' : '',
            ].join(' ')}
          >
            <span className="sidebar-nav-icon">{mod.icon}</span>
            <span className="sidebar-nav-label">{mod.name}</span>
            {!mod.available && <span className="sidebar-badge">Bientôt</span>}
          </Link>
        ))}
      </nav>

      <div className="sidebar-shortcuts">
        <span className="sidebar-section-label">Raccourcis</span>
        {shortcuts.map(s => (
          <a
            key={s.id}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="sidebar-shortcut"
          >
            <span className="sidebar-nav-icon">{s.icon ?? '🔗'}</span>
            <span className="sidebar-nav-label">{s.label}</span>
          </a>
        ))}
        <button className="sidebar-add-shortcut">+ Ajouter</button>
      </div>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials}</div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-email">{user?.email}</span>
          </div>
        </div>
        <button className="sidebar-logout" onClick={logout}>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/layout/AppLayout.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add AppLayout and Sidebar with module navigation and shortcuts"
```

---

### Task 17: Frontend — ModuleCard + Dashboard

**Files:**
- Create: `frontend/src/components/layout/ModuleCard.tsx`
- Create: `frontend/src/pages/Dashboard.tsx`

- [ ] **Step 1: Create frontend/src/components/layout/ModuleCard.tsx**

```typescript
import { useNavigate } from 'react-router-dom'
import { GlassCard } from '../ui/GlassCard'

interface ModuleCardProps {
  slug: string
  name: string
  description: string
  icon: string
  available: boolean
  animationDelay: number
}

export function ModuleCard({ slug, name, description, icon, available, animationDelay }: ModuleCardProps) {
  const navigate = useNavigate()

  return (
    <GlassCard
      className={`module-card ${available ? 'module-card--available' : ''}`}
      style={{ animationDelay: `${animationDelay}ms` }}
      onClick={() => available && navigate(`/${slug}`)}
    >
      <span className="module-card-icon">{icon}</span>
      <h3 className="module-card-name">{name}</h3>
      <p className="module-card-description">{description}</p>
      {!available && <span className="module-card-badge">Bientôt</span>}
    </GlassCard>
  )
}
```

- [ ] **Step 2: Create frontend/src/pages/Dashboard.tsx**

```typescript
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { apiClient } from '../api/client'
import { ModuleCard } from '../components/layout/ModuleCard'

interface Module {
  slug: string
  name: string
  description: string
  icon: string
  available: boolean
}

export function Dashboard() {
  const { user } = useAuth()
  const [modules, setModules] = useState<Module[]>([])

  useEffect(() => {
    apiClient<{ modules: Module[] }>('/api/modules')
      .then(d => setModules(d.modules))
      .catch(() => {})
  }, [])

  const dateStr = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  const capitalizedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1)
  const firstName = user?.name.split(' ')[0] ?? ''

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1 className="dashboard-greeting">Bonjour, {firstName} 👋</h1>
        <p className="dashboard-date">{capitalizedDate}</p>
      </header>

      <section className="dashboard-modules">
        <h2 className="dashboard-section-title">Vos modules</h2>
        <div className="modules-grid">
          {modules.map((mod, i) => (
            <ModuleCard
              key={mod.slug}
              {...mod}
              animationDelay={i * 75}
            />
          ))}
        </div>
      </section>
    </div>
  )
}
```

- [ ] **Step 3: Start the frontend dev server and verify the full flow**

Make sure the backend and postgres are running first:
```bash
# Terminal 1 — from repo root
docker-compose up -d postgres
cd backend && npm run dev

# Terminal 2
cd frontend && npm run dev
```

Open `http://localhost:5173`. Expected flow:
1. Redirects to `/login`
2. Click "S'inscrire" → register with name, email, password
3. Redirected to dashboard — greeting shows your name
4. Sidebar shows 5 module cards with "Bientôt" badge
5. Dashboard shows 5 module cards with staggered entrance animation
6. Logout → redirected to `/login`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/ModuleCard.tsx frontend/src/pages/Dashboard.tsx
git commit -m "feat: add ModuleCard and Dashboard with staggered animation"
```

---

### Task 18: Frontend — Dockerfile + nginx

**Files:**
- Create: `frontend/nginx.conf`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Create frontend/nginx.conf**

```nginx
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;
    gzip on;
    gzip_types text/plain text/css application/json application/javascript application/x-javascript text/xml application/xml text/javascript;

    location /api/ {
        proxy_pass http://backend:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

- [ ] **Step 2: Create frontend/Dockerfile**

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

- [ ] **Step 3: Commit**

```bash
git add frontend/nginx.conf frontend/Dockerfile
git commit -m "feat: add frontend Dockerfile and nginx config"
```

---

### Task 19: Integration — docker-compose build + smoke test

- [ ] **Step 1: Stop local dev servers**

Stop any running `npm run dev` processes (Ctrl+C in each terminal).

- [ ] **Step 2: Create root .env from example**

```bash
cp .env.example .env
```

Edit `.env` and set a real value for `JWT_SECRET` (at least 32 characters).

- [ ] **Step 3: Build and start all services**

```bash
docker-compose up --build
```

Wait until you see `Server running on port 3001` in the backend logs and nginx starts.

- [ ] **Step 4: Smoke test**

Open `http://localhost` in a browser.

Expected:
1. Landing on `/login` — "Mon Monde" title in Playfair Display, glassmorphism card
2. Register an account → redirected to dashboard
3. Dashboard shows greeting + 5 module placeholder cards with animations
4. Sidebar shows modules and "Ajouter" shortcuts button
5. Logout → back to `/login`

- [ ] **Step 5: Commit**

```bash
git add .env.example
git commit -m "chore: finalize phase 1 — auth, dashboard, sidebar"
```
