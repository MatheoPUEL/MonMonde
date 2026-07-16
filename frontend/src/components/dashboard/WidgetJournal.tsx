import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { journalApi, JournalEntry, JournalStats } from '../../api/journal'
import { Button } from '../ui/Button'
import { IconJournal, IconFlame, MOOD_ICONS } from '../ui/icons'

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 7) return `Il y a ${days} jours`
  if (days < 30) return `Il y a ${Math.floor(days / 7)} semaine${days >= 14 ? 's' : ''}`
  return `Il y a ${Math.floor(days / 30)} mois`
}

export function WidgetJournal() {
  const [entry, setEntry] = useState<JournalEntry | null>(null)
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      journalApi.getEntries({ limit: 1, draft: false }),
      journalApi.getStats(),
    ])
      .then(([entriesData, statsData]) => {
        setEntry(entriesData.entries[0] ?? null)
        setStats(statsData)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const MoodIcon = entry?.mood ? MOOD_ICONS[entry.mood] : null
  const snippet = entry?.contentText.trim().slice(0, 220)

  return (
    <div className="dashboard-widget widget-journal">
      <div className="widget-journal-header">
        <span className="dashboard-widget-title"><IconJournal size={14} />Journal</span>
        {stats && stats.currentStreak > 0 && (
          <span className="widget-streak-badge"><IconFlame size={12} /> {stats.currentStreak} j</span>
        )}
      </div>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : entry ? (
        <>
          <div className="widget-journal-entry">
            {MoodIcon && (
              <span className="widget-journal-mood"><MoodIcon size={16} /></span>
            )}
            <span className="widget-journal-entry-title">
              {entry.title || 'Sans titre'}
            </span>
            <span className="widget-journal-date">{relativeDate(entry.createdAt)}</span>
          </div>
          {snippet && <p className="widget-journal-snippet">{snippet}</p>}
          <Button variant="ghost" onClick={() => navigate(`/journal/${entry.id}`)}>
            Continuer d'écrire
          </Button>
        </>
      ) : (
        <div className="widget-empty">
          <span>Pas encore d'entrée</span>
          <Link to="/journal" className="btn btn-ghost" style={{ width: 'auto' }}>
            Écrire
          </Link>
        </div>
      )}
    </div>
  )
}
