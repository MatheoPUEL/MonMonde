import { prisma } from './prisma'
import { localCoverExists, recoverArtworkCover, recoverBookCover } from './covers'

/** Copies every cover still hotlinked from another site (or whose local copy went missing)
 *  into uploads/covers. Runs once at startup, one image at a time, so covers saved before
 *  local copies existed get protected without waiting for them to break. */
export async function backfillCovers(): Promise<void> {
  let saved = 0
  let failed = 0

  const books = await prisma.book.findMany({
    where: { coverUrl: { not: null } },
    select: { id: true, coverUrl: true, coverSourceUrl: true, googleBooksId: true, isbn: true },
  })
  for (const book of books) {
    if (localCoverExists(book.coverUrl)) continue
    const recovered = await recoverBookCover(book)
    if (!recovered) { failed++; continue }
    await prisma.book.update({ where: { id: book.id }, data: recovered })
    saved++
  }

  const artworks = await prisma.artwork.findMany({
    where: { coverUrl: { not: null } },
    select: { id: true, coverUrl: true, coverSourceUrl: true, sourceApi: true, sourceId: true },
  })
  for (const artwork of artworks) {
    if (localCoverExists(artwork.coverUrl)) continue
    const recovered = await recoverArtworkCover(artwork)
    if (!recovered) { failed++; continue }
    await prisma.artwork.update({ where: { id: artwork.id }, data: recovered })
    saved++
  }

  if (saved || failed) console.log(`Covers: ${saved} copied locally, ${failed} could not be fetched`)
}
