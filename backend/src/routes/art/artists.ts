import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { searchArtistCandidatesOnWikidata, fetchArtistByWikidataId } from '../../lib/wikidata'

const router = Router()
router.use(requireAuth)

router.get('/', async (req, res, next) => {
  try {
    const { search } = req.query as Record<string, string>

    const artists = await prisma.artist.findMany({
      where: {
        userId: req.user!.id,
        artworks: { some: {} },
        ...(search ? { name: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: { _count: { select: { artworks: true } } },
      orderBy: { name: 'asc' },
    })

    res.json({
      artists: artists.map(({ _count, ...a }) => ({
        ...a,
        artworkCount: _count.artworks,
      })),
    })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const artist = await prisma.artist.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        artworks: {
          include: { tags: true, artist: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    if (!artist) { res.status(404).json({ error: 'Artist not found' }); return }

    res.json({ artist })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.artist.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Artist not found' }); return }

    const { name, bio, birthDate, deathDate, nationality, photoUrl } = req.body

    const artist = await prisma.artist.update({
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
    res.json({ artist })
  } catch (err) { next(err) }
})

// GET /api/art/artists/:id/enrich/candidates — search results for the user to pick from
router.get('/:id/enrich/candidates', async (req, res, next) => {
  try {
    const existing = await prisma.artist.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Artist not found' }); return }

    const candidates = await searchArtistCandidatesOnWikidata(existing.name)
    res.json({ candidates })
  } catch (err) { next(err) }
})

router.post('/:id/enrich', async (req, res, next) => {
  try {
    const existing = await prisma.artist.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!existing) { res.status(404).json({ error: 'Artist not found' }); return }

    const { wikidataId } = req.body as { wikidataId?: string }
    if (!wikidataId) { res.status(400).json({ error: 'wikidataId is required' }); return }

    const result = await fetchArtistByWikidataId(wikidataId)
    if (!result) {
      res.status(404).json({ error: 'Artist not found on Wikidata' })
      return
    }

    const artist = await prisma.artist.update({
      where: { id: req.params.id },
      data: {
        ...(result.bio ? { bio: result.bio } : {}),
        ...(result.photoUrl ? { photoUrl: result.photoUrl } : {}),
        ...(result.wikidataId ? { wikidataId: result.wikidataId } : {}),
        ...(result.nationality ? { nationality: result.nationality } : {}),
        ...(result.birthDate ? { birthDate: parseDateLoose(result.birthDate) } : {}),
        ...(result.deathDate ? { deathDate: parseDateLoose(result.deathDate) } : {}),
      },
      include: {
        artworks: {
          include: { tags: true, artist: true },
          orderBy: { createdAt: 'desc' },
        },
      },
    })
    res.json({ artist })
  } catch (err) { next(err) }
})

function parseDateLoose(dateStr: string): Date | null {
  const year = parseInt(dateStr.replace(/\D.*/, ''), 10)
  if (isNaN(year)) return null
  return new Date(Date.UTC(year, 0, 1))
}

export default router
