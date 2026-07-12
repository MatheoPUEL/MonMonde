import { Router } from 'express'
import { prisma } from '../../lib/prisma'
import { validateRrule, computeStats } from '../../lib/rrule'
import { RoutineType } from '@prisma/client'

const router = Router()

router.get('/', async (req, res, next) => {
  try {
    const { type, active, search, category } = req.query as Record<string, string>
    const where: Record<string, unknown> = { userId: req.user!.id }

    if (type && Object.values(RoutineType).includes(type as RoutineType)) {
      where.type = type as RoutineType
    }
    if (active !== undefined) where.active = active === 'true'
    if (category) where.category = { contains: category, mode: 'insensitive' }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ]
    }

    const routines = await prisma.routine.findMany({ where, orderBy: { createdAt: 'desc' } })
    res.json({ routines })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const { name, description, type, category, color, icon, rruleString,
            startDate, endDate, active, hasQuantity, unit, targetCount, targetPeriod } = req.body

    if (!name) { res.status(400).json({ error: 'name is required' }); return }
    if (!rruleString) { res.status(400).json({ error: 'rruleString is required' }); return }
    if (!validateRrule(rruleString)) { res.status(400).json({ error: 'Invalid rruleString' }); return }

    const routine = await prisma.routine.create({
      data: {
        userId: req.user!.id,
        name, description, category, unit,
        type: type || 'HABIT',
        color: color || '#C4775A',
        icon: icon || '✅',
        rruleString,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : undefined,
        active: active !== undefined ? active : true,
        hasQuantity: hasQuantity || false,
        targetCount: targetCount != null ? Number(targetCount) : undefined,
        targetPeriod: targetPeriod || undefined,
      },
    })
    res.status(201).json({ routine })
  } catch (err) { next(err) }
})

router.get('/:id/stats', async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }

    const completions = await prisma.routineCompletion.findMany({
      where: { routineId: req.params.id, done: true },
      select: { date: true },
    })

    const stats = computeStats(
      routine.rruleString,
      routine.startDate,
      completions.map(c => c.date),
      new Date()
    )
    res.json(stats)
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const routine = await prisma.routine.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    })
    if (!routine) { res.status(404).json({ error: 'Routine not found' }); return }
    res.json({ routine })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Routine not found' }); return }

    const { name, description, type, category, color, icon, rruleString,
            startDate, endDate, active, hasQuantity, unit, targetCount, targetPeriod } = req.body

    if (rruleString !== undefined && !validateRrule(rruleString)) {
      res.status(400).json({ error: 'Invalid rruleString' }); return
    }

    const routine = await prisma.routine.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(type !== undefined && { type }),
        ...(category !== undefined && { category }),
        ...(color !== undefined && { color }),
        ...(icon !== undefined && { icon }),
        ...(rruleString !== undefined && { rruleString }),
        ...(startDate !== undefined && startDate !== null && { startDate: new Date(startDate) }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(active !== undefined && { active }),
        ...(hasQuantity !== undefined && { hasQuantity }),
        ...(unit !== undefined && { unit }),
        ...(targetCount !== undefined && { targetCount: targetCount != null ? Number(targetCount) : null }),
        ...(targetPeriod !== undefined && { targetPeriod }),
      },
    })
    res.json({ routine })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.routine.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Routine not found' }); return }
    await prisma.routine.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
