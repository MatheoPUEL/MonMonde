import { useState, useRef } from 'react'
import { readingApi, Book } from '../../api/reading'
import { GlassCard } from '../../components/ui/GlassCard'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { AuthorAutocomplete } from '../../components/reading/AuthorAutocomplete'

interface Props {
  book: Book
  onClose: () => void
  onUpdated: (book: Book) => void
}

export function EditBookModal({ book, onClose, onUpdated }: Props) {
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>(
    book.coverType === 'upload' ? 'upload' : 'url'
  )
  const [tagInput, setTagInput] = useState('')
  const [tags, setTags] = useState<string[]>(book.tags.map(t => t.name))
  const [genreInput, setGenreInput] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: book.title,
    authorName: book.author.name,
    synopsis: book.synopsis || '',
    isbn: book.isbn || '',
    pageCount: book.pageCount?.toString() || '',
    coverUrl: book.coverUrl || '',
    genres: book.genres,
  })

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 180)
  }

  function addTag(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault()
      const t = tagInput.trim()
      if (!tags.includes(t)) setTags(prev => [...prev, t])
      setTagInput('')
    }
  }

  function addGenre(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && genreInput.trim()) {
      e.preventDefault()
      const g = genreInput.trim()
      if (!form.genres.includes(g)) setForm(f => ({ ...f, genres: [...f.genres, g] }))
      setGenreInput('')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.authorName) return
    setLoading(true)
    try {
      const { book: updated } = await readingApi.updateBook(book.id, {
        title: form.title,
        authorName: form.authorName,
        synopsis: form.synopsis || undefined,
        isbn: form.isbn || undefined,
        pageCount: form.pageCount ? Number(form.pageCount) : undefined,
        coverUrl: coverMode === 'url' ? form.coverUrl || undefined : undefined,
        coverType: coverMode === 'url' ? 'url' : undefined,
        genres: form.genres,
        tags,
      })

      if (coverMode === 'upload' && fileRef.current?.files?.[0]) {
        try {
          const result = await readingApi.uploadCover(updated.id, fileRef.current.files[0])
          setLoading(false)
          onUpdated(result.book)
        } catch {
          setLoading(false)
          onUpdated(updated)
        }
      } else {
        setLoading(false)
        onUpdated(updated)
      }
      handleClose()
    } catch {
      setLoading(false)
    }
  }

  return (
    <div
      className={`modal-overlay${closing ? ' modal-closing' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Modifier le livre</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="add-form">
          <div className="add-form-row">
            <Input
              label="Titre *"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              required
            />
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
            <Input
              label="ISBN"
              value={form.isbn}
              onChange={e => setForm(f => ({ ...f, isbn: e.target.value }))}
            />
            <Input
              label="Nombre de pages"
              type="number"
              min="1"
              value={form.pageCount}
              onChange={e => setForm(f => ({ ...f, pageCount: e.target.value }))}
            />
          </div>

          <div className="input-group cover-options">
            <label className="input-label">Couverture</label>
            <div className="cover-radio-group">
              <label>
                <input
                  type="radio"
                  name="coverMode"
                  value="url"
                  checked={coverMode === 'url'}
                  onChange={() => setCoverMode('url')}
                /> URL externe
              </label>
              <label>
                <input
                  type="radio"
                  name="coverMode"
                  value="upload"
                  checked={coverMode === 'upload'}
                  onChange={() => setCoverMode('upload')}
                /> Upload
              </label>
            </div>
            {coverMode === 'url' ? (
              <Input
                placeholder="https://..."
                value={form.coverUrl}
                onChange={e => setForm(f => ({ ...f, coverUrl: e.target.value }))}
              />
            ) : (
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="input-field"
                style={{ padding: '0.5rem' }}
              />
            )}
          </div>

          <div className="tags-input-wrap">
            <label className="input-label">Genres</label>
            <div className="tags-chips">
              {form.genres.map(g => (
                <span key={g} className="tag-chip">
                  {g}
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => setForm(f => ({ ...f, genres: f.genres.filter(x => x !== g) }))}
                  >×</button>
                </span>
              ))}
            </div>
            <input
              className="input-field"
              placeholder="Ajouter un genre (Entrée pour valider)"
              value={genreInput}
              onChange={e => setGenreInput(e.target.value)}
              onKeyDown={addGenre}
            />
          </div>

          <div className="tags-input-wrap">
            <label className="input-label">Tags</label>
            <div className="tags-chips">
              {tags.map(t => (
                <span key={t} className="tag-chip">
                  {t}
                  <button
                    type="button"
                    className="tag-chip-remove"
                    onClick={() => setTags(prev => prev.filter(x => x !== t))}
                  >×</button>
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

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" className="btn-sm" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" loading={loading} className="btn-sm">
              Enregistrer
            </Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
