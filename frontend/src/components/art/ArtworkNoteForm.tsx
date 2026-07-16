import { useState } from 'react'
import { ArtworkNote, artApi } from '../../api/art'
import { Input } from '../ui/Input'
import { Button } from '../ui/Button'

interface Props {
  artworkId: string
  onCreated: (note: ArtworkNote) => void
  onCancel: () => void
}

export function ArtworkNoteForm({ artworkId, onCreated, onCancel }: Props) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title || !content) return
    setLoading(true)
    try {
      const { note } = await artApi.createNote(artworkId, { title, content })
      onCreated(note)
    } catch {}
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card note-form" style={{ padding: '1.25rem' }}>
      <Input label="Titre *" value={title} onChange={e => setTitle(e.target.value)} required autoFocus />
      <div className="input-group">
        <label className="input-label">Contenu *</label>
        <textarea
          className="input-field"
          rows={4}
          value={content}
          onChange={e => setContent(e.target.value)}
          required
          style={{ resize: 'vertical' }}
        />
      </div>
      <div className="note-form-actions">
        <Button type="button" variant="ghost" className="btn-sm" onClick={onCancel}>Annuler</Button>
        <Button type="submit" loading={loading} className="btn-sm">Enregistrer</Button>
      </div>
    </form>
  )
}
