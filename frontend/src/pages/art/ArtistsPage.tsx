import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { artistsApi, type Artist } from '../../api/art'

export function ArtistsPage() {
  const [artists, setArtists] = useState<Artist[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    artistsApi.getAll({ search: search || undefined })
      .then(d => setArtists(d.artists))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [search])

  return (
    <div className="authors-page">
      <div className="reading-header">
        <div>
          <h1 className="reading-title">Artistes</h1>
          <p className="reading-count">{artists.length} artiste{artists.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="reading-toolbar">
        <input
          className="input-field reading-search"
          placeholder="Rechercher un artiste..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="routines-loading"><div className="loading-spinner" /></div>
      ) : artists.length === 0 ? (
        <div className="routines-empty">Aucun artiste trouvé.</div>
      ) : (
        <div className="authors-grid">
          {artists.map(a => (
            <Link key={a.id} to={`/art/artists/${a.id}`} className="author-card glass-card">
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
                  <span>{a.artworkCount} œuvre{(a.artworkCount ?? 0) !== 1 ? 's' : ''}</span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
