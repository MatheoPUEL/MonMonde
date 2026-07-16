import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { readingApi, Book } from '../../api/reading'
import { ProgressBar } from '../reading/ProgressBar'
import { bookInitials } from '../reading/bookInitials'
import { Button } from '../ui/Button'
import { IconReading } from '../ui/icons'

const MAX_SHOWN = 3

export function WidgetLecture() {
  const [books, setBooks] = useState<Book[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    readingApi.getBooks({ status: 'READING' })
      .then(d => setBooks(d.books))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const shown = books.slice(0, MAX_SHOWN)
  const extra = books.length - shown.length

  return (
    <div className="dashboard-widget widget-reading">
      <span className="dashboard-widget-title">
        <IconReading size={14} />Lecture{books.length > 1 ? 's' : ''} en cours
      </span>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : shown.length > 0 ? (
        <>
          <div className="widget-reading-list">
            {shown.map(book => (
              <div
                key={book.id}
                className="widget-reading-item"
                onClick={() => navigate(`/reading/${book.id}`)}
              >
                <div className="widget-reading-item-cover">
                  {book.coverUrl
                    ? <img src={book.coverUrl} alt={book.title} />
                    : bookInitials(book.title)
                  }
                </div>
                <div className="widget-reading-item-info">
                  <span className="widget-reading-item-title">{book.title}</span>
                  <span className="widget-reading-item-author">{book.author.name}</span>
                  {book.currentPage != null && book.pageCount != null ? (
                    <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
                  ) : (
                    <span className="widget-book-noprogress">Progression non suivie</span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {extra > 0 && (
            <span className="widget-reading-more">et {extra} autre{extra > 1 ? 's' : ''} en cours</span>
          )}
          <Button onClick={() => navigate('/reading')}>Continuer la lecture</Button>
        </>
      ) : (
        <div className="widget-empty">
          <span>Aucun livre en cours</span>
          <Link to="/reading" className="btn btn-ghost" style={{ width: 'auto' }}>
            Choisir un livre
          </Link>
        </div>
      )}
    </div>
  )
}
