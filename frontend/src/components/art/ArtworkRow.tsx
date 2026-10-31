import { useNavigate } from 'react-router-dom'
import { Artwork } from '../../api/art'
import { artworkInitials } from './artworkInitials'
import { CoverImage } from '../ui/CoverImage'

export function ArtworkRow({ artwork }: { artwork: Artwork }) {
  const navigate = useNavigate()

  return (
    <div className="artwork-row" onClick={() => navigate(`/art/${artwork.id}`)}>
      <div className="artwork-row-cover">
        <CoverImage
          kind="artwork"
          id={artwork.id}
          src={artwork.coverUrl}
          alt={artwork.title}
          loading="lazy"
          fallback={<span className="artwork-cover-initials artwork-cover-initials--sm">{artworkInitials(artwork.title)}</span>}
        />
      </div>
      <div className="artwork-row-info">
        <div className="artwork-row-title">{artwork.title}</div>
        <div className="artwork-row-artist">{artwork.artist.name}</div>
      </div>
      <div className="artwork-row-meta">
        {artwork.dateDisplay && <span className="chip">{artwork.dateDisplay}</span>}
        {artwork.currents[0] && <span className="chip">{artwork.currents[0]}</span>}
        {artwork.favorite ? <span title="Favori" style={{ color: 'var(--accent)' }}>★</span> : null}
      </div>
    </div>
  )
}
