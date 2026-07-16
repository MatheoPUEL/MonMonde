import { Router } from 'express'
import { requireAuth } from '../middleware/auth'
import { prisma } from '../lib/prisma'

// Cross-entity search over the user's own saved data.
// Not to be confused with /api/reading/search or /api/art/search, which
// query external catalogs (Google Books, Met, AIC) to find items to add.

const router = Router()
router.use(requireAuth)

const RESULT_LIMIT = 6

const EMPTY_RESULTS = {
  books: [],
  authors: [],
  citations: [],
  artworks: [],
  artists: [],
  entries: [],
  routines: [],
}

router.get('/', async (req, res, next) => {
  try {
    const q = ((req.query.q as string) || '').trim()
    if (q.length < 2) {
      res.json({ results: EMPTY_RESULTS })
      return
    }

    const userId = req.user!.id
    const contains = { contains: q, mode: 'insensitive' as const }

    const [books, authors, citations, artworks, artists, entries, routines] = await Promise.all([
      prisma.book.findMany({
        where: { userId, OR: [{ title: contains }, { author: { name: contains } }, { isbn: contains }] },
        select: { id: true, title: true, coverUrl: true, author: { select: { name: true } } },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.author.findMany({
        where: { userId, name: contains },
        select: { id: true, name: true, photoUrl: true },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.citation.findMany({
        where: { userId, OR: [{ text: contains }, { author: contains }, { source: contains }, { comment: contains }] },
        select: { id: true, text: true, author: true },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.artwork.findMany({
        where: { userId, OR: [{ title: contains }, { artist: { name: contains } }, { museum: contains }] },
        select: { id: true, title: true, coverUrl: true, artist: { select: { name: true } } },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.artist.findMany({
        where: { userId, name: contains },
        select: { id: true, name: true, photoUrl: true },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.journalEntry.findMany({
        where: { userId, OR: [{ title: contains }, { contentText: contains }] },
        select: { id: true, title: true },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.routine.findMany({
        where: { userId, OR: [{ name: contains }, { category: contains }] },
        select: { id: true, name: true, icon: true },
        take: RESULT_LIMIT,
        orderBy: { createdAt: 'desc' },
      }),
    ])

    res.json({
      results: {
        books: books.map(b => ({ id: b.id, title: b.title, subtitle: b.author.name, coverUrl: b.coverUrl })),
        authors: authors.map(a => ({ id: a.id, title: a.name, coverUrl: a.photoUrl })),
        citations: citations.map(c => ({ id: c.id, title: c.text.slice(0, 80), subtitle: c.author })),
        artworks: artworks.map(a => ({ id: a.id, title: a.title, subtitle: a.artist.name, coverUrl: a.coverUrl })),
        artists: artists.map(a => ({ id: a.id, title: a.name, coverUrl: a.photoUrl })),
        entries: entries.map(e => ({ id: e.id, title: e.title || 'Sans titre' })),
        routines: routines.map(r => ({ id: r.id, title: r.name, icon: r.icon })),
      },
    })
  } catch (err) {
    next(err)
  }
})

export default router
