import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { artApi, Artwork, ArtworkNote, ArtworkMedia } from '../../api/art'
import { citationsApi, type Citation } from '../../api/citations'
import { ArtworkNoteCard } from '../../components/art/ArtworkNoteCard'
import { ArtworkNoteForm } from '../../components/art/ArtworkNoteForm'
import { MediaGallery } from '../../components/art/MediaGallery'
import { CitationCard } from '../../components/citations/CitationCard'
import { CitationForm } from '../../components/citations/CitationForm'
import { EditArtworkModal } from './EditArtworkModal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { Lightbox } from '../../components/ui/Lightbox'
import { artworkInitials } from '../../components/art/artworkInitials'
import { IconChevronLeft, IconEdit, IconStar, IconTrash, IconExpand } from '../../components/ui/icons'

export function ArtworkDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [artwork, setArtwork] = useState<Artwork | null>(null)
  const [notes, setNotes] = useState<ArtworkNote[]>([])
  const [media, setMedia] = useState<ArtworkMedia[]>([])
  const [showLightbox, setShowLightbox] = useState(false)
  const [loading, setLoading] = useState(true)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [review, setReview] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'media' | 'citations'>('info')
  const [citations, setCitations] = useState<Citation[]>([])
  const [citationsLoaded, setCitationsLoaded] = useState(false)
  const [showCitationForm, setShowCitationForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([artApi.getArtwork(id), artApi.getNotes(id)])
      .then(([artworkData, notesData]) => {
        setArtwork(artworkData.artwork)
        setReview(artworkData.artwork.review || '')
        setNotes(notesData.notes)
        setMedia(artworkData.artwork.media || [])
      })
      .catch(() => navigate('/art'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function update(data: Parameters<typeof artApi.updateArtwork>[1]) {
    if (!artwork) return
    try {
      const { artwork: updated } = await artApi.updateArtwork(artwork.id, data)
      setArtwork(updated)
    } catch {}
  }

  async function saveReview() {
    if (!artwork) return
    setSavingReview(true)
    try { await update({ review }) } finally { setSavingReview(false) }
  }

  async function confirmDelete() {
    if (!artwork) return
    try { await artApi.deleteArtwork(artwork.id); navigate('/art') } catch {}
  }

  async function loadCitations() {
    if (!artwork || citationsLoaded) return
    try {
      const data = await citationsApi.getByArtwork(artwork.id)
      setCitations(data.citations)
      setCitationsLoaded(true)
    } catch {}
  }

  function handleTabChange(tab: 'info' | 'notes' | 'media' | 'citations') {
    setActiveTab(tab)
    if (tab === 'citations') loadCitations()
  }

  async function handleCitationFavoriteToggle(citationId: string) {
    const { citation } = await citationsApi.toggleFavorite(citationId)
    setCitations(prev => prev.map(c => c.id === citationId ? citation : c))
  }

  if (loading) return <div className="reading-loading"><div className="loading-spinner" /></div>
  if (!artwork) return null

  return (
    <div className="book-detail">
      <button className="book-detail-back" onClick={() => navigate('/art')}>
        <IconChevronLeft size={14} /> Collection
      </button>

      <div className="book-detail-layout">
        <div className="book-detail-left">
          <div className="book-detail-cover-wrap">
            <div
              className={`book-detail-cover${artwork.coverUrl ? ' book-detail-cover--clickable' : ''}`}
              onClick={() => artwork.coverUrl && setShowLightbox(true)}
            >
              {artwork.coverUrl ? (
                <>
                  <img src={artwork.coverUrl} alt={artwork.title} />
                  <button
                    type="button"
                    className="book-detail-cover-expand"
                    onClick={e => { e.stopPropagation(); setShowLightbox(true) }}
                    title="Voir en grand"
                    aria-label="Voir en grand"
                  >
                    <IconExpand size={15} />
                  </button>
                </>
              ) : (
                <span className="book-cover-initials book-cover-initials--lg">{artworkInitials(artwork.title)}</span>
              )}
            </div>
          </div>

          <div className="book-detail-side-actions">
            <button className="btn-side" onClick={() => setShowEditModal(true)}>
              <IconEdit size={14} /> Modifier
            </button>
            <button
              className={`btn-side ${artwork.favorite ? 'btn-side--active' : ''}`}
              onClick={() => update({ favorite: !artwork.favorite })}
            >
              <IconStar size={14} filled={artwork.favorite} /> Favori
            </button>
            <button className="btn-side btn-side--danger" onClick={() => setShowDeleteConfirm(true)}>
              <IconTrash size={14} /> Supprimer
            </button>
          </div>
        </div>

        <div className="book-detail-right">
          <h1 className="book-detail-title">{artwork.title}</h1>
          <Link to={`/art/artists/${artwork.artist.id}`} className="book-detail-author">{artwork.artist.name}</Link>

          <div className="chips-row">
            {artwork.dateDisplay && <span className="chip">{artwork.dateDisplay}</span>}
            {artwork.movements.map(m => <span key={m} className="chip">{m}</span>)}
            {artwork.currents.map(c => <span key={c} className="chip">{c}</span>)}
            {artwork.themes.map(t => <span key={t} className="chip">{t}</span>)}
            {artwork.tags.map(t => <span key={t.id} className="chip">{t.name}</span>)}
          </div>

          {artwork.museum && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{artwork.museum}</div>}
          {artwork.technique && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{artwork.technique}{artwork.dimensions ? ` · ${artwork.dimensions}` : ''}</div>}

          <div className="routines-tabs" style={{ marginTop: '1.25rem' }}>
            <button className={`routines-tab${activeTab === 'info' ? ' active' : ''}`} onClick={() => handleTabChange('info')}>
              Informations
            </button>
            <button className={`routines-tab${activeTab === 'notes' ? ' active' : ''}`} onClick={() => handleTabChange('notes')}>
              Notes {notes.length > 0 && `(${notes.length})`}
            </button>
            <button className={`routines-tab${activeTab === 'media' ? ' active' : ''}`} onClick={() => handleTabChange('media')}>
              Médias {media.length > 0 && `(${media.length})`}
            </button>
            <button className={`routines-tab${activeTab === 'citations' ? ' active' : ''}`} onClick={() => handleTabChange('citations')}>
              Citations {citationsLoaded && citations.length > 0 && `(${citations.length})`}
            </button>
          </div>

          {activeTab === 'info' && (
            <>
              {artwork.description && (
                <div className="book-detail-section">
                  <div className="book-detail-section-title">Description</div>
                  <div className="book-detail-synopsis">{artwork.description}</div>
                </div>
              )}
              <div className="book-detail-section">
                <div className="book-detail-section-title">Détails</div>
                <div className="artwork-meta-grid">
                  {artwork.period && <div><span className="artwork-meta-label">Période</span>{artwork.period}</div>}
                  {artwork.century != null && <div><span className="artwork-meta-label">Siècle</span>{artwork.century}e</div>}
                  {artwork.medium && <div><span className="artwork-meta-label">Support</span>{artwork.medium}</div>}
                  {artwork.country && <div><span className="artwork-meta-label">Pays d'origine</span>{artwork.country}</div>}
                </div>
              </div>
              <div className="book-detail-section">
                <div className="book-detail-section-title">Mes notes personnelles</div>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Ce que cette œuvre t'évoque..."
                  value={review}
                  onChange={e => setReview(e.target.value)}
                  onBlur={saveReview}
                  style={{ resize: 'vertical' }}
                />
                {savingReview && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Enregistrement...</div>}
              </div>
            </>
          )}

          {activeTab === 'notes' && (
            <div className="book-detail-section">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="book-detail-section-title" style={{ marginBottom: 0 }}>Notes</div>
                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.875rem', fontSize: '0.82rem' }} onClick={() => setShowNoteForm(true)}>
                  + Note
                </button>
              </div>
              {notes.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune note.</div>
              ) : (
                <div className="notes-list">
                  {notes.map(n => (
                    <ArtworkNoteCard
                      key={n.id}
                      note={n}
                      artworkId={artwork.id}
                      onUpdated={updated => setNotes(prev => prev.map(x => x.id === updated.id ? updated : x))}
                      onDeleted={noteId => setNotes(prev => prev.filter(x => x.id !== noteId))}
                    />
                  ))}
                </div>
              )}
              {showNoteForm && (
                <ArtworkNoteForm
                  artworkId={artwork.id}
                  onCreated={note => { setNotes(prev => [note, ...prev]); setShowNoteForm(false) }}
                  onCancel={() => setShowNoteForm(false)}
                />
              )}
            </div>
          )}

          {activeTab === 'media' && (
            <div className="book-detail-section">
              <div className="book-detail-section-title">Médias</div>
              <MediaGallery artworkId={artwork.id} media={media} onChange={setMedia} />
            </div>
          )}

          {activeTab === 'citations' && (
            <div className="book-detail-section" style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="book-detail-section-title" style={{ marginBottom: 0 }}>Citations</div>
                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.875rem', fontSize: '0.82rem' }} onClick={() => setShowCitationForm(true)}>
                  + Citation
                </button>
              </div>
              {citations.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune citation liée à cette œuvre.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {citations.map(c => (
                    <CitationCard
                      key={c.id}
                      citation={c}
                      onClick={() => navigate(`/citations/${c.id}`)}
                      onFavoriteToggle={handleCitationFavoriteToggle}
                    />
                  ))}
                </div>
              )}
              {showCitationForm && (
                <CitationForm
                  defaultArtworkId={artwork.id}
                  onSave={async data => {
                    const { citation } = await citationsApi.create({ ...data, sourceType: 'ARTWORK', artworkId: artwork.id })
                    setCitations(prev => [citation, ...prev])
                    setShowCitationForm(false)
                  }}
                  onClose={() => setShowCitationForm(false)}
                />
              )}
            </div>
          )}
        </div>
      </div>
      {showEditModal && (
        <EditArtworkModal
          artwork={artwork}
          onClose={() => setShowEditModal(false)}
          onUpdated={updated => {
            setArtwork(updated)
            setReview(updated.review || '')
            setShowEditModal(false)
          }}
        />
      )}
      {showDeleteConfirm && artwork && (
        <ConfirmModal
          title="Supprimer cette œuvre"
          message={`Supprimer "${artwork.title}" définitivement ? Cette action est irréversible.`}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
      {showLightbox && artwork.coverUrl && (
        <Lightbox src={artwork.coverUrl} alt={artwork.title} onClose={() => setShowLightbox(false)} />
      )}
    </div>
  )
}
