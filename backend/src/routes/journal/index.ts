import { Router } from 'express'
import entriesRouter from './entries'
import statsRouter from './stats'
import archivesRouter from './archives'

const router = Router()

router.use('/entries', entriesRouter)
router.use('/stats', statsRouter)
router.use('/archives', archivesRouter)

export default router
