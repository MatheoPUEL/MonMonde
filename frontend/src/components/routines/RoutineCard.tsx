import type { Routine } from '../../api/routines'
import { TYPE_LABELS, TYPE_COLORS } from '../../api/routines'
import { FrequencyBadge } from './FrequencyBadge'
import { StreakBadge } from './StreakBadge'
import { GlassCard } from '../ui/GlassCard'

interface RoutineCardProps {
  routine: Routine
  streak?: number
  successRate?: number
  onClick: () => void
}

export function RoutineCard({ routine, streak = 0, successRate, onClick }: RoutineCardProps) {
  return (
    <GlassCard
      className="routine-card"
      onClick={onClick}
    >
      <div className="routine-card-dot" style={{ background: routine.color }} />
      <div style={{ fontSize: '1.25rem' }}>{routine.icon}</div>
      <div className="routine-card-info">
        <div className="routine-card-name">{routine.name}</div>
        <div className="routine-card-meta">
          <span className="type-badge" style={{ background: TYPE_COLORS[routine.type] }}>
            {TYPE_LABELS[routine.type]}
          </span>
          <FrequencyBadge rruleString={routine.rruleString} />
          <StreakBadge streak={streak} />
          {successRate !== undefined && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {Math.round(successRate * 100)}%
            </span>
          )}
        </div>
      </div>
    </GlassCard>
  )
}
