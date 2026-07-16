import { useState, useRef } from 'react'
import { artApi, Artwork } from '../../api/art'
import { GlassCard } from '../../components/ui/GlassCard'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ArtistAutocomplete } from '../../components/art/ArtistAutocomplete'
import { ChipsField } from '../../components/art/ChipsField'
import { IconClose } from '../../components/ui/icons'

interface Props {
  artwork: Artwork
  onClose: () => void
  onUpdated: (artwork: Artwork) => void
}

export function EditArtworkModal({ artwork, onClose, onUpdated }: Props) {
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>(
    artwork.coverType === 'upload' ? 'upload' : 'url'
  )
  const [tags, setTags] = useState<string[]>(artwork.tags.map(t => t.name))
  const fileRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    title: artwork.title,
    artistName: artwork.artist.name,
    dateDisplay: artwork.dateDisplay || '',
    year: artwork.year?.toString() || '',
    century: artwork.century?.toString() || '',
    period: artwork.period || '',
    movements: artwork.movements,
    currents: artwork.currents,
    themes: artwork.themes,
    technique: artwork.technique || '',
    medium: artwork.medium || '',
    dimensions: artwork.dimensions || '',
    country: artwork.country || '',
    museum: artwork.museum || '',
    description: artwork.description || '',
    coverUrl: artwork.coverUrl || '',
  })

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 180)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.artistName) return
    setLoading(true)
    try {
      const { artwork: updated } = await artApi.updateArtwork(artwork.id, {
        title: form.title,
        artistName: form.artistName,
        dateDisplay: form.dateDisplay || undefined,
        year: form.year ? Number(form.year) : undefined,
        century: form.century ? Number(form.century) : undefined,
        period: form.period || undefined,
        movements: form.movements,
        currents: form.currents,
        themes: form.themes,
        technique: form.technique || undefined,
        medium: form.medium || undefined,
        dimensions: form.dimensions || undefined,
        country: form.country || undefined,
        museum: form.museum || undefined,
        description: form.description || undefined,
        coverUrl: coverMode === 'url' ? form.coverUrl || undefined : undefined,
        coverType: coverMode === 'url' ? 'url' : undefined,
        tags,
      })

      if (coverMode === 'upload' && fileRef.current?.files?.[0]) {
        try {
          const result = await artApi.uploadCover(updated.id, fileRef.current.files[0])
          setLoading(false)
          onUpdated(result.artwork)
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
    <div className={`modal-overlay${closing ? ' modal-closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Modifier l'œuvre</h2>
          <button className="modal-close" onClick={handleClose}><IconClose size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="add-form">
          <div className="add-form-row">
            <Input label="Titre *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required />
            <div className="input-group">
              <label className="input-label">Artiste *</label>
              <ArtistAutocomplete
                value={form.artistName}
                onChange={v => setForm(f => ({ ...f, artistName: v }))}
                required
              />
            </div>
          </div>

          <div className="add-form-row">
            <Input label="Date de création" value={form.dateDisplay} onChange={e => setForm(f => ({ ...f, dateDisplay: e.target.value }))} />
            <Input label="Année" type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
            <Input label="Siècle" type="number" value={form.century} onChange={e => setForm(f => ({ ...f, century: e.target.value }))} />
          </div>

          <Input label="Période" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />

          <ChipsField label="Mouvement artistique" values={form.movements} onChange={v => setForm(f => ({ ...f, movements: v }))} />
          <ChipsField label="Courant artistique" values={form.currents} onChange={v => setForm(f => ({ ...f, currents: v }))} />
          <ChipsField label="Thème" values={form.themes} onChange={v => setForm(f => ({ ...f, themes: v }))} />

          <div className="add-form-row">
            <Input label="Technique" value={form.technique} onChange={e => setForm(f => ({ ...f, technique: e.target.value }))} />
            <Input label="Support" value={form.medium} onChange={e => setForm(f => ({ ...f, medium: e.target.value }))} />
            <Input label="Dimensions" value={form.dimensions} onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))} />
          </div>

          <div className="add-form-row">
            <Input label="Pays d'origine" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
            <Input label="Musée / lieu de conservation" value={form.museum} onChange={e => setForm(f => ({ ...f, museum: e.target.value }))} />
          </div>

          <div className="input-group">
            <label className="input-label">Description</label>
            <textarea
              className="input-field"
              rows={3}
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="input-group cover-options">
            <label className="input-label">Image principale</label>
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

          <ChipsField label="Tags" values={tags} onChange={setTags} />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <Button type="button" variant="ghost" className="btn-sm" onClick={handleClose}>Annuler</Button>
            <Button type="submit" loading={loading} className="btn-sm">Enregistrer</Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
