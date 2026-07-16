import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'

const router = Router()

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

async function searchMet(q: string): Promise<ArtSearchResult[]> {
  try {
    const searchRes = await fetch(
      `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=${encodeURIComponent(q)}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!searchRes.ok) return []
    const searchData = await searchRes.json() as { objectIDs?: number[] }
    const ids = (searchData.objectIDs ?? []).slice(0, 8)

    const objects = await Promise.all(ids.map(async id => {
      try {
        const res = await fetch(
          `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`,
          { signal: AbortSignal.timeout(8000) }
        )
        if (!res.ok) return null
        return await res.json() as MetObject
      } catch { return null }
    }))

    return objects
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
  } catch {
    return []
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

async function searchAic(q: string): Promise<ArtSearchResult[]> {
  try {
    const fields = 'id,title,artist_title,date_display,date_start,medium_display,dimensions,place_of_origin,style_title,image_id'
    const res = await fetch(
      `https://api.artic.edu/api/v1/artworks/search?q=${encodeURIComponent(q)}&fields=${fields}&limit=8`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return []
    const data = await res.json() as { data?: AicObject[]; config?: { iiif_url?: string } }
    const iiifUrl = data.config?.iiif_url

    return (data.data ?? [])
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
  } catch {
    return []
  }
}

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    const [aicResults, metResults] = await Promise.all([searchAic(q), searchMet(q)])
    res.json({ artworks: [...aicResults, ...metResults] })
  } catch (err) {
    next(err)
  }
})

export default router
