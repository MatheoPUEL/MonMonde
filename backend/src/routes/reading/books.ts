import express, { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { uploadCover } from '../../lib/upload'
import { ReadingStatus } from '@prisma/client'
import notesRouter from './notes'

const router = Router({ mergeParams: true })

router.use(requireAuth)
router.use('/:bookId/notes', notesRouter)

router.get('/', async (req, res, next) => {
  try {
    const { status, search, tag, favorite } = req.query as Record<string, string>

    const where: Record<string, unknown> = { userId: req.user!.id }

    if (status && Object.values(ReadingStatus).includes(status as ReadingStatus)) {
      where.status = status as ReadingStatus
    }
    if (favorite === 'true') where.favorite = true
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { author: { name: { contains: search, mode: 'insensitive' } } },
        { isbn: { contains: search, mode: 'insensitive' } },
      ]
    }

    let books = await prisma.book.findMany({
      where,
      include: { tags: true, author: true },
      orderBy: { createdAt: 'desc' },
    })

    if (tag) {
      books = books.filter(b => b.tags.some(t => t.name.toLowerCase() === tag.toLowerCase()))
    }

    res.json({ books })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { title, authorName, synopsis, isbn, pageCount, genres, coverUrl, coverType,
            googleBooksId, status, owned, tags } = req.body

    if (!title || !authorName) {
      res.status(400).json({ error: 'Title and authorName are required' })
      return
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      res.status(400).json({ error: 'tags must be an array of strings' })
      return
    }
    if (status !== undefined && !Object.values(ReadingStatus).includes(status)) {
      res.status(400).json({ error: 'Invalid status value' })
      return
    }

    // find-or-create author
    const author = await prisma.author.upsert({
      where: { userId_name: { userId: req.user!.id, name: authorName } },
      create: { userId: req.user!.id, name: authorName },
      update: {},
    })

    const book = await prisma.book.create({
      data: {
        userId: req.user!.id,
        title,
        authorId: author.id,
        synopsis, isbn,
        pageCount: pageCount != null ? Number(pageCount) : undefined,
        genres: genres || [],
        coverUrl, coverType, googleBooksId,
        status: status || 'WISHLIST',
        owned: owned || false,
        tags: tags?.length ? { create: (tags as string[]).map(name => ({ name })) } : undefined,
      },
      include: { tags: true, author: true },
    })

    res.status(201).json({ book })
  } catch (err) { next(err) }
})

// GET /api/reading/books/:id/citations
router.get('/:id/citations', async (req, res, next) => {
  try {
    const book = await prisma.book.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    })
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const citations = await prisma.citation.findMany({
      where: { bookId: req.params.id },
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ citations, total: citations.length })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const book = await prisma.book.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: { tags: true, notes: { orderBy: { createdAt: 'desc' } }, author: true },
    })
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }
    res.json({ book })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }

    const { title, authorName, synopsis, isbn, pageCount, genres, coverUrl, coverType,
            status, owned, rating, review, favorite, rereadCount, tags } = req.body

    // Validate tags is an array if provided
    if (tags !== undefined && !Array.isArray(tags)) {
      res.status(400).json({ error: 'tags must be an array of strings' })
      return
    }

    // Validate status enum if provided
    if (status !== undefined && !Object.values(ReadingStatus).includes(status)) {
      res.status(400).json({ error: 'Invalid status value' })
      return
    }

    // find-or-create author if authorName provided
    let authorId: string | undefined
    if (authorName !== undefined) {
      const authorRecord = await prisma.author.upsert({
        where: { userId_name: { userId: req.user!.id, name: authorName } },
        create: { userId: req.user!.id, name: authorName },
        update: {},
      })
      authorId = authorRecord.id
    }

    let book
    if (tags !== undefined) {
      // Atomic: delete existing tags and update book in one transaction
      const [, updatedBook] = await prisma.$transaction([
        prisma.bookTag.deleteMany({ where: { bookId: req.params.id } }),
        prisma.book.update({
          where: { id: req.params.id },
          data: {
            ...(title !== undefined && { title }),
            ...(authorId !== undefined && { authorId }),
            ...(synopsis !== undefined && { synopsis }),
            ...(isbn !== undefined && { isbn }),
            ...(pageCount !== undefined && { pageCount: Number(pageCount) }),
            ...(genres !== undefined && { genres }),
            ...(coverUrl !== undefined && { coverUrl }),
            ...(coverType !== undefined && { coverType }),
            ...(status !== undefined && { status }),
            ...(owned !== undefined && { owned }),
            ...(rating !== undefined && { rating: rating != null ? Number(rating) : null }),
            ...(review !== undefined && { review }),
            ...(favorite !== undefined && { favorite }),
            ...(rereadCount !== undefined && { rereadCount: Number(rereadCount) }),
            tags: { create: (tags as string[]).map(name => ({ name })) },
          },
          include: { tags: true, author: true },
        }),
      ])
      book = updatedBook
    } else {
      book = await prisma.book.update({
        where: { id: req.params.id },
        data: {
          ...(title !== undefined && { title }),
          ...(authorId !== undefined && { authorId }),
          ...(synopsis !== undefined && { synopsis }),
          ...(isbn !== undefined && { isbn }),
          ...(pageCount !== undefined && { pageCount: Number(pageCount) }),
          ...(genres !== undefined && { genres }),
          ...(coverUrl !== undefined && { coverUrl }),
          ...(coverType !== undefined && { coverType }),
          ...(status !== undefined && { status }),
          ...(owned !== undefined && { owned }),
          ...(rating !== undefined && { rating: rating != null ? Number(rating) : null }),
          ...(review !== undefined && { review }),
          ...(favorite !== undefined && { favorite }),
          ...(rereadCount !== undefined && { rereadCount: Number(rereadCount) }),
        },
        include: { tags: true, author: true },
      })
    }

    res.json({ book })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }
    await prisma.book.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.put('/:id/progress', async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }

    const { currentPage, startedAt, finishedAt } = req.body

    const currentPageNum = currentPage != null ? Number(currentPage) : undefined
    const autoFinish =
      currentPageNum != null &&
      existing.pageCount != null &&
      currentPageNum >= existing.pageCount &&
      existing.status === 'READING'

    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: {
        ...(currentPageNum !== undefined && { currentPage: currentPageNum }),
        ...(startedAt !== undefined && { startedAt: startedAt ? new Date(startedAt) : null }),
        ...(finishedAt !== undefined && { finishedAt: finishedAt ? new Date(finishedAt) : null }),
        ...(autoFinish && { status: 'FINISHED' }),
      },
      include: { tags: true, author: true },
    })

    res.json({ book })
  } catch (err) { next(err) }
})

router.post('/:id/cover', uploadCover.single('cover'), async (req, res, next) => {
  try {
    const existing = await prisma.book.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Book not found' }); return }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }

    const coverUrl = `/uploads/covers/${req.file.filename}`
    const book = await prisma.book.update({
      where: { id: req.params.id },
      data: { coverUrl, coverType: 'upload' },
      include: { tags: true, author: true },
    })

    res.json({ book, coverUrl })
  } catch (err) { next(err) }
})

// Handle multer errors for cover upload
router.use('/:id/cover', (err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message?.includes('Only JPEG') || err.message?.includes('images are allowed')) {
    res.status(400).json({ error: err.message })
    return
  }
  next(err)
})

export default router
