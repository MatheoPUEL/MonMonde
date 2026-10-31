import { Router } from 'express'
import searchRouter from './search'
import artworksRouter from './artworks'
import artistsRouter from './artists'
import museumsRouter from './museums'

const router = Router()

router.use('/search', searchRouter)
router.use('/artworks', artworksRouter)
router.use('/artists', artistsRouter)
router.use('/museums', museumsRouter)

export default router
