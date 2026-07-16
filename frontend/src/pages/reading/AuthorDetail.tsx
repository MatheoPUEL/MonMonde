import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { authorsApi, type Author, type OLAuthorCandidate } from '../../api/reading'
import { BookRow } from '../../components/reading/BookRow'
import { EnrichPickerModal } from '../../components/ui/EnrichPickerModal'
import { IconChevronLeft } from '../../components/ui/icons'

function candidateSubtitle(c: OLAuthorCandidate): string | undefined {
  const parts = [
    (c.birthDate || c.deathDate) ? `${c.birthDate ?? '?'} – ${c.deathDate ?? '…'}` : null,
    c.workCount ? `${c.workCount} œuvre${c.workCount > 1 ? 's' : ''} répertoriée${c.workCount > 1 ? 's' : ''}` : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : undefined
}

export function AuthorDetail() {
  const { authorId } = useParams<{ authorId: string }>()
  const [author, setAuthor] = useState<Author | null>(null)
  const [searching, setSearching] = useState(false)
  const [applying, setApplying] = useState(false)
  const [candidates, setCandidates] = useState<OLAuthorCandidate[] | null>(null)
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorId) return
    authorsApi.getOne(authorId)
      .then(d => setAuthor(d.author))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authorId])

  async function handleOpenEnrich() {
    if (!authorId) return
    setSearching(true)
    setEnrichMsg(null)
    try {
      const data = await authorsApi.getEnrichCandidates(authorId)
      if (data.candidates.length === 0) {
        setEnrichMsg('Aucun résultat trouvé sur Open Library.')
      } else {
        setCandidates(data.candidates)
      }
    } catch {
      setEnrichMsg('Erreur lors de la recherche.')
    }
    setSearching(false)
  }

  async function handleApply(olid: string) {
    if (!authorId) return
    setApplying(true)
    try {
      const data = await authorsApi.enrich(authorId, olid)
      setAuthor(data.author)
      setEnrichMsg('Informations mises à jour.')
      setCandidates(null)
    } catch {
      setEnrichMsg("Erreur lors de l'enrichissement.")
    }
    setApplying(false)
  }

  if (loading) return <div className="routines-loading"><div className="loading-spinner" /></div>
  if (!author) return <div className="routines-empty">Auteur introuvable.</div>

  const books = author.books ?? []

  return (
    <div className="author-detail">
      <Link to="/reading/authors" className="author-back-link"><IconChevronLeft size={12} /> Auteurs</Link>

      <div className="author-detail-header">
        <div className="author-detail-avatar">
          {author.photoUrl
            ? <img src={author.photoUrl} alt={author.name} className="author-detail-photo" />
            : <span className="author-detail-initials">{author.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
          }
        </div>
        <div className="author-detail-info">
          <h1 className="author-detail-name">{author.name}</h1>
          {(author.birthDate || author.deathDate || author.nationality) && (
            <p className="author-detail-meta">
              {author.nationality && <span>{author.nationality}</span>}
              {author.birthDate && (
                <span>{new Date(author.birthDate).getFullYear()}
                  {author.deathDate ? ` – ${new Date(author.deathDate).getFullYear()}` : ''}
                </span>
              )}
            </p>
          )}
          {author.bio && <p className="author-detail-bio">{author.bio}</p>}
          <div className="author-detail-actions">
            <button
              className="btn btn-ghost"
              style={{ width: 'auto', padding: '0.5rem 1rem' }}
              onClick={handleOpenEnrich}
              disabled={searching}
            >
              {searching ? <span className="loading-spinner loading-spinner--sm" /> : '✦'} Enrichir via Open Library
            </button>
            {enrichMsg && <span className="author-enrich-msg">{enrichMsg}</span>}
          </div>
        </div>
      </div>

      {candidates && (
        <EnrichPickerModal
          title="Choisir la fiche Open Library"
          candidates={candidates.map(c => ({ id: c.olid, title: c.name, subtitle: candidateSubtitle(c) }))}
          applying={applying}
          onSelect={handleApply}
          onClose={() => setCandidates(null)}
        />
      )}

      <div className="author-detail-books">
        <h2 className="author-detail-section-title">
          {books.length} livre{books.length !== 1 ? 's' : ''}
          {author.avgRating != null && ` · ★ ${author.avgRating.toFixed(1)} en moyenne`}
        </h2>
        {books.map(b => (
          <BookRow key={b.id} book={b} />
        ))}
      </div>
    </div>
  )
}
