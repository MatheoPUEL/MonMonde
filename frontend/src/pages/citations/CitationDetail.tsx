import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { citationsApi, type Citation, SOURCE_TYPE_LABELS } from '../../api/citations'
import { CitationForm } from '../../components/citations/CitationForm'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { SOURCE_TYPE_ICONS, IconStar, IconChevronLeft, IconChevronRight, IconReading } from '../../components/ui/icons'

export function CitationDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [citation, setCitation] = useState<Citation | null>(null)
  const [showEdit, setShowEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true)
    try {
      const data = await citationsApi.getOne(id)
      setCitation(data.citation)
    } catch {
      navigate('/citations/list')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  function handleDelete() {
    if (!id || !citation) return
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!id) return
    await citationsApi.delete(id)
    navigate('/citations/list')
  }

  async function handleFavoriteToggle() {
    if (!id) return
    const { citation: updated } = await citationsApi.toggleFavorite(id)
    setCitation(updated)
  }

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
  if (!citation) return null

  const locationParts = [
    citation.chapter ? `Ch. ${citation.chapter}` : null,
    citation.page ? `p. ${citation.page}` : null,
  ].filter(Boolean).join(' · ')

  const SourceIcon = SOURCE_TYPE_ICONS[citation.sourceType]

  return (
    <div className="citation-detail">
      <button className="citation-detail-back" onClick={() => navigate('/citations/list')}>
        <IconChevronLeft size={14} /> Citations
      </button>

      <div className="citation-detail-quote" style={{ borderLeftColor: citation.color }}>
        <div className="citation-detail-text">«&nbsp;{citation.text}&nbsp;»</div>
      </div>

      <div className="citation-detail-meta">
        {citation.author && (
          <span className="citation-detail-author">{citation.author}</span>
        )}
        <span className="citation-source-badge">
          <SourceIcon size={13} /> {SOURCE_TYPE_LABELS[citation.sourceType]}
        </span>
        {citation.source && (
          <span className="citation-detail-source-text">{citation.source}</span>
        )}
        {locationParts && (
          <span className="citation-detail-location">{locationParts}</span>
        )}
        <button
          onClick={handleFavoriteToggle}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: citation.favorite ? 'var(--accent)' : 'var(--text-muted)' }}
          title={citation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
        >
          <IconStar size={18} filled={citation.favorite} />
        </button>
      </div>

      {citation.tags.length > 0 && (
        <div className="citation-detail-tags">
          {citation.tags.map(t => (
            <span key={t.id} className="citation-detail-tag">{t.name}</span>
          ))}
        </div>
      )}

      {citation.comment && (
        <div className="citation-detail-section">
          <div className="citation-detail-section-title">Mon commentaire</div>
          <div className="citation-detail-comment">{citation.comment}</div>
        </div>
      )}

      {citation.book && (
        <div className="citation-detail-section">
          <div className="citation-detail-section-title">Livre lié</div>
          <Link to={`/reading/${citation.book.id}`} className="citation-detail-book-link">
            <div className="citation-detail-book-cover">
              {citation.book.coverUrl
                ? <img src={citation.book.coverUrl} alt={citation.book.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 3 }} />
                : <IconReading size={16} />}
            </div>
            <div className="citation-detail-book-info">
              <div className="citation-detail-book-title">{citation.book.title}</div>
              <div className="citation-detail-book-author">{citation.book?.author?.name}</div>
            </div>
            <IconChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
          </Link>
        </div>
      )}

      <div className="citation-detail-actions">
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowEdit(true)}>
          Modifier
        </button>
        <button className="btn-danger" onClick={handleDelete}>
          Supprimer
        </button>
      </div>

      {showEdit && (
        <CitationForm
          initial={citation}
          onSave={async data => {
            await citationsApi.update(citation.id, data)
            await load()
          }}
          onClose={() => setShowEdit(false)}
        />
      )}
      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer cette citation"
          message="Supprimer cette citation définitivement ? Cette action est irréversible."
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
