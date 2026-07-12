import { apiClient } from './client'

export type Mood = 'EXCELLENT' | 'GOOD' | 'NEUTRAL' | 'BAD' | 'VERY_BAD'

export interface JournalTag {
  id: string
  name: string
  entryId: string
}

export interface JournalEntry {
  id: string
  userId: string
  title: string
  content: string
  contentText: string
  mood: Mood | null
  favorite: boolean
  pinned: boolean
  draft: boolean
  tags: JournalTag[]
  createdAt: string
  updatedAt: string
}

export interface JournalStats {
  totalEntries: number
  totalWords: number
  currentStreak: number
  longestStreak: number
  avgEntriesPerWeek: number
  moodByWeek: { week: string; avg: number; count: number }[]
  moodByMonth: { month: string; avg: number; count: number }[]
}

export interface ArchiveItem {
  year: number
  month: number
  count: number
}

export const MOOD_LABELS: Record<Mood, string> = {
  EXCELLENT: 'Excellent',
  GOOD: 'Bon',
  NEUTRAL: 'Neutre',
  BAD: 'Mauvais',
  VERY_BAD: 'Très mauvais',
}

export const MOOD_EMOJIS: Record<Mood, string> = {
  EXCELLENT: '😄',
  GOOD: '🙂',
  NEUTRAL: '😐',
  BAD: '😔',
  VERY_BAD: '😞',
}

export const EMPTY_DOC = '{"type":"doc","content":[{"type":"paragraph"}]}'

export const journalApi = {
  getEntries: (params?: {
    search?: string
    mood?: Mood
    favorite?: boolean
    pinned?: boolean
    draft?: boolean
    tag?: string
    dateFrom?: string
    dateTo?: string
    page?: number
    limit?: number
  }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    if (params?.mood) q.set('mood', params.mood)
    if (params?.favorite) q.set('favorite', 'true')
    if (params?.pinned) q.set('pinned', 'true')
    if (params?.draft !== undefined) q.set('draft', String(params.draft))
    if (params?.tag) q.set('tag', params.tag)
    if (params?.dateFrom) q.set('dateFrom', params.dateFrom)
    if (params?.dateTo) q.set('dateTo', params.dateTo)
    if (params?.page) q.set('page', String(params.page))
    if (params?.limit) q.set('limit', String(params.limit))
    const qs = q.toString()
    return apiClient<{ entries: JournalEntry[]; total: number; page: number }>(
      `/api/journal/entries${qs ? `?${qs}` : ''}`
    )
  },

  createEntry: (data: {
    title: string
    content: string
    mood?: Mood | null
    favorite?: boolean
    pinned?: boolean
    draft?: boolean
    tags?: string[]
  }) =>
    apiClient<{ entry: JournalEntry }>('/api/journal/entries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getEntry: (id: string) =>
    apiClient<{ entry: JournalEntry }>(`/api/journal/entries/${id}`),

  updateEntry: (
    id: string,
    data: Partial<{
      title: string
      content: string
      mood: Mood | null
      favorite: boolean
      pinned: boolean
      draft: boolean
      tags: string[]
    }>
  ) =>
    apiClient<{ entry: JournalEntry }>(`/api/journal/entries/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteEntry: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/journal/entries/${id}`, { method: 'DELETE' }),

  getStats: () => apiClient<JournalStats>('/api/journal/stats'),

  getArchives: () =>
    apiClient<{ archives: ArchiveItem[] }>('/api/journal/archives'),
}
