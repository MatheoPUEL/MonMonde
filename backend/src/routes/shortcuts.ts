import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'

const router = Router()

router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const shortcuts = await prisma.shortcut.findMany({
      where: { userId: req.user!.id },
      orderBy: { order: 'asc' },
    })
    res.json({ shortcuts })
  } catch (err) {
    next(err)
  }
})

router.post('/', async (req, res, next) => {
  try {
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
  } catch (err) {
    next(err)
  }
})

router.put('/:id', async (req, res, next) => {
  try {
    const { label, url, icon } = req.body
    if (label === undefined && url === undefined && icon === undefined) {
      res.status(400).json({ error: 'At least one field (label, url, icon) required' })
      return
    }
    if (label !== undefined && !label) {
      res.status(400).json({ error: 'Label cannot be empty' })
      return
    }
    if (url !== undefined && !url) {
      res.status(400).json({ error: 'URL cannot be empty' })
      return
    }

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
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.shortcut.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) {
      res.status(404).json({ error: 'Shortcut not found' })
      return
    }

    await prisma.shortcut.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
