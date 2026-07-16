import { Router } from 'express'
import searchRouter from './search'
import artworksRouter from './artworks'
import artistsRouter from './artists'

const router = Router()

router.use('/search', searchRouter)
router.use('/artworks', artworksRouter)
router.use('/artists', artistsRouter)

export default router
