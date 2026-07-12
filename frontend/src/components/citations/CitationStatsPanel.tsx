import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { citationsApi, type CitationStats, SOURCE_TYPE_LABELS, SOURCE_TYPE_ICONS, type SourceType } from '../../api/citations'

export function CitationStatsPanel() {
  const [stats, setStats] = useState<CitationStats | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    citationsApi.getStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>
  if (!stats) return null

  const sourceTypeEntries = Object.entries(stats.bySourceType) as [SourceType, number][]

  return (
    <div className="citations-container">
      <h1 style={{ fontFamily: 'Playfair Display, serif', fontSize: '2rem', marginBottom: '1.5rem', animation: 'fadeUp 0.4s ease both' }}>
        Statistiques
      </h1>

      <div className="citations-stats-panel">
        <div className="citations-stat-card">
          <div className="citations-stat-value">{stats.total}</div>
          <div className="citations-stat-label">Citations</div>
        </div>
        <div className="citations-stat-card">
          <div className="citations-stat-value">{stats.favorites}</div>
          <div className="citations-stat-label">Favoris</div>
        </div>
        <div className="citations-stat-card">
          <div className="citations-stat-value">{Object.keys(stats.bySourceType).length}</div>
          <div className="citations-stat-label">Types de source</div>
        </div>
      </div>

      {sourceTypeEntries.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Par type de source</div>
          {sourceTypeEntries
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => (
              <div key={type} className="citations-stats-row">
                <span className="citations-stats-row-label">
                  {SOURCE_TYPE_ICONS[type]} {SOURCE_TYPE_LABELS[type]}
                </span>
                <span className="citations-stats-row-count">{count}</span>
              </div>
            ))}
        </div>
      )}

      {stats.byAuthor.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Top auteurs</div>
          {stats.byAuthor.slice(0, 5).map(({ author, count }) => (
            <div key={author} className="citations-stats-row">
              <span className="citations-stats-row-label">{author}</span>
              <span className="citations-stats-row-count">{count}</span>
            </div>
          ))}
        </div>
      )}

      {stats.mostViewed.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Citations les plus consultées</div>
          {stats.mostViewed.map(c => (
            <div
              key={c.id}
              className="citations-stats-row"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/citations/${c.id}`)}
            >
              <span className="citations-stats-row-label" style={{ fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                «&nbsp;{c.text}&nbsp;»
              </span>
              <span className="citations-stats-row-count">{c.viewCount} vues</span>
            </div>
          ))}
        </div>
      )}

      {stats.timeline.length > 0 && (
        <div className="citations-stats-section">
          <div className="citations-stats-section-title">Évolution mensuelle</div>
          {stats.timeline.map(({ month, count }) => (
            <div key={month} className="citations-stats-row">
              <span className="citations-stats-row-label">{month}</span>
              <span className="citations-stats-row-count">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
