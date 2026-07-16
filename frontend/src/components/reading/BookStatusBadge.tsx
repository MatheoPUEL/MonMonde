import { ReadingStatus, STATUS_LABELS } from '../../api/reading'

const STATUS_CLASS: Record<ReadingStatus, string> = {
  WISHLIST: 'status-badge--neutral',
  TO_READ: 'status-badge--neutral',
  READING: 'status-badge--accent',
  FINISHED: 'status-badge--success',
  ABANDONED: 'status-badge--danger',
}

export function BookStatusBadge({ status }: { status: ReadingStatus }) {
  return (
    <span className={`status-badge ${STATUS_CLASS[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  )
}
