import { apiClient } from './client'
import type { Author } from './reading'

export type SourceType =
  | 'BOOK' | 'ARTICLE' | 'INTERNET' | 'PODCAST'
  | 'FILM' | 'SERIES' | 'VIDEO' | 'PERSON' | 'OTHER'

export interface CitationTag {
  id: string
  name: string
}

export interface CitationBook {
  id: string
  title: string
  author: Author
  coverUrl?: string
}

export interface Citation {
  id: string
  userId: string
  text: string
  author?: string
  sourceType: SourceType
  source?: string
  bookId?: string
  book?: CitationBook | null
  page?: number
  chapter?: string
  comment?: string
  color: string
  favorite: boolean
  viewCount: number
  tags: CitationTag[]
  createdAt: string
  updatedAt: string
}

export interface CitationStats {
  total: number
  favorites: number
  bySourceType: Partial<Record<SourceType, number>>
  byAuthor: Array<{ author: string; count: number }>
  mostViewed: Citation[]
  timeline: Array<{ month: string; count: number }>
}

export type CitationInput = {
  text: string
  author?: string
  sourceType?: SourceType
  source?: string
  bookId?: string | null
  page?: number | null
  chapter?: string
  comment?: string
  color?: string
  favorite?: boolean
  tags?: string[]
}

export const SOURCE_TYPE_LABELS: Record<SourceType, string> = {
  BOOK: 'Livre',
  ARTICLE: 'Article',
  INTERNET: 'Internet',
  PODCAST: 'Podcast',
  FILM: 'Film',
  SERIES: 'Série',
  VIDEO: 'Vidéo',
  PERSON: 'Personne',
  OTHER: 'Autre',
}

export const SOURCE_TYPE_ICONS: Record<SourceType, string> = {
  BOOK: '📚',
  ARTICLE: '📰',
  INTERNET: '🌐',
  PODCAST: '🎙️',
  FILM: '🎬',
  SERIES: '📺',
  VIDEO: '▶️',
  PERSON: '🧑',
  OTHER: '💬',
}

export const PRESET_COLORS = [
  '#C4775A', '#7A9E7E', '#5A8AC4', '#9B7EC8',
  '#E5A34A', '#E56464', '#48bb78', '#A89890',
]

export const citationsApi = {
  getAll: (params?: {
    search?: string
    sourceType?: SourceType
    favorite?: boolean
    tag?: string
    bookId?: string
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.sourceType) q.set('sourceType', params.sourceType)
    if (params?.favorite) q.set('favorite', 'true')
    if (params?.tag) q.set('tag', params.tag)
    if (params?.bookId) q.set('bookId', params.bookId)
    const qs = q.toString()
    return apiClient<{ citations: Citation[]; total: number }>(
      `/api/citations${qs ? `?${qs}` : ''}`
    )
  },

  getOne: (id: string) =>
    apiClient<{ citation: Citation }>(`/api/citations/${id}`),

  create: (data: CitationInput) =>
    apiClient<{ citation: Citation }>('/api/citations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<CitationInput>) =>
    apiClient<{ citation: Citation }>(`/api/citations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/citations/${id}`, { method: 'DELETE' }),

  toggleFavorite: (id: string) =>
    apiClient<{ citation: Citation }>(`/api/citations/${id}/favorite`, {
      method: 'PATCH',
    }),

  getStats: () =>
    apiClient<CitationStats>('/api/citations/stats'),

  getTags: () =>
    apiClient<{ tags: string[] }>('/api/citations/tags'),

  getByBook: (bookId: string) =>
    apiClient<{ citations: Citation[]; total: number }>(
      `/api/reading/books/${bookId}/citations`
    ),
}
