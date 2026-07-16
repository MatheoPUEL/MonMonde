import { fetchWikipediaExtract } from './wikipedia'

export interface WikidataArtistResult {
  wikidataId: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  nationality?: string
  photoUrl?: string
}

export interface WikidataArtistCandidate {
  wikidataId: string
  name: string
  description?: string
}

interface WbSearchResponse {
  search?: Array<{ id: string; label?: string; description?: string }>
}

interface WbClaimSnak {
  mainsnak?: {
    datavalue?: {
      value?: { time?: string; id?: string } | string
    }
  }
}

interface WbEntity {
  labels?: Record<string, { value: string }>
  descriptions?: Record<string, { value: string }>
  claims?: Record<string, WbClaimSnak[]>
  sitelinks?: Record<string, { title: string }>
}

interface WbGetEntitiesResponse {
  entities?: Record<string, WbEntity>
}

function parseWikidataYear(time?: string): string | undefined {
  if (!time) return undefined
  const match = time.replace(/^[+-]/, '').match(/^(\d{1,4})/)
  return match ? match[1] : undefined
}

async function fetchJson<T>(url: string): Promise<T | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
  if (!res.ok) return null
  return res.json() as Promise<T>
}

async function fetchLabel(entityId: string): Promise<string | undefined> {
  const data = await fetchJson<WbGetEntitiesResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${entityId}&props=labels&languages=fr|en&format=json&origin=*`
  )
  const labels = data?.entities?.[entityId]?.labels
  return labels?.fr?.value ?? labels?.en?.value
}

/** Fetches a biography, preferring the French Wikipedia extract linked to this Wikidata entity
 *  over the (often English-only) raw description, falling back to English if no French page exists. */
export async function fetchWikidataBio(wikidataId: string): Promise<string | undefined> {
  const data = await fetchJson<WbGetEntitiesResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=sitelinks|descriptions&languages=fr|en&format=json&origin=*`
  )
  const entity = data?.entities?.[wikidataId]
  if (!entity) return undefined

  const sitelink = entity.sitelinks?.frwiki ?? entity.sitelinks?.enwiki
  if (sitelink) {
    const extract = await fetchWikipediaExtract(entity.sitelinks?.frwiki ? 'fr' : 'en', sitelink.title)
    if (extract) return extract
  }

  return entity.descriptions?.fr?.value ?? entity.descriptions?.en?.value
}

/** Returns candidate matches for a name search, so the caller can let the user pick the right one
 *  instead of guessing — Wikidata often has several entities sharing similar/identical labels. */
export async function searchArtistCandidatesOnWikidata(name: string): Promise<WikidataArtistCandidate[]> {
  const search = await fetchJson<WbSearchResponse>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&type=item&format=json&limit=5&origin=*`
  )
  return (search?.search ?? []).map(s => ({
    wikidataId: s.id,
    name: s.label ?? name,
    description: s.description,
  }))
}

export async function fetchArtistByWikidataId(wikidataId: string): Promise<WikidataArtistResult | null> {
  const data = await fetchJson<WbGetEntitiesResponse>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${wikidataId}&props=labels|descriptions|claims|sitelinks&languages=fr|en&format=json&origin=*`
  )
  const entity = data?.entities?.[wikidataId]
  if (!entity) return null

  const name = entity.labels?.fr?.value ?? entity.labels?.en?.value ?? wikidataId

  const birthClaim = entity.claims?.['P569']?.[0]?.mainsnak?.datavalue?.value
  const deathClaim = entity.claims?.['P570']?.[0]?.mainsnak?.datavalue?.value
  const birthDate = typeof birthClaim === 'object' ? parseWikidataYear(birthClaim?.time) : undefined
  const deathDate = typeof deathClaim === 'object' ? parseWikidataYear(deathClaim?.time) : undefined

  const countryClaim = entity.claims?.['P27']?.[0]?.mainsnak?.datavalue?.value
  const countryId = typeof countryClaim === 'object' ? countryClaim?.id : undefined
  const nationality = countryId ? await fetchLabel(countryId) : undefined

  const imageClaim = entity.claims?.['P18']?.[0]?.mainsnak?.datavalue?.value
  const imageFile = typeof imageClaim === 'string' ? imageClaim : undefined
  const photoUrl = imageFile
    ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(imageFile)}?width=400`
    : undefined

  const bio = await fetchWikidataBio(wikidataId)

  return { wikidataId, name, bio, birthDate, deathDate, nationality, photoUrl }
}
