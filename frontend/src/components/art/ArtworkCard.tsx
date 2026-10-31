import { useNavigate } from 'react-router-dom'
import { Artwork } from '../../api/art'
import { artworkInitials } from './artworkInitials'
import { CoverImage } from '../ui/CoverImage'

export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  const navigate = useNavigate()

  return (
    <div className="artwork-card" onClick={() => navigate(`/art/${artwork.id}`)}>
      <div className="artwork-cover-wrap">
        <CoverImage
          kind="artwork"
          id={artwork.id}
          src={artwork.coverUrl}
          alt={artwork.title}
          loading="lazy"
          fallback={<span className="artwork-cover-initials">{artworkInitials(artwork.title)}</span>}
        />
        {artwork.favorite && <span className="artwork-cover-fav">★</span>}
      </div>
      <div className="artwork-card-info">
        <div className="artwork-card-title">{artwork.title}</div>
        <div className="artwork-card-artist">{artwork.artist.name}</div>
        <div className="artwork-card-footer">
          {artwork.dateDisplay && <span className="chip chip--sm">{artwork.dateDisplay}</span>}
          {artwork.currents[0] && <span className="chip chip--sm">{artwork.currents[0]}</span>}
        </div>
      </div>
    </div>
  )
}
