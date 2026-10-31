export interface MuseumLocation {
  latitude: number
  longitude: number
  city?: string
  country?: string
  wikidataId?: string
}

export interface MuseumCandidate {
  wikidataId: string
  name: string
  description?: string
}

/** A lookup service failed or rate-limited us — unlike "not found", worth retrying later. */
export class GeocodeUnavailableError extends Error {}

interface WbSearchResponse {
  search?: Array<{ id: string; label?: string; description?: string }>
}

interface SparqlResponse {
  results?: { bindings?: Array<Record<string, { value: string } | undefined>> }
}

// Wikimedia throttles anonymous-looking clients much harder; its policy asks for a contact URL.
const USER_AGENT = 'MonMonde/1.0 (https://github.com/MatheoPUEL/MonMonde)'

async function fetchJson<T>(url: string): Promise<T> {
  let res: Response
  try {
    res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
  } catch (err) {
    throw new GeocodeUnavailableError((err as Error).message)
  }
  if (!res.ok) throw new GeocodeUnavailableError(`${new URL(url).host} answered ${res.status}`)
  return await res.json() as T
}

async function searchWikidata(name: string, limit: number) {
  const data = await fetchJson<WbSearchResponse>(
    `https://www.wikidata.org/w/api.php?action=wbsearchentities&search=${encodeURIComponent(name)}&language=fr&uselang=fr&type=item&limit=${limit}&format=json`
  )
  return data.search ?? []
}

// City-like types, so that a museum filed under "7e arrondissement" or "Manhattan" shows
// "Paris" or "New York" — the nearest administrative area is used when none matches.
const CITY_TYPES = ['Q515', 'Q1549591', 'Q5119', 'Q1637706', 'Q200250'].map(q => `wd:${q}`).join(' ')

/** Locates every given entity in one SPARQL query; entities without coordinates are absent. */
export async function locateEntities(ids: string[]): Promise<Map<string, MuseumLocation>> {
  const located = new Map<string, MuseumLocation>()
  if (!ids.length) return located

  const query = `
    SELECT ?item ?coord ?cityLabel ?areaLabel ?countryLabel WHERE {
      VALUES ?item { ${ids.map(id => `wd:${id}`).join(' ')} }
      ?item wdt:P625 ?coord .
      OPTIONAL { ?item wdt:P131* ?city . ?city wdt:P31 ?cityType . VALUES ?cityType { ${CITY_TYPES} } }
      OPTIONAL { ?item wdt:P131 ?area . }
      OPTIONAL { ?item wdt:P17 ?country . }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "fr,en". }
    }`
  const data = await fetchJson<SparqlResponse>(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
  )

  for (const row of data.results?.bindings ?? []) {
    const id = row.item?.value.split('/').pop()
    const point = row.coord?.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/)
    if (!id || !point) continue
    const existing = located.get(id)
    if (existing?.city && row.cityLabel) continue
    located.set(id, {
      latitude: Number(point[2]),
      longitude: Number(point[1]),
      city: row.cityLabel?.value ?? existing?.city ?? row.areaLabel?.value,
      country: row.countryLabel?.value ?? existing?.country,
      wikidataId: id,
    })
  }
  return located
}

/** Resolves a Wikidata entity to coordinates plus city and country labels. */
export async function locateMuseumByWikidataId(wikidataId: string): Promise<MuseumLocation | null> {
  return (await locateEntities([wikidataId])).get(wikidataId) ?? null
}

/** Candidates shown to the user when the automatic placement picked the wrong place. */
export async function searchMuseumCandidates(name: string): Promise<MuseumCandidate[]> {
  return (await searchWikidata(name, 8)).map(s => ({
    wikidataId: s.id,
    name: s.label ?? name,
    description: s.description,
  }))
}

async function geocodeWithNominatim(name: string): Promise<MuseumLocation | null> {
  const results = await fetchJson<Array<{
    lat: string
    lon: string
    address?: { city?: string; town?: string; village?: string; country?: string }
  }>>(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(name)}&format=json&limit=1&addressdetails=1&accept-language=fr`
  )
  const hit = results[0]
  if (!hit) return null
  return {
    latitude: Number(hit.lat),
    longitude: Number(hit.lon),
    city: hit.address?.city ?? hit.address?.town ?? hit.address?.village,
    country: hit.address?.country,
  }
}

/** Best-effort placement from a free-text museum name: the best-ranked Wikidata match that has
 *  coordinates wins (museum names are distinctive enough that this is usually right), with
 *  OpenStreetMap as a fallback for small institutions Wikidata doesn't geolocate.
 *  Resolves null when nothing matches; throws GeocodeUnavailableError when a service is down. */
export async function geocodeMuseum(name: string): Promise<MuseumLocation | null> {
  const ids = (await searchWikidata(name, 5)).map(s => s.id)
  const located = await locateEntities(ids)
  const best = ids.find(id => located.has(id))
  if (best) return located.get(best)!
  return geocodeWithNominatim(name)
}
