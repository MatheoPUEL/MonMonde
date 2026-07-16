import { apiClient } from './client'

export type ArtworkMediaType = 'IMAGE' | 'PDF' | 'VIDEO' | 'AUDIO' | 'OTHER'

export interface ArtworkTag {
  id: string
  name: string
}

export interface ArtworkNote {
  id: string
  artworkId: string
  title: string
  content: string
  createdAt: string
  updatedAt: string
}

export interface ArtworkMedia {
  id: string
  artworkId: string
  type: ArtworkMediaType
  url: string
  filename: string
  originalName?: string
  mimeType?: string
  size?: number
  caption?: string
  createdAt: string
}

export interface Artist {
  id: string
  userId: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  nationality?: string
  photoUrl?: string
  wikidataId?: string
  artworkCount?: number
  artworks?: Artwork[]
  createdAt: string
  updatedAt: string
}

export interface Artwork {
  id: string
  userId: string
  title: string
  artist: Artist
  dateDisplay?: string
  year?: number
  century?: number
  period?: string
  movements: string[]
  currents: string[]
  themes: string[]
  technique?: string
  medium?: string
  dimensions?: string
  country?: string
  museum?: string
  description?: string
  review?: string
  coverUrl?: string
  coverType?: string
  sourceApi?: string
  sourceId?: string
  sourceUrl?: string
  favorite: boolean
  tags: ArtworkTag[]
  notes?: ArtworkNote[]
  media?: ArtworkMedia[]
  createdAt: string
  updatedAt: string
}

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

export type ArtworkInput = Partial<Omit<Artwork, 'artist' | 'tags'>> & {
  title: string
  artistName: string
  tags?: string[]
}

export const artApi = {
  search: (q: string) =>
    apiClient<{ artworks: ArtSearchResult[] }>(`/api/art/search?q=${encodeURIComponent(q)}`),

  getArtworks: (params?: {
    search?: string
    favorite?: boolean
    artistId?: string
    movement?: string
    current?: string
    theme?: string
    century?: number
    country?: string
    tag?: string
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.favorite) q.set('favorite', 'true')
    if (params?.artistId) q.set('artistId', params.artistId)
    if (params?.movement) q.set('movement', params.movement)
    if (params?.current) q.set('current', params.current)
    if (params?.theme) q.set('theme', params.theme)
    if (params?.century) q.set('century', String(params.century))
    if (params?.country) q.set('country', params.country)
    if (params?.tag) q.set('tag', params.tag)
    const qs = q.toString()
    return apiClient<{ artworks: Artwork[] }>(`/api/art/artworks${qs ? `?${qs}` : ''}`)
  },

  getArtwork: (id: string) =>
    apiClient<{ artwork: Artwork }>(`/api/art/artworks/${id}`),

  createArtwork: (data: ArtworkInput) =>
    apiClient<{ artwork: Artwork }>('/api/art/artworks', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateArtwork: (id: string, data: Partial<Omit<Artwork, 'tags' | 'artist'>> & { artistName?: string; tags?: string[] }) =>
    apiClient<{ artwork: Artwork }>(`/api/art/artworks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteArtwork: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/art/artworks/${id}`, { method: 'DELETE' }),

  uploadCover: async (id: string, file: File): Promise<{ artwork: Artwork; coverUrl: string }> => {
    const form = new FormData()
    form.append('cover', file)
    const res = await fetch(`/api/art/artworks/${id}/cover`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(body.error || 'Upload failed')
    }
    return res.json()
  },

  uploadMedia: async (id: string, files: File[]): Promise<{ media: ArtworkMedia[] }> => {
    const form = new FormData()
    files.forEach(f => form.append('files', f))
    const res = await fetch(`/api/art/artworks/${id}/media`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: 'Upload failed' }))
      throw new Error(body.error || 'Upload failed')
    }
    return res.json()
  },

  deleteMedia: (id: string, mediaId: string) =>
    apiClient<{ ok: boolean }>(`/api/art/artworks/${id}/media/${mediaId}`, { method: 'DELETE' }),

  getNotes: (artworkId: string) =>
    apiClient<{ notes: ArtworkNote[] }>(`/api/art/artworks/${artworkId}/notes`),

  createNote: (artworkId: string, data: { title: string; content: string }) =>
    apiClient<{ note: ArtworkNote }>(`/api/art/artworks/${artworkId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNote: (artworkId: string, noteId: string, data: Partial<Pick<ArtworkNote, 'title' | 'content'>>) =>
    apiClient<{ note: ArtworkNote }>(`/api/art/artworks/${artworkId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNote: (artworkId: string, noteId: string) =>
    apiClient<{ ok: boolean }>(`/api/art/artworks/${artworkId}/notes/${noteId}`, { method: 'DELETE' }),
}

export interface WikidataArtistCandidate {
  wikidataId: string
  name: string
  description?: string
}

export const artistsApi = {
  getAll: (params?: { search?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return apiClient<{ artists: Artist[] }>(`/api/art/artists${qs ? `?${qs}` : ''}`)
  },

  getOne: (id: string) =>
    apiClient<{ artist: Artist }>(`/api/art/artists/${id}`),

  update: (id: string, data: Partial<Pick<Artist, 'name' | 'bio' | 'birthDate' | 'deathDate' | 'nationality' | 'photoUrl'>>) =>
    apiClient<{ artist: Artist }>(`/api/art/artists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getEnrichCandidates: (id: string) =>
    apiClient<{ candidates: WikidataArtistCandidate[] }>(`/api/art/artists/${id}/enrich/candidates`),

  enrich: (id: string, wikidataId: string) =>
    apiClient<{ artist: Artist }>(`/api/art/artists/${id}/enrich`, {
      method: 'POST',
      body: JSON.stringify({ wikidataId }),
    }),
}
