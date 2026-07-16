import { GlassCard } from './GlassCard'
import { IconClose } from './icons'

export interface EnrichCandidate {
  id: string
  title: string
  subtitle?: string
}

interface Props {
  title: string
  candidates: EnrichCandidate[]
  applying: boolean
  onSelect: (id: string) => void
  onClose: () => void
}

export function EnrichPickerModal({ title, candidates, applying, onSelect, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <GlassCard className="modal-card">
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={onClose}><IconClose size={16} /></button>
        </div>

        <div className="search-results" style={{ maxHeight: 320 }}>
          {candidates.map(c => (
            <div
              key={c.id}
              className="search-result-item"
              onClick={() => { if (!applying) onSelect(c.id) }}
              style={applying ? { opacity: 0.6, pointerEvents: 'none' } : undefined}
            >
              <div className="search-result-info">
                <div className="search-result-title">{c.title}</div>
                {c.subtitle && <div className="search-result-author">{c.subtitle}</div>}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  )
}
