import { JournalEntry, MOOD_LABELS } from '../../api/journal'
import { GlassCard } from '../ui/GlassCard'
import { MOOD_ICONS, IconPin, IconStar } from '../ui/icons'

interface Props {
  entry: JournalEntry
  onClick: () => void
}

export function EntryCard({ entry, onClick }: Props) {
  const dateStr = new Date(entry.createdAt).toLocaleDateString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
  const preview = entry.contentText.trim().slice(0, 120)
  const MoodIcon = entry.mood ? MOOD_ICONS[entry.mood] : null

  return (
    <GlassCard className="entry-card" onClick={onClick}>
      <div className="entry-card-header">
        <div className="entry-card-meta">
          <span className="entry-card-date">{dateStr}</span>
          {entry.mood && MoodIcon && (
            <span className="entry-mood-chip">
              <MoodIcon size={12} /> {MOOD_LABELS[entry.mood]}
            </span>
          )}
        </div>
        <div className="entry-card-indicators">
          {entry.pinned && <span title="Épinglée"><IconPin size={13} /></span>}
          {entry.favorite && <span title="Favori" style={{ color: 'var(--accent)' }}><IconStar size={13} filled /></span>}
          {entry.draft && <span className="entry-draft-badge">Brouillon</span>}
        </div>
      </div>
      <h3 className="entry-card-title">{entry.title || <em style={{ color: 'var(--text-muted)' }}>Sans titre</em>}</h3>
      {preview && (
        <p className="entry-card-preview">
          {preview}{entry.contentText.length > 120 ? '…' : ''}
        </p>
      )}
      {entry.tags.length > 0 && (
        <div className="entry-card-tags">
          {entry.tags.slice(0, 3).map(t => (
            <span key={t.id} className="chip">{t.name}</span>
          ))}
          {entry.tags.length > 3 && (
            <span className="chip">+{entry.tags.length - 3}</span>
          )}
        </div>
      )}
    </GlassCard>
  )
}
