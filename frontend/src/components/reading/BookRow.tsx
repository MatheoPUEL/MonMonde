import { useNavigate } from 'react-router-dom'
import { Book } from '../../api/reading'
import { BookStatusBadge } from './BookStatusBadge'
import { ProgressBar } from './ProgressBar'
import { StarRating } from './StarRating'
import { bookInitials } from './bookInitials'

export function BookRow({ book }: { book: Book }) {
  const navigate = useNavigate()

  return (
    <div className="book-row" onClick={() => navigate(`/reading/${book.id}`)}>
      <div className="book-row-cover">
        {book.coverUrl ? (
          <img src={book.coverUrl} alt={book.title} loading="lazy" />
        ) : <span className="book-cover-initials book-cover-initials--sm">{bookInitials(book.title)}</span>}
      </div>
      <div className="book-row-info">
        <div className="book-row-title">{book.title}</div>
        <div className="book-row-author">{book.author.name}</div>
        {book.status === 'READING' && (
          <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
        )}
      </div>
      <div className="book-row-meta">
        <BookStatusBadge status={book.status} />
        {book.rating ? <StarRating value={book.rating} readonly size="sm" /> : null}
        {book.favorite ? <span title="Favori" style={{ color: 'var(--accent)' }}>★</span> : null}
      </div>
    </div>
  )
}
