import { RRule } from 'rrule'

export function formatDtstart(date: Date): string {
  return date.toISOString().replace(/[-:.]/g, '').slice(0, 15) + 'Z'
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

export function getOccurrencesInMonth(rruleString: string, startDate: Date, year: number, month: number): number[] {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const monthStart = new Date(Date.UTC(year, month - 1, 1))
    const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999))
    return rule.between(monthStart, monthEnd, true).map(d => d.getUTCDate())
  } catch {
    return []
  }
}

export function getOccurrencesInYear(rruleString: string, startDate: Date, year: number): Date[] {
  try {
    const rule = RRule.fromString(`DTSTART:${formatDtstart(startDate)}\nRRULE:${rruleString}`)
    const yearStart = new Date(Date.UTC(year, 0, 1))
    const yearEnd = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999))
    return rule.between(yearStart, yearEnd, true)
  } catch {
    return []
  }
}

const DAY_LABELS: Record<string, string> = {
  MO: 'Lun', TU: 'Mar', WE: 'Mer', TH: 'Jeu', FR: 'Ven', SA: 'Sam', SU: 'Dim',
}

export function rruleToFrench(rruleString: string): string {
  const parts: Record<string, string> = {}
  for (const p of rruleString.split(';')) {
    const [k, v] = p.split('=')
    if (k && v) parts[k] = v
  }
  const freq = parts['FREQ']
  const interval = parts['INTERVAL'] ? parseInt(parts['INTERVAL']) : 1
  const byday = parts['BYDAY']
  const bymonthday = parts['BYMONTHDAY']

  if (freq === 'DAILY') {
    return interval === 1 ? 'Tous les jours' : `Tous les ${interval} jours`
  }
  if (freq === 'WEEKLY') {
    if (byday) {
      const days = byday.split(',').map(d => DAY_LABELS[d] ?? d).join(', ')
      return interval === 1 ? days : `${days} (×${interval})`
    }
    return interval === 1 ? 'Hebdomadaire' : `Toutes les ${interval} semaines`
  }
  if (freq === 'MONTHLY') {
    if (bymonthday) {
      const n = parseInt(bymonthday)
      return `Le ${n}${n === 1 ? 'er' : 'e'} du mois`
    }
    if (byday) {
      const match = byday.match(/^(-?\d+)([A-Z]{2})$/)
      if (match) {
        const n = parseInt(match[1])
        const day = DAY_LABELS[match[2]] ?? match[2]
        return n === -1 ? `Dernier ${day} du mois` : `${n}e ${day} du mois`
      }
    }
    return interval === 1 ? 'Mensuel' : `Tous les ${interval} mois`
  }
  if (freq === 'YEARLY') return 'Annuellement'
  return rruleString
}
