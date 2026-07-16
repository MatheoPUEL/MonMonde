import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { artistsApi, type Artist, type WikidataArtistCandidate } from '../../api/art'
import { ArtworkRow } from '../../components/art/ArtworkRow'
import { EnrichPickerModal } from '../../components/ui/EnrichPickerModal'
import { IconChevronLeft } from '../../components/ui/icons'

export function ArtistDetail() {
  const { artistId } = useParams<{ artistId: string }>()
  const [artist, setArtist] = useState<Artist | null>(null)
  const [searching, setSearching] = useState(false)
  const [applying, setApplying] = useState(false)
  const [candidates, setCandidates] = useState<WikidataArtistCandidate[] | null>(null)
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!artistId) return
    artistsApi.getOne(artistId)
      .then(d => setArtist(d.artist))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [artistId])

  async function handleOpenEnrich() {
    if (!artistId) return
    setSearching(true)
    setEnrichMsg(null)
    try {
      const data = await artistsApi.getEnrichCandidates(artistId)
      if (data.candidates.length === 0) {
        setEnrichMsg('Aucun résultat trouvé sur Wikidata.')
      } else {
        setCandidates(data.candidates)
      }
    } catch {
      setEnrichMsg('Erreur lors de la recherche.')
    }
    setSearching(false)
  }

  async function handleApply(wikidataId: string) {
    if (!artistId) return
    setApplying(true)
    try {
      const data = await artistsApi.enrich(artistId, wikidataId)
      setArtist(data.artist)
      setEnrichMsg('Informations mises à jour.')
      setCandidates(null)
    } catch {
      setEnrichMsg("Erreur lors de l'enrichissement.")
    }
    setApplying(false)
  }

  if (loading) return <div className="routines-loading"><div className="loading-spinner" /></div>
  if (!artist) return <div className="routines-empty">Artiste introuvable.</div>

  const artworks = artist.artworks ?? []

  return (
    <div className="author-detail">
      <Link to="/art/artists" className="author-back-link"><IconChevronLeft size={12} /> Artistes</Link>

      <div className="author-detail-header">
        <div className="author-detail-avatar">
          {artist.photoUrl
            ? <img src={artist.photoUrl} alt={artist.name} className="author-detail-photo" />
            : <span className="author-detail-initials">{artist.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div className="author-detail-info">
          <h1 className="author-detail-name">{artist.name}</h1>
          {(artist.birthDate || artist.deathDate || artist.nationality) && (
            <p className="author-detail-meta">
              {artist.nationality && <span>{artist.nationality}</span>}
              {artist.birthDate && (
                <span>{new Date(artist.birthDate).getFullYear()}
                  {artist.deathDate ? ` – ${new Date(artist.deathDate).getFullYear()}` : ''}
                </span>
              )}
            </p>
          )}
          {artist.bio && <p className="author-detail-bio">{artist.bio}</p>}
          <div className="author-detail-actions">
            <button
              className="btn btn-ghost"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              onClick={handleOpenEnrich}
              disabled={searching}
            >
              {searching ? <span className="loading-spinner loading-spinner--sm" /> : '✦'} Enrichir via Wikidata
            </button>
            {enrichMsg && <span className="author-enrich-msg">{enrichMsg}</span>}
          </div>
        </div>
      </div>

      {candidates && (
        <EnrichPickerModal
          title="Choisir la fiche Wikidata"
          candidates={candidates.map(c => ({ id: c.wikidataId, title: c.name, subtitle: c.description }))}
          applying={applying}
          onSelect={handleApply}
          onClose={() => setCandidates(null)}
        />
      )}

      <div className="author-detail-books">
        <h2 className="author-detail-section-title">
          {artworks.length} œuvre{artworks.length !== 1 ? 's' : ''}
        </h2>
        {artworks.map(a => (
          <ArtworkRow key={a.id} artwork={a} />
        ))}
      </div>
    </div>
  )
}
