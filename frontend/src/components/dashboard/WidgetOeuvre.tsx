import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { artApi, Artwork } from '../../api/art'
import { artworkInitials } from '../art/artworkInitials'
import { IconArt } from '../ui/icons'

function pickRandom<T>(arr: T[]): T | null {
  if (arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

export function WidgetOeuvre() {
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    artApi.getArtworks({ favorite: true })
      .then(d => {
        if (d.artworks.length > 0) return d.artworks
        return artApi.getArtworks().then(d2 => d2.artworks)
      })
      .then(list => setArtwork(pickRandom(list)))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="dashboard-widget widget-art">
      <span className="dashboard-widget-title"><IconArt size={14} />L'art du jour</span>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : artwork ? (
        <Link to={`/art/${artwork.id}`} className="widget-art-link">
          <div className="widget-art-image">
            {artwork.coverUrl
              ? <img src={artwork.coverUrl} alt={artwork.title} />
              : <span className="widget-art-initials">{artworkInitials(artwork.title)}</span>
            }
          </div>
          <div className="widget-art-title">{artwork.title}</div>
          <div className="widget-art-artist">
            {artwork.artist.name}{artwork.year ? `, ${artwork.year}` : ''}
          </div>
        </Link>
      ) : (
        <div className="widget-empty">
          <span>Aucune œuvre enregistrée</span>
          <Link to="/art" className="btn btn-ghost" style={{ width: 'auto' }}>
            Ajouter une œuvre
          </Link>
        </div>
      )}
    </div>
  )
}
