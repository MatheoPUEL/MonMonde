import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { readingApi, Book, BookNote, ReadingStatus, STATUS_LABELS } from '../../api/reading'
import { citationsApi, type Citation } from '../../api/citations'
import { StarRating } from '../../components/reading/StarRating'
import { ProgressUpdateForm } from '../../components/reading/ProgressUpdateForm'
import { NoteCard } from '../../components/reading/NoteCard'
import { NoteForm } from '../../components/reading/NoteForm'
import { BookStatusBadge } from '../../components/reading/BookStatusBadge'
import { CitationCard } from '../../components/citations/CitationCard'
import { CitationForm } from '../../components/citations/CitationForm'
import { EditBookModal } from './EditBookModal'
import { ConfirmModal } from '../../components/ui/ConfirmModal'
import { bookInitials } from '../../components/reading/bookInitials'
import { IconChevronLeft, IconEdit, IconStar, IconRedo, IconTrash, IconClose } from '../../components/ui/icons'

export function BookDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [book, setBook] = useState<Book | null>(null)
  const [notes, setNotes] = useState<BookNote[]>([])
  const [loading, setLoading] = useState(true)
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [review, setReview] = useState('')
  const [savingReview, setSavingReview] = useState(false)
  const [activeTab, setActiveTab] = useState<'info' | 'notes' | 'citations'>('info')
  const [citations, setCitations] = useState<Citation[]>([])
  const [citationsLoaded, setCitationsLoaded] = useState(false)
  const [showCitationForm, setShowCitationForm] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([readingApi.getBook(id), readingApi.getNotes(id)])
      .then(([bookData, notesData]) => {
        setBook(bookData.book)
        setReview(bookData.book.review || '')
        setNotes(notesData.notes)
      })
      .catch(() => navigate('/reading'))
      .finally(() => setLoading(false))
  }, [id, navigate])

  async function update(data: Parameters<typeof readingApi.updateBook>[1]) {
    if (!book) return
    try {
      const { book: updated } = await readingApi.updateBook(book.id, data)
      setBook(updated)
    } catch {}
  }

  async function saveReview() {
    if (!book) return
    setSavingReview(true)
    try { await update({ review }) } finally { setSavingReview(false) }
  }

  async function handleDelete() {
    if (!book) return
    setShowDeleteConfirm(true)
  }

  async function confirmDelete() {
    if (!book) return
    try { await readingApi.deleteBook(book.id); navigate('/reading') } catch {}
  }

  async function loadCitations() {
    if (!book || citationsLoaded) return
    try {
      const data = await citationsApi.getByBook(book.id)
      setCitations(data.citations)
      setCitationsLoaded(true)
    } catch {}
  }

  function handleTabChange(tab: 'info' | 'notes' | 'citations') {
    setActiveTab(tab)
    if (tab === 'citations') loadCitations()
  }

  async function handleCitationFavoriteToggle(citationId: string) {
    const { citation } = await citationsApi.toggleFavorite(citationId)
    setCitations(prev => prev.map(c => c.id === citationId ? citation : c))
  }

  if (loading) return <div className="reading-loading"><div className="loading-spinner" /></div>
  if (!book) return null

  const progress = book.currentPage && book.pageCount
    ? Math.round((book.currentPage / book.pageCount) * 100)
    : null

  return (
    <div className="book-detail">
      <button className="book-detail-back" onClick={() => navigate('/reading')}>
        <IconChevronLeft size={14} /> Bibliothèque
      </button>

      <div className="book-detail-layout">
        {/* Left column */}
        <div className="book-detail-left">
          <div className="book-detail-cover-wrap">
            <div className="book-detail-cover">
              {book.coverUrl ? <img src={book.coverUrl} alt={book.title} /> : (
                <span className="book-cover-initials book-cover-initials--lg">{bookInitials(book.title)}</span>
              )}
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">Statut</label>
            <select
              className="status-select"
              value={book.status}
              onChange={e => update({ status: e.target.value as ReadingStatus })}
            >
              {(Object.keys(STATUS_LABELS) as ReadingStatus[]).map(s => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
          </div>

          <label className="owned-toggle" style={{ fontSize: '0.875rem' }}>
            <input
              type="checkbox"
              checked={book.owned}
              onChange={e => update({ owned: e.target.checked })}
              style={{ accentColor: 'var(--accent)' }}
            />
            Je possède ce livre
          </label>

          <div>
            <label className="input-label" style={{ marginBottom: '0.375rem', display: 'block' }}>Ma note</label>
            <StarRating value={book.rating || 0} onChange={v => update({ rating: v })} />
          </div>

          <div className="book-detail-side-actions">
            <button
              className="btn-side"
              onClick={() => setShowEditModal(true)}
            >
              <IconEdit size={14} /> Modifier
            </button>
            <button
              className={`btn-side ${book.favorite ? 'btn-side--active' : ''}`}
              onClick={() => update({ favorite: !book.favorite })}
            >
              <IconStar size={14} filled={book.favorite} /> Favori
            </button>
            <div className="reread-row">
              <button
                className="btn-side reread-btn"
                onClick={() => update({ rereadCount: book.rereadCount + 1 })}
              >
                <IconRedo size={14} /> Relecture ({book.rereadCount})
              </button>
              {book.rereadCount > 0 && (
                <button
                  className="btn-side reread-reset"
                  onClick={() => update({ rereadCount: 0 })}
                  title="Remettre à zéro"
                >
                  <IconClose size={12} />
                </button>
              )}
            </div>
            <button
              className="btn-side btn-side--danger"
              onClick={handleDelete}
            >
              <IconTrash size={14} /> Supprimer
            </button>
          </div>
        </div>

        {/* Right column */}
        <div className="book-detail-right">
          <h1 className="book-detail-title">{book.title}</h1>
          <Link to={`/reading/authors/${book.author.id}`} className="book-detail-author">{book.author.name}</Link>

          <div className="chips-row">
            <BookStatusBadge status={book.status} />
            {book.genres.map(g => <span key={g} className="chip">{g}</span>)}
            {book.tags.map(t => <span key={t.id} className="chip">{t.name}</span>)}
          </div>

          {book.isbn && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>ISBN: {book.isbn}</div>}
          {book.pageCount && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{book.pageCount} pages</div>}

          {/* Tab bar — reuse routines-tabs CSS classes */}
          <div className="routines-tabs" style={{ marginTop: '1.25rem' }}>
            <button
              className={`routines-tab${activeTab === 'info' ? ' active' : ''}`}
              onClick={() => handleTabChange('info')}
            >
              Informations
            </button>
            <button
              className={`routines-tab${activeTab === 'notes' ? ' active' : ''}`}
              onClick={() => handleTabChange('notes')}
            >
              Notes {notes.length > 0 && `(${notes.length})`}
            </button>
            <button
              className={`routines-tab${activeTab === 'citations' ? ' active' : ''}`}
              onClick={() => handleTabChange('citations')}
            >
              Citations {citationsLoaded && citations.length > 0 && `(${citations.length})`}
            </button>
          </div>

          {/* Informations tab */}
          {activeTab === 'info' && (
            <>
              {book.synopsis && (
                <div className="book-detail-section">
                  <div className="book-detail-section-title">Synopsis</div>
                  <div className="book-detail-synopsis">{book.synopsis}</div>
                </div>
              )}
              {(book.status === 'READING' || book.currentPage != null) && (
                <div className="book-detail-section">
                  <div className="book-detail-section-title">
                    Progression {progress != null ? `— ${progress}%` : ''}
                  </div>
                  <ProgressUpdateForm book={book} onUpdated={setBook} />
                </div>
              )}
              <div className="book-detail-section">
                <div className="book-detail-section-title">Mon avis</div>
                <textarea
                  className="input-field"
                  rows={4}
                  placeholder="Ton avis sur ce livre..."
                  value={review}
                  onChange={e => setReview(e.target.value)}
                  onBlur={saveReview}
                  style={{ resize: 'vertical' }}
                />
                {savingReview && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>Enregistrement...</div>}
              </div>
            </>
          )}

          {/* Notes tab */}
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
                    <NoteCard
                      key={n.id}
                      note={n}
                      bookId={book.id}
                      onUpdated={updated => setNotes(prev => prev.map(x => x.id === updated.id ? updated : x))}
                      onDeleted={noteId => setNotes(prev => prev.filter(x => x.id !== noteId))}
                    />
                  ))}
                </div>
              )}
              {showNoteForm && (
                <NoteForm
                  bookId={book.id}
                  onCreated={note => { setNotes(prev => [note, ...prev]); setShowNoteForm(false) }}
                  onCancel={() => setShowNoteForm(false)}
                />
              )}
            </div>
          )}

          {/* Citations tab */}
          {activeTab === 'citations' && (
            <div className="book-detail-section" style={{ marginTop: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <div className="book-detail-section-title" style={{ marginBottom: 0 }}>Citations</div>
                <button className="btn btn-primary" style={{ width: 'auto', padding: '0.4rem 0.875rem', fontSize: '0.82rem' }} onClick={() => setShowCitationForm(true)}>
                  + Citation
                </button>
              </div>
              {citations.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Aucune citation liée à ce livre.</div>
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
                  defaultBookId={book.id}
                  onSave={async data => {
                    const { citation } = await citationsApi.create({ ...data, sourceType: 'BOOK', bookId: book.id })
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
        <EditBookModal
          book={book}
          onClose={() => setShowEditModal(false)}
          onUpdated={updated => {
            setBook(updated)
            setReview(updated.review || '')
            setShowEditModal(false)
          }}
        />
      )}
      {showDeleteConfirm && book && (
        <ConfirmModal
          title="Supprimer ce livre"
          message={`Supprimer "${book.title}" définitivement ? Cette action est irréversible.`}
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </div>
  )
}
