interface ProgressBarProps {
  currentPage?: number
  pageCount?: number
  showLabel?: boolean
}

export function ProgressBar({ currentPage, pageCount, showLabel = true }: ProgressBarProps) {
  if (!currentPage || !pageCount) return null

  const pct = Math.min(100, Math.round((currentPage / pageCount) * 100))

  return (
    <div className="progress-bar-wrap">
      <div className="progress-bar-track">
        <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <span className="progress-bar-label">{pct}%</span>}
    </div>
  )
}
