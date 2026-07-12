interface StreakBadgeProps { streak: number }

export function StreakBadge({ streak }: StreakBadgeProps) {
  if (streak === 0) return null
  return (
    <span className="streak-badge" title="Série actuelle">
      🔥 {streak} jour{streak > 1 ? 's' : ''}
    </span>
  )
}
