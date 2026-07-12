import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import aggregateRouter from './aggregate'
import routinesCrudRouter from './routines'
import completionsRouter from './completions'

const router = Router()
router.use(requireAuth)

// Named aggregate routes (/today, /grid) MUST be before /:id catch-all
router.use('/', aggregateRouter)
router.use('/', routinesCrudRouter)
router.use('/:routineId/completions', completionsRouter)

export default router
