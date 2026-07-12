import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { authorsApi, type Author } from '../../api/reading'
import { BookRow } from '../../components/reading/BookRow'

export function AuthorDetail() {
  const { authorId } = useParams<{ authorId: string }>()
  const [author, setAuthor] = useState<Author | null>(null)
  const [enriching, setEnriching] = useState(false)
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authorId) return
    authorsApi.getOne(authorId)
      .then(d => setAuthor(d.author))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [authorId])

  async function handleEnrich() {
    if (!authorId) return
    setEnriching(true)
    setEnrichMsg(null)
    try {
      const data = await authorsApi.enrich(authorId)
      setAuthor(data.author)
      setEnrichMsg('Informations mises à jour.')
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setEnrichMsg(msg.includes('404') ? 'Auteur introuvable sur Open Library.' : "Erreur lors de l'enrichissement.")
    }
    setEnriching(false)
  }

  if (loading) return <div className="routines-loading"><div className="loading-spinner" /></div>
  if (!author) return <div className="routines-empty">Auteur introuvable.</div>

  const books = author.books ?? []

  return (
    <div className="author-detail">
      <Link to="/reading/authors" className="author-back-link">← Auteurs</Link>

      <div className="glass-card author-detail-header">
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
              onClick={handleEnrich}
              disabled={enriching}
            >
              {enriching ? <span className="loading-spinner loading-spinner--sm" /> : '✦'} Enrichir via Open Library
            </button>
            {enrichMsg && <span className="author-enrich-msg">{enrichMsg}</span>}
          </div>
        </div>
      </div>

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
