import { useState } from 'react'
import { BookNote, readingApi } from '../../api/reading'
import { ConfirmModal } from '../ui/ConfirmModal'
import { IconTrash } from '../ui/icons'

interface Props {
  note: BookNote
  bookId: string
  onUpdated: (note: BookNote) => void
  onDeleted: (noteId: string) => void
}

export function NoteCard({ note, bookId, onDeleted }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function confirmDelete() {
    try {
      await readingApi.deleteNote(bookId, note.id)
      onDeleted(note.id)
    } catch {}
  }

  const ref = note.chapter
    ? `${note.chapter}${note.page ? ` · p.${note.page}` : ''}`
    : note.page ? `p.${note.page}` : null

  return (
    <>
      <div className="note-card">
        <div className="note-card-header">
          <div className="note-card-title">{note.title}</div>
          <div className="note-card-actions">
            <button className="btn-icon" onClick={() => setShowDeleteConfirm(true)} title="Supprimer"><IconTrash size={13} /></button>
          </div>
        </div>
        <div className="note-card-content">{note.content}</div>
        {ref && <div className="note-card-ref">{ref}</div>}
        <div className="note-card-date">
          {new Date(note.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
      {showDeleteConfirm && (
        <ConfirmModal
          title="Supprimer cette note"
          message="Supprimer cette note définitivement ? Cette action est irréversible."
          onConfirm={confirmDelete}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  )
}
