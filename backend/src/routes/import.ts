import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { RoutineType, SourceType, ReadingStatus, Mood, TargetPeriod } from '@prisma/client'

const router = Router()
router.use(requireAuth)

function validateVersion(body: Record<string, unknown>, res: import('express').Response): boolean {
  if (!body.version) {
    res.status(400).json({ error: 'version field is required' })
    return false
  }
  if (body.version !== '1') {
    res.status(400).json({ error: 'Unsupported export version' })
    return false
  }
  return true
}

router.post('/journal', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; entries?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const entries = body.entries ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const entry of entries) {
        const createdAt = new Date(entry.createdAt as string)
        const dayStart = new Date(createdAt)
        dayStart.setUTCHours(0, 0, 0, 0)
        const dayEnd = new Date(createdAt)
        dayEnd.setUTCHours(23, 59, 59, 999)

        const existing = await tx.journalEntry.findFirst({
          where: {
            userId,
            title: entry.title as string,
            createdAt: { gte: dayStart, lte: dayEnd },
          },
        })

        if (existing) { skipped++; continue }

        const tags = (entry.tags as string[]) ?? []
        await tx.journalEntry.create({
          data: {
            userId,
            title: entry.title as string,
            content: entry.content as string,
            contentText: (entry.contentText as string) ?? '',
            mood: (entry.mood as Mood | null) ?? null,
            favorite: (entry.favorite as boolean) ?? false,
            pinned: (entry.pinned as boolean) ?? false,
            draft: (entry.draft as boolean) ?? false,
            createdAt,
            tags: { create: tags.filter(Boolean).map(name => ({ name })) },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: entries.length })
  } catch (err) { next(err) }
})

router.post('/reading', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; books?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const books = body.books ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const book of books) {
        const isbn = (book.isbn as string) || undefined

        // find-or-create author
        const authorName = (book.author as string) || 'Inconnu'
        const bookAuthor = await tx.author.upsert({
          where: { userId_name: { userId, name: authorName } },
          create: { userId, name: authorName },
          update: {},
        })

        const existing = await tx.book.findFirst({
          where: isbn
            ? { userId, isbn }
            : { userId, title: book.title as string, authorId: bookAuthor.id },
        })

        if (existing) { skipped++; continue }

        const tags = (book.tags as string[]) ?? []
        const notes = (book.notes as Record<string, unknown>[]) ?? []

        await tx.book.create({
          data: {
            userId,
            title: book.title as string,
            authorId: bookAuthor.id,
            synopsis: (book.synopsis as string) ?? null,
            isbn: isbn ?? null,
            pageCount: book.pageCount != null ? Number(book.pageCount) : null,
            genres: (book.genres as string[]) ?? [],
            coverUrl: (book.coverUrl as string) ?? null,
            coverType: (book.coverType as string) ?? null,
            googleBooksId: (book.googleBooksId as string) ?? null,
            status: (book.status as ReadingStatus) ?? 'WISHLIST',
            owned: (book.owned as boolean) ?? false,
            rating: book.rating != null ? Number(book.rating) : null,
            review: (book.review as string) ?? null,
            favorite: (book.favorite as boolean) ?? false,
            rereadCount: (book.rereadCount as number) ?? 0,
            currentPage: book.currentPage != null ? Number(book.currentPage) : null,
            startedAt: book.startedAt ? new Date(book.startedAt as string) : null,
            finishedAt: book.finishedAt ? new Date(book.finishedAt as string) : null,
            tags: { create: tags.filter(Boolean).map(name => ({ name })) },
            notes: {
              create: notes.map(n => ({
                title: n.title as string,
                content: n.content as string,
                chapter: (n.chapter as string) ?? null,
                page: n.page != null ? Number(n.page) : null,
              })),
            },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: books.length })
  } catch (err) { next(err) }
})

router.post('/routines', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; routines?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const routines = body.routines ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const routine of routines) {
        const existing = await tx.routine.findFirst({
          where: { userId, name: routine.name as string, rruleString: routine.rruleString as string },
        })

        if (existing) { skipped++; continue }

        const completions = (routine.completions as Record<string, unknown>[]) ?? []

        await tx.routine.create({
          data: {
            userId,
            name: routine.name as string,
            description: (routine.description as string) ?? null,
            type: (routine.type as RoutineType) ?? 'HABIT',
            category: (routine.category as string) ?? null,
            color: (routine.color as string) ?? '#C4775A',
            icon: (routine.icon as string) ?? '✅',
            rruleString: routine.rruleString as string,
            startDate: routine.startDate ? new Date(routine.startDate as string) : new Date(),
            endDate: routine.endDate ? new Date(routine.endDate as string) : null,
            active: (routine.active as boolean) ?? true,
            hasQuantity: (routine.hasQuantity as boolean) ?? false,
            unit: (routine.unit as string) ?? null,
            targetCount: routine.targetCount != null ? Number(routine.targetCount) : null,
            targetPeriod: (routine.targetPeriod as TargetPeriod) ?? null,
            completions: {
              create: completions.map(c => ({
                date: new Date(c.date as string),
                done: (c.done as boolean) ?? true,
                value: c.value != null ? Number(c.value) : null,
                note: (c.note as string) ?? null,
              })),
            },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: routines.length })
  } catch (err) { next(err) }
})

router.post('/citations', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const body = req.body as { version?: string; citations?: Record<string, unknown>[] }

    if (!validateVersion(body as Record<string, unknown>, res)) return
    const citations = body.citations ?? []

    let imported = 0
    let skipped = 0

    await prisma.$transaction(async (tx) => {
      for (const citation of citations) {
        const existing = await tx.citation.findFirst({
          where: {
            userId,
            text: citation.text as string,
            author: (citation.author as string | null) ?? null,
          },
        })

        if (existing) { skipped++; continue }

        const tags = (citation.tags as string[]) ?? []

        await tx.citation.create({
          data: {
            userId,
            text: citation.text as string,
            author: (citation.author as string) ?? null,
            sourceType: (citation.sourceType as SourceType) ?? 'OTHER',
            source: (citation.source as string) ?? null,
            page: citation.page != null ? Number(citation.page) : null,
            chapter: (citation.chapter as string) ?? null,
            comment: (citation.comment as string) ?? null,
            color: (citation.color as string) ?? '#C4775A',
            favorite: (citation.favorite as boolean) ?? false,
            viewCount: (citation.viewCount as number) ?? 0,
            tags: { create: tags.filter(Boolean).map(name => ({ name })) },
          },
        })
        imported++
      }
    })

    res.json({ imported, skipped, total: citations.length })
  } catch (err) { next(err) }
})

export default router
