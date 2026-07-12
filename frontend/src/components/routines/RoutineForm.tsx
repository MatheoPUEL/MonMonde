import { useState } from 'react'
import type { Routine, RoutineInput, RoutineType } from '../../api/routines'

const PRESET_COLORS = ['#C4775A', '#7A9E7E', '#5A8AC4', '#9B7EC8', '#E5A34A', '#E56464', '#48bb78', '#A89890']

const PRESET_ICONS = [
  '🏃', '💪', '🧘', '🚴', '🏊', '🥗', '💊', '😴',
  '📚', '✍️', '🎯', '🧠', '📖', '🎓', '💡', '🗒️',
  '🌅', '🌿', '💧', '🧹', '💰', '🎵', '🎨', '🧩',
  '💻', '📧', '📋', '⏰', '🔧', '🤝', '✅', '⭐',
]

const WEEKDAYS = [
  { key: 'MO', label: 'L' }, { key: 'TU', label: 'M' }, { key: 'WE', label: 'M' },
  { key: 'TH', label: 'J' }, { key: 'FR', label: 'V' }, { key: 'SA', label: 'S' }, { key: 'SU', label: 'D' },
]

type FreqPreset = 'daily' | 'weekly' | 'monthly' | 'custom'

interface RoutineFormProps {
  initial?: Partial<Routine>
  onSave: (data: RoutineInput) => Promise<void>
  onClose: () => void
}

function detectPreset(rrule: string): FreqPreset {
  if (rrule === 'FREQ=DAILY') return 'daily'
  if (rrule === 'FREQ=WEEKLY') return 'weekly'
  if (rrule.startsWith('FREQ=MONTHLY')) return 'monthly'
  return 'custom'
}

export function RoutineForm({ initial, onSave, onClose }: RoutineFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [type, setType] = useState<RoutineType>(initial?.type ?? 'HABIT')
  const [category, setCategory] = useState(initial?.category ?? '')
  const [color, setColor] = useState(initial?.color ?? '#C4775A')
  const [icon, setIcon] = useState(initial?.icon ?? '✅')
  const [rruleString, setRruleString] = useState(initial?.rruleString ?? 'FREQ=DAILY')
  const [freqPreset, setFreqPreset] = useState<FreqPreset>(() => detectPreset(initial?.rruleString ?? 'FREQ=DAILY'))
  const [selectedDays, setSelectedDays] = useState<string[]>(() => {
    const m = initial?.rruleString?.match(/BYDAY=([^;]+)/)
    return m ? m[1].split(',') : []
  })
  const [hasQuantity, setHasQuantity] = useState(initial?.hasQuantity ?? false)
  const [unit, setUnit] = useState(initial?.unit ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function applyPreset(preset: FreqPreset) {
    setFreqPreset(preset)
    if (preset === 'daily') setRruleString('FREQ=DAILY')
    if (preset === 'weekly') setRruleString('FREQ=WEEKLY')
    if (preset === 'monthly') setRruleString('FREQ=MONTHLY;BYMONTHDAY=1')
  }

  function toggleDay(day: string) {
    const next = selectedDays.includes(day)
      ? selectedDays.filter(d => d !== day)
      : [...selectedDays, day]
    setSelectedDays(next)
    if (next.length > 0) {
      setRruleString(`FREQ=WEEKLY;BYDAY=${next.join(',')}`)
      setFreqPreset('custom')
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { setError('Le nom est requis'); return }
    setSaving(true)
    setError('')
    try {
      await onSave({
        name: name.trim(),
        description: description || undefined,
        type,
        category: category || undefined,
        color,
        icon,
        rruleString,
        hasQuantity,
        unit: hasQuantity && unit ? unit : undefined,
      })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la sauvegarde')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="routine-form-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="routine-form-modal">
        <div className="routine-form-title">{initial?.id ? 'Modifier' : 'Nouvelle routine'}</div>
        <form onSubmit={handleSubmit}>

          {/* Nom */}
          <div className="routine-form-row">
            <label className="routine-form-label">Nom *</label>
            <input
              className="input-field"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ex: Méditation du matin"
            />
          </div>

          {/* Icône */}
          <div className="routine-form-row">
            <label className="routine-form-label">Icône</label>
            <div className="icon-grid">
              {PRESET_ICONS.map(i => (
                <button
                  key={i}
                  type="button"
                  className={`icon-btn${icon === i ? ' active' : ''}`}
                  onClick={() => setIcon(i)}
                  title={i}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>

          {/* Couleur */}
          <div className="routine-form-row">
            <label className="routine-form-label">Couleur</label>
            <div className="color-swatches">
              {PRESET_COLORS.map(c => (
                <div
                  key={c}
                  className={`color-swatch${color === c ? ' active' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          {/* Type */}
          <div className="routine-form-row">
            <label className="routine-form-label">Type</label>
            <div className="freq-presets">
              {(['HABIT', 'TASK', 'OBLIGATION'] as RoutineType[]).map(t => (
                <button key={t} type="button"
                  className={`freq-preset-btn${type === t ? ' active' : ''}`}
                  onClick={() => setType(t)}>
                  {t === 'HABIT' ? 'Habitude' : t === 'TASK' ? 'Tâche' : 'Obligation'}
                </button>
              ))}
            </div>
          </div>

          {/* Fréquence */}
          <div className="routine-form-row">
            <label className="routine-form-label">Fréquence</label>
            <div className="freq-presets">
              <button type="button" className={`freq-preset-btn${freqPreset === 'daily' ? ' active' : ''}`}
                onClick={() => applyPreset('daily')}>Quotidien</button>
              <button type="button" className={`freq-preset-btn${freqPreset === 'weekly' ? ' active' : ''}`}
                onClick={() => applyPreset('weekly')}>Hebdo</button>
              <button type="button" className={`freq-preset-btn${freqPreset === 'monthly' ? ' active' : ''}`}
                onClick={() => applyPreset('monthly')}>Mensuel</button>
              <button type="button" className={`freq-preset-btn${freqPreset === 'custom' ? ' active' : ''}`}
                onClick={() => setFreqPreset('custom')}>Personnalisé</button>
            </div>

            {freqPreset === 'weekly' && (
              <div style={{ marginTop: '0.5rem' }}>
                <div className="routine-form-sublabel">Jours de la semaine</div>
                <div className="weekday-toggle">
                  {WEEKDAYS.map(d => (
                    <button key={d.key} type="button"
                      className={`weekday-btn${selectedDays.includes(d.key) ? ' active' : ''}`}
                      onClick={() => toggleDay(d.key)}>
                      {d.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {freqPreset === 'monthly' && (
              <div style={{ marginTop: '0.5rem' }}>
                <div className="routine-form-sublabel">Jour du mois</div>
                <select
                  className="input-field"
                  value={rruleString.match(/BYMONTHDAY=(\d+)/)?.[1] ?? '1'}
                  onChange={e => setRruleString(`FREQ=MONTHLY;BYMONTHDAY=${e.target.value}`)}
                >
                  {Array.from({ length: 28 }, (_, i) => i + 1).map(n => (
                    <option key={n} value={n}>Le {n}{n === 1 ? 'er' : 'e'} du mois</option>
                  ))}
                  <option value="-1">Dernier jour du mois</option>
                </select>
              </div>
            )}

            {freqPreset === 'custom' && (
              <div style={{ marginTop: '0.5rem' }}>
                <div className="routine-form-sublabel">Règle rrule personnalisée</div>
                <input
                  className="input-field"
                  value={rruleString}
                  onChange={e => setRruleString(e.target.value)}
                  placeholder="FREQ=WEEKLY;BYDAY=MO,TH"
                  style={{ fontSize: '0.85rem', fontFamily: 'monospace' }}
                />
              </div>
            )}
          </div>

          {/* Catégorie */}
          <div className="routine-form-row">
            <label className="routine-form-label">Catégorie</label>
            <input
              className="input-field"
              value={category}
              onChange={e => setCategory(e.target.value)}
              placeholder="Sport, Santé, Travail…"
            />
          </div>

          {/* Description */}
          <div className="routine-form-row">
            <label className="routine-form-label">Description</label>
            <input
              className="input-field"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Optionnel"
            />
          </div>

          {/* Quantitatif */}
          <div className="routine-form-row">
            <label className="routine-form-check-label">
              <input type="checkbox" checked={hasQuantity} onChange={e => setHasQuantity(e.target.checked)} />
              <span>Validation quantitative</span>
            </label>
            {hasQuantity && (
              <input
                className="input-field"
                value={unit}
                onChange={e => setUnit(e.target.value)}
                placeholder="Unité (km, pages, min…)"
                style={{ marginTop: '0.5rem' }}
              />
            )}
          </div>

          {error && <div className="routine-form-error">{error}</div>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost form-btn" onClick={onClose}>Annuler</button>
            <button type="submit" className="btn btn-primary form-btn" disabled={saving}>
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
