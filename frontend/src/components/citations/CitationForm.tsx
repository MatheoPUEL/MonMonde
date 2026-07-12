import { useState, useEffect, useRef, useCallback } from 'react'
import type { Citation, CitationInput, SourceType } from '../../api/citations'
import { citationsApi, SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS, PRESET_COLORS } from '../../api/citations'
import { readingApi, type Book } from '../../api/reading'

const SOURCE_TYPES: SourceType[] = [
  'BOOK', 'ARTICLE', 'INTERNET', 'PODCAST', 'FILM', 'SERIES', 'VIDEO', 'PERSON', 'OTHER',
]

interface CitationFormProps {
  initial?: Partial<Citation>
  defaultBookId?: string
  onSave: (data: CitationInput) => Promise<void>
  onClose: () => void
}

export function CitationForm({ initial, defaultBookId, onSave, onClose }: CitationFormProps) {
  const [text, setText] = useState(initial?.text ?? '')
  const [author, setAuthor] = useState(initial?.author ?? '')
  const [sourceType, setSourceType] = useState<SourceType>(initial?.sourceType ?? 'OTHER')
  const [source, setSource] = useState(initial?.source ?? '')
  const [bookId, setBookId] = useState<string | null>(initial?.bookId ?? defaultBookId ?? null)
  const [selectedBook, setSelectedBook] = useState<Book | null>(null)
  const [bookSearch, setBookSearch] = useState(initial?.book?.title ?? '')
  const [bookResults, setBookResults] = useState<Book[]>([])
  const [showBookResults, setShowBookResults] = useState(false)
  const [page, setPage] = useState<string>(initial?.page != null ? String(initial.page) : '')
  const [chapter, setChapter] = useState(initial?.chapter ?? '')
  const [comment, setComment] = useState(initial?.comment ?? '')
  const [tags, setTags] = useState<string[]>(
    initial?.tags?.map(t => (typeof t === 'string' ? t : (t as { name: string }).name)) ?? []
  )
  const [tagInput, setTagInput] = useState('')
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([])
  const [allTags, setAllTags] = useState<string[]>([])
  const [color, setColor] = useState(initial?.color ?? '#C4775A')
  const [favorite, setFavorite] = useState(initial?.favorite ?? false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const bookSearchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    citationsApi.getTags().then(d => setAllTags(d.tags)).catch(() => {})
  }, [])

  const searchBooks = useCallback((q: string) => {
    if (bookSearchRef.current) clearTimeout(bookSearchRef.current)
    if (!q.trim()) { setBookResults([]); setShowBookResults(false); return }
    bookSearchRef.current = setTimeout(async () => {
      try {
        const d = await readingApi.getBooks({ search: q })
        setBookResults(d.books.slice(0, 6))
        setShowBookResults(true)
      } catch {}
    }, 300)
  }, [])

  function handleBookSearchChange(val: string) {
    setBookSearch(val)
    if (!val) { setBookId(null); setSelectedBook(null) }
    searchBooks(val)
  }

  function selectBook(book: Book) {
    setBookId(book.id)
    setSelectedBook(book)
    setBookSearch(book.title)
    setSource(book.title)
    setAuthor(a => a || book.author.name)
    setShowBookResults(false)
  }

  function handleTagInputKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const newTag = tagInput.trim().replace(/,$/, '')
      if (newTag && !tags.includes(newTag)) setTags(prev => [...prev, newTag])
      setTagInput('')
      setTagSuggestions([])
    } else if (e.key === 'Backspace' && !tagInput && tags.length) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  function handleTagInputChange(val: string) {
    setTagInput(val)
    if (val.trim()) {
      setTagSuggestions(
        allTags.filter(t => t.toLowerCase().includes(val.toLowerCase()) && !tags.includes(t))
      )
    } else {
      setTagSuggestions([])
    }
  }

  function addSuggestion(tag: string) {
    if (!tags.includes(tag)) setTags(prev => [...prev, tag])
    setTagInput('')
    setTagSuggestions([])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) { setError('Le texte de la citation est requis'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        text: text.trim(),
        author: author || undefined,
        sourceType,
        source: source || undefined,
        bookId: bookId || null,
        page: page ? Number(page) : null,
        chapter: chapter || undefined,
        comment: comment || undefined,
        color,
        favorite,
        tags,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="citation-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="citation-form-modal">
        <div className="citation-form-title">
          {initial?.id ? 'Modifier la citation' : 'Nouvelle citation'}
        </div>
        <form onSubmit={handleSubmit}>

          <div className="citation-form-row">
            <label className="citation-form-label">Texte *</label>
            <textarea
              className="input-field"
              rows={4}
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="« La meilleure façon de prédire l'avenir est de l'inventer. »"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="citation-form-row">
            <label className="citation-form-label">Auteur</label>
            <input
              className="input-field"
              value={author}
              onChange={e => setAuthor(e.target.value)}
              placeholder="Alan Kay"
            />
          </div>

          <div className="citation-form-row">
            <label className="citation-form-label">Type de source</label>
            <div className="source-type-grid">
              {SOURCE_TYPES.map(t => (
                <button
                  key={t}
                  type="button"
                  className={`source-type-btn${sourceType === t ? ' active' : ''}`}
                  onClick={() => setSourceType(t)}
                >
                  {SOURCE_TYPE_ICONS[t]} {SOURCE_TYPE_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          {sourceType === 'BOOK' ? (
            <div className="citation-form-row">
              <label className="citation-form-label">Livre</label>
              <div style={{ position: 'relative' }}>
                <input
                  className="input-field"
                  value={bookSearch}
                  onChange={e => handleBookSearchChange(e.target.value)}
                  placeholder="Rechercher dans ta bibliothèque…"
                  onFocus={() => bookSearch && setShowBookResults(true)}
                />
                {showBookResults && bookResults.length > 0 && (
                  <div className="book-search-results">
                    {bookResults.map(b => (
                      <div key={b.id} className="book-search-item" onClick={() => selectBook(b)}>
                        <div>
                          <div className="book-search-item-title">{b.title}</div>
                          <div className="book-search-item-author">{b.author.name}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedBook && (
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                  ✓ Lié à <strong>{selectedBook.title}</strong>
                </div>
              )}
            </div>
          ) : (
            <div className="citation-form-row">
              <label className="citation-form-label">Source</label>
              <input
                className="input-field"
                value={source}
                onChange={e => setSource(e.target.value)}
                placeholder="Titre de l'article, nom du podcast…"
              />
            </div>
          )}

          {sourceType === 'BOOK' && (
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <div className="citation-form-row" style={{ flex: 1 }}>
                <label className="citation-form-label">Page</label>
                <input
                  className="input-field"
                  type="number"
                  min={1}
                  value={page}
                  onChange={e => setPage(e.target.value)}
                  placeholder="42"
                />
              </div>
              <div className="citation-form-row" style={{ flex: 1 }}>
                <label className="citation-form-label">Chapitre</label>
                <input
                  className="input-field"
                  value={chapter}
                  onChange={e => setChapter(e.target.value)}
                  placeholder="III"
                />
              </div>
            </div>
          )}

          <div className="citation-form-row">
            <label className="citation-form-label">Commentaire personnel</label>
            <textarea
              className="input-field"
              rows={3}
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder="Ce que tu retiens, les liens avec d'autres idées…"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="citation-form-row">
            <label className="citation-form-label">Tags</label>
            <div className="tag-input-wrap" onClick={() => document.getElementById('tag-input-field')?.focus()}>
              {tags.map(t => (
                <span key={t} className="tag-chip">
                  {t}
                  <button type="button" className="tag-chip-remove" onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                </span>
              ))}
              <div style={{ position: 'relative', flex: 1 }}>
                <input
                  id="tag-input-field"
                  className="tag-input-field"
                  value={tagInput}
                  onChange={e => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  placeholder={tags.length === 0 ? 'Philo, Stoïcisme…' : ''}
                />
                {tagSuggestions.length > 0 && (
                  <div className="tag-suggestions">
                    {tagSuggestions.map(s => (
                      <div key={s} className="tag-suggestion-item" onClick={() => addSuggestion(s)}>{s}</div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="citation-form-row">
            <label className="citation-form-label">Couleur de la bande</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  style={{
                    width: 28, height: 28, borderRadius: '50%', background: c,
                    cursor: 'pointer',
                    border: `2px solid ${color === c ? 'rgba(0,0,0,0.35)' : 'transparent'}`,
                    transform: color === c ? 'scale(1.2)' : 'scale(1)',
                    transition: 'all 0.1s',
                  }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="citation-form-row">
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={favorite} onChange={e => setFavorite(e.target.checked)} />
              Marquer comme favori
            </label>
          </div>

          {error && <div className="citation-form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost form-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary form-btn" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
