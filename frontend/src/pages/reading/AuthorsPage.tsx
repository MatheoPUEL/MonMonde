import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { authorsApi, type Author } from '../../api/reading'

export function AuthorsPage() {
  const [authors, setAuthors] = useState<Author[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    authorsApi.getAll({ search: search || undefined })
      .then(d => setAuthors(d.authors))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  return (
    <div className="authors-page">
      <div className="reading-header">
        <div>
          <h1 className="reading-title">Auteurs</h1>
          <p className="reading-count">{authors.length} auteur{authors.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="reading-toolbar">
        <input
          className="input-field reading-search"
          placeholder="Rechercher un auteur..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="routines-loading"><div className="loading-spinner" /></div>
      ) : authors.length === 0 ? (
        <div className="routines-empty">Aucun auteur trouvé.</div>
      ) : (
        <div className="authors-grid">
          {authors.map(a => (
            <Link key={a.id} to={`/reading/authors/${a.id}`} className="author-card glass-card">
              <div className="author-card-avatar">
                {a.photoUrl
                  ? <img src={a.photoUrl} alt={a.name} className="author-card-photo" />
                  : <span className="author-card-initials">{a.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
                }
              </div>
              <div className="author-card-info">
                <div className="author-card-name">{a.name}</div>
                <div className="author-card-meta">
                  {a.nationality && <span>{a.nationality}</span>}
                  <span>{a.bookCount} livre{(a.bookCount ?? 0) !== 1 ? 's' : ''}</span>
                  {a.avgRating != null && <span>★ {a.avgRating.toFixed(1)}</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
