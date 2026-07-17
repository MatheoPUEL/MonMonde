import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const router = Router()

interface GoogleBook {
  id: string
  volumeInfo: {
    title?: string
    authors?: string[]
    description?: string
    imageLinks?: { thumbnail?: string; smallThumbnail?: string }
    industryIdentifiers?: { type: string; identifier: string }[]
    pageCount?: number
    categories?: string[]
  }
}

interface BookResult {
  googleBooksId: string
  title: string
  author: string
  synopsis?: string | null
  coverUrl?: string | null
  isbn?: string | null
  pageCount?: number | null
  genres: string[]
}

const CACHE_RESULT_LIMIT = 10

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    const normalized = q.replace(/[\s-]/g, '')
    const isIsbn = /^\d{9}[\dxX]$|^\d{13}$/.test(normalized)
    // Each word of the query must show up somewhere across title/author —
    // matching the query as one literal substring would miss almost every
    // real search ("camus étranger" spans both fields, never one of them).
    const words = q.split(/\s+/).filter(Boolean)

    // Local cache first — avoids hitting Google Books' (rate-limited) API for
    // a search someone has already done before.
    const cached = await prisma.bookSearchCache.findMany({
      where: isIsbn
        ? { isbn: normalized }
        : { AND: words.map(w => ({ OR: [{ title: { contains: w, mode: 'insensitive' } }, { author: { contains: w, mode: 'insensitive' } }] })) },
      select: { googleBooksId: true, title: true, author: true, synopsis: true, coverUrl: true, isbn: true, pageCount: true, genres: true },
      take: CACHE_RESULT_LIMIT,
      orderBy: { updatedAt: 'desc' },
    })

    if (cached.length > 0) {
      res.json({ books: cached })
      return
    }

    const searchQuery = isIsbn ? `isbn:${normalized}` : q
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    const keyParam = apiKey ? `&key=${apiKey}` : ''
    const langParam = isIsbn ? '' : '&langRestrict=fr'
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=${CACHE_RESULT_LIMIT}${langParam}${keyParam}`
    const response = await fetch(url)

    if (!response.ok) {
      res.status(502).json({ error: 'Google Books API unavailable' })
      return
    }

    const data = await response.json() as { items?: GoogleBook[] }

    const books: BookResult[] = (data.items || []).map((item) => ({
      googleBooksId: item.id,
      title: item.volumeInfo.title || 'Sans titre',
      author: item.volumeInfo.authors?.join(', ') || 'Auteur inconnu',
      synopsis: item.volumeInfo.description,
      coverUrl: (item.volumeInfo.imageLinks?.thumbnail || item.volumeInfo.imageLinks?.smallThumbnail)
        ?.replace('http:', 'https:'),
      isbn: item.volumeInfo.industryIdentifiers
        ?.find(i => i.type === 'ISBN_13' || i.type === 'ISBN_10')?.identifier,
      pageCount: item.volumeInfo.pageCount,
      genres: item.volumeInfo.categories || [],
    }))

    if (books.length > 0) {
      await Promise.all(books.map(b => prisma.bookSearchCache.upsert({
        where: { googleBooksId: b.googleBooksId },
        update: {
          title: b.title,
          author: b.author,
          synopsis: b.synopsis ?? null,
          coverUrl: b.coverUrl ?? null,
          isbn: b.isbn ?? null,
          pageCount: b.pageCount ?? null,
          genres: b.genres,
        },
        create: {
          googleBooksId: b.googleBooksId,
          title: b.title,
          author: b.author,
          synopsis: b.synopsis ?? null,
          coverUrl: b.coverUrl ?? null,
          isbn: b.isbn ?? null,
          pageCount: b.pageCount ?? null,
          genres: b.genres,
        },
      })))
    }

    res.json({ books })
  } catch (err) {
    next(err)
  }
})

export default router
