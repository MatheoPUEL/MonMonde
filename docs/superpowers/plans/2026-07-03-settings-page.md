# Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/settings` page where the user can update their profile picture, name, email, and password.

**Architecture:** Backend adds `avatarUrl` to the User model and exposes four new endpoints on `/api/auth/me`. Frontend adds an `AuthContext.refreshUser()` method, a `settings` API module, a `SettingsPage` component, and updates the sidebar with an avatar display and a settings link.

**Tech Stack:** Prisma (PostgreSQL), Express, bcryptjs, multer — React, TypeScript, react-router-dom.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `backend/prisma/schema.prisma` | Modify | Add `avatarUrl String?` to User |
| `backend/src/middleware/auth.ts` | Modify | Include `avatarUrl` in `req.user` select + type |
| `backend/src/lib/upload.ts` | Modify | Add `uploadAvatar` multer instance |
| `backend/src/routes/auth.ts` | Modify | Add PATCH /me, POST /me/password, POST /me/avatar, DELETE /me/avatar |
| `backend/src/__tests__/settings.test.ts` | Create | Tests for all 4 new endpoints |
| `frontend/src/context/AuthContext.tsx` | Modify | Add `avatarUrl` to User type, add `refreshUser()` |
| `frontend/src/api/settings.ts` | Create | `updateProfile`, `changePassword`, `uploadAvatar`, `deleteAvatar` |
| `frontend/src/pages/SettingsPage.tsx` | Create | Three-section settings page |
| `frontend/src/styles/settings.css` | Create | Styles for settings page |
| `frontend/src/App.tsx` | Modify | Add `/settings` route |
| `frontend/src/components/layout/Sidebar.tsx` | Modify | Settings link + avatar image display |

---

### Task 1: Add avatarUrl to Prisma schema + migrate

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add the field**

In `backend/prisma/schema.prisma`, update the `User` model:

```prisma
model User {
  id        String     @id @default(cuid())
  email     String     @unique
  password  String
  name      String
  avatarUrl String?
  createdAt DateTime   @default(now())
  updatedAt DateTime   @updatedAt
  shortcuts      Shortcut[]
  books          Book[]
  authors        Author[]
  journalEntries JournalEntry[]
  routines       Routine[]
  citations      Citation[]
}
```

- [ ] **Step 2: Run migration**

```bash
cd backend
npx prisma migrate dev --name add_avatar_url
```

Expected: Migration file created in `backend/prisma/migrations/`, Prisma client regenerated.

- [ ] **Step 3: Commit**

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/
git commit -m "feat: add avatarUrl field to User model"
```

---

### Task 2: Add uploadAvatar to upload.ts

**Files:**
- Modify: `backend/src/lib/upload.ts`

- [ ] **Step 1: Add avatar upload config**

Replace the entire content of `backend/src/lib/upload.ts`:

```typescript
import multer from 'multer'
import path from 'path'
import fs from 'fs'

const COVERS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads', 'covers')
const AVATARS_DIR = path.join(
  process.env.UPLOADS_DIR ? path.dirname(process.env.UPLOADS_DIR) : path.join(process.cwd(), 'uploads'),
  'avatars'
)

for (const dir of [COVERS_DIR, AVATARS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

const imageFilter = (_req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (allowed.includes(file.mimetype)) {
    cb(null, true)
  } else {
    cb(new Error('Only JPEG, PNG, and WebP images are allowed'))
  }
}

export const uploadCover = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, COVERS_DIR),
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export const uploadAvatar = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, AVATARS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase()
      cb(null, `${(req as any).user!.id}${ext}`)
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: imageFilter,
})

export const UPLOADS_BASE = process.env.UPLOADS_DIR
  ? path.dirname(process.env.UPLOADS_DIR)
  : path.join(process.cwd(), 'uploads')
```

- [ ] **Step 2: Commit**

```bash
git add backend/src/lib/upload.ts
git commit -m "feat: add uploadAvatar multer instance"
```

---

### Task 3: Update auth middleware to include avatarUrl

**Files:**
- Modify: `backend/src/middleware/auth.ts`

- [ ] **Step 1: Extend the type and select**

Replace the content of `backend/src/middleware/auth.ts`:

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
      user?: { id: string; name: string; email: string; avatarUrl: string | null }
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
      select: { id: true, name: true, email: true, avatarUrl: true },
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
git commit -m "feat: include avatarUrl in requireAuth user select"
```

---

### Task 4: Write tests for the new endpoints

**Files:**
- Create: `backend/src/__tests__/settings.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import request from 'supertest'
import app from '../app'
import { prisma } from '../lib/prisma'
import path from 'path'

const TEST_EMAIL = 'settings-test@example.com'

async function createUserAndGetCookie() {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ name: 'Settings User', email: TEST_EMAIL, password: 'password123' })
  return (res.headers['set-cookie'] as unknown as string[])[0]
}

afterEach(async () => {
  await prisma.user.deleteMany({ where: { email: TEST_EMAIL } })
  await prisma.user.deleteMany({ where: { email: 'new-settings@example.com' } })
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('PATCH /api/auth/me', () => {
  it('updates name and email', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ name: 'Updated Name', email: 'new-settings@example.com' })

    expect(res.status).toBe(200)
    expect(res.body.user.name).toBe('Updated Name')
    expect(res.body.user.email).toBe('new-settings@example.com')
  })

  it('returns 409 if new email is already taken', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ name: 'Other', email: 'new-settings@example.com', password: 'password123' })
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .patch('/api/auth/me')
      .set('Cookie', cookie)
      .send({ email: 'new-settings@example.com' })

    expect(res.status).toBe(409)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).patch('/api/auth/me').send({ name: 'X' })
    expect(res.status).toBe(401)
  })
})

describe('POST /api/auth/me/password', () => {
  it('changes password with correct current password', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'password123', newPassword: 'newpassword456' })

    expect(res.status).toBe(200)
    expect(res.body.ok).toBe(true)
  })

  it('returns 400 with wrong current password', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'wrongpassword', newPassword: 'newpassword456' })

    expect(res.status).toBe(400)
  })

  it('returns 400 if new password is too short', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .post('/api/auth/me/password')
      .set('Cookie', cookie)
      .send({ currentPassword: 'password123', newPassword: 'short' })

    expect(res.status).toBe(400)
  })

  it('returns 401 without auth', async () => {
    const res = await request(app)
      .post('/api/auth/me/password')
      .send({ currentPassword: 'x', newPassword: 'y' })
    expect(res.status).toBe(401)
  })
})

describe('DELETE /api/auth/me/avatar', () => {
  it('clears avatarUrl', async () => {
    const cookie = await createUserAndGetCookie()

    const res = await request(app)
      .delete('/api/auth/me/avatar')
      .set('Cookie', cookie)

    expect(res.status).toBe(200)
    expect(res.body.user.avatarUrl).toBeNull()
  })

  it('returns 401 without auth', async () => {
    const res = await request(app).delete('/api/auth/me/avatar')
    expect(res.status).toBe(401)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd backend && npx jest settings.test.ts --no-coverage
```

Expected: All tests FAIL with 404 or "route not found" errors.

---

### Task 5: Implement new endpoints in auth.ts

**Files:**
- Modify: `backend/src/routes/auth.ts`

- [ ] **Step 1: Add imports**

At the top of `backend/src/routes/auth.ts`, add the `uploadAvatar` import:

```typescript
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { uploadAvatar, UPLOADS_BASE } from '../lib/upload'
```

- [ ] **Step 2: Update GET /me to return avatarUrl**

Replace the existing `GET /me` handler:

```typescript
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})
```

- [ ] **Step 3: Add PATCH /me**

After the GET /me handler, add:

```typescript
router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email } = req.body
    const userId = req.user!.id
    const updates: { name?: string; email?: string } = {}

    if (name) updates.name = name.trim()
    if (email) {
      const normalizedEmail = email.toLowerCase().trim()
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (existing && existing.id !== userId) {
        res.status(409).json({ error: 'Email already in use' })
        return
      }
      updates.email = normalizedEmail
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updates,
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    res.json({ user })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 4: Add POST /me/password**

```typescript
router.post('/me/password', requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body
    if (!currentPassword || !newPassword) {
      res.status(400).json({ error: 'currentPassword and newPassword are required' })
      return
    }
    if (newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters' })
      return
    }

    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    const valid = await bcrypt.compare(currentPassword, user!.password)
    if (!valid) {
      res.status(400).json({ error: 'Mot de passe actuel incorrect' })
      return
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashed } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 5: Add POST /me/avatar**

```typescript
router.post('/me/avatar', requireAuth, uploadAvatar.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    const relativePath = `/uploads/avatars/${req.file.filename}`

    // Delete old avatar file if it exists
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    })
    if (current?.avatarUrl) {
      const oldPath = path.join(UPLOADS_BASE, current.avatarUrl.replace('/uploads/', ''))
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath)
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: relativePath },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    res.json({ user })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 6: Add DELETE /me/avatar**

```typescript
router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    })
    if (current?.avatarUrl) {
      const filePath = path.join(UPLOADS_BASE, current.avatarUrl.replace('/uploads/', ''))
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
    }

    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { avatarUrl: null },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })
    res.json({ user })
  } catch (err) {
    next(err)
  }
})
```

- [ ] **Step 7: Run tests**

```bash
cd backend && npx jest settings.test.ts --no-coverage
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add backend/src/routes/auth.ts backend/src/__tests__/settings.test.ts
git commit -m "feat: add profile update, password change, and avatar endpoints"
```

---

### Task 6: Update AuthContext

**Files:**
- Modify: `frontend/src/context/AuthContext.tsx`

- [ ] **Step 1: Update the file**

Replace the entire content of `frontend/src/context/AuthContext.tsx`:

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { apiClient } from '../api/client'

interface User {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchMe() {
    const data = await apiClient<{ user: User }>('/api/auth/me')
    setUser(data.user)
  }

  useEffect(() => {
    fetchMe()
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

  async function refreshUser() {
    await fetchMe()
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
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

- [ ] **Step 2: Commit**

```bash
git add frontend/src/context/AuthContext.tsx
git commit -m "feat: add avatarUrl and refreshUser to AuthContext"
```

---

### Task 7: Create settings API module

**Files:**
- Create: `frontend/src/api/settings.ts`

- [ ] **Step 1: Create the file**

```typescript
import { apiClient } from './client'

interface UserProfile {
  id: string
  name: string
  email: string
  avatarUrl: string | null
}

export async function updateProfile(data: { name?: string; email?: string }) {
  return apiClient<{ user: UserProfile }>('/api/auth/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
}

export async function changePassword(currentPassword: string, newPassword: string) {
  return apiClient<{ ok: boolean }>('/api/auth/me/password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
}

export async function uploadAvatar(file: File) {
  const formData = new FormData()
  formData.append('avatar', file)
  return apiClient<{ user: UserProfile }>('/api/auth/me/avatar', {
    method: 'POST',
    body: formData,
  })
}

export async function deleteAvatar() {
  return apiClient<{ user: UserProfile }>('/api/auth/me/avatar', { method: 'DELETE' })
}
```

- [ ] **Step 2: Check apiClient accepts FormData**

Open `frontend/src/api/client.ts`. Verify that `apiClient` does not force a `Content-Type: application/json` header when the body is a `FormData` instance. If it does, add a guard:

In the fetch options, only set `'Content-Type': 'application/json'` when `body` is a string (not FormData). The browser sets the correct multipart boundary automatically for FormData.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/api/settings.ts
git commit -m "feat: add settings API module"
```

---

### Task 8: Create SettingsPage and CSS

**Files:**
- Create: `frontend/src/pages/SettingsPage.tsx`
- Create: `frontend/src/styles/settings.css`

- [ ] **Step 1: Create settings.css**

```css
/* ---- Settings page ---- */
.settings-page {
  max-width: 600px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.settings-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.75rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.settings-card {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.settings-card-title {
  font-family: 'Playfair Display', serif;
  font-size: 1.05rem;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

/* Avatar */
.settings-avatar-section {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

.settings-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  overflow: hidden;
  background: var(--accent-light);
  border: 2px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
  transition: opacity 0.15s;
  flex-shrink: 0;
}

.settings-avatar:hover { opacity: 0.85; }

.settings-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.settings-avatar-actions {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.settings-avatar-hint {
  font-size: 0.78rem;
  color: var(--text-muted);
}

/* Feedback */
.settings-feedback {
  font-size: 0.82rem;
  padding: 0.5rem 0.75rem;
  border-radius: var(--radius-sm);
}

.settings-feedback--success {
  background: rgba(72, 187, 120, 0.12);
  color: #276749;
}

.settings-feedback--error {
  background: rgba(196, 75, 75, 0.1);
  color: #c44b4b;
}

@media (max-width: 640px) {
  .settings-page { padding: 1rem; }
}
```

- [ ] **Step 2: Create SettingsPage.tsx**

```typescript
import { useState, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { updateProfile, changePassword, uploadAvatar, deleteAvatar } from '../api/settings'

export function SettingsPage() {
  const { user, refreshUser } = useAuth()

  // Profile section
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [profileFeedback, setProfileFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)

  // Password section
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordFeedback, setPasswordFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const [savingPassword, setSavingPassword] = useState(false)

  // Avatar section
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const initials = user?.name
    .split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?'

  async function handleSaveProfile() {
    setSavingProfile(true)
    setProfileFeedback(null)
    try {
      await updateProfile({ name, email })
      await refreshUser()
      setProfileFeedback({ type: 'success', msg: 'Profil mis à jour.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setProfileFeedback({ type: 'error', msg: msg.includes('409') ? 'Cet email est déjà utilisé.' : msg })
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleChangePassword() {
    if (newPassword !== confirmPassword) {
      setPasswordFeedback({ type: 'error', msg: 'Les mots de passe ne correspondent pas.' })
      return
    }
    if (newPassword.length < 8) {
      setPasswordFeedback({ type: 'error', msg: 'Le nouveau mot de passe doit faire au moins 8 caractères.' })
      return
    }
    setSavingPassword(true)
    setPasswordFeedback(null)
    try {
      await changePassword(currentPassword, newPassword)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordFeedback({ type: 'success', msg: 'Mot de passe changé.' })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Une erreur est survenue'
      setPasswordFeedback({ type: 'error', msg: msg.includes('400') ? 'Mot de passe actuel incorrect.' : msg })
    } finally {
      setSavingPassword(false)
    }
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      setAvatarFeedback({ type: 'error', msg: 'L\'image ne doit pas dépasser 5 Mo.' })
      return
    }
    setAvatarFeedback(null)
    try {
      await uploadAvatar(file)
      await refreshUser()
      setAvatarFeedback({ type: 'success', msg: 'Photo mise à jour.' })
    } catch {
      setAvatarFeedback({ type: 'error', msg: 'Erreur lors de l\'upload.' })
    }
  }

  async function handleDeleteAvatar() {
    setAvatarFeedback(null)
    try {
      await deleteAvatar()
      await refreshUser()
      setAvatarFeedback({ type: 'success', msg: 'Photo supprimée.' })
    } catch {
      setAvatarFeedback({ type: 'error', msg: 'Erreur lors de la suppression.' })
    }
  }

  return (
    <div className="settings-page">
      <h1 className="settings-title">Paramètres</h1>

      {/* Avatar */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">Photo de profil</div>
        <div className="settings-avatar-section">
          <div className="settings-avatar" onClick={() => fileInputRef.current?.click()}>
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="Avatar" />
              : initials}
          </div>
          <div className="settings-avatar-actions">
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem' }} onClick={() => fileInputRef.current?.click()}>
              Changer la photo
            </button>
            {user?.avatarUrl && (
              <button className="btn btn-ghost" style={{ width: 'auto', padding: '0.45rem 1rem', fontSize: '0.85rem', color: '#c44b4b' }} onClick={handleDeleteAvatar}>
                Supprimer
              </button>
            )}
            <span className="settings-avatar-hint">JPEG, PNG ou WebP · 5 Mo max</span>
          </div>
        </div>
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} onChange={handleAvatarChange} />
        {avatarFeedback && (
          <div className={`settings-feedback settings-feedback--${avatarFeedback.type}`}>{avatarFeedback.msg}</div>
        )}
      </div>

      {/* Informations */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">Informations</div>
        <div className="input-group">
          <label className="input-label">Nom</label>
          <input className="input-field" value={name} onChange={e => setName(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label">Email</label>
          <input className="input-field" type="email" value={email} onChange={e => setEmail(e.target.value)} />
        </div>
        {profileFeedback && (
          <div className={`settings-feedback settings-feedback--${profileFeedback.type}`}>{profileFeedback.msg}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1.25rem' }} onClick={handleSaveProfile} disabled={savingProfile}>
            {savingProfile ? 'Enregistrement…' : 'Sauvegarder'}
          </button>
        </div>
      </div>

      {/* Mot de passe */}
      <div className="glass-card settings-card">
        <div className="settings-card-title">Mot de passe</div>
        <div className="input-group">
          <label className="input-label">Mot de passe actuel</label>
          <input className="input-field" type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label">Nouveau mot de passe</label>
          <input className="input-field" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        </div>
        <div className="input-group">
          <label className="input-label">Confirmer le nouveau mot de passe</label>
          <input className="input-field" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        </div>
        {passwordFeedback && (
          <div className={`settings-feedback settings-feedback--${passwordFeedback.type}`}>{passwordFeedback.msg}</div>
        )}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" style={{ width: 'auto', padding: '0.5rem 1.25rem' }} onClick={handleChangePassword} disabled={savingPassword}>
            {savingPassword ? 'Enregistrement…' : 'Changer le mot de passe'}
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Import settings.css in main.tsx or globals**

In `frontend/src/main.tsx` (or wherever global CSS is imported), add:

```typescript
import './styles/settings.css'
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/SettingsPage.tsx frontend/src/styles/settings.css frontend/src/main.tsx
git commit -m "feat: add SettingsPage with avatar, profile, and password sections"
```

---

### Task 9: Wire up routing and sidebar

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/layout/Sidebar.tsx`

- [ ] **Step 1: Add /settings route in App.tsx**

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ProtectedRoute } from './routes/ProtectedRoute'
import { AppLayout } from './components/layout/AppLayout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { ReadingPage } from './pages/reading/ReadingPage'
import { JournalPage } from './pages/journal/JournalPage'
import { RoutinesPage } from './pages/routines/RoutinesPage'
import { CitationsPage } from './pages/citations/CitationsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<ProtectedRoute><AppLayout><Dashboard /></AppLayout></ProtectedRoute>} />
          <Route path="/reading/*" element={<ProtectedRoute><AppLayout><ReadingPage /></AppLayout></ProtectedRoute>} />
          <Route path="/journal/*" element={<ProtectedRoute><AppLayout><JournalPage /></AppLayout></ProtectedRoute>} />
          <Route path="/routines/*" element={<ProtectedRoute><AppLayout><RoutinesPage /></AppLayout></ProtectedRoute>} />
          <Route path="/citations/*" element={<ProtectedRoute><AppLayout><CitationsPage /></AppLayout></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><AppLayout><SettingsPage /></AppLayout></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
```

- [ ] **Step 2: Update Sidebar.tsx**

Replace the `sidebar-footer` section and add avatar image support. The full updated `Sidebar.tsx`:

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

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
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
    <aside className={`sidebar${isOpen ? ' sidebar--open' : ''}`}>
      <div className="sidebar-header">
        <span className="sidebar-logo">Mon Monde</span>
      </div>

      <nav className="sidebar-nav">
        <Link
          to="/"
          onClick={onClose}
          className={`sidebar-nav-item${location.pathname === '/' ? ' sidebar-nav-item--active' : ''}`}
        >
          <span className="sidebar-nav-icon">🏠</span>
          <span className="sidebar-nav-label">Dashboard</span>
        </Link>
        <span className="sidebar-section-label">Modules</span>
        {modules.map(mod => (
          <Link
            key={mod.slug}
            to={mod.available ? `/${mod.slug}` : '#'}
            onClick={onClose}
            className={[
              'sidebar-nav-item',
              !mod.available ? 'sidebar-nav-item--disabled' : '',
              location.pathname.startsWith(`/${mod.slug}`) ? 'sidebar-nav-item--active' : '',
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
          <div className="sidebar-avatar">
            {user?.avatarUrl
              ? <img src={user.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : initials}
          </div>
          <div className="sidebar-user-info">
            <span className="sidebar-user-name">{user?.name}</span>
            <span className="sidebar-user-email">{user?.email}</span>
          </div>
        </div>
        <Link
          to="/settings"
          onClick={onClose}
          className={`sidebar-nav-item${location.pathname === '/settings' ? ' sidebar-nav-item--active' : ''}`}
          style={{ fontSize: '0.82rem', marginTop: '0.25rem' }}
        >
          <span className="sidebar-nav-icon">⚙</span>
          <span className="sidebar-nav-label">Paramètres</span>
        </Link>
        <button className="sidebar-logout" onClick={() => { logout(); onClose() }}>
          Déconnexion
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx
git commit -m "feat: add /settings route and settings link in sidebar"
```

---

### Task 10: Check apiClient for FormData compatibility

**Files:**
- Modify (if needed): `frontend/src/api/client.ts`

- [ ] **Step 1: Read client.ts**

Open `frontend/src/api/client.ts` and check how the `Content-Type` header is set.

- [ ] **Step 2: Guard the Content-Type header**

If `apiClient` sets `'Content-Type': 'application/json'` unconditionally, update it so it only sets that header when `body` is a string:

```typescript
const headers: Record<string, string> = {}
if (options?.body && typeof options.body === 'string') {
  headers['Content-Type'] = 'application/json'
}
```

If it already handles this (e.g., by not setting Content-Type at all, or checking), no change needed.

- [ ] **Step 3: Commit if changed**

```bash
git add frontend/src/api/client.ts
git commit -m "fix: only set Content-Type: application/json for string bodies"
```

---

## Self-Review

**Spec coverage:**
- ✅ Avatar upload/remove — Tasks 2, 5, 8
- ✅ Edit name/email — Tasks 4, 8
- ✅ Change password — Tasks 5, 8
- ✅ Sidebar settings link — Task 9
- ✅ Sidebar avatar display — Task 9
- ✅ AuthContext `avatarUrl` + `refreshUser` — Task 6
- ✅ `/settings` route — Task 9
- ✅ Error handling (409, 400, file size) — Tasks 5, 8
- ✅ Backend tests — Task 4 (tests written before implementation)

**Placeholder scan:** No TBD/TODO found.

**Type consistency:**
- `User.avatarUrl: string | null` used consistently in Tasks 3, 5, 6, 7, 8, 9
- `refreshUser()` defined in Task 6, consumed in Task 8
- `uploadAvatar` multer from Task 2 imported in Task 5
- `UPLOADS_BASE` imported in Task 5 for file cleanup
