import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { extractTextFromTiptap } from '../../lib/journal'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const { search, mood, favorite, pinned, draft, tag, dateFrom, dateTo, page = '1', limit = '20' } = req.query as Record<string, string>

    const where: any = { userId }

    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { contentText: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (mood) where.mood = mood
    if (favorite === 'true') where.favorite = true
    if (pinned === 'true') where.pinned = true
    if (draft === 'true') where.draft = true
    if (tag) where.tags = { some: { name: tag } }
    if (dateFrom || dateTo) {
      where.createdAt = {}
      if (dateFrom) where.createdAt.gte = new Date(dateFrom)
      if (dateTo) where.createdAt.lte = new Date(dateTo)
    }

    const pageNum = Math.max(1, parseInt(page) || 1)
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20))
    const skip = (pageNum - 1) * limitNum

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        include: { tags: true },
        orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limitNum,
      }),
      prisma.journalEntry.count({ where }),
    ])

    res.json({ entries, total, page: pageNum })
  } catch (err) {
    next(err)
  }
})

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const { title, content, mood, favorite = false, pinned = false, draft = false, tags = [] } = req.body

    if (!title?.trim()) {
      res.status(400).json({ error: 'title is required' })
      return
    }
    if (content === undefined || content === null) {
      res.status(400).json({ error: 'content is required' })
      return
    }

    const contentText = extractTextFromTiptap(content)

    const entry = await prisma.journalEntry.create({
      data: {
        userId,
        title: title.trim(),
        content,
        contentText,
        mood: mood || null,
        favorite,
        pinned,
        draft,
        tags: {
          create: (tags as string[]).filter(Boolean).map(name => ({ name: name.toLowerCase().trim() })),
        },
      },
      include: { tags: true },
    })

    res.status(201).json({ entry })
  } catch (err) {
    next(err)
  }
})

router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const entry = await prisma.journalEntry.findFirst({
      where: { id: req.params.id, userId },
      include: { tags: true },
    })
    if (!entry) {
      res.status(404).json({ error: 'Entry not found' })
      return
    }
    res.json({ entry })
  } catch (err) {
    next(err)
  }
})

router.put('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const existing = await prisma.journalEntry.findFirst({ where: { id: req.params.id, userId } })
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' })
      return
    }

    const { title, content, mood, favorite, pinned, draft, tags } = req.body
    const data: any = {}

    if (title !== undefined) data.title = title.trim()
    if (content !== undefined) {
      data.content = content
      data.contentText = extractTextFromTiptap(content)
    }
    if (mood !== undefined) data.mood = mood || null
    if (favorite !== undefined) data.favorite = favorite
    if (pinned !== undefined) data.pinned = pinned
    if (draft !== undefined) data.draft = draft

    if (tags !== undefined) {
      const tagNames = (tags as string[]).filter(Boolean).map(n => n.toLowerCase().trim())
      const entry = await prisma.$transaction(async (tx) => {
        await tx.journalTag.deleteMany({ where: { entryId: req.params.id } })
        return tx.journalEntry.update({
          where: { id: req.params.id },
          data: { ...data, tags: { create: tagNames.map(name => ({ name })) } },
          include: { tags: true },
        })
      })
      res.json({ entry })
      return
    }

    const entry = await prisma.journalEntry.update({
      where: { id: req.params.id },
      data,
      include: { tags: true },
    })
    res.json({ entry })
  } catch (err) {
    next(err)
  }
})

router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id
    const existing = await prisma.journalEntry.findFirst({ where: { id: req.params.id, userId } })
    if (!existing) {
      res.status(404).json({ error: 'Entry not found' })
      return
    }
    await prisma.journalEntry.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
