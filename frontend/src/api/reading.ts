import { apiClient } from './client'

export type ReadingStatus = 'WISHLIST' | 'TO_READ' | 'READING' | 'FINISHED' | 'ABANDONED'

export interface BookTag {
  id: string
  name: string
}

export interface BookNote {
  id: string
  bookId: string
  title: string
  content: string
  chapter?: string
  page?: number
  createdAt: string
  updatedAt: string
}

export interface Author {
  id: string
  userId: string
  name: string
  bio?: string
  birthDate?: string
  deathDate?: string
  nationality?: string
  photoUrl?: string
  openLibraryId?: string
  bookCount?: number
  avgRating?: number
  books?: Book[]
  createdAt: string
  updatedAt: string
}

export interface Book {
  id: string
  userId: string
  title: string
  author: Author
  synopsis?: string
  isbn?: string
  pageCount?: number
  genres: string[]
  coverUrl?: string
  coverType?: string
  googleBooksId?: string
  status: ReadingStatus
  owned: boolean
  rating?: number
  review?: string
  favorite: boolean
  rereadCount: number
  tags: BookTag[]
  notes?: BookNote[]
  currentPage?: number
  startedAt?: string
  finishedAt?: string
  createdAt: string
  updatedAt: string
}

export interface GoogleBookResult {
  googleBooksId: string
  title: string
  author: string
  synopsis?: string
  coverUrl?: string
  isbn?: string
  pageCount?: number
  genres: string[]
}

export const STATUS_LABELS: Record<ReadingStatus, string> = {
  WISHLIST: 'Liste de souhaits',
  TO_READ: 'À lire',
  READING: 'En cours',
  FINISHED: 'Terminé',
  ABANDONED: 'Abandonné',
}

export type BookInput = Partial<Omit<Book, 'author'>> & { title: string; authorName: string; tags?: string[] }

export const readingApi = {
  search: (q: string) =>
    apiClient<{ books: GoogleBookResult[] }>(`/api/reading/search?q=${encodeURIComponent(q)}`),

  getBooks: (params?: { status?: ReadingStatus; search?: string; tag?: string; favorite?: boolean }) => {
    const q = new URLSearchParams()
    if (params?.status) q.set('status', params.status)
    if (params?.search) q.set('search', params.search)
    if (params?.tag) q.set('tag', params.tag)
    if (params?.favorite) q.set('favorite', 'true')
    const qs = q.toString()
    return apiClient<{ books: Book[] }>(`/api/reading/books${qs ? `?${qs}` : ''}`)
  },

  getBook: (id: string) =>
    apiClient<{ book: Book }>(`/api/reading/books/${id}`),

  createBook: (data: BookInput) =>
    apiClient<{ book: Book }>('/api/reading/books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBook: (id: string, data: Partial<Omit<Book, 'tags' | 'author'>> & { authorName?: string; tags?: string[] }) =>
    apiClient<{ book: Book }>(`/api/reading/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteBook: (id: string) =>
    apiClient<{ ok: boolean }>(`/api/reading/books/${id}`, { method: 'DELETE' }),

  updateProgress: (id: string, data: { currentPage?: number; startedAt?: string; finishedAt?: string }) =>
    apiClient<{ book: Book }>(`/api/reading/books/${id}/progress`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  uploadCover: async (id: string, file: File): Promise<{ book: Book; coverUrl: string }> => {
    const form = new FormData()
    form.append('cover', file)
    const res = await fetch(`/api/reading/books/${id}/cover`, {
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

  getNotes: (bookId: string) =>
    apiClient<{ notes: BookNote[] }>(`/api/reading/books/${bookId}/notes`),

  createNote: (bookId: string, data: { title: string; content: string; chapter?: string; page?: number }) =>
    apiClient<{ note: BookNote }>(`/api/reading/books/${bookId}/notes`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateNote: (bookId: string, noteId: string, data: Partial<Pick<BookNote, 'title' | 'content' | 'chapter' | 'page'>>) =>
    apiClient<{ note: BookNote }>(`/api/reading/books/${bookId}/notes/${noteId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteNote: (bookId: string, noteId: string) =>
    apiClient<{ ok: boolean }>(`/api/reading/books/${bookId}/notes/${noteId}`, { method: 'DELETE' }),
}

export interface OLAuthorCandidate {
  olid: string
  name: string
  birthDate?: string
  deathDate?: string
  workCount?: number
  topWork?: string
}

export const authorsApi = {
  getAll: (params?: { search?: string }) => {
    const q = new URLSearchParams()
    if (params?.search) q.set('search', params.search)
    const qs = q.toString()
    return apiClient<{ authors: Author[] }>(`/api/reading/authors${qs ? `?${qs}` : ''}`)
  },

  getOne: (id: string) =>
    apiClient<{ author: Author }>(`/api/reading/authors/${id}`),

  update: (id: string, data: Partial<Pick<Author, 'name' | 'bio' | 'birthDate' | 'deathDate' | 'nationality' | 'photoUrl'>>) =>
    apiClient<{ author: Author }>(`/api/reading/authors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  getEnrichCandidates: (id: string) =>
    apiClient<{ candidates: OLAuthorCandidate[] }>(`/api/reading/authors/${id}/enrich/candidates`),

  enrich: (id: string, olid: string) =>
    apiClient<{ author: Author }>(`/api/reading/authors/${id}/enrich`, {
      method: 'POST',
      body: JSON.stringify({ olid }),
    }),
}
