import { Router, Request, Response, NextFunction } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import fs from 'fs'
import path from 'path'
import { prisma } from '../lib/prisma'
import { requireAuth } from '../middleware/auth'
import { uploadAvatar, UPLOADS_BASE } from '../lib/upload'

const router = Router()

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body
    if (!name || !email || !password) {
      res.status(400).json({ error: 'Name, email and password required' })
      return
    }
    if (password.length < 8) {
      res.status(400).json({ error: 'Password must be at least 8 characters' })
      return
    }

    const normalizedEmail = email.toLowerCase()
    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      res.status(409).json({ error: 'Email already in use' })
      return
    }

    const hashed = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { name, email: normalizedEmail, password: hashed },
      select: { id: true, name: true, email: true, avatarUrl: true },
    })

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, { expiresIn: '7d' })
    res.cookie('token', token, COOKIE_OPTIONS)
    res.status(201).json({ user })
  } catch (err) {
    next(err)
  }
})

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password required' })
      return
    }

    const normalizedEmail = email.toLowerCase()
    const user = await prisma.user.findUnique({ where: { email: normalizedEmail } })
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
    res.json({ user: { id: user.id, name: user.name, email: user.email, avatarUrl: user.avatarUrl } })
  } catch (err) {
    next(err)
  }
})

router.post('/logout', (_req, res) => {
  res.clearCookie('token')
  res.json({ ok: true })
})

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user })
})

router.patch('/me', requireAuth, async (req, res, next) => {
  try {
    const { name, email } = req.body
    const userId = req.user!.id
    const updates: { name?: string; email?: string } = {}

    if (name !== undefined) {
      if (name.trim().length === 0) {
        res.status(400).json({ error: 'Name cannot be empty' })
        return
      }
      updates.name = name.trim()
    }
    if (email) {
      const normalizedEmail = email.toLowerCase().trim()
      const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } })
      if (existing && existing.id !== userId) {
        res.status(409).json({ error: 'Email already in use' })
        return
      }
      updates.email = normalizedEmail
    }

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: 'Nothing to update' })
      return
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
    if (!user) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      res.status(400).json({ error: 'Current password is incorrect' })
      return
    }

    const hashed = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({ where: { id: req.user!.id }, data: { password: hashed } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

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
      await fs.promises.unlink(oldPath).catch(() => {})
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

// Handle multer errors for avatar upload (wrong file type)
router.use('/me/avatar', (err: Error, _req: Request, res: Response, next: NextFunction) => {
  if (err.message?.includes('Only JPEG') || err.message?.includes('images are allowed')) {
    res.status(400).json({ error: 'Image must be JPEG, PNG, or WebP (max 5 MB)' })
  } else {
    next(err)
  }
})

router.delete('/me/avatar', requireAuth, async (req, res, next) => {
  try {
    const current = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { avatarUrl: true },
    })
    if (current?.avatarUrl) {
      const filePath = path.join(UPLOADS_BASE, current.avatarUrl.replace('/uploads/', ''))
      await fs.promises.unlink(filePath).catch(() => {})
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

export default router
