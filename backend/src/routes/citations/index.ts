import { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import citationsRouter from './citations'

const router = Router()

router.use(requireAuth)
router.use('/', citationsRouter)

export default router
