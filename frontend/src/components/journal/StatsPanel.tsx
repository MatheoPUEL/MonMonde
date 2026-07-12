import { useEffect, useState } from 'react'
import { journalApi, JournalStats } from '../../api/journal'

function moodColor(avg: number): string {
  if (avg <= 1.5) return '#48bb78'
  if (avg <= 2.5) return '#68d391'
  if (avg <= 3.5) return '#a0a0a0'
  if (avg <= 4.5) return '#f7b350'
  return '#e56464'
}

function moodLabel(avg: number): string {
  const rounded = Math.round(avg)
  return ['', 'Exc.', 'Bon', 'Neu.', 'Mau.', 'T.Mau.'][rounded] ?? ''
}

function MoodBar({ avg, label }: { avg: number; label: string }) {
  const pct = Math.round(((5 - avg) / 4) * 100)
  return (
    <div className="stats-bar-row">
      <span className="stats-bar-label">{label}</span>
      <div className="stats-bar-track">
        <div className="stats-bar-fill" style={{ width: `${pct}%`, background: moodColor(avg) }} />
      </div>
      <span className="stats-bar-value">{moodLabel(avg)}</span>
    </div>
  )
}

export function StatsPanel() {
  const [stats, setStats] = useState<JournalStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    journalApi.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div className="stats-loading"><div className="loading-spinner" /></div>
  if (!stats) return null

  function monthLabel(m: string) {
    const [y, mo] = m.split('-')
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' })
  }

  return (
    <div className="stats-panel">
      <h2 className="stats-title">Statistiques</h2>

      <div className="stats-chips">
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.totalEntries}</div>
          <div className="stats-chip-label">Entrées</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.totalWords.toLocaleString('fr-FR')}</div>
          <div className="stats-chip-label">Mots</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.currentStreak}</div>
          <div className="stats-chip-label">Série actuelle</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.longestStreak}</div>
          <div className="stats-chip-label">Meilleure série</div>
        </div>
        <div className="stats-chip">
          <div className="stats-chip-value">{stats.avgEntriesPerWeek}</div>
          <div className="stats-chip-label">Entrées/sem.</div>
        </div>
      </div>

      {stats.moodByMonth.length > 0 && (
        <div className="stats-section">
          <div className="stats-section-title">Humeur par mois</div>
          {stats.moodByMonth.slice(-6).map(m => (
            <MoodBar key={m.month} avg={m.avg} label={monthLabel(m.month)} />
          ))}
        </div>
      )}

      {stats.moodByWeek.length > 0 && (
        <div className="stats-section">
          <div className="stats-section-title">Humeur par semaine</div>
          {stats.moodByWeek.slice(-8).map(w => (
            <MoodBar key={w.week} avg={w.avg} label={w.week.replace(/^\d{4}-/, '')} />
          ))}
        </div>
      )}
    </div>
  )
}
