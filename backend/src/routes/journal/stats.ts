import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const MOOD_VALUES: Record<string, number> = {
  EXCELLENT: 1, GOOD: 2, NEUTRAL: 3, BAD: 4, VERY_BAD: 5,
}

function getISOWeek(d: Date): string {
  const date = new Date(d)
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7)
  const week1 = new Date(date.getFullYear(), 0, 4)
  const weekNum = 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7)
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`
}

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id

    const entries = await prisma.journalEntry.findMany({
      where: { userId, draft: false },
      select: { contentText: true, mood: true, createdAt: true },
      orderBy: { createdAt: 'asc' },
    })

    const totalEntries = entries.length

    const totalWords = entries.reduce((sum, e) => {
      return sum + e.contentText.trim().split(/\s+/).filter(Boolean).length
    }, 0)

    // Streak calculation
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const entryDaySet = new Set(
      entries.map(e => {
        const d = new Date(e.createdAt)
        d.setHours(0, 0, 0, 0)
        return d.getTime()
      })
    )
    const sortedDays = Array.from(entryDaySet).sort((a, b) => a - b)

    let longestStreak = 0
    let currentRunLength = 0

    for (let i = 0; i < sortedDays.length; i++) {
      if (i === 0 || sortedDays[i] - sortedDays[i - 1] === 86400000) {
        currentRunLength++
      } else {
        currentRunLength = 1
      }
      longestStreak = Math.max(longestStreak, currentRunLength)
    }

    const lastDay = sortedDays[sortedDays.length - 1] ?? -1
    const yesterday = today.getTime() - 86400000
    const currentStreak = (lastDay === today.getTime() || lastDay === yesterday) ? currentRunLength : 0

    // Avg per week
    let avgEntriesPerWeek = 0
    if (entries.length > 0) {
      const firstEntry = new Date(entries[0].createdAt)
      const weeks = Math.max(1, (Date.now() - firstEntry.getTime()) / (7 * 86400000))
      avgEntriesPerWeek = Math.round((totalEntries / weeks) * 10) / 10
    }

    // Mood grouping
    const weekGroups: Record<string, number[]> = {}
    const monthGroups: Record<string, number[]> = {}

    for (const e of entries) {
      if (!e.mood) continue
      const val = MOOD_VALUES[e.mood]
      const week = getISOWeek(new Date(e.createdAt))
      const d = new Date(e.createdAt)
      const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      if (!weekGroups[week]) weekGroups[week] = []
      weekGroups[week].push(val)
      if (!monthGroups[month]) monthGroups[month] = []
      monthGroups[month].push(val)
    }

    const avg = (vals: number[]) => Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10

    const moodByWeek = Object.entries(weekGroups)
      .map(([week, vals]) => ({ week, avg: avg(vals), count: vals.length }))
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-12)

    const moodByMonth = Object.entries(monthGroups)
      .map(([month, vals]) => ({ month, avg: avg(vals), count: vals.length }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12)

    res.json({ totalEntries, totalWords, currentStreak, longestStreak, avgEntriesPerWeek, moodByWeek, moodByMonth })
  } catch (err) {
    next(err)
  }
})

export default router
