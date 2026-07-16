import { useState } from 'react'
import { ArtworkNote, artApi } from '../../api/art'
import { ConfirmModal } from '../ui/ConfirmModal'
import { IconTrash } from '../ui/icons'

interface Props {
  note: ArtworkNote
  artworkId: string
  onUpdated: (note: ArtworkNote) => void
  onDeleted: (noteId: string) => void
}

export function ArtworkNoteCard({ note, artworkId, onDeleted }: Props) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  async function confirmDelete() {
    try {
      await artApi.deleteNote(artworkId, note.id)
      onDeleted(note.id)
    } catch {}
  }

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
