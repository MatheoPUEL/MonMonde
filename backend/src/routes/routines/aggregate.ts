import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { isScheduled } from '../../lib/rrule'

const router = Router()

router.get('/today', async (req, res, next) => {
  try {
    const userId = req.user!.id
    const now = new Date()

    const routines = await prisma.routine.findMany({ where: { userId, active: true } })
    const dueRoutines = routines.filter(r => isScheduled(r.rruleString, r.startDate, now))

    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
    const todayEnd = new Date(todayStart.getTime() + 86399999)

    const completions = await prisma.routineCompletion.findMany({
      where: {
        routineId: { in: dueRoutines.map(r => r.id) },
        date: { gte: todayStart, lte: todayEnd },
      },
    })

    const completionMap = new Map(completions.map(c => [c.routineId, c]))
    const items = dueRoutines.map(routine => ({
      routine,
      completion: completionMap.get(routine.id) ?? null,
      isDue: true,
    }))

    res.json({ items })
  } catch (err) { next(err) }
})

router.get('/grid', async (req, res, next) => {
  try {
    const { year, month } = req.query as Record<string, string>
    const userId = req.user!.id

    const y = Number(year) || new Date().getUTCFullYear()
    const m = Number(month) || new Date().getUTCMonth() + 1

    const monthStart = new Date(Date.UTC(y, m - 1, 1))
    const monthEnd = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999))

    const routines = await prisma.routine.findMany({ where: { userId, active: true } })
    const completions = await prisma.routineCompletion.findMany({
      where: {
        routineId: { in: routines.map(r => r.id) },
        date: { gte: monthStart, lte: monthEnd },
      },
    })

    res.json({ routines, completions, year: y, month: m })
  } catch (err) { next(err) }
})

export default router
