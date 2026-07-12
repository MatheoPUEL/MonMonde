import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { readingApi, Book } from '../../api/reading'
import { ProgressBar } from '../reading/ProgressBar'

export function WidgetLecture() {
  const [book, setBook] = useState<Book | null>(null)
  const [totalReading, setTotalReading] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    readingApi.getBooks({ status: 'READING' })
      .then(d => {
        setBook(d.books[0] ?? null)
        setTotalReading(d.books.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-widget widget-reading">
      <span className="dashboard-widget-title">📚 Lecture en cours</span>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : book ? (
        <>
          <div className="widget-book-layout">
            <div className="widget-book-cover">
              {book.coverUrl
                ? <img src={book.coverUrl} alt={book.title} />
                : '📖'
              }
            </div>
            <div className="widget-book-info">
              <Link to={`/reading/books/${book.id}`} className="widget-book-title">
                {book.title}
              </Link>
              <span className="widget-book-author">{book.author.name}</span>
              {book.currentPage != null && book.pageCount != null ? (
                <>
                  <ProgressBar currentPage={book.currentPage} pageCount={book.pageCount} />
                  <span className="widget-book-noprogress">
                    {book.pageCount - book.currentPage} page{book.pageCount - book.currentPage > 1 ? 's' : ''} restantes
                  </span>
                </>
              ) : (
                <span className="widget-book-noprogress">Progression non suivie</span>
              )}
            </div>
          </div>
          {totalReading > 1 && (
            <span className="widget-book-more">
              et {totalReading - 1} autre{totalReading > 2 ? 's' : ''} en cours
            </span>
          )}
          <Link to="/reading" className="dashboard-widget-link">
            Voir la bibliothèque →
          </Link>
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
