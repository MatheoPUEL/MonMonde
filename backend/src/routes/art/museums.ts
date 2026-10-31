import { Router } from 'express'
import type { Museum, MuseumVisit } from '@prisma/client'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import {
  geocodeMuseum, locateMuseumByWikidataId, searchMuseumCandidates, GeocodeUnavailableError,
} from '../../lib/museumGeocode'

const router = Router()

router.use(requireAuth)

// Geocoding runs one museum at a time to respect Wikidata/Nominatim rate limits, so a first
// load is capped; the client re-fetches while `pending` is non-zero.
const GEOCODE_BATCH = 8

// Placeholder the art search stores when Wikidata knows no collection — not a real place.
const NOT_A_MUSEUM = new Set(['wikidata'])

type MuseumStatus = 'visited' | 'wishlist' | 'artworks'

function serialize(museum: Museum & { visits: MuseumVisit[] }, artworkCount: number) {
  const { visits, geocodedAt: _geocodedAt, userId: _userId, ...rest } = museum
  const lastVisitAt = visits.reduce<Date | null>((max, v) => (!max || v.date > max ? v.date : max), null)
  const status: MuseumStatus = visits.length > 0 ? 'visited' : museum.wishlist ? 'wishlist' : 'artworks'
  return { ...rest, status, artworkCount, visitCount: visits.length, lastVisitAt }
}

async function artworkCountsByMuseum(userId: string): Promise<Map<string, number>> {
  const groups = await prisma.artwork.groupBy({
    by: ['museum'],
    where: { userId, museum: { not: null } },
    _count: { _all: true },
  })
  const counts = new Map<string, number>()
  for (const g of groups) {
    const name = g.museum?.trim()
    if (!name || NOT_A_MUSEUM.has(name.toLowerCase())) continue
    counts.set(name, (counts.get(name) ?? 0) + g._count._all)
  }
  return counts
}

/** Saves the lookup result — including "not found", so it isn't retried on every load.
 *  A service outage propagates instead, leaving the museum pending for a later attempt. */
async function geocodeAndSave(museum: Museum): Promise<Museum> {
  const location = await geocodeMuseum(museum.name)
  return prisma.museum.update({
    where: { id: museum.id },
    data: {
      geocodedAt: new Date(),
      ...(location && {
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city ?? null,
        country: location.country ?? null,
        wikidataId: location.wikidataId ?? null,
      }),
    },
  })
}

async function findOwned(id: string, userId: string) {
  return prisma.museum.findFirst({ where: { id, userId } })
}

async function detail(id: string, userId: string) {
  const museum = await prisma.museum.findFirst({
    where: { id, userId },
    include: { visits: { orderBy: { date: 'desc' } } },
  })
  if (!museum) return null
  const artworks = await prisma.artwork.findMany({
    where: { userId, museum: museum.name },
    include: { tags: true, artist: true },
    orderBy: { createdAt: 'desc' },
  })
  return { ...serialize(museum, artworks.length), visits: museum.visits, artworks }
}

// GET /api/art/museums — every museum holding one of the user's artworks, plus the ones
// they visited or want to visit. Museums named on artworks are created and placed lazily here.
router.get('/', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const counts = await artworkCountsByMuseum(userId)

    if (counts.size) {
      await prisma.museum.createMany({
        data: [...counts.keys()].map(name => ({ userId, name })),
        skipDuplicates: true,
      })
    }

    const pending = await prisma.museum.findMany({
      where: { userId, geocodedAt: null },
      orderBy: { createdAt: 'asc' },
      take: GEOCODE_BATCH,
    })
    let unavailable = false
    for (const museum of pending) {
      try {
        await geocodeAndSave(museum)
      } catch (err) {
        if (!(err instanceof GeocodeUnavailableError)) throw err
        unavailable = true
        break
      }
    }

    const museums = await prisma.museum.findMany({
      where: { userId },
      include: { visits: true },
      orderBy: { name: 'asc' },
    })

    const visible = museums
      .map(m => ({ museum: serialize(m, counts.get(m.name) ?? 0), geocoded: !!m.geocodedAt }))
      .filter(({ museum: m }) => m.artworkCount > 0 || m.visitCount > 0 || m.wishlist)

    res.json({
      museums: visible.map(v => v.museum),
      // Still to be placed; 0 when the lookup service is down, so the client stops polling
      pending: unavailable ? 0 : visible.filter(v => !v.geocoded).length,
    })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const museum = await detail(req.params.id, req.user!.id)
    if (!museum) { res.status(404).json({ error: 'Museum not found' }); return }
    res.json({ museum })
  } catch (err) { next(err) }
})

// POST /api/art/museums — add a museum by hand (visited or to visit), even with no artworks there
router.post('/', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const { name, wishlist, visitDate } = req.body as { name?: string; wishlist?: boolean; visitDate?: string }
    const trimmed = name?.trim()
    if (!trimmed) { res.status(400).json({ error: 'name is required' }); return }
    if (visitDate && isNaN(Date.parse(visitDate))) { res.status(400).json({ error: 'Invalid visitDate' }); return }

    let museum = await prisma.museum.upsert({
      where: { userId_name: { userId, name: trimmed } },
      create: { userId, name: trimmed, wishlist: !visitDate && !!wishlist },
      update: wishlist !== undefined && !visitDate ? { wishlist } : {},
    })
    if (!museum.geocodedAt) {
      try {
        museum = await geocodeAndSave(museum)
      } catch (err) {
        // Saved without coordinates; the next map load retries the lookup
        if (!(err instanceof GeocodeUnavailableError)) throw err
      }
    }
    if (visitDate) {
      await prisma.museumVisit.create({ data: { museumId: museum.id, date: new Date(visitDate) } })
    }

    res.status(201).json({ museum: await detail(museum.id, userId) })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (!await findOwned(req.params.id, userId)) { res.status(404).json({ error: 'Museum not found' }); return }

    const { wishlist } = req.body as { wishlist?: boolean }
    await prisma.museum.update({
      where: { id: req.params.id },
      data: { ...(wishlist !== undefined && { wishlist: !!wishlist }) },
    })
    res.json({ museum: await detail(req.params.id, userId) })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    if (!await findOwned(req.params.id, req.user!.id)) { res.status(404).json({ error: 'Museum not found' }); return }
    await prisma.museum.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// GET /api/art/museums/:id/locate/candidates — for fixing a museum placed at the wrong spot
router.get('/:id/locate/candidates', async (req, res, next) => {
  try {
    const museum = await findOwned(req.params.id, req.user!.id)
    if (!museum) { res.status(404).json({ error: 'Museum not found' }); return }
    res.json({ candidates: await searchMuseumCandidates(museum.name) })
  } catch (err) {
    if (err instanceof GeocodeUnavailableError) { res.status(502).json({ error: 'Wikidata est indisponible, réessaie dans un instant' }); return }
    next(err)
  }
})

router.post('/:id/locate', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (!await findOwned(req.params.id, userId)) { res.status(404).json({ error: 'Museum not found' }); return }

    const { wikidataId } = req.body as { wikidataId?: string }
    if (!wikidataId) { res.status(400).json({ error: 'wikidataId is required' }); return }

    let location
    try {
      location = await locateMuseumByWikidataId(wikidataId)
    } catch (err) {
      if (!(err instanceof GeocodeUnavailableError)) throw err
      res.status(502).json({ error: 'Wikidata est indisponible, réessaie dans un instant' })
      return
    }
    if (!location) { res.status(422).json({ error: 'Ce lieu n\'a pas de coordonnées sur Wikidata' }); return }

    await prisma.museum.update({
      where: { id: req.params.id },
      data: {
        latitude: location.latitude,
        longitude: location.longitude,
        city: location.city ?? null,
        country: location.country ?? null,
        wikidataId,
        geocodedAt: new Date(),
      },
    })
    res.json({ museum: await detail(req.params.id, userId) })
  } catch (err) { next(err) }
})

router.post('/:id/visits', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (!await findOwned(req.params.id, userId)) { res.status(404).json({ error: 'Museum not found' }); return }

    const { date, note } = req.body as { date?: string; note?: string }
    if (!date || isNaN(Date.parse(date))) { res.status(400).json({ error: 'A valid date is required' }); return }

    await prisma.$transaction([
      prisma.museumVisit.create({ data: { museumId: req.params.id, date: new Date(date), note: note?.trim() || null } }),
      // Once visited, a museum is no longer "to visit"
      prisma.museum.update({ where: { id: req.params.id }, data: { wishlist: false } }),
    ])
    res.status(201).json({ museum: await detail(req.params.id, userId) })
  } catch (err) { next(err) }
})

router.delete('/:id/visits/:visitId', async (req, res, next) => {
  try {
    const userId = req.user!.id
    if (!await findOwned(req.params.id, userId)) { res.status(404).json({ error: 'Museum not found' }); return }

    const visit = await prisma.museumVisit.findFirst({ where: { id: req.params.visitId, museumId: req.params.id } })
    if (!visit) { res.status(404).json({ error: 'Visit not found' }); return }

    await prisma.museumVisit.delete({ where: { id: visit.id } })
    res.json({ museum: await detail(req.params.id, userId) })
  } catch (err) { next(err) }
})

export default router
