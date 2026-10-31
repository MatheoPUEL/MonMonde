import museums from '../data/museums.json'

// Notable museums downloaded from Wikidata (scripts/fetch-museums.ts), most notable first.
// Suggested when adding a museum so its exact name and position come for free.

export interface KnownMuseum {
  wikidataId: string
  name: string
  names: string[]
  city?: string
  country?: string
  latitude: number
  longitude: number
}

export type MuseumSuggestion = Omit<KnownMuseum, 'names'>

/** Lowercase, accent- and punctuation-free, so "Musee d'Orsay" finds "musée d’Orsay". */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

const indexed = (museums as KnownMuseum[]).map(museum => ({
  museum,
  names: museum.names.map(normalize),
}))

const byWikidataId = new Map(indexed.map(({ museum }) => [museum.wikidataId, museum]))

export function knownMuseumById(wikidataId: string): KnownMuseum | undefined {
  return byWikidataId.get(wikidataId)
}

/** Exact match on any known name — used to place museums named on artworks without a lookup. */
export function knownMuseumByName(name: string): KnownMuseum | undefined {
  const q = normalize(name)
  return q ? indexed.find(({ names }) => names.includes(q))?.museum : undefined
}

function score(names: string[], q: string, words: string[]): number {
  let best = 0
  for (const name of names) {
    if (name === q) return 4
    if (name.startsWith(q)) best = Math.max(best, 3)
    else {
      const nameWords = name.split(' ')
      // Every typed word starts a word of the name: "orsay mus" → "musee d orsay"
      if (words.every(w => nameWords.some(n => n.startsWith(w)))) best = Math.max(best, 2)
      else if (name.includes(q)) best = Math.max(best, 1)
    }
  }
  return best
}

// Words a user may type that the museum's own name doesn't carry ("musée des Offices" is filed
// as "galerie des Offices"), so they aren't required to match
const GENERIC_WORDS = new Set([
  'musee', 'museum', 'museo', 'museu', 'galerie', 'gallery', 'galleria', 'galeria',
  'de', 'du', 'des', 'd', 'la', 'le', 'les', 'l', 'of', 'the', 'and', 'et', 'art', 'arts',
])

export function suggestMuseums(query: string, limit = 8): MuseumSuggestion[] {
  const q = normalize(query)
  if (q.length < 2) return []
  const all = q.split(' ')
  const significant = all.filter(w => !GENERIC_WORDS.has(w))
  const words = significant.length ? significant : all
  return indexed
    .map(({ museum, names }, rank) => ({ museum, rank, score: score(names, q, words) }))
    .filter(r => r.score > 0)
    // Best match first; among equals, the most notable museum (the list is ordered by notability)
    .sort((a, b) => b.score - a.score || a.rank - b.rank)
    .slice(0, limit)
    .map(({ museum: { names: _names, ...suggestion } }) => suggestion)
}
