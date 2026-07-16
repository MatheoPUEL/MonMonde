import { apiClient } from './client'

export interface SearchResultItem {
  id: string
  title: string
  subtitle?: string | null
  coverUrl?: string | null
  icon?: string
}

export interface GlobalSearchResults {
  books: SearchResultItem[]
  authors: SearchResultItem[]
  citations: SearchResultItem[]
  artworks: SearchResultItem[]
  artists: SearchResultItem[]
  entries: SearchResultItem[]
  routines: SearchResultItem[]
}

export const searchApi = {
  search: (q: string) =>
    apiClient<{ results: GlobalSearchResults }>(`/api/search?q=${encodeURIComponent(q)}`),
}
