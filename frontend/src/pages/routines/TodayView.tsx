import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { routinesApi, type TodayItem } from '../../api/routines'
import { FrequencyBadge } from '../../components/routines/FrequencyBadge'
import { GlassCard } from '../../components/ui/GlassCard'

export function TodayView() {
  const [items, setItems] = useState<TodayItem[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    try {
      const data = await routinesApi.getToday()
      setItems(data.items)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleCompletion(item: TodayItem) {
    const now = new Date()
    const todayMidnightISO = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
    if (item.completion?.done) {
      await routinesApi.deleteCompletion(item.routine.id, todayMidnightISO)
    } else {
      await routinesApi.upsertCompletion(item.routine.id, { date: todayMidnightISO, done: true })
    }
    await load()
  }

  const today = new Date()
  const dateLabel = today.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })

  if (loading) return <div style={{ padding: '2rem', color: 'var(--text-muted)' }}>Chargement…</div>

  return (
    <div className="routines-container">
      <div className="today-header">
        <div className="today-date" style={{ textTransform: 'capitalize' }}>{dateLabel}</div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.25rem' }}>
          {items.length === 0
            ? "Aucune routine prévue aujourd'hui"
            : `${items.filter(i => i.completion?.done).length} / ${items.length} complétées`}
        </div>
      </div>

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎉</div>
          <div>Rien de prévu aujourd'hui</div>
        </div>
      ) : (
        <div className="today-list">
          {items.map(item => (
            <GlassCard key={item.routine.id} className="today-item">
              <div className="today-item-icon">{item.routine.icon}</div>
              <div
                className="today-item-info"
                onClick={() => navigate(`/routines/${item.routine.id}`)}
              >
                <div className="today-item-name">{item.routine.name}</div>
                <div className="today-item-freq">
                  <FrequencyBadge rruleString={item.routine.rruleString} />
                  {item.routine.category && (
                    <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                      {item.routine.category}
                    </span>
                  )}
                </div>
              </div>
              <button
                className={`today-check-btn${item.completion?.done ? ' done' : ''}`}
                onClick={() => toggleCompletion(item)}
              >
                {item.completion?.done ? '✓' : ''}
              </button>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
