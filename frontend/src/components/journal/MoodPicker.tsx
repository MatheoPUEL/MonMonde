import { Mood, MOOD_LABELS } from '../../api/journal'
import { MOOD_ICONS } from '../ui/icons'

const MOODS: Mood[] = ['EXCELLENT', 'GOOD', 'NEUTRAL', 'BAD', 'VERY_BAD']

interface Props {
  value: Mood | null
  onChange: (mood: Mood | null) => void
}

export function MoodPicker({ value, onChange }: Props) {
  return (
    <div className="mood-picker">
      {MOODS.map(mood => {
        const Icon = MOOD_ICONS[mood]
        return (
          <button
            key={mood}
            type="button"
            className={`mood-picker-btn${value === mood ? ' mood-picker-btn--active' : ''}`}
            onClick={() => onChange(value === mood ? null : mood)}
            title={MOOD_LABELS[mood]}
          >
            <span className="mood-picker-emoji"><Icon size={19} /></span>
            <span className="mood-picker-label">{MOOD_LABELS[mood]}</span>
          </button>
        )
      })}
    </div>
  )
}
