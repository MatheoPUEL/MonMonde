export interface OLAuthorResult {
  olid: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  photoUrl?: string
}

export async function searchAuthorOnOL(name: string): Promise<OLAuthorResult | null> {
  const res = await fetch(
    `https://openlibrary.org/search/authors.json?q=${encodeURIComponent(name)}&limit=5`,
    { signal: AbortSignal.timeout(8000) }
  )
  if (!res.ok) return null

  const data = await res.json() as { docs?: Array<{ key: string; name: string }> }
  const docs = data.docs ?? []

  const match = docs.find(d => d.name.toLowerCase() === name.toLowerCase()) ?? docs[0]
  if (!match) return null

  const olid = match.key.replace('/authors/', '')
  return fetchAuthorDetail(olid)
}

async function fetchAuthorDetail(olid: string): Promise<OLAuthorResult | null> {
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
  }

  const bio = typeof data.bio === 'string' ? data.bio : data.bio?.value
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
