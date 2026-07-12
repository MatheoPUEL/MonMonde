import { rruleToFrench } from '../../utils/rrule'

interface FrequencyBadgeProps { rruleString: string }

export function FrequencyBadge({ rruleString }: FrequencyBadgeProps) {
  return <span className="frequency-badge">{rruleToFrench(rruleString)}</span>
}
