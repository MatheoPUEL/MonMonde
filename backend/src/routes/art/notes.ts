import { Router } from 'express'
import { prisma } from '../../lib/prisma'

const router = Router({ mergeParams: true })

async function verifyOwnership(artworkId: string, userId: string) {
  return prisma.artwork.findFirst({ where: { id: artworkId, userId } })
}

router.get('/', async (req, res, next) => {
  try {
    const artworkId = (req.params as Record<string, string>)['artworkId']
    const artwork = await verifyOwnership(artworkId, req.user!.id)
    if (!artwork) { res.status(404).json({ error: 'Artwork not found' }); return }
    const notes = await prisma.artworkNote.findMany({
      where: { artworkId },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ notes })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const artworkId = (req.params as Record<string, string>)['artworkId']
    const artwork = await verifyOwnership(artworkId, req.user!.id)
    if (!artwork) { res.status(404).json({ error: 'Artwork not found' }); return }

    const { title, content } = req.body
    if (!title || !content) {
      res.status(400).json({ error: 'Title and content are required' })
      return
    }

    const note = await prisma.artworkNote.create({
      data: { artworkId, title, content },
    })
    res.status(201).json({ note })
  } catch (err) { next(err) }
})

router.put('/:noteId', async (req, res, next) => {
  try {
    const artworkId = (req.params as Record<string, string>)['artworkId']
    const noteId = (req.params as Record<string, string>)['noteId']
    const artwork = await verifyOwnership(artworkId, req.user!.id)
    if (!artwork) { res.status(404).json({ error: 'Artwork not found' }); return }

    const existing = await prisma.artworkNote.findFirst({
      where: { id: noteId, artworkId },
    })
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return }

    const { title, content } = req.body
    const note = await prisma.artworkNote.update({
      where: { id: noteId },
      data: {
        ...(title !== undefined && { title }),
        ...(content !== undefined && { content }),
      },
    })
    res.json({ note })
  } catch (err) { next(err) }
})

router.delete('/:noteId', async (req, res, next) => {
  try {
    const artworkId = (req.params as Record<string, string>)['artworkId']
    const noteId = (req.params as Record<string, string>)['noteId']
    const artwork = await verifyOwnership(artworkId, req.user!.id)
    if (!artwork) { res.status(404).json({ error: 'Artwork not found' }); return }

    const existing = await prisma.artworkNote.findFirst({
      where: { id: noteId, artworkId },
    })
    if (!existing) { res.status(404).json({ error: 'Note not found' }); return }

    await prisma.artworkNote.delete({ where: { id: noteId } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

export default router
