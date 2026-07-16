import { useRef, useState } from 'react'
import { ArtworkMedia, artApi } from '../../api/art'
import { IconUpload, IconTrash, IconFile, IconVideo, IconAudio } from '../ui/icons'
import { ConfirmModal } from '../ui/ConfirmModal'

interface Props {
  artworkId: string
  media: ArtworkMedia[]
  onChange: (media: ArtworkMedia[]) => void
}

export function MediaGallery({ artworkId, media, onChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [toDelete, setToDelete] = useState<ArtworkMedia | null>(null)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files || !files.length) return
    setUploading(true)
    setError('')
    try {
      const { media: uploaded } = await artApi.uploadMedia(artworkId, Array.from(files))
      onChange([...uploaded, ...media])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'upload")
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function confirmDelete() {
    if (!toDelete) return
    try {
      await artApi.deleteMedia(artworkId, toDelete.id)
      onChange(media.filter(m => m.id !== toDelete.id))
    } catch {}
    setToDelete(null)
  }

  return (
    <div className="media-gallery">
      <div className="media-gallery-grid">
        {media.map(m => (
          <div key={m.id} className="media-item">
            {m.type === 'IMAGE' ? (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="media-item-thumb">
                <img src={m.url} alt={m.originalName || m.filename} loading="lazy" />
              </a>
            ) : (
              <a href={m.url} target="_blank" rel="noopener noreferrer" className="media-item-thumb media-item-thumb--file">
                {m.type === 'VIDEO' ? <IconVideo size={22} /> : m.type === 'AUDIO' ? <IconAudio size={22} /> : <IconFile size={22} />}
              </a>
            )}
            <div className="media-item-name" title={m.originalName || m.filename}>{m.originalName || m.filename}</div>
            <button type="button" className="media-item-remove" onClick={() => setToDelete(m)} aria-label="Supprimer">
              <IconTrash size={12} />
            </button>
          </div>
        ))}
        <label className="media-item media-item-add">
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={handleFiles}
            accept="image/*,application/pdf,video/*,audio/*"
          />
          <IconUpload size={18} />
          <span>{uploading ? 'Envoi…' : 'Ajouter'}</span>
        </label>
      </div>
      {error && <div className="citation-form-error">{error}</div>}
      {toDelete && (
        <ConfirmModal
          title="Supprimer ce média"
          message={`Supprimer "${toDelete.originalName || toDelete.filename}" définitivement ?`}
          onConfirm={confirmDelete}
          onCancel={() => setToDelete(null)}
        />
      )}
    </div>
  )
}
