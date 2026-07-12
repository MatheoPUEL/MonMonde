import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'

function now() {
  return new Date().toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapEntry(e: any) {
  return {
    id: e.id,
    title: e.title,
    content: e.content,
    contentText: e.contentText,
    mood: e.mood,
    favorite: e.favorite,
    pinned: e.pinned,
    draft: e.draft,
    tags: e.tags.map((t: any) => t.name),
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapBook(b: any) {
  return {
    id: b.id,
    title: b.title,
    author: b.author,
    synopsis: b.synopsis,
    isbn: b.isbn,
    pageCount: b.pageCount,
    genres: b.genres,
    coverUrl: b.coverUrl,
    coverType: b.coverType,
    googleBooksId: b.googleBooksId,
    status: b.status,
    owned: b.owned,
    rating: b.rating,
    review: b.review,
    favorite: b.favorite,
    rereadCount: b.rereadCount,
    currentPage: b.currentPage,
    startedAt: b.startedAt?.toISOString() ?? null,
    finishedAt: b.finishedAt?.toISOString() ?? null,
    tags: b.tags.map((t: any) => t.name),
    notes: b.notes.map((n: any) => ({
      id: n.id,
      title: n.title,
      content: n.content,
      chapter: n.chapter,
      page: n.page,
      createdAt: n.createdAt.toISOString(),
      updatedAt: n.updatedAt.toISOString(),
    })),
    createdAt: b.createdAt.toISOString(),
    updatedAt: b.updatedAt.toISOString(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapRoutine(r: any) {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    type: r.type,
    category: r.category,
    color: r.color,
    icon: r.icon,
    rruleString: r.rruleString,
    startDate: r.startDate.toISOString(),
    endDate: r.endDate?.toISOString() ?? null,
    active: r.active,
    hasQuantity: r.hasQuantity,
    unit: r.unit,
    targetCount: r.targetCount,
    targetPeriod: r.targetPeriod,
    completions: r.completions.map((c: any) => ({
      date: c.date.toISOString(),
      done: c.done,
      value: c.value,
      note: c.note,
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapCitation(c: any) {
  return {
    id: c.id,
    text: c.text,
    author: c.author,
    sourceType: c.sourceType,
    source: c.source,
    page: c.page,
    chapter: c.chapter,
    comment: c.comment,
    color: c.color,
    favorite: c.favorite,
    viewCount: c.viewCount,
    tags: c.tags.map((t: any) => t.name),
    createdAt: c.createdAt.toISOString(),
    updatedAt: c.updatedAt.toISOString(),
  }
}

const router = Router()
router.use(requireAuth)

router.get('/journal', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const entries = await prisma.journalEntry.findMany({
      where: { userId },
      include: { tags: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'journal',
      entries: entries.map(mapEntry),
    })
  } catch (err) { next(err) }
})

router.get('/reading', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const books = await prisma.book.findMany({
      where: { userId },
      include: { tags: true, notes: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'reading',
      books: books.map(mapBook),
    })
  } catch (err) { next(err) }
})

router.get('/routines', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const routines = await prisma.routine.findMany({
      where: { userId },
      include: { completions: { orderBy: { date: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'routines',
      routines: routines.map(mapRoutine),
    })
  } catch (err) { next(err) }
})

router.get('/citations', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const citations = await prisma.citation.findMany({
      where: { userId },
      include: { tags: true },
      orderBy: { createdAt: 'asc' },
    })

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'citations',
      citations: citations.map(mapCitation),
    })
  } catch (err) { next(err) }
})

router.get('/all', async (req, res, next) => {
  try {
    const userId = req.user!.id

    const [entries, books, routines, citations] = await Promise.all([
      prisma.journalEntry.findMany({ where: { userId }, include: { tags: true }, orderBy: { createdAt: 'asc' } }),
      prisma.book.findMany({ where: { userId }, include: { tags: true, notes: true }, orderBy: { createdAt: 'asc' } }),
      prisma.routine.findMany({ where: { userId }, include: { completions: { orderBy: { date: 'asc' } } }, orderBy: { createdAt: 'asc' } }),
      prisma.citation.findMany({ where: { userId }, include: { tags: true }, orderBy: { createdAt: 'asc' } }),
    ])

    res.json({
      exportedAt: now(),
      version: '1',
      module: 'all',
      journal: { entries: entries.map(mapEntry) },
      reading: { books: books.map(mapBook) },
      routines: { routines: routines.map(mapRoutine) },
      citations: { citations: citations.map(mapCitation) },
    })
  } catch (err) { next(err) }
})

export default router
