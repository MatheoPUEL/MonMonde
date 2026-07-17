import { useState, useEffect, useRef } from 'react'
import { readingApi, Book, BookTag, GoogleBookResult, ReadingStatus, STATUS_LABELS } from '../../api/reading'
import { GlassCard } from '../../components/ui/GlassCard'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { AuthorAutocomplete } from '../../components/reading/AuthorAutocomplete'
import { bookInitials } from '../../components/reading/bookInitials'
import { IconClose, IconChevronLeft } from '../../components/ui/icons'

interface Props {
  onClose: () => void
  onAdded: (book: Book) => void
}

export function AddBookModal({ onClose, onAdded }: Props) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 180)
  }

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<GoogleBookResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manual, setManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>('url')
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const [form, setForm] = useState({
    title: '', authorName: '', synopsis: '', isbn: '', pageCount: '',
    coverUrl: '', googleBooksId: '', genres: [] as string[],
    status: 'WISHLIST' as ReadingStatus, owned: false,
  })

  useEffect(() => {
    if (!query.trim() || manual) { setResults([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await readingApi.search(query)
        setResults(data.books)
      } catch {}
      setSearching(false)
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [query, manual])

  function fillFromResult(r: GoogleBookResult) {
    setForm({
      title: r.title, authorName: r.author,
      synopsis: r.synopsis || '', isbn: r.isbn || '',
      pageCount: r.pageCount?.toString() || '',
      coverUrl: r.coverUrl || '', googleBooksId: r.googleBooksId,
      genres: r.genres, status: 'WISHLIST', owned: false,
    })
    setResults([])
    setQuery('')
    setManual(true)
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const t = tagInput.trim()
      if (!tags.includes(t)) setTags(prev => [...prev, t])
      setTagInput('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.authorName) return
    setLoading(true)
    try {
      const { book } = await readingApi.createBook({
        title: form.title,
        authorName: form.authorName,
        synopsis: form.synopsis || undefined,
        isbn: form.isbn || undefined,
        googleBooksId: form.googleBooksId || undefined,
        genres: form.genres,
        status: form.status,
        owned: form.owned,
        pageCount: form.pageCount ? Number(form.pageCount) : undefined,
        coverUrl: coverMode === 'url' ? form.coverUrl || undefined : undefined,
        coverType: coverMode === 'url' ? 'url' : undefined,
        tags: tags as unknown as BookTag[] & string[],
      })

      if (coverMode === 'upload' && fileRef.current?.files?.[0]) {
        try {
          const uploaded = await readingApi.uploadCover(book.id, fileRef.current.files[0])
          onAdded(uploaded.book)
        } catch {
          onAdded(book)
        }
      } else {
        onAdded(book)
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className={`modal-overlay${closing ? ' modal-closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Ajouter un livre</h2>
          <button className="modal-close" onClick={handleClose}><IconClose size={16} /></button>
        </div>

        {!manual ? (
          <>
            <div className="add-search-input-wrap">
              <Input
                placeholder="Rechercher un titre, auteur ou ISBN..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {searching && <div className="add-search-spinner" />}
            </div>

            {results.length > 0 && (
              <div className="add-search-results">
                {results.map(r => (
                  <div key={r.googleBooksId} className="add-search-result-item" onClick={() => fillFromResult(r)}>
                    <div className="add-search-result-cover">
                      {r.coverUrl ? <img src={r.coverUrl} alt={r.title} /> : bookInitials(r.title)}
                    </div>
                    <div className="add-search-result-info">
                      <div className="add-search-result-title">{r.title}</div>
                      <div className="add-search-result-author">{r.author}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query && !searching && results.length === 0 && (
              <div className="add-search-no-results">
                Aucun résultat.{' '}
                <button className="manual-toggle" onClick={() => setManual(true)}>Saisie manuelle</button>
              </div>
            )}

            <button className="manual-toggle" onClick={() => setManual(true)}>Saisie manuelle →</button>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="add-form">
            <div className="add-form-row">
              <Input label="Titre *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
              <div className="input-group">
                <label className="input-label">Auteur *</label>
                <AuthorAutocomplete
                  value={form.authorName}
                  onChange={v => setForm(f => ({ ...f, authorName: v }))}
                  required
                />
              </div>
            </div>

            <div className="input-group">
              <label className="input-label">Synopsis</label>
              <textarea
                className="input-field"
                rows={3}
                value={form.synopsis}
                onChange={e => setForm(f => ({ ...f, synopsis: e.target.value }))}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div className="add-form-row">
              <Input label="ISBN" value={form.isbn} onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))} />
              <Input label="Nombre de pages" type="number" min="1" value={form.pageCount} onChange={e => setForm(f => ({ ...f, pageCount: e.target.value }))} />
            </div>

            <div className="input-group">
              <label className="input-label">Statut</label>
              <select className="status-select" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ReadingStatus }))}>
                {(Object.keys(STATUS_LABELS) as ReadingStatus[]).map(s => (
                  <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                ))}
              </select>
            </div>

            <div className="input-group cover-options">
              <label className="input-label">Couverture</label>
              <div className="cover-radio-group">
                <label><input type="radio" name="coverMode" value="url" checked={coverMode === 'url'} onChange={() => setCoverMode('url')} /> URL externe</label>
                <label><input type="radio" name="coverMode" value="upload" checked={coverMode === 'upload'} onChange={() => setCoverMode('upload')} /> Upload</label>
              </div>
              {coverMode === 'url' ? (
                <Input placeholder="https://..." value={form.coverUrl} onChange={e => setForm(f => ({ ...f, coverUrl: e.target.value }))} />
              ) : (
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="input-field" style={{ padding: '0.5rem' }} />
              )}
            </div>

            <div className="tags-input-wrap">
              <label className="input-label">Tags</label>
              <div className="tags-chips">
                {tags.map(t => (
                  <span key={t} className="tag-chip">
                    {t}
                    <button type="button" className="tag-chip-remove" onClick={() => setTags(prev => prev.filter(x => x !== t))}>×</button>
                  </span>
                ))}
              </div>
              <input
                className="input-field"
                placeholder="Ajouter un tag (Entrée pour valider)"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={addTag}
              />
            </div>

            <label className="owned-toggle">
              <input type="checkbox" checked={form.owned} onChange={e => setForm(f => ({ ...f, owned: e.target.checked }))} />
              Je possède ce livre
            </label>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <Button type="button" variant="ghost" className="btn-sm" onClick={() => setManual(false)}><IconChevronLeft size={12} /> Retour</Button>
              <Button type="submit" loading={loading} className="btn-sm">Ajouter</Button>
            </div>
          </form>
        )}
      </GlassCard>
    </div>
  )
}
