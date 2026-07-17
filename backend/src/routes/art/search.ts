import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const router = Router()

const CACHE_RESULT_LIMIT = 40
const WIKIDATA_UA = 'MonMonde-PersonalApp/1.0'

export interface ArtSearchResult {
  sourceApi: 'met' | 'aic' | 'cma' | 'vaa' | 'wikidata'
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

interface SourceResult {
  results: ArtSearchResult[]
  // false when the source errored/timed out — as opposed to a legitimate
  // zero-match response — so callers know not to trust an empty result as final.
  ok: boolean
}

function yearToCentury(year?: number): number | undefined {
  if (year == null || year <= 0) return undefined
  return Math.ceil(year / 100)
}

// --- The Metropolitan Museum of Art ---------------------------------------

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

// --- Art Institute of Chicago -----------------------------------------------

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

// --- Cleveland Museum of Art -------------------------------------------------

interface CmaObject {
  id: number
  title?: string
  creation_date?: string
  creation_date_earliest?: number
  technique?: string
  measurements?: string
  culture?: string[]
  creators?: Array<{ description?: string }>
  images?: { web?: { url?: string } }
  url?: string
}

async function searchCma(q: string): Promise<SourceResult> {
  try {
    const fields = 'id,title,creation_date,creation_date_earliest,technique,measurements,culture,creators,images,url'
    const res = await fetch(
      `https://openaccess-api.clevelandart.org/api/artworks/?q=${encodeURIComponent(q)}&has_image=1&limit=8&fields=${fields}`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return { results: [], ok: false }
    const data = await res.json() as { data?: CmaObject[] }

    const results = (data.data ?? [])
      .filter(o => !!o.title)
      .map(o => {
        // creators[].description reads like "Alexandre Cabanel (French, 1823–1889)".
        const artistDesc = o.creators?.[0]?.description
        return {
          sourceApi: 'cma' as const,
          sourceId: String(o.id),
          sourceUrl: o.url,
          title: o.title!,
          artist: artistDesc ? artistDesc.split(' (')[0] : 'Artiste inconnu',
          dateDisplay: o.creation_date,
          year: o.creation_date_earliest,
          century: yearToCentury(o.creation_date_earliest),
          currents: [],
          themes: [],
          technique: o.technique,
          medium: o.technique,
          dimensions: o.measurements,
          country: o.culture?.[0],
          museum: 'Cleveland Museum of Art',
          imageUrl: o.images?.web?.url,
        }
      })
    return { results, ok: true }
  } catch {
    return { results: [], ok: false }
  }
}

// --- Victoria and Albert Museum ---------------------------------------------

interface VaaRecord {
  systemNumber: string
  _primaryTitle?: string
  _primaryMaker?: { name?: string }
  _primaryDate?: string
  _primaryPlace?: string
  _images?: { _iiif_image_base_url?: string }
}

// V&A catalogues makers as "Cabanel, Alexandre" — flip to reading order.
function vaaArtistName(raw?: string): string {
  if (!raw) return 'Artiste inconnu'
  const [last, first] = raw.split(', ')
  return first ? `${first} ${last}` : raw
}

async function searchVaa(q: string): Promise<SourceResult> {
  try {
    const res = await fetch(
      `https://api.vam.ac.uk/v2/objects/search?q=${encodeURIComponent(q)}&images_exist=true&page_size=8`,
      { signal: AbortSignal.timeout(8000) }
    )
    if (!res.ok) return { results: [], ok: false }
    const data = await res.json() as { records?: VaaRecord[] }

    const results = (data.records ?? [])
      .filter(r => !!r._primaryTitle)
      .map(r => {
        const yearMatch = r._primaryDate?.match(/\d{4}/)
        const year = yearMatch ? parseInt(yearMatch[0], 10) : undefined
        return {
          sourceApi: 'vaa' as const,
          sourceId: r.systemNumber,
          sourceUrl: `https://collections.vam.ac.uk/item/${r.systemNumber}`,
          title: r._primaryTitle!,
          artist: vaaArtistName(r._primaryMaker?.name),
          dateDisplay: r._primaryDate,
          year,
          century: yearToCentury(year),
          currents: [],
          themes: [],
          technique: undefined,
          medium: undefined,
          dimensions: undefined,
          country: r._primaryPlace,
          museum: 'Victoria and Albert Museum',
          imageUrl: r._images?._iiif_image_base_url ? `${r._images._iiif_image_base_url}full/!800,800/0/default.jpg` : undefined,
        }
      })
    return { results, ok: true }
  } catch {
    return { results: [], ok: false }
  }
}

// --- Wikidata -----------------------------------------------------------------
// Broadest coverage by far (aggregates every museum's own catalogue, including
// the Louvre, Orsay, Uffizi, Prado, National Gallery…) at the cost of messier,
// less complete data than a dedicated museum API.

interface WikidataSnak { mainsnak?: { datavalue?: { value: unknown } } }
interface WikidataEntity {
  labels?: Record<string, { value: string }>
  claims?: Record<string, WikidataSnak[]>
}

function wdFirstValue(entity: WikidataEntity, prop: string): any {
  return entity.claims?.[prop]?.[0]?.mainsnak?.datavalue?.value
}

function wdImageUrl(filename: string, width = 800): string {
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}?width=${width}`
}

async function wikidataFetch<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': WIKIDATA_UA } })
  if (!res.ok) return null
  return await res.json() as T
}

interface SparqlBinding {
  work: { value: string }
  workLabel?: { value: string }
  image?: { value: string }
  collectionLabel?: { value: string }
  inception?: { value: string }
}

// Plain label search won't surface "La Mort de César" from a query of just
// "Camuccini" — a painting's label rarely contains its painter's name — so
// when the query resolves to an artist we separately pull their notable
// works (has an image, in a public collection) straight out of Wikidata.
async function worksByArtist(artistId: string, artistName: string): Promise<ArtSearchResult[]> {
  const query = `SELECT ?work ?workLabel ?image ?collectionLabel ?inception WHERE {
    ?work wdt:P170 wd:${artistId} .
    ?work wdt:P18 ?image .
    OPTIONAL { ?work wdt:P195 ?collection . }
    OPTIONAL { ?work wdt:P571 ?inception . }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
  } LIMIT 16`
  const res = await fetch(`https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`, {
    signal: AbortSignal.timeout(8000),
    headers: { 'User-Agent': WIKIDATA_UA, Accept: 'application/sparql-results+json' },
  })
  if (!res.ok) throw new Error('wikidata sparql request failed')
  const data = await res.json() as { results?: { bindings?: SparqlBinding[] } }

  const seen = new Set<string>()
  const results: ArtSearchResult[] = []
  for (const b of data.results?.bindings ?? []) {
    const id = b.work.value.split('/').pop()!
    const title = b.workLabel?.value
    // An unlabelled entity comes back with its own QID as the "label" — skip it.
    if (!title || /^Q\d+$/.test(title) || seen.has(id)) continue
    seen.add(id)

    const year = b.inception?.value ? parseInt(b.inception.value.slice(0, 4), 10) : undefined
    results.push({
      sourceApi: 'wikidata',
      sourceId: id,
      sourceUrl: `https://www.wikidata.org/wiki/${id}`,
      title,
      artist: artistName,
      dateDisplay: year ? String(year) : undefined,
      year,
      century: yearToCentury(year),
      currents: [],
      themes: [],
      museum: b.collectionLabel?.value ?? 'Wikidata',
      imageUrl: b.image ? `${b.image.value}?width=800` : undefined,
    })
    if (results.length >= 8) break
  }
  return results
}

async function searchWikidata(q: string): Promise<SourceResult> {
  try {
    const searchData = await wikidataFetch<{ search?: Array<{ id: string }> }>(
      `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(q)}&language=fr&type=item&limit=10&format=json`
    )
    if (!searchData) return { results: [], ok: false }
    const ids = (searchData.search ?? []).map(s => s.id)
    if (ids.length === 0) return { results: [], ok: true }

    const entitiesData = await wikidataFetch<{ entities?: Record<string, WikidataEntity> }>(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=claims|labels&languages=fr|en&format=json`
    )
    if (!entitiesData) return { results: [], ok: false }
    const entities = entitiesData.entities ?? {}

    // Only entities that have both a creator and an image plausibly are a
    // displayable artwork — cheaper and more reliable than enumerating every
    // "instance of" subclass (painting, drawing, print, sculpture...) by QID.
    const candidates = ids
      .map(id => [id, entities[id]] as const)
      .filter((e): e is [string, WikidataEntity] => !!e[1] && !!wdFirstValue(e[1], 'P170') && !!wdFirstValue(e[1], 'P18'))

    // Entities that are themselves a human (P31 = Q5) — likely the artist
    // being searched for — whose notable works we fetch separately below.
    const artistCandidates = ids
      .map(id => [id, entities[id]] as const)
      .filter((e): e is [string, WikidataEntity] => !!e[1] && wdFirstValue(e[1], 'P31')?.id === 'Q5')
      .slice(0, 2)

    const refIds = new Set<string>()
    for (const [, e] of candidates) {
      const creator = wdFirstValue(e, 'P170')?.id
      const collection = wdFirstValue(e, 'P195')?.id ?? wdFirstValue(e, 'P276')?.id
      const material = wdFirstValue(e, 'P186')?.id
      if (creator) refIds.add(creator)
      if (collection) refIds.add(collection)
      if (material) refIds.add(material)
    }

    const labelsById: Record<string, string> = {}
    if (refIds.size > 0) {
      const labelsData = await wikidataFetch<{ entities?: Record<string, WikidataEntity> }>(
        `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${[...refIds].join('|')}&props=labels&languages=fr|en&format=json`
      )
      for (const [id, e] of Object.entries(labelsData?.entities ?? {})) {
        labelsById[id] = e.labels?.fr?.value ?? e.labels?.en?.value ?? id
      }
    }

    const results = candidates.map(([id, e]) => {
      const creatorId = wdFirstValue(e, 'P170')?.id as string | undefined
      const collectionId = (wdFirstValue(e, 'P195')?.id ?? wdFirstValue(e, 'P276')?.id) as string | undefined
      const materialId = wdFirstValue(e, 'P186')?.id as string | undefined
      const imageFilename = wdFirstValue(e, 'P18') as string | undefined
      const inceptionTime = wdFirstValue(e, 'P571')?.time as string | undefined
      const year = inceptionTime ? parseInt(inceptionTime.slice(1, 5), 10) : undefined
      const heightAmount = wdFirstValue(e, 'P2048')?.amount as string | undefined
      const widthAmount = wdFirstValue(e, 'P2049')?.amount as string | undefined
      const dimensions = heightAmount && widthAmount
        ? `${Math.abs(parseFloat(heightAmount))} × ${Math.abs(parseFloat(widthAmount))} cm`
        : undefined

      return {
        sourceApi: 'wikidata' as const,
        sourceId: id,
        sourceUrl: `https://www.wikidata.org/wiki/${id}`,
        title: e.labels?.fr?.value ?? e.labels?.en?.value ?? id,
        artist: creatorId ? (labelsById[creatorId] ?? 'Artiste inconnu') : 'Artiste inconnu',
        dateDisplay: year ? String(year) : undefined,
        year,
        century: yearToCentury(year),
        currents: [],
        themes: [],
        technique: materialId ? labelsById[materialId] : undefined,
        medium: materialId ? labelsById[materialId] : undefined,
        dimensions,
        country: undefined,
        museum: collectionId ? (labelsById[collectionId] ?? 'Wikidata') : 'Wikidata',
        imageUrl: imageFilename ? wdImageUrl(imageFilename) : undefined,
      }
    })

    const artistWorkLists = await Promise.all(
      artistCandidates.map(([id, e]) => worksByArtist(id, e.labels?.fr?.value ?? e.labels?.en?.value ?? 'Artiste inconnu'))
    )
    const seenIds = new Set(results.map(r => r.sourceId))
    const artistResults = artistWorkLists.flat().filter(r => !seenIds.has(r.sourceId))

    return { results: [...results, ...artistResults], ok: true }
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

    // Local cache first — Met's object-detail fetches and Wikidata's
    // multi-step lookups in particular are expensive, so a repeat search
    // should be free.
    const cached = await prisma.artworkSearchCache.findMany({
      where: { AND: words.map(w => ({ OR: [{ title: { contains: w, mode: 'insensitive' } }, { artist: { contains: w, mode: 'insensitive' } }] })) },
      select: CACHE_SELECT,
      take: CACHE_RESULT_LIMIT,
      orderBy: { updatedAt: 'desc' },
    })

    if (cached.length > 0) {
      res.json({ artworks: cached.map(c => ({ ...c, sourceApi: c.sourceApi as ArtSearchResult['sourceApi'] })) })
      return
    }

    const [aic, met, cma, vaa, wikidata] = await Promise.all([
      searchAic(q), searchMet(q), searchCma(q), searchVaa(q), searchWikidata(q),
    ])
    // Wikidata leads: its results come from resolving a specific named
    // entity (a title or an artist), so they tend to be more precisely
    // on-target than the museums' own full-text search over everything
    // they hold — worth protecting from truncation first.
    const sources = [wikidata, aic, met, cma, vaa]
    const artworks = sources.flatMap(s => s.results).slice(0, CACHE_RESULT_LIMIT)

    // Only cache when every source actually answered — caching a response
    // where one source merely timed out would permanently freeze an
    // incomplete result set under this query.
    if (artworks.length > 0 && sources.every(s => s.ok)) {
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
