import { useState } from 'react'
import { Link } from 'react-router-dom'
import { museumsApi, MuseumDetail, WikidataMuseumCandidate } from '../../api/art'
import { EnrichPickerModal } from '../ui/EnrichPickerModal'
import { ConfirmModal } from '../ui/ConfirmModal'
import { IconChevronLeft, IconClose, IconPin, IconStar, IconTrash, IconCheck } from '../ui/icons'
import { artworkInitials } from './artworkInitials'
import { CoverImage } from '../ui/CoverImage'
import { MUSEUM_STATUS_LABELS, todayIso } from './museumStatus'

interface Props {
  museum: MuseumDetail
  onBack: () => void
  onChanged: (museum: MuseumDetail) => void
  onDeleted: (id: string) => void
}

function formatVisitDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export function MuseumPanel({ museum, onBack, onChanged, onDeleted }: Props) {
  const [visitDate, setVisitDate] = useState(todayIso)
  const [visitNote, setVisitNote] = useState('')
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [candidates, setCandidates] = useState<WikidataMuseumCandidate[] | null>(null)
  const [locating, setLocating] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function run(action: () => Promise<{ museum: MuseumDetail }>) {
    setSaving(true)
    setError('')
    try {
      const { museum: updated } = await action()
      onChanged(updated)
      return true
    } catch (e) {
      setError((e as Error).message)
      return false
    } finally {
      setSaving(false)
    }
  }

  async function addVisit(e: React.FormEvent) {
    e.preventDefault()
    const ok = await run(() => museumsApi.addVisit(museum.id, { date: visitDate, note: visitNote || undefined }))
    if (ok) {
      setShowVisitForm(false)
      setVisitNote('')
      setVisitDate(todayIso())
    }
  }

  async function openLocatePicker() {
    setLocating(true)
    setError('')
    try {
      const { candidates } = await museumsApi.getLocateCandidates(museum.id)
      if (candidates.length) setCandidates(candidates)
      else setError('Aucun lieu correspondant sur Wikidata.')
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLocating(false)
    }
  }

  async function applyLocation(wikidataId: string) {
    if (await run(() => museumsApi.locate(museum.id, wikidataId))) setCandidates(null)
  }

  async function remove() {
    setConfirmDelete(false)
    try {
      await museumsApi.delete(museum.id)
      onDeleted(museum.id)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const place = [museum.city, museum.country].filter(Boolean).join(', ')

  return (
    <div className="museum-panel">
      <button className="museum-panel-back" onClick={onBack}>
        <IconChevronLeft size={14} /> Tous les musées
      </button>

      <div className="museum-panel-head">
        <span className={`museum-status museum-status--${museum.status}`}>
          <span className="museum-dot" /> {MUSEUM_STATUS_LABELS[museum.status]}
        </span>
        <h2 className="museum-panel-title">{museum.name}</h2>
        {place && <div className="museum-panel-place">{place}</div>}
        {museum.latitude == null && (
          <div className="museum-panel-place museum-panel-place--missing">
            <IconPin size={12} /> Pas encore placé sur la carte
          </div>
        )}
      </div>

      <div className="museum-panel-actions">
        <button className="btn-side" onClick={() => setShowVisitForm(v => !v)} disabled={saving}>
          <IconCheck size={14} /> Ajouter une visite
        </button>
        {museum.visitCount === 0 && (
          <button
            className={`btn-side ${museum.wishlist ? 'btn-side--active' : ''}`}
            onClick={() => run(() => museumsApi.update(museum.id, { wishlist: !museum.wishlist }))}
            disabled={saving}
          >
            <IconStar size={14} filled={museum.wishlist} /> À visiter
          </button>
        )}
        <button className="btn-side" onClick={openLocatePicker} disabled={locating || saving}>
          <IconPin size={14} /> {locating ? 'Recherche…' : museum.latitude == null ? 'Localiser' : 'Corriger la position'}
        </button>
        {museum.artworkCount === 0 && (
          <button className="btn-side btn-side--danger" onClick={() => setConfirmDelete(true)}>
            <IconTrash size={14} /> Retirer
          </button>
        )}
      </div>

      {error && <div className="museum-panel-error">{error}</div>}

      {showVisitForm && (
        <form className="museum-visit-form" onSubmit={addVisit}>
          <input
            type="date"
            className="input-field"
            value={visitDate}
            max={todayIso()}
            onChange={e => setVisitDate(e.target.value)}
            required
          />
          <input
            className="input-field"
            placeholder="Note (facultatif) — expo, salle préférée…"
            value={visitNote}
            onChange={e => setVisitNote(e.target.value)}
          />
          <div className="museum-visit-form-actions">
            <button type="button" className="btn btn-ghost" onClick={() => setShowVisitForm(false)}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>Enregistrer</button>
          </div>
        </form>
      )}

      {museum.visits.length > 0 && (
        <section className="museum-panel-section">
          <div className="book-detail-section-title">
            Visites ({museum.visits.length})
          </div>
          <ul className="museum-visits">
            {museum.visits.map(v => (
              <li key={v.id} className="museum-visit">
                <div>
                  <div className="museum-visit-date">{formatVisitDate(v.date)}</div>
                  {v.note && <div className="museum-visit-note">{v.note}</div>}
                </div>
                <button
                  className="museum-visit-delete"
                  aria-label="Supprimer la visite"
                  onClick={() => run(() => museumsApi.deleteVisit(museum.id, v.id))}
                  disabled={saving}
                >
                  <IconClose size={12} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="museum-panel-section">
        <div className="book-detail-section-title">
          Mes œuvres ici ({museum.artworks.length})
        </div>
        {museum.artworks.length === 0 ? (
          <p className="museum-panel-empty">Aucune œuvre de ta collection n'est conservée ici.</p>
        ) : (
          <div className="museum-artworks">
            {museum.artworks.map(a => (
              <Link key={a.id} to={`/art/${a.id}`} className="museum-artwork">
                <div className="museum-artwork-cover">
                  <CoverImage
                    kind="artwork"
                    id={a.id}
                    src={a.coverUrl}
                    alt={a.title}
                    loading="lazy"
                    fallback={<span className="artwork-cover-initials artwork-cover-initials--sm">{artworkInitials(a.title)}</span>}
                  />
                </div>
                <div className="museum-artwork-info">
                  <div className="museum-artwork-title">{a.title}</div>
                  <div className="museum-artwork-artist">{a.artist.name}</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {candidates && (
        <EnrichPickerModal
          title="Choisir le bon lieu"
          candidates={candidates.map((c: WikidataMuseumCandidate) => ({ id: c.wikidataId, title: c.name, subtitle: c.description }))}
          applying={saving}
          onSelect={applyLocation}
          onClose={() => setCandidates(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Retirer ce musée ?"
          message={`${museum.name} et ses ${museum.visitCount} visite${museum.visitCount !== 1 ? 's' : ''} seront supprimés.`}
          confirmLabel="Retirer"
          onConfirm={remove}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </div>
  )
}
