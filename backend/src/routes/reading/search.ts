import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'

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

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const q = (req.query.q as string)?.trim()
    if (!q) {
      res.status(400).json({ error: 'Query parameter q is required' })
      return
    }

    const normalized = q.replace(/[\s-]/g, '')
    const isIsbn = /^\d{9}[\dxX]$|^\d{13}$/.test(normalized)
    const searchQuery = isIsbn ? `isbn:${normalized}` : q
    const apiKey = process.env.GOOGLE_BOOKS_API_KEY
    const keyParam = apiKey ? `&key=${apiKey}` : ''
    const langParam = isIsbn ? '' : '&langRestrict=fr'
    const url = `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=10${langParam}${keyParam}`
    const response = await fetch(url)

    if (!response.ok) {
      res.status(502).json({ error: 'Google Books API unavailable' })
      return
    }

    const data = await response.json() as { items?: GoogleBook[] }

    const books = (data.items || []).map((item) => ({
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

    res.json({ books })
  } catch (err) {
    next(err)
  }
})

export default router
