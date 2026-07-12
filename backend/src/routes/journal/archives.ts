import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'

const router = Router()

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const userId = (req as any).user.id

    const entries = await prisma.journalEntry.findMany({
      where: { userId, draft: false },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    })

    const groups: Record<string, number> = {}
    for (const e of entries) {
      const d = new Date(e.createdAt)
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`
      groups[key] = (groups[key] ?? 0) + 1
    }

    const archives = Object.entries(groups)
      .map(([key, count]) => {
        const [year, month] = key.split('-').map(Number)
        return { year, month, count }
      })
      .sort((a, b) => b.year - a.year || b.month - a.month)

    res.json({ archives })
  } catch (err) {
    next(err)
  }
})

export default router
