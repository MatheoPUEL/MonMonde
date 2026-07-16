import { Mood, MOOD_LABELS } from '../../api/journal'
import { MOOD_ICONS } from '../ui/icons'

const MOOD_BG: Record<Mood, string> = {
  EXCELLENT: 'rgba(72,187,120,0.15)',
  GOOD: 'rgba(104,211,145,0.15)',
  NEUTRAL: 'rgba(160,160,160,0.15)',
  BAD: 'rgba(247,179,80,0.15)',
  VERY_BAD: 'rgba(229,100,100,0.15)',
}

const MOOD_BORDER: Record<Mood, string> = {
  EXCELLENT: 'rgba(72,187,120,0.4)',
  GOOD: 'rgba(104,211,145,0.4)',
  NEUTRAL: 'rgba(160,160,160,0.4)',
  BAD: 'rgba(247,179,80,0.4)',
  VERY_BAD: 'rgba(229,100,100,0.4)',
}

interface Props { mood: Mood }

export function MoodBadge({ mood }: Props) {
  const Icon = MOOD_ICONS[mood]
  return (
    <span
      className="mood-badge"
      style={{ background: MOOD_BG[mood], borderColor: MOOD_BORDER[mood] }}
    >
      <Icon size={13} /> {MOOD_LABELS[mood]}
    </span>
  )
}
