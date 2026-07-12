import { Router } from 'express'
import searchRouter from './search'
import booksRouter from './books'
import authorsRouter from './authors'

const router = Router()

router.use('/search', searchRouter)
router.use('/books', booksRouter)
router.use('/authors', authorsRouter)

export default router
