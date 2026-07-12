import type { Routine, RoutineCompletion } from '../../api/routines'
import { getOccurrencesInYear } from '../../utils/rrule'

interface AnnualHeatmapProps {
  routine: Routine
  completions: RoutineCompletion[]
  year: number
}

function isLeapYear(y: number) {
  return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0
}

export function AnnualHeatmap({ routine, completions, year }: AnnualHeatmapProps) {
  const scheduledDates = getOccurrencesInYear(routine.rruleString, new Date(routine.startDate), year)
  const scheduledSet = new Set(scheduledDates.map(d => d.toISOString().slice(0, 10)))
  const completedSet = new Set(
    completions.filter(c => c.done).map(c => new Date(c.date).toISOString().slice(0, 10))
  )
  const todayStr = new Date().toISOString().slice(0, 10)

  const jan1 = new Date(Date.UTC(year, 0, 1))
  const startDow = jan1.getUTCDay()
  const totalDays = isLeapYear(year) ? 366 : 365

  const weeks: Array<Array<{ dateStr: string; level: string } | null>> = []
  let currentWeek: Array<{ dateStr: string; level: string } | null> = Array(startDow).fill(null)

  for (let i = 0; i < totalDays; i++) {
    const d = new Date(Date.UTC(year, 0, i + 1))
    const dateStr = d.toISOString().slice(0, 10)
    const scheduled = scheduledSet.has(dateStr)
    const done = completedSet.has(dateStr)
    const isFuture = dateStr > todayStr

    let level = 'empty'
    if (scheduled && !isFuture) level = done ? 'l4' : 'l1'

    currentWeek.push({ dateStr, level })
    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null)
    weeks.push(currentWeek)
  }

  return (
    <div className="annual-heatmap">
      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
        {routine.icon} {routine.name}
      </div>
      <div className="heatmap-grid">
        {weeks.map((week, wi) => (
          <div key={wi} className="heatmap-week">
            {week.map((cell, di) =>
              cell ? (
                <div
                  key={di}
                  className={`heatmap-cell heatmap-cell--${cell.level}`}
                  title={cell.dateStr}
                />
              ) : (
                <div key={di} style={{ width: 11, height: 11 }} />
              )
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
