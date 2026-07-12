import { RRule } from 'rrule'

// "2024-01-15T10:30:00.000Z" -> "20240115T103000Z"
export function formatDtstart(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
}

export function validateRrule(rruleString: string): boolean {
  try {
    RRule.fromString('RRULE:' + rruleString)
    return rruleString.includes('FREQ=')
  } catch {
    return false
  }
}

export function isScheduled(rruleString: string, startDate: Date, date: Date): boolean {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 23, 59, 59, 999))
    return rule.between(start, end, true).length > 0
  } catch {
    return false
  }
}

export interface RoutineStats {
  totalCompletions: number
  successRate: number
  currentStreak: number
  longestStreak: number
  thisMonth: number
  thisYear: number
}

export function computeStats(
  rruleString: string,
  startDate: Date,
  completionDates: Date[],
  now: Date
): RoutineStats {
  const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
  const todayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999))

  // Normalize to UTC day start — formatDtstart truncates ms, so the first rrule
  // occurrence is at seconds precision and falls before startDate with ms. Without
  // this normalization, rule.between(startDate, todayEnd) returns [] on day 1.
  const normalizedStart = new Date(Date.UTC(
    startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()
  ))

  const scheduledDays = rule.between(normalizedStart, todayEnd, true).map(d => {
    const day = new Date(d)
    day.setUTCHours(0, 0, 0, 0)
    return day.getTime()
  }).sort((a, b) => a - b)

  const completedDaySet = new Set(completionDates.map(c => {
    const d = new Date(c)
    d.setUTCHours(0, 0, 0, 0)
    return d.getTime()
  }))

  const totalCompletions = completionDates.length

  const successRate = scheduledDays.length > 0
    ? Math.round((totalCompletions / scheduledDays.length) * 100) / 100
    : 0

  // Longest streak: consecutive scheduled days all completed
  let longestStreak = 0
  let currentRun = 0
  for (const dayTs of scheduledDays) {
    if (completedDaySet.has(dayTs)) {
      currentRun++
      if (currentRun > longestStreak) longestStreak = currentRun
    } else {
      currentRun = 0
    }
  }

  // Current streak: consecutive completed scheduled days from the most recent
  let currentStreak = 0
  for (let i = scheduledDays.length - 1; i >= 0; i--) {
    if (!completedDaySet.has(scheduledDays[i])) break
    currentStreak++
  }

  const thisMonth = completionDates.filter(c => {
    const d = new Date(c)
    return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() === now.getUTCMonth()
  }).length

  const thisYear = completionDates.filter(c =>
    new Date(c).getUTCFullYear() === now.getUTCFullYear()
  ).length

  return { totalCompletions, successRate, currentStreak, longestStreak, thisMonth, thisYear }
}
