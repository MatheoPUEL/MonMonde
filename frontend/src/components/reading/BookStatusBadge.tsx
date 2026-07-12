import { ReadingStatus, STATUS_LABELS, STATUS_COLORS } from '../../api/reading'

export function BookStatusBadge({ status }: { status: ReadingStatus }) {
  return (
    <span
      className="status-badge"
      style={{ background: STATUS_COLORS[status] + '22', color: STATUS_COLORS[status] }}
    >
      {STATUS_LABELS[status]}
    </span>
  )
}
