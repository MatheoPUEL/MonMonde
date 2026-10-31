import { useState } from 'react'
import { museumsApi, MuseumDetail } from '../../api/art'
import { GlassCard } from '../../components/ui/GlassCard'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { IconClose } from '../../components/ui/icons'
import { todayIso } from '../../components/art/museumStatus'

interface Props {
  onClose: () => void
  onAdded: (museum: MuseumDetail) => void
}

type Kind = 'visited' | 'wishlist'

export function AddMuseumModal({ onClose, onAdded }: Props) {
  const [closing, setClosing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [name, setName] = useState('')
  const [kind, setKind] = useState<Kind>('visited')
  const [visitDate, setVisitDate] = useState(todayIso)

  function handleClose() {
    setClosing(true)
    setTimeout(onClose, 180)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError('')
    try {
      const { museum } = await museumsApi.create(
        kind === 'visited' ? { name, visitDate } : { name, wishlist: true }
      )
      onAdded(museum)
    } catch (err) {
      setError((err as Error).message)
      setLoading(false)
    }
  }

  return (
    <div className={`modal-overlay${closing ? ' modal-closing' : ''}`} onClick={e => { if (e.target === e.currentTarget) handleClose() }}>
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">Ajouter un musée</h2>
          <button className="modal-close" onClick={handleClose}><IconClose size={16} /></button>
        </div>

        <form onSubmit={handleSubmit} className="add-form">
          <Input
            label="Nom du musée *"
            placeholder="Musée d'Orsay, Prado, Tate Modern…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            required
          />

          <div className="input-group">
            <label className="input-label">Statut</label>
            <div className="reading-filters" style={{ margin: 0 }}>
              <button
                type="button"
                className={`filter-chip museum-filter museum-filter--visited ${kind === 'visited' ? 'filter-chip--active' : ''}`}
                onClick={() => setKind('visited')}
              >
                <span className="museum-dot" /> Je l'ai visité
              </button>
              <button
                type="button"
                className={`filter-chip museum-filter museum-filter--wishlist ${kind === 'wishlist' ? 'filter-chip--active' : ''}`}
                onClick={() => setKind('wishlist')}
              >
                <span className="museum-dot" /> À visiter
              </button>
            </div>
          </div>

          {kind === 'visited' && (
            <Input
              label="Date de la visite"
              type="date"
              value={visitDate}
              max={todayIso()}
              onChange={e => setVisitDate(e.target.value)}
              required
            />
          )}

          {error && <div className="museum-panel-error">{error}</div>}

          <div className="modal-actions">
            <Button type="button" variant="ghost" onClick={handleClose} style={{ width: 'auto' }}>Annuler</Button>
            <Button type="submit" loading={loading} style={{ width: 'auto' }}>Ajouter</Button>
          </div>
        </form>
      </GlassCard>
    </div>
  )
}
