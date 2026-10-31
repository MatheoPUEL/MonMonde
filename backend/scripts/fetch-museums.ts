/**
 * Regenerates src/data/museums.json — the list of notable museums suggested when adding one,
 * so users pick an exact, already-placed entry instead of guessing the spelling.
 *
 * Notability = number of Wikipedia editions with an article (Wikidata sitelinks).
 * Run with: npx tsx scripts/fetch-museums.ts
 */
import fs from 'fs'
import path from 'path'
import { locateEntities } from '../src/lib/museumGeocode'

const USER_AGENT = 'MonMonde/1.0 (https://github.com/MatheoPUEL/MonMonde)'
const MIN_SITELINKS = 10
const MAX_MUSEUMS = 2500

// Art museum, art gallery, art museum (building), national museum, contemporary art museum,
// public art gallery, museum of fine arts, modern art museum
const TYPES = ['Q207694', 'Q1007870', 'Q17431399', 'Q2668072', 'Q3329412', 'Q2772772', 'Q1060829', 'Q10624527']

export interface KnownMuseum {
  wikidataId: string
  name: string
  /** Every French/English label and alias, for matching what the user types */
  names: string[]
  city?: string
  country?: string
  latitude: number
  longitude: number
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return res.json() as Promise<T>
}

async function notableMuseumIds(): Promise<string[]> {
  const query = `
    SELECT ?m (MAX(?l) AS ?links) WHERE {
      VALUES ?type { ${TYPES.map(t => `wd:${t}`).join(' ')} }
      ?m wdt:P31 ?type ; wikibase:sitelinks ?l .
      FILTER(?l >= ${MIN_SITELINKS})
    } GROUP BY ?m ORDER BY DESC(?links) LIMIT ${MAX_MUSEUMS}`
  const data = await getJson<{ results: { bindings: Array<{ m: { value: string } }> } }>(
    `https://query.wikidata.org/sparql?query=${encodeURIComponent(query)}&format=json`
  )
  return data.results.bindings.map(b => b.m.value.split('/').pop()!)
}

interface Entity {
  labels?: Record<string, { value: string }>
  aliases?: Record<string, Array<{ value: string }>>
}

async function namesOf(ids: string[]): Promise<Record<string, Entity>> {
  const data = await getJson<{ entities: Record<string, Entity> }>(
    `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${ids.join('|')}&props=labels|aliases&languages=fr|en&format=json`
  )
  return data.entities
}

async function main() {
  const ids = await notableMuseumIds()
  console.log(`${ids.length} notable museums`)

  const museums: KnownMuseum[] = []
  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50)
    const [locations, entities] = await Promise.all([locateEntities(batch), namesOf(batch)])
    for (const id of batch) {
      const location = locations.get(id)
      const entity = entities[id]
      const label = entity?.labels?.fr?.value ?? entity?.labels?.en?.value
      if (!location || !label) continue
      // French labels are lowercase by Wikidata convention ("musée d'Orsay")
      const name = label[0].toUpperCase() + label.slice(1)
      const names = new Set([
        label,
        ...Object.values(entity.labels ?? {}).map(l => l.value),
        ...Object.values(entity.aliases ?? {}).flat().map(a => a.value),
      ])
      museums.push({
        wikidataId: id,
        name,
        names: [...names],
        city: location.city,
        country: location.country,
        latitude: Math.round(location.latitude * 1e5) / 1e5,
        longitude: Math.round(location.longitude * 1e5) / 1e5,
      })
    }
    process.stdout.write(`\r${Math.min(i + 50, ids.length)}/${ids.length}`)
    await sleep(500)
  }

  const out = path.join(__dirname, '../src/data/museums.json')
  fs.writeFileSync(out, JSON.stringify(museums) + '\n')
  console.log(`\nWrote ${museums.length} museums to ${path.relative(process.cwd(), out)}`)
}

main().catch(err => { console.error(err); process.exit(1) })
