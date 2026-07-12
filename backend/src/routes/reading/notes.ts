import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router({ mergeParams: true })

async function verifyOwnership(bookId: string, userId: string) {
  return prisma.book.findFirst({ where: { id: bookId, userId } })
}

router.get('/', async (req, res, next) => {
  try {
    const bookId = (req.params as Record<string, string>)['bookId']
    const book = await verifyOwnership(bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }
    const notes = await prisma.bookNote.findMany({
      where: { bookId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notes })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const bookId = (req.params as Record<string, string>)['bookId']
    const book = await verifyOwnership(bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const { title, content, chapter, page } = req.body
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' })
      return
    }

    const note = await prisma.bookNote.create({
      data: {
        bookId,
        title, content, chapter,
        page: page != null ? Number(page) : undefined,
      },
    })
    res.status(201).json({ note })
  } catch (err) { next(err) }
})

router.put('/:noteId', async (req, res, next) => {
  try {
    const bookId = (req.params as Record<string, string>)['bookId']
    const noteId = (req.params as Record<string, string>)['noteId']
    const book = await verifyOwnership(bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const existing = await prisma.bookNote.findFirst({
      where: { id: noteId, bookId },
    })
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return }

    const { title, content, chapter, page } = req.body
    const note = await prisma.bookNote.update({
      where: { id: noteId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
        ...(chapter !== undefined && { chapter }),
        ...(page !== undefined && { page: page != null ? Number(page) : null }),
      },
    })
    res.json({ note })
  } catch (err) { next(err) }
})

router.delete('/:noteId', async (req, res, next) => {
  try {
    const bookId = (req.params as Record<string, string>)['bookId']
    const noteId = (req.params as Record<string, string>)['noteId']
    const book = await verifyOwnership(bookId, req.user!.id)
    if (!book) { res.status(404).json({ error: 'Book not found' }); return }

    const existing = await prisma.bookNote.findFirst({
      where: { id: noteId, bookId },
    })
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return }

    await prisma.bookNote.delete({ where: { id: noteId } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
