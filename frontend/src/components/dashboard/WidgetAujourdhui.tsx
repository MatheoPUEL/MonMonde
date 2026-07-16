import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { routinesApi, TodayItem } from '../../api/routines'
import { IconRoutines } from '../ui/icons'

const RING_R = 34
const RING_CIRC = 2 * Math.PI * RING_R

function ProgressRing({ done, total }: { done: number; total: number }) {
  const progress = total === 0 ? 0 : done / total
  const offset = RING_CIRC * (1 - progress)
  return (
    <svg className="widget-ring" viewBox="0 0 88 88" aria-label={`${done} sur ${total} complétées`}>
      <circle cx="44" cy="44" r={RING_R} className="widget-ring-track" />
      <circle
        cx="44"
        cy="44"
        r={RING_R}
        className="widget-ring-fill"
        strokeDasharray={RING_CIRC}
        strokeDashoffset={offset}
        transform="rotate(-90 44 44)"
      />
      <text x="44" y="40" textAnchor="middle" dominantBaseline="middle" className="widget-ring-label">
        {done}/{total}
      </text>
      <text x="44" y="56" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'var(--font-sans)' }}>
        faites
      </text>
    </svg>
  )
}

export function WidgetAujourdhui() {
  const [items, setItems] = useState<TodayItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    routinesApi.getToday()
      .then(d => setItems(d.items))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const dueItems = items.filter(i => i.isDue)
  const doneItems = dueItems.filter(i => i.completion?.done)

  return (
    <div className="dashboard-widget widget-today">
      <span className="dashboard-widget-title"><IconRoutines size={14} />Aujourd'hui</span>
      {loading ? (
        <div className="widget-loading-center">
          <div className="loading-spinner" />
        </div>
      ) : dueItems.length === 0 ? (
        <div className="widget-empty">
          <span>Rien de prévu aujourd'hui</span>
          <Link to="/routines" className="dashboard-widget-link">
            Voir les routines →
          </Link>
        </div>
      ) : (
        <>
          <div className="widget-today-body">
            <ProgressRing done={doneItems.length} total={dueItems.length} />
            <ul className="widget-routine-list">
              {dueItems.slice(0, 3).map(({ routine, completion }) => (
                <li
                  key={routine.id}
                  className={`widget-routine-item${completion?.done ? ' widget-routine-item--done' : ''}`}
                >
                  <span className="widget-routine-icon">{routine.icon}</span>
                  <span className="widget-routine-name">{routine.name}</span>
                  {completion?.done && <span className="widget-routine-check">✓</span>}
                </li>
              ))}
            </ul>
          </div>
          <Link to="/routines" className="dashboard-widget-link">
            Voir toutes →
          </Link>
        </>
      )}
    </div>
  )
}
