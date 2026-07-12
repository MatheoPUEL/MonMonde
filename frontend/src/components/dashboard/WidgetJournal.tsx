import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { journalApi, JournalEntry, JournalStats, MOOD_EMOJIS } from '../../api/journal'

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

  return (
    <div className="dashboard-widget widget-journal">
      <div className="widget-journal-header">
        <span className="dashboard-widget-title">📓 Journal</span>
        {stats && stats.currentStreak > 0 && (
          <span className="widget-streak-badge">🔥 {stats.currentStreak} j</span>
        )}
      </div>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : entry ? (
        <>
          <div className="widget-journal-entry">
            {entry.mood && (
              <span className="widget-journal-mood">{MOOD_EMOJIS[entry.mood]}</span>
            )}
            <span className="widget-journal-entry-title">
              {entry.title || 'Sans titre'}
            </span>
            <span className="widget-journal-date">{relativeDate(entry.createdAt)}</span>
          </div>
          <Link to={`/journal/${entry.id}`} className="dashboard-widget-link">
            Lire l'entrée →
          </Link>
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
