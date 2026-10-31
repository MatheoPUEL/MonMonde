import { apiClient } from './client'

export type CoverKind = 'book' | 'artwork'

const ENDPOINTS: Record<CoverKind, (id: string) => string> = {
  book: id => `/api/reading/books/${id}/cover/recover`,
  artwork: id => `/api/art/artworks/${id}/cover/recover`,
}

// One request per cover per page load, shared by every place the same cover is shown
const recoveries = new Map<string, Promise<string | null>>()

/** Asks the server to fetch a cover again after it failed to load. Resolves the new URL,
 *  or null when no source has an image any more. */
export function recoverCover(kind: CoverKind, id: string): Promise<string | null> {
  const key = `${kind}:${id}`
  let pending = recoveries.get(key)
  if (!pending) {
    pending = apiClient<{ coverUrl: string }>(ENDPOINTS[kind](id), { method: 'POST' })
      .then(r => r.coverUrl)
      .catch(() => null)
    recoveries.set(key, pending)
  }
  return pending
}
