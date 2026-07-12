# Edit Book Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter un bouton "✏ Modifier" dans la page `BookDetail` qui ouvre une modal pré-remplie pour éditer les métadonnées d'un livre (titre, auteur, synopsis, ISBN, pages, genres, tags, couverture).

**Architecture:** Nouveau composant `EditBookModal` calqué sur `AddBookModal` mais sans la phase de recherche Google Books — il arrive directement sur le formulaire pré-rempli avec les données du livre existant. Le composant appelle `readingApi.updateBook` puis `readingApi.uploadCover` si nécessaire. `BookDetail` reçoit le livre mis à jour via callback `onUpdated`.

**Tech Stack:** React, TypeScript, CSS existant (classes `modal-*`, `add-form`, `btn-side`, `input-field`), `AuthorAutocomplete`, `readingApi.updateBook`, `readingApi.uploadCover`.

---

### Task 1 : Créer `EditBookModal.tsx`

**Files:**
- Create: `frontend/src/pages/reading/EditBookModal.tsx`

- [ ] **Step 1 : Créer le composant avec le formulaire pré-rempli**

```tsx
// frontend/src/pages/reading/EditBookModal.tsx
import { useState, useRef } from 'react'
import { readingApi, Book, BookTag, ReadingStatus, STATUS_LABELS } from '../../api/reading'
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
        tags: tags as unknown as BookTag[] & string[],
      })

      if (coverMode === 'upload' && fileRef.current?.files?.[0]) {
        try {
          const result = await readingApi.uploadCover(updated.id, fileRef.current.files[0])
          onUpdated(result.book)
        } catch {
          onUpdated(updated)
        }
      } else {
        onUpdated(updated)
      }
      handleClose()
    } catch {}
    setLoading(false)
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
```

- [ ] **Step 2 : Vérifier que le fichier compile sans erreur TypeScript**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npx tsc --noEmit 2>&1 | grep EditBookModal
```

Expected: aucune sortie (zéro erreur sur ce fichier).

- [ ] **Step 3 : Commit**

```bash
git add "frontend/src/pages/reading/EditBookModal.tsx"
git commit -m "feat: add EditBookModal component for editing book metadata"
```

---

### Task 2 : Intégrer le bouton et la modal dans `BookDetail`

**Files:**
- Modify: `frontend/src/pages/reading/BookDetail.tsx`

- [ ] **Step 1 : Ajouter l'import et le state**

Dans `frontend/src/pages/reading/BookDetail.tsx`, ajouter l'import en haut du fichier :

```tsx
import { EditBookModal } from './EditBookModal'
```

Puis dans le corps du composant `BookDetail`, après la ligne `const [showCitationForm, setShowCitationForm] = useState(false)`, ajouter :

```tsx
const [showEditModal, setShowEditModal] = useState(false)
```

- [ ] **Step 2 : Ajouter le bouton "Modifier" dans les actions latérales**

Localiser le bloc `book-detail-side-actions` (autour de la ligne 126). Ajouter le bouton **avant** le bouton Favori :

```tsx
<div className="book-detail-side-actions">
  <button
    className="btn-side"
    onClick={() => setShowEditModal(true)}
  >
    ✏ Modifier
  </button>
  <button
    className={`btn-side ${book.favorite ? 'btn-side--active' : ''}`}
    onClick={() => update({ favorite: !book.favorite })}
  >
    {book.favorite ? '★' : '☆'} Favori
  </button>
  {/* ... reste des boutons inchangés ... */}
```

- [ ] **Step 3 : Ajouter le rendu conditionnel de la modal**

Juste avant la balise fermante `</div>` du composant (`return` final), ajouter :

```tsx
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
```

- [ ] **Step 4 : Vérifier la compilation complète**

```bash
cd "/Users/matheopuel/Library/Mobile Documents/com~apple~CloudDocs/Documents/Programmation/Mon monde/frontend"
npx tsc --noEmit 2>&1
```

Expected: aucune erreur TypeScript.

- [ ] **Step 5 : Tester manuellement dans le navigateur**

1. Ouvrir la page d'un livre
2. Cliquer "✏ Modifier" → la modal s'ouvre pré-remplie avec les données du livre
3. Modifier le titre, cliquer "Enregistrer" → la page se met à jour sans rechargement
4. Ouvrir la modal à nouveau → le nouveau titre est bien pré-rempli
5. Appuyer sur Échap ou cliquer l'overlay → la modal se ferme
6. Changer l'auteur via l'autocomplete → vérifier que le lien auteur en haut de page se met à jour
7. Ajouter/supprimer un genre et un tag → vérifier la mise à jour dans les chips de la page

- [ ] **Step 6 : Commit**

```bash
git add "frontend/src/pages/reading/BookDetail.tsx"
git commit -m "feat: wire EditBookModal into BookDetail with edit button"
```
