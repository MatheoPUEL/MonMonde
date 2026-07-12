import type { Citation } from '../../api/citations'
import { SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS } from '../../api/citations'

interface CitationCardProps {
  citation: Citation
  onClick: () => void
  onFavoriteToggle: (id: string) => void
}

export function CitationCard({ citation, onClick, onFavoriteToggle }: CitationCardProps) {
  const visibleTags = citation.tags.slice(0, 3)
  const extraCount = citation.tags.length - visibleTags.length

  return (
    <div className="citation-card" onClick={onClick}>
      <div className="citation-card-strip" style={{ background: citation.color }} />
      <div className="citation-card-body">
        <div className="citation-card-text">
          «&nbsp;{citation.text}&nbsp;»
        </div>
        <div className="citation-card-meta">
          <div className="citation-card-meta-left">
            {citation.author && (
              <span className="citation-card-author">{citation.author}</span>
            )}
            <span className="citation-source-badge">
              {SOURCE_TYPE_ICONS[citation.sourceType]}&nbsp;{SOURCE_TYPE_LABELS[citation.sourceType]}
            </span>
            {citation.source && (
              <span className="citation-card-source">{citation.source}</span>
            )}
          </div>
          <div className="citation-card-meta-right">
            {visibleTags.map(t => (
              <span key={t.id} className="citation-tag">{t.name}</span>
            ))}
            {extraCount > 0 && (
              <span className="citation-tag citation-tag--more">+{extraCount}</span>
            )}
            <button
              className={`citation-fav-btn${citation.favorite ? ' active' : ''}`}
              onClick={e => { e.stopPropagation(); onFavoriteToggle(citation.id) }}
              title={citation.favorite ? 'Retirer des favoris' : 'Ajouter aux favoris'}
            >
              {citation.favorite ? '★' : '☆'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
