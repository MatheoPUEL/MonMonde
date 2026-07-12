import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { SourceType } from '@prisma/client'

const router = Router()

const CITATION_INCLUDE = {
  tags: true,
  book: { select: { id: true, title: true, coverUrl: true, author: true } },
} as const

// GET /api/citations
router.get('/', async (req, res, next) => {
  try {
    const { search, sourceType, favorite, tag, bookId } = req.query as Record<string, string>
    const userId = req.user!.id

    const where: Record<string, unknown> = { userId }
    if (sourceType && Object.values(SourceType).includes(sourceType as SourceType)) {
      where.sourceType = sourceType as SourceType
    }
    if (favorite === 'true') where.favorite = true
    if (bookId) where.bookId = bookId
    if (search) {
      where.OR = [
        { text: { contains: search, mode: 'insensitive' } },
        { author: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
        { comment: { contains: search, mode: 'insensitive' } },
      ]
    }
    if (tag) {
      where.tags = { some: { name: { equals: tag, mode: 'insensitive' } } }
    }

    const citations = await prisma.citation.findMany({
      where,
      include: CITATION_INCLUDE,
      orderBy: { createdAt: 'desc' },
    })

    res.json({ citations, total: citations.length })
  } catch (err) { next(err) }
})

// GET /api/citations/stats — registered BEFORE /:id
router.get('/stats', async (req, res, next) => {
  try {
    const userId = req.user!.id

    const twelveMonthsAgo = new Date()
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12)

    const [total, favorites, bySourceTypeRaw, byAuthorRaw, mostViewed, recentForTimeline] =
      await Promise.all([
        prisma.citation.count({ where: { userId } }),
        prisma.citation.count({ where: { userId, favorite: true } }),
        prisma.citation.groupBy({
          by: ['sourceType'],
          where: { userId },
          _count: { _all: true },
        }),
        prisma.citation.groupBy({
          by: ['author'],
          where: { userId, author: { not: null } },
          _count: { _all: true },
        }),
        prisma.citation.findMany({
          where: { userId },
          include: CITATION_INCLUDE,
          orderBy: { viewCount: 'desc' },
          take: 5,
        }),
        prisma.citation.findMany({
          where: { userId, createdAt: { gte: twelveMonthsAgo } },
          select: { createdAt: true },
        }),
      ])

    const bySourceType: Record<string, number> = {}
    for (const row of bySourceTypeRaw) {
      bySourceType[row.sourceType] = row._count._all
    }

    const byAuthor = byAuthorRaw
      .filter(r => r.author)
      .map(r => ({ author: r.author as string, count: r._count._all }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const timelineMap = new Map<string, number>()
    for (const c of recentForTimeline) {
      const month = c.createdAt.toISOString().slice(0, 7)
      timelineMap.set(month, (timelineMap.get(month) ?? 0) + 1)
    }
    const timeline = Array.from(timelineMap.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month))

    res.json({ total, favorites, bySourceType, byAuthor, mostViewed, timeline })
  } catch (err) { next(err) }
})

// GET /api/citations/tags — registered BEFORE /:id
router.get('/tags', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const tags = await prisma.citationTag.findMany({
      where: { citation: { userId } },
      select: { name: true },
      distinct: ['name'],
      orderBy: { name: 'asc' },
    })
    res.json({ tags: tags.map(t => t.name) })
  } catch (err) { next(err) }
})

// GET /api/citations/:id — increments viewCount
router.get('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }

    const citation = await prisma.citation.update({
      where: { id: req.params.id },
      data: { viewCount: { increment: 1 } },
      include: CITATION_INCLUDE,
    })
    res.json({ citation })
  } catch (err) { next(err) }
})

// POST /api/citations
router.post('/', async (req, res, next) => {
  try {
    const { text, author, sourceType, source, bookId, page, chapter, comment, color, favorite, tags } = req.body
    if (!text?.trim()) { res.status(400).json({ error: 'text is required' }); return }

    if (bookId) {
      const book = await prisma.book.findFirst({
        where: { id: bookId, userId: req.user!.id },
        select: { id: true },
      })
      if (!book) { res.status(404).json({ error: 'Book not found' }); return }
    }

    const citation = await prisma.citation.create({
      data: {
        userId: req.user!.id,
        text: text.trim(),
        author: author || undefined,
        sourceType: sourceType || 'OTHER',
        source: source || undefined,
        bookId: bookId || undefined,
        page: page != null ? Number(page) : undefined,
        chapter: chapter || undefined,
        comment: comment || undefined,
        color: color || '#C4775A',
        favorite: favorite ?? false,
        tags: Array.isArray(tags) && tags.length
          ? { create: tags.map((name: string) => ({ name: name.trim() })) }
          : undefined,
      },
      include: CITATION_INCLUDE,
    })
    res.status(201).json({ citation })
  } catch (err) { next(err) }
})

// PUT /api/citations/:id
router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }

    const { text, author, sourceType, source, bookId, page, chapter, comment, color, favorite, tags } = req.body

    if (sourceType !== undefined && !Object.values(SourceType).includes(sourceType as SourceType)) {
      res.status(400).json({ error: 'Invalid sourceType' }); return
    }

    if (bookId !== undefined && bookId) {
      const book = await prisma.book.findFirst({
        where: { id: bookId, userId: req.user!.id },
        select: { id: true },
      })
      if (!book) { res.status(404).json({ error: 'Book not found' }); return }
    }

    const citation = await prisma.citation.update({
      where: { id: req.params.id },
      data: {
        ...(text !== undefined && { text: text.trim() }),
        ...(author !== undefined && { author }),
        ...(sourceType !== undefined && { sourceType }),
        ...(source !== undefined && { source }),
        ...(bookId !== undefined && { bookId: bookId || null }),
        ...(page !== undefined && { page: page != null ? Number(page) : null }),
        ...(chapter !== undefined && { chapter }),
        ...(comment !== undefined && { comment }),
        ...(color !== undefined && { color }),
        ...(favorite !== undefined && { favorite }),
        ...(tags !== undefined && {
          tags: {
            deleteMany: {},
            create: (tags as string[]).map(name => ({ name: name.trim() })),
          },
        }),
      },
      include: CITATION_INCLUDE,
    })
    res.json({ citation })
  } catch (err) { next(err) }
})

// DELETE /api/citations/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }
    await prisma.citation.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// PATCH /api/citations/:id/favorite
router.patch('/:id/favorite', async (req, res, next) => {
  try {
    const existing = await prisma.citation.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Citation not found' }); return }
    const citation = await prisma.citation.update({
      where: { id: req.params.id },
      data: { favorite: !existing.favorite },
      include: CITATION_INCLUDE,
    })
    res.json({ citation })
  } catch (err) { next(err) }
})

export default router
