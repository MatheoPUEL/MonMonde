import { fetchWikidataBio } from './wikidata'

export interface OLAuthorResult {
  olid: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  photoUrl?: string
}

export interface OLAuthorCandidate {
  olid: string
  name: string
  birthDate?: string
  deathDate?: string
  workCount?: number
  topWork?: string
}

/** Returns candidate matches for a name search, so the caller can let the user pick the right one
 *  instead of guessing — Open Library often has near-duplicate stub entries for the same person. */
export async function searchAuthorCandidatesOnOL(name: string): Promise<OLAuthorCandidate[]> {
  const res = await fetch(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=5`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return []

  const data = await res.json() as {
    docs?: Array<{
      key: string
      name: string
      birth_date?: string
      death_date?: string
      work_count?: number
      top_work?: string
    }>
  }

  return (data.docs ?? []).map(d => ({
    olid: d.key.replace('/authors/', ''),
    name: d.name,
    birthDate: d.birth_date,
    deathDate: d.death_date,
    workCount: d.work_count,
    topWork: d.top_work,
  }))
}

export async function fetchAuthorByOlid(olid: string): Promise<OLAuthorResult | null> {
  const res = await fetch(
    `https://openlibrary.org/authors/${olid}.json`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null

  const data = await res.json() as {
    name?: string
    bio?: string | { value: string }
    birth_date?: string
    death_date?: string
    photos?: number[]
    remote_ids?: { wikidata?: string }
  }

  let bio = typeof data.bio === 'string' ? data.bio : data.bio?.value
  // Open Library bios are usually English-only; prefer the French Wikipedia
  // extract for the same person when Open Library links to a Wikidata entity.
  if (data.remote_ids?.wikidata) {
    const frenchBio = await fetchWikidataBio(data.remote_ids.wikidata)
    if (frenchBio) bio = frenchBio
  }

  const photoUrl = data.photos?.[0]
    ? `https://covers.openlibrary.org/a/olid/${olid}-L.jpg`
    : undefined

  return {
    olid,
    name: data.name ?? '',
    bio,
    birthDate: data.birth_date,
    deathDate: data.death_date,
    photoUrl,
  }
}
