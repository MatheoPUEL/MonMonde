import { useNavigate } from 'react-router-dom'
import { Book } from '../../api/reading'
import { BookStatusBadge } from './BookStatusBadge'
import { ProgressBar } from './ProgressBar'
import { StarRating } from './StarRating'

export function BookCard({ book }: { book: Book }) {
  const navigate = useNavigate()

  return (
    <div className="glass-card book-card" onClick={() => navigate(`/reading/${book.id}`)}>
      <div className="book-cover-wrap">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} loading="lazy" />
        ) : (
          '📚'
        )}
      </div>
      <div className="book-card-info">
        <div className="book-card-title">{book.title}</div>
        <div className="book-card-author">{book.author.name}</div>
        <div className="book-card-footer">
          <BookStatusBadge status={book.status} />
          {book.rating ? <StarRating value={book.rating} readonly size="sm" /> : null}
        </div>
        {book.status === 'READING' && (
          <div style={{ marginTop: '0.5rem' }}>
            <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
          </div>
        )}
      </div>
    </div>
  )
}
