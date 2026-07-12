import { type Routine, type RoutineCompletion, TYPE_LABELS, type RoutineType } from '../../api/routines'
import { getOccurrencesInMonth } from '../../utils/rrule'
import { CompletionCell, type CellState } from './CompletionCell'

const TYPE_ORDER: RoutineType[] = ['HABIT', 'TASK', 'OBLIGATION']

interface HabitGridProps {
  routines: Routine[]
  completions: RoutineCompletion[]
  year: number
  month: number
  onToggle: (routineId: string, dateISO: string) => void
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

export function HabitGrid({ routines, completions, year, month, onToggle }: HabitGridProps) {
  const daysInMonth = getDaysInMonth(year, month)
  const today = new Date()
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  const todayDay = today.getDate()

  // Map: routineId -> day (1-31) -> completion
  const completionMap = new Map<string, Map<number, RoutineCompletion>>()
  for (const c of completions) {
    const day = new Date(c.date).getUTCDate()
    if (!completionMap.has(c.routineId)) completionMap.set(c.routineId, new Map())
    completionMap.get(c.routineId)!.set(day, c)
  }

  // Cache scheduled days per routine
  const scheduledCache = new Map<string, Set<number>>()
  for (const r of routines) {
    const days = getOccurrencesInMonth(r.rruleString, new Date(r.startDate), year, month)
    scheduledCache.set(r.id, new Set(days))
  }

  function getCellState(routine: Routine, day: number): CellState {
    if (!scheduledCache.get(routine.id)?.has(day)) return 'not-due'

    const cellDate = new Date(Date.UTC(year, month - 1, day))
    const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()))
    if (cellDate > todayUTC) return 'future'

    const completion = completionMap.get(routine.id)?.get(day)
    return completion?.done ? 'done' : 'missed'
  }

  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1)
  const grouped = TYPE_ORDER
    .map(type => ({ type, items: routines.filter(r => r.type === type) }))
    .filter(g => g.items.length > 0)

  return (
    <div className="habit-grid">
      <table className="habit-grid-table">
        <thead>
          <tr>
            <th style={{ minWidth: 160 }} />
            {days.map(d => (
              <th key={d} className={`habit-grid-day-header${isCurrentMonth && d === todayDay ? ' today' : ''}`}>
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {grouped.map(({ type, items }) => (
            <>
              <tr key={`header-${type}`}>
                <td colSpan={daysInMonth + 1} className="habit-grid-type-header">
                  {TYPE_LABELS[type]}
                </td>
              </tr>
              {items.map(routine => (
                <tr key={routine.id}>
                  <td className="habit-grid-name-cell" style={{ borderLeftColor: routine.color }}>
                    {routine.icon} {routine.name}
                  </td>
                  {days.map(day => {
                    const state = getCellState(routine, day)
                    const dateISO = new Date(Date.UTC(year, month - 1, day)).toISOString()
                    return (
                      <td key={day} style={{ padding: 0 }}>
                        <CompletionCell state={state} onClick={() => onToggle(routine.id, dateISO)} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </>
          ))}
        </tbody>
      </table>
      <div className="habit-grid-legend">
        <span>✓ Réalisé</span>
        <span>✗ Manqué</span>
        <span>░ À venir</span>
        <span>· Non prévu</span>
      </div>
    </div>
  )
}
