import { useState, useEffect, useRef } from 'react'
import { artApi, Artwork, ArtSearchResult } from '../../api/art'
import { GlassCard } from '../../components/ui/GlassCard'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { ArtistAutocomplete } from '../../components/art/ArtistAutocomplete'
import { ChipsField } from '../../components/art/ChipsField'
import { artworkInitials } from '../../components/art/artworkInitials'
import { IconClose, IconChevronLeft } from '../../components/ui/icons'

interface Props {
  onClose: () => void
  onAdded: (artwork: Artwork) => void
}

export function AddArtworkModal({ onClose, onAdded }: Props) {
  const [closing, setClosing] = useState(false)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 180)
  }

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ArtSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [manual, setManual] = useState(false)
  const [loading, setLoading] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const [coverMode, setCoverMode] = useState<'url' | 'upload'>('url')
  const fileRef = useRef<HTMLInputElement>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>()

  const [form, setForm] = useState({
    title: '', artistName: '', dateDisplay: '', year: '', century: '', period: '',
    movements: [] as string[], currents: [] as string[], themes: [] as string[],
    technique: '', medium: '', dimensions: '', country: '', museum: '', description: '',
    coverUrl: '', sourceApi: '', sourceId: '', sourceUrl: '',
  })

  useEffect(() => {
    if (!query.trim() || manual) { setResults([]); return }
    clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(async () => {
      setSearching(true)
      try {
        const data = await artApi.search(query)
        setResults(data.artworks)
      } catch {}
      setSearching(false)
    }, 400)
    return () => clearTimeout(searchTimeout.current)
  }, [query, manual])

  function fillFromResult(r: ArtSearchResult) {
    setForm({
      title: r.title, artistName: r.artist,
      dateDisplay: r.dateDisplay || '', year: r.year?.toString() || '', century: r.century?.toString() || '',
      period: '', movements: [], currents: r.currents, themes: r.themes,
      technique: r.technique || '', medium: r.medium || '', dimensions: r.dimensions || '',
      country: r.country || '', museum: r.museum, description: '',
      coverUrl: r.imageUrl || '', sourceApi: r.sourceApi, sourceId: r.sourceId, sourceUrl: r.sourceUrl || '',
    })
    setResults([])
    setQuery('')
    setManual(true)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title || !form.artistName) return
    setLoading(true)
    try {
      const { artwork } = await artApi.createArtwork({
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
        sourceApi: form.sourceApi || undefined,
        sourceId: form.sourceId || undefined,
        sourceUrl: form.sourceUrl || undefined,
        tags,
      })

      if (coverMode === 'upload' && fileRef.current?.files?.[0]) {
        try {
          const uploaded = await artApi.uploadCover(artwork.id, fileRef.current.files[0])
          onAdded(uploaded.artwork)
        } catch {
          onAdded(artwork)
        }
      } else {
        onAdded(artwork)
      }
    } catch {}
    setLoading(false)
  }

  return (
    <div className={`modal-overlay${closing ? ' modal-closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Ajouter une œuvre</h2>
          <button className="modal-close" onClick={handleClose}><IconClose size={16} /></button>
        </div>

        {!manual ? (
          <>
            <div className="search-input-wrap">
              <Input
                placeholder="Rechercher un titre, un artiste..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                autoFocus
              />
              {searching && <div className="search-spinner" />}
            </div>

            {results.length > 0 && (
              <div className="search-results">
                {results.map(r => (
                  <div key={`${r.sourceApi}-${r.sourceId}`} className="search-result-item" onClick={() => fillFromResult(r)}>
                    <div className="search-result-cover">
                      {r.imageUrl ? <img src={r.imageUrl} alt={r.title} /> : artworkInitials(r.title)}
                    </div>
                    <div className="search-result-info">
                      <div className="search-result-title">{r.title}</div>
                      <div className="search-result-author">{r.artist} {r.dateDisplay ? `· ${r.dateDisplay}` : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {query && !searching && results.length === 0 && (
              <div className="search-no-results">
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
                <label className="input-label">Artiste *</label>
                <ArtistAutocomplete
                  value={form.artistName}
                  onChange={v => setForm(f => ({ ...f, artistName: v }))}
                  required
                />
              </div>
            </div>

            <div className="add-form-row">
              <Input label="Date de création" placeholder="ex: vers 1503–1519" value={form.dateDisplay} onChange={e => setForm(f => ({ ...f, dateDisplay: e.target.value }))} />
              <Input label="Année" type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} />
              <Input label="Siècle" type="number" value={form.century} onChange={e => setForm(f => ({ ...f, century: e.target.value }))} />
            </div>

            <Input label="Période" placeholder="ex: Haute Renaissance" value={form.period} onChange={e => setForm(f => ({ ...f, period: e.target.value }))} />

            <ChipsField label="Mouvement artistique" values={form.movements} onChange={v => setForm(f => ({ ...f, movements: v }))} placeholder="ex: Renaissance" />
            <ChipsField label="Courant artistique" values={form.currents} onChange={v => setForm(f => ({ ...f, currents: v }))} placeholder="ex: Impressionnisme" />
            <ChipsField label="Thème" values={form.themes} onChange={v => setForm(f => ({ ...f, themes: v }))} placeholder="ex: Portrait" />

            <div className="add-form-row">
              <Input label="Technique" value={form.technique} onChange={e => setForm(f => ({ ...f, technique: e.target.value }))} />
              <Input label="Support" value={form.medium} onChange={e => setForm(f => ({ ...f, medium: e.target.value }))} />
              <Input label="Dimensions" placeholder="ex: 73 x 92 cm" value={form.dimensions} onChange={e => setForm(f => ({ ...f, dimensions: e.target.value }))} />
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

            <ChipsField label="Tags" values={tags} onChange={setTags} placeholder="Ajouter un tag (Entrée pour valider)" />

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
