import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router({ mergeParams: true })

router.get('/', async (req, res, next) => {
  try {
    const { routineId } = req.params as { routineId: string }
    const { from, to } = req.query as Record<string, string>

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: req.user!.id } })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    const where: Record<string, unknown> = { routineId }
    if (from || to) {
      where.date = {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      }
    }

    const completions = await prisma.routineCompletion.findMany({
      where,
      orderBy: { date: 'asc' },
    })
    res.json({ completions })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { routineId } = req.params as { routineId: string }
    const { date, done, value, note } = req.body

    if (!date) { res.status(400).json({ error: 'date is required' }); return }

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: req.user!.id } })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    const raw = new Date(date)
    const normalizedDate = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()))

    const completion = await prisma.routineCompletion.upsert({
      where: { routineId_date: { routineId, date: normalizedDate } },
      create: {
        routineId,
        date: normalizedDate,
        done: done !== undefined ? done : true,
        value: value != null ? Number(value) : undefined,
        note,
      },
      update: {
        ...(done !== undefined && { done }),
        ...(value !== undefined && { value: value != null ? Number(value) : null }),
        ...(note !== undefined && { note }),
      },
    })
    res.json({ completion })
  } catch (err) { next(err) }
})

router.delete('/:date', async (req, res, next) => {
  try {
    const { routineId, date } = req.params as { routineId: string; date: string }

    const routine = await prisma.routine.findFirst({ where: { id: routineId, userId: req.user!.id } })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    await prisma.routineCompletion.deleteMany({
      where: { routineId, date: new Date(decodeURIComponent(date)) },
    })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
