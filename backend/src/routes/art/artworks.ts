import express, { Router } from 'express'
import { requireAuth } from '../../middleware/auth'
import { prisma } from '../../lib/prisma'
import { uploadCover, uploadArtworkMedia, artworkMediaType } from '../../lib/upload'
import notesRouter from './notes'

const router = Router({ mergeParams: true })

router.use(requireAuth)
router.use('/:artworkId/notes', notesRouter)

router.get('/', async (req, res, next) => {
  try {
    const { search, favorite, artistId, movement, current, theme, century, country, tag } =
      req.query as Record<string, string>

    const where: Record<string, unknown> = { userId: req.user!.id }

    if (favorite === 'true') where.favorite = true
    if (artistId) where.artistId = artistId
    if (movement) where.movements = { has: movement }
    if (current) where.currents = { has: current }
    if (theme) where.themes = { has: theme }
    if (century) where.century = Number(century)
    if (country) where.country = { equals: country, mode: 'insensitive' }
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { artist: { name: { contains: search, mode: 'insensitive' } } },
        { museum: { contains: search, mode: 'insensitive' } },
      ]
    }

    let artworks = await prisma.artwork.findMany({
      where,
      include: { tags: true, artist: true },
      orderBy: { createdAt: 'desc' },
    })

    if (tag) {
      artworks = artworks.filter(a => a.tags.some(t => t.name.toLowerCase() === tag.toLowerCase()))
    }

    res.json({ artworks })
  } catch (err) { next(err) }
})

router.post('/', async (req, res, next) => {
  try {
    const {
      title, artistName, dateDisplay, year, century, period, movements, currents, themes,
      technique, medium, dimensions, country, museum, description, review,
      coverUrl, coverType, sourceApi, sourceId, sourceUrl, favorite, tags,
    } = req.body

    if (!title || !artistName) {
      res.status(400).json({ error: 'Title and artistName are required' })
      return
    }

    if (tags !== undefined && !Array.isArray(tags)) {
      res.status(400).json({ error: 'tags must be an array of strings' })
      return
    }

    const artist = await prisma.artist.upsert({
      where: { userId_name: { userId: req.user!.id, name: artistName } },
      create: { userId: req.user!.id, name: artistName },
      update: {},
    })

    const artwork = await prisma.artwork.create({
      data: {
        userId: req.user!.id,
        title,
        artistId: artist.id,
        dateDisplay, period, technique, medium, dimensions, country, museum, description, review,
        year: year != null ? Number(year) : undefined,
        century: century != null ? Number(century) : undefined,
        movements: movements || [],
        currents: currents || [],
        themes: themes || [],
        coverUrl, coverType, sourceApi, sourceId, sourceUrl,
        favorite: favorite || false,
        tags: tags?.length ? { create: (tags as string[]).map(name => ({ name })) } : undefined,
      },
      include: { tags: true, artist: true, media: true },
    })

    res.status(201).json({ artwork })
  } catch (err) { next(err) }
})

// GET /api/art/artworks/:id/citations
router.get('/:id/citations', async (req, res, next) => {
  try {
    const artwork = await prisma.artwork.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      select: { id: true },
    })
    if (!artwork) { res.status(404).json({ error: 'Artwork not found' }); return }

    const citations = await prisma.citation.findMany({
      where: { artworkId: req.params.id },
      include: { tags: true },
      orderBy: { createdAt: 'desc' },
    })
    res.json({ citations, total: citations.length })
  } catch (err) { next(err) }
})

router.get('/:id', async (req, res, next) => {
  try {
    const artwork = await prisma.artwork.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
      include: {
        tags: true,
        artist: true,
        notes: { orderBy: { createdAt: 'desc' } },
        media: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!artwork) { res.status(404).json({ error: 'Artwork not found' }); return }
    res.json({ artwork })
  } catch (err) { next(err) }
})

router.put('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.artwork.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Artwork not found' }); return }

    const {
      title, artistName, dateDisplay, year, century, period, movements, currents, themes,
      technique, medium, dimensions, country, museum, description, review,
      coverUrl, coverType, favorite, tags,
    } = req.body

    if (tags !== undefined && !Array.isArray(tags)) {
      res.status(400).json({ error: 'tags must be an array of strings' })
      return
    }

    let artistId: string | undefined
    if (artistName !== undefined) {
      const artistRecord = await prisma.artist.upsert({
        where: { userId_name: { userId: req.user!.id, name: artistName } },
        create: { userId: req.user!.id, name: artistName },
        update: {},
      })
      artistId = artistRecord.id
    }

    const data = {
      ...(title !== undefined && { title }),
      ...(artistId !== undefined && { artistId }),
      ...(dateDisplay !== undefined && { dateDisplay }),
      ...(year !== undefined && { year: year != null ? Number(year) : null }),
      ...(century !== undefined && { century: century != null ? Number(century) : null }),
      ...(period !== undefined && { period }),
      ...(movements !== undefined && { movements }),
      ...(currents !== undefined && { currents }),
      ...(themes !== undefined && { themes }),
      ...(technique !== undefined && { technique }),
      ...(medium !== undefined && { medium }),
      ...(dimensions !== undefined && { dimensions }),
      ...(country !== undefined && { country }),
      ...(museum !== undefined && { museum }),
      ...(description !== undefined && { description }),
      ...(review !== undefined && { review }),
      ...(coverUrl !== undefined && { coverUrl }),
      ...(coverType !== undefined && { coverType }),
      ...(favorite !== undefined && { favorite }),
    }

    let artwork
    if (tags !== undefined) {
      const [, updated] = await prisma.$transaction([
        prisma.artworkTag.deleteMany({ where: { artworkId: req.params.id } }),
        prisma.artwork.update({
          where: { id: req.params.id },
          data: { ...data, tags: { create: (tags as string[]).map(name => ({ name })) } },
          include: { tags: true, artist: true, media: true },
        }),
      ])
      artwork = updated
    } else {
      artwork = await prisma.artwork.update({
        where: { id: req.params.id },
        data,
        include: { tags: true, artist: true, media: true },
      })
    }

    res.json({ artwork })
  } catch (err) { next(err) }
})

router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.artwork.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Artwork not found' }); return }
    await prisma.artwork.delete({ where: { id: req.params.id } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

router.post('/:id/cover', uploadCover.single('cover'), async (req, res, next) => {
  try {
    const existing = await prisma.artwork.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Artwork not found' }); return }
    if (!req.file) { res.status(400).json({ error: 'No file uploaded' }); return }

    const coverUrl = `/uploads/covers/${req.file.filename}`
    const artwork = await prisma.artwork.update({
      where: { id: req.params.id },
      data: { coverUrl, coverType: 'upload' },
      include: { tags: true, artist: true, media: true },
    })

    res.json({ artwork, coverUrl })
  } catch (err) { next(err) }
})

router.post('/:id/media', uploadArtworkMedia.array('files', 10), async (req, res, next) => {
  try {
    const existing = await prisma.artwork.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Artwork not found' }); return }

    const files = (req.files as Express.Multer.File[]) || []
    if (!files.length) { res.status(400).json({ error: 'No files uploaded' }); return }

    const media = await prisma.$transaction(
      files.map(file => prisma.artworkMedia.create({
        data: {
          artworkId: req.params.id,
          type: artworkMediaType(file.mimetype),
          url: `/uploads/artworks/${file.filename}`,
          filename: file.filename,
          originalName: file.originalname,
          mimeType: file.mimetype,
          size: file.size,
        },
      }))
    )

    res.status(201).json({ media })
  } catch (err) { next(err) }
})

router.delete('/:id/media/:mediaId', async (req, res, next) => {
  try {
    const existing = await prisma.artwork.findFirst({ where: { id: req.params.id, userId: req.user!.id } })
    if (!existing) { res.status(404).json({ error: 'Artwork not found' }); return }

    const media = await prisma.artworkMedia.findFirst({
      where: { id: req.params.mediaId, artworkId: req.params.id },
    })
    if (!media) { res.status(404).json({ error: 'Media not found' }); return }

    await prisma.artworkMedia.delete({ where: { id: req.params.mediaId } })
    res.json({ ok: true })
  } catch (err) { next(err) }
})

// Handle multer errors for cover/media upload
router.use(['/:id/cover', '/:id/media'], (err: Error, _req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err.message?.includes('Only JPEG') || err.message?.includes('images are allowed') || err.message?.includes('Unsupported file type')) {
    res.status(400).json({ error: err.message })
    return
  }
  next(err)
})

export default router
