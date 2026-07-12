import { useState } from 'react'
import { Book, readingApi } from '../../api/reading'
import { Button } from '../ui/Button'
import { ProgressBar } from './ProgressBar'

interface Props {
  book: Book
  onUpdated: (book: Book) => void
}

export function ProgressUpdateForm({ book, onUpdated }: Props) {
  const [page, setPage] = useState(book.currentPage?.toString() || '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!page) return
    setLoading(true)
    try {
      const { book: updated } = await readingApi.updateProgress(book.id, {
        currentPage: Number(page),
      })
      onUpdated(updated)
    } catch {}
    setLoading(false)
  }

  return (
    <div>
      <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
      <form onSubmit={handleSubmit} className="progress-update-inline" style={{ marginTop: '0.75rem' }}>
        <input
          className="input-field progress-page-input"
          type="number"
          min="0"
          max={book.pageCount}
          value={page}
          onChange={e => setPage(e.target.value)}
          placeholder="Page"
        />
        {book.pageCount && <span className="progress-page-label">/ {book.pageCount} pages</span>}
        <Button type="submit" loading={loading} className="btn-update-progress">Mettre à jour</Button>
      </form>
    </div>
  )
}
