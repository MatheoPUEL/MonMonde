import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const router = Router()

const CACHE_RESULT_LIMIT = 16

export interface ArtSearchResult {
  sourceApi: 'met' | 'aic'
  sourceId: string
  sourceUrl?: string
  title: string
  artist: string
  dateDisplay?: string
  year?: number
  century?: number
  currents: string[]
  themes: string[]
  technique?: string
  medium?: string
  dimensions?: string
  country?: string
  museum: string
  imageUrl?: string
}

function yearToCentury(year?: number): number | undefined {
  if (year == null || year <= 0) return undefined
  return Math.ceil(year / 100)
}

interface MetObject {
  objectID: number
  title?: string
  artistDisplayName?: string
  objectDate?: string
  objectBeginDate?: number
  medium?: string
  dimensions?: string
  country?: string
  repository?: string
  primaryImageSmall?: string
  primaryImage?: string
  objectURL?: string
  tags?: Array<{ term: string }>
}

interface SourceResult {
  results: ArtSearchResult[]
  // false when the source errored/timed out — as opposed to a legitimate
  // zero-match response — so callers know not to trust an empty result as final.
  ok: boolean
}

async function searchMet(q: string): Promise<SourceResult> {
  try {
    const searchRes = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!searchRes.ok) return { results: [], ok: false }
    const searchData = await searchRes.json() as { objectIDs?: number[] }
    const ids = (searchData.objectIDs ?? []).slice(0, 8)

    let anyObjectFailed = false
    const objects = await Promise.all(ids.map(async id => {
      try {
        const res = await fetch(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (!res.ok) { anyObjectFailed = true; return null }
        return await res.json() as MetObject
      } catch { anyObjectFailed = true; return null }
    }))

    const results = objects
      .filter((o): o is MetObject => !!o && !!o.title)
      .map(o => ({
        sourceApi: 'met' as const,
        sourceId: String(o.objectID),
        sourceUrl: o.objectURL,
        title: o.title!,
        artist: o.artistDisplayName || 'Artiste inconnu',
        dateDisplay: o.objectDate,
        year: o.objectBeginDate,
        century: yearToCentury(o.objectBeginDate),
        currents: [],
        themes: (o.tags ?? []).map(t => t.term).slice(0, 5),
        technique: o.medium,
        medium: o.medium,
        dimensions: o.dimensions,
        country: o.country,
        museum: o.repository || 'The Metropolitan Museum of Art',
        imageUrl: o.primaryImage || o.primaryImageSmall,
      }))
    return { results, ok: !anyObjectFailed }
  } catch {
    return { results: [], ok: false }
  }
}

interface AicObject {
  id: number
  title?: string
  artist_title?: string
  date_display?: string
  date_start?: number
  medium_display?: string
  dimensions?: string
  place_of_origin?: string
  style_title?: string
  image_id?: string
}

async function searchAic(q: string): Promise<SourceResult> {
  try {
    const fields = 'id,title,artist_title,date_display,date_start,medium_display,dimensions,place_of_origin,style_title,image_id'
    const res = await fetch(
      `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&fields=${fields}&limit=8`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return { results: [], ok: false }
    const data = await res.json() as { data?: AicObject[]; config?: { iiif_url?: string } }
    const iiifUrl = data.config?.iiif_url

    const results = (data.data ?? [])
      .filter(o => !!o.title)
      .map(o => ({
        sourceApi: 'aic' as const,
        sourceId: String(o.id),
        sourceUrl: `https://www.artic.edu/artworks/${o.id}`,
        title: o.title!,
        artist: o.artist_title || 'Artiste inconnu',
        dateDisplay: o.date_display,
        year: o.date_start,
        century: yearToCentury(o.date_start),
        currents: o.style_title ? [o.style_title] : [],
        themes: [],
        technique: o.medium_display,
        medium: o.medium_display,
        dimensions: o.dimensions,
        country: o.place_of_origin,
        museum: 'Art Institute of Chicago',
        imageUrl: o.image_id && iiifUrl ? `${iiifUrl}/${o.image_id}/full/843,/0/default.jpg` : undefined,
      }))
    return { results, ok: true }
  } catch {
    return { results: [], ok: false }
  }
}

const CACHE_SELECT = {
  sourceApi: true, sourceId: true, sourceUrl: true, title: true, artist: true,
  dateDisplay: true, year: true, century: true, currents: true, themes: true,
  technique: true, medium: true, dimensions: true, country: true, museum: true, imageUrl: true,
} as const

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    // Each word of the query must show up somewhere across title/artist —
    // matching the query as one literal substring would miss almost every
    // real search ("sunflowers van gogh" spans both fields, never one of them).
    const words = q.split(/\s+/).filter(Boolean)

    // Local cache first — Met's object-detail fetches in particular are
    // expensive (one request per result), so a repeat search should be free.
    const cached = await prisma.artworkSearchCache.findMany({
      where: { AND: words.map(w => ({ OR: [{ title: { contains: w, mode: 'insensitive' } }, { artist: { contains: w, mode: 'insensitive' } }] })) },
      select: CACHE_SELECT,
      take: CACHE_RESULT_LIMIT,
      orderBy: { updatedAt: 'desc' },
    })

    if (cached.length > 0) {
      res.json({ artworks: cached.map(c => ({ ...c, sourceApi: c.sourceApi as 'met' | 'aic' })) })
      return
    }

    const [aic, met] = await Promise.all([searchAic(q), searchMet(q)])
    const artworks = [...aic.results, ...met.results]

    // Only cache when both sources actually answered — caching a response
    // where one source merely timed out would permanently freeze an
    // incomplete result set under this query.
    if (artworks.length > 0 && aic.ok && met.ok) {
      await Promise.all(artworks.map(a => prisma.artworkSearchCache.upsert({
        where: { sourceApi_sourceId: { sourceApi: a.sourceApi, sourceId: a.sourceId } },
        update: {
          sourceUrl: a.sourceUrl ?? null,
          title: a.title,
          artist: a.artist,
          dateDisplay: a.dateDisplay ?? null,
          year: a.year ?? null,
          century: a.century ?? null,
          currents: a.currents,
          themes: a.themes,
          technique: a.technique ?? null,
          medium: a.medium ?? null,
          dimensions: a.dimensions ?? null,
          country: a.country ?? null,
          museum: a.museum,
          imageUrl: a.imageUrl ?? null,
        },
        create: {
          sourceApi: a.sourceApi,
          sourceId: a.sourceId,
          sourceUrl: a.sourceUrl ?? null,
          title: a.title,
          artist: a.artist,
          dateDisplay: a.dateDisplay ?? null,
          year: a.year ?? null,
          century: a.century ?? null,
          currents: a.currents,
          themes: a.themes,
          technique: a.technique ?? null,
          medium: a.medium ?? null,
          dimensions: a.dimensions ?? null,
          country: a.country ?? null,
          museum: a.museum,
          imageUrl: a.imageUrl ?? null,
        },
      })))
    }

    res.json({ artworks })
  } catch (err) {
    next(err)
  }
})

export default router
