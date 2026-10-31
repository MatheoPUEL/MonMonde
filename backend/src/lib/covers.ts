import crypto from 'crypto'
import fs from 'fs'
import path from 'path'
import { COVERS_DIR } from './upload'

// Covers used to be hotlinked straight from Google Books, museum CDNs and Wikimedia. Those links
// rot or start refusing browsers (the Art Institute of Chicago now puts its images behind a
// Cloudflare bot challenge), so remote covers are copied into uploads/covers and the original
// URL is kept in coverSourceUrl to download it again if the local copy is ever lost.

const USER_AGENT = 'MonMonde/1.0 (https://github.com/MatheoPUEL/MonMonde)'
const MAX_BYTES = 15 * 1024 * 1024
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export function isRemoteUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url)
}

/** Whether a stored cover points at a file we serve that is actually on disk. */
export function localCoverExists(url: string | null | undefined): boolean {
  if (!url?.startsWith('/uploads/covers/')) return false
  return fs.existsSync(path.join(COVERS_DIR, path.basename(url)))
}

async function downloadImage(url: string): Promise<{ data: Buffer; ext: string } | null> {
  const host = new URL(url).hostname
  const headers: Record<string, string> = { 'User-Agent': USER_AGENT, Accept: 'image/*' }
  // AIC lets identified API clients through its bot challenge
  if (host.endsWith('artic.edu')) headers['AIC-User-Agent'] = USER_AGENT

  let res: Response
  try {
    res = await fetch(url, { headers, redirect: 'follow', signal: AbortSignal.timeout(15000) })
  } catch {
    return null
  }
  if (!res.ok) return null

  const type = res.headers.get('content-type')?.split(';')[0].trim().toLowerCase() ?? ''
  const ext = EXTENSIONS[type]
  if (!ext) return null
  // Google Books answers a missing cover with a grey "image not available" PNG; real covers are JPEGs
  if (host.startsWith('books.google') && type === 'image/png') return null

  const data = Buffer.from(await res.arrayBuffer())
  if (!data.length || data.length > MAX_BYTES) return null
  return { data, ext }
}

/** Downloads a remote image into uploads/covers. Resolves the local URL, or null on failure. */
export async function cacheRemoteImage(url: string): Promise<string | null> {
  const image = await downloadImage(url)
  if (!image) return null
  // Named after the source URL, so caching the same image twice reuses one file
  const name = `remote-${crypto.createHash('sha1').update(url).digest('hex').slice(0, 24)}${image.ext}`
  await fs.promises.writeFile(path.join(COVERS_DIR, name), image.data)
  return `/uploads/covers/${name}`
}

interface StoredCover {
  coverUrl: string | null
  coverSourceUrl: string | null
}

/** Turns the cover URL a client sent into the fields to store. A remote URL is copied locally
 *  when possible (and kept as-is when not — recovery will retry later). Resolves {} when the
 *  value is unchanged, e.g. an edit form sending back the source URL it was shown. */
export async function storeCover(
  coverUrl: string | null | undefined,
  existing?: StoredCover,
): Promise<Partial<StoredCover>> {
  if (coverUrl === undefined) return {}
  if (!coverUrl) return { coverUrl: null, coverSourceUrl: null }
  if (!isRemoteUrl(coverUrl)) {
    return coverUrl === existing?.coverUrl ? {} : { coverUrl, coverSourceUrl: null }
  }
  if (coverUrl === existing?.coverSourceUrl && localCoverExists(existing.coverUrl)) return {}
  return { coverUrl: await cacheRemoteImage(coverUrl) ?? coverUrl, coverSourceUrl: coverUrl }
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, 'AIC-User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })
    return res.ok ? await res.json() as T : null
  } catch {
    return null
  }
}

/** Asks the artwork's original source for its current image URL. */
async function artworkImageFromSource(sourceApi: string, sourceId: string): Promise<string | null> {
  const id = encodeURIComponent(sourceId)
  switch (sourceApi) {
    case 'aic': {
      const data = await fetchJson<{ data?: { image_id?: string }; config?: { iiif_url?: string } }>(
        `https://api.artic.edu/api/v1/artworks/${id}?fields=image_id`
      )
      const imageId = data?.data?.image_id
      const iiif = data?.config?.iiif_url ?? 'https://www.artic.edu/iiif/2'
      return imageId ? `${iiif}/${imageId}/full/843,/0/default.jpg` : null
    }
    case 'met': {
      const data = await fetchJson<{ primaryImage?: string; primaryImageSmall?: string }>(
        `https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`
      )
      return data?.primaryImage || data?.primaryImageSmall || null
    }
    case 'cma': {
      const data = await fetchJson<{ data?: { images?: { web?: { url?: string } } } }>(
        `https://openaccess-api.clevelandart.org/api/artworks/${id}?fields=images`
      )
      return data?.data?.images?.web?.url ?? null
    }
    case 'vaa': {
      const data = await fetchJson<{ meta?: { images?: { _iiif_image?: string } } }>(
        `https://api.vam.ac.uk/v2/museumobject/${id}`
      )
      const base = data?.meta?.images?._iiif_image
      return base ? `${base}full/!800,800/0/default.jpg` : null
    }
    case 'wikidata': {
      const data = await fetchJson<{ claims?: { P18?: Array<{ mainsnak?: { datavalue?: { value?: string } } }> } }>(
        `https://www.wikidata.org/w/api.php?action=wbgetclaims&entity=${id}&property=P18&format=json`
      )
      const file = data?.claims?.P18?.[0]?.mainsnak?.datavalue?.value
      return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=800` : null
    }
    default:
      return null
  }
}

async function bookImageFromGoogle(googleBooksId: string): Promise<string | null> {
  const key = process.env.GOOGLE_BOOKS_API_KEY ? `?key=${process.env.GOOGLE_BOOKS_API_KEY}` : ''
  const data = await fetchJson<{ volumeInfo?: { imageLinks?: { thumbnail?: string; smallThumbnail?: string } } }>(
    `https://www.googleapis.com/books/v1/volumes/${encodeURIComponent(googleBooksId)}${key}`
  )
  const links = data?.volumeInfo?.imageLinks
  return (links?.thumbnail ?? links?.smallThumbnail)?.replace(/^http:/, 'https:') ?? null
}

/** Tries each candidate in order, lazily: later ones may cost an API call to resolve. */
async function firstCached(candidates: Array<string | null | undefined | (() => Promise<string | null>)>): Promise<StoredCover | null> {
  const tried = new Set<string>()
  for (const candidate of candidates) {
    const url = typeof candidate === 'function' ? await candidate() : candidate
    if (!isRemoteUrl(url) || tried.has(url)) continue
    tried.add(url)
    const local = await cacheRemoteImage(url)
    if (local) return { coverUrl: local, coverSourceUrl: url }
  }
  return null
}

export interface BookCoverSource extends StoredCover {
  googleBooksId: string | null
  isbn: string | null
}

export interface ArtworkCoverSource extends StoredCover {
  sourceApi: string | null
  sourceId: string | null
}

/** Finds a working image for a book whose cover no longer loads. Null when nothing was found. */
export function recoverBookCover(book: BookCoverSource): Promise<StoredCover | null> {
  const isbn = book.isbn?.replace(/[^\dX]/gi, '')
  return firstCached([
    book.coverSourceUrl,
    book.coverUrl,
    book.googleBooksId ? () => bookImageFromGoogle(book.googleBooksId!) : null,
    // default=false makes Open Library answer 404 instead of a blank image
    isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : null,
  ])
}

/** Finds a working image for an artwork whose cover no longer loads. Null when nothing was found. */
export function recoverArtworkCover(artwork: ArtworkCoverSource): Promise<StoredCover | null> {
  return firstCached([
    artwork.coverSourceUrl,
    artwork.coverUrl,
    artwork.sourceApi && artwork.sourceId
      ? () => artworkImageFromSource(artwork.sourceApi!, artwork.sourceId!)
      : null,
  ])
}
