import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { searchAuthorCandidatesOnOL, fetchAuthorByOlid } from '../../lib/openlibrary'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query as Record<string, string>

    const authors = await prisma.author.findMany({
      where: {
        userId: req.user!.id,
        books: { some: {} },
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { books: true } } },
      orderBy: { name: 'asc' },
    })

    res.json({
      authors: authors.map(({ _count, ...a }) => ({
        ...a,
        bookCount: _count.books,
      })),
    })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const author = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        books: {
          include: { tags: true, author: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!author) { res.status(404).json({ error: 'Author not found' }); return }

    const ratedBooks = author.books.filter(b => b.rating != null)
    const avgRating = ratedBooks.length > 0
      ? ratedBooks.reduce((sum, b) => sum + b.rating!, 0) / ratedBooks.length
      : null

    res.json({ author: { ...author, avgRating } })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Author not found' }); return }

    const { name, bio, birthDate, deathDate, nationality, photoUrl } = req.body

    const author = await prisma.author.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(bio !== undefined && { bio }),
        ...(birthDate !== undefined && { birthDate: birthDate ? new Date(birthDate) : null }),
        ...(deathDate !== undefined && { deathDate: deathDate ? new Date(deathDate) : null }),
        ...(nationality !== undefined && { nationality }),
        ...(photoUrl !== undefined && { photoUrl }),
      },
    })
    res.json({ author })
  } catch (err) { next(err) }
})

// GET /api/reading/authors/:id/enrich/candidates — search results for the user to pick from
router.get('/:id/enrich/candidates', async (req, res, next) => {
  try {
    const existing = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Author not found' }); return }

    const candidates = await searchAuthorCandidatesOnOL(existing.name)
    res.json({ candidates })
  } catch (err) { next(err) }
})

router.post('/:id/enrich', async (req, res, next) => {
  try {
    const existing = await prisma.author.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Author not found' }); return }

    const { olid } = req.body as { olid?: string }
    if (!olid) { res.status(400).json({ error: 'olid is required' }); return }

    const result = await fetchAuthorByOlid(olid)
    if (!result) {
      res.status(404).json({ error: 'Author not found on Open Library' })
      return
    }

    const author = await prisma.author.update({
      where: { id: req.params.id },
      data: {
        ...(result.bio ? { bio: result.bio } : {}),
        ...(result.photoUrl ? { photoUrl: result.photoUrl } : {}),
        ...(result.olid ? { openLibraryId: result.olid } : {}),
        ...(result.birthDate ? { birthDate: parseDateLoose(result.birthDate) } : {}),
        ...(result.deathDate ? { deathDate: parseDateLoose(result.deathDate) } : {}),
      },
      include: {
        books: {
          include: { tags: true, author: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    const ratedBooks = author.books.filter(b => b.rating != null)
    const avgRating = ratedBooks.length > 0
      ? ratedBooks.reduce((sum, b) => sum + b.rating!, 0) / ratedBooks.length
      : null

    res.json({ author: { ...author, avgRating } })
  } catch (err) { next(err) }
})

function parseDateLoose(dateStr: string): Date | null {
  const year = parseInt(dateStr.replace(/\D.*/, ''), 10)
  if (isNaN(year)) return null
  return new Date(Date.UTC(year, 0, 1))
}

export default router
