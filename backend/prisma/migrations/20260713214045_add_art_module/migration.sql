-- CreateEnum
CREATE TYPE "ArtworkMediaType" AS ENUM ('IMAGE', 'PDF', 'VIDEO', 'AUDIO', 'OTHER');

-- AlterEnum
ALTER TYPE "SourceType" ADD VALUE 'ARTWORK';

-- AlterTable
ALTER TABLE "Citation" ADD COLUMN     "artworkId" TEXT;

-- CreateTable
CREATE TABLE "Artist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "nationality" TEXT,
    "photoUrl" TEXT,
    "wikidataId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Artwork" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "artistId" TEXT NOT NULL,
    "dateDisplay" TEXT,
    "year" INTEGER,
    "century" INTEGER,
    "period" TEXT,
    "movements" TEXT[],
    "currents" TEXT[],
    "themes" TEXT[],
    "technique" TEXT,
    "medium" TEXT,
    "dimensions" TEXT,
    "country" TEXT,
    "museum" TEXT,
    "description" TEXT,
    "review" TEXT,
    "coverUrl" TEXT,
    "coverType" TEXT,
    "sourceApi" TEXT,
    "sourceId" TEXT,
    "sourceUrl" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Artwork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,

    CONSTRAINT "ArtworkTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkNote" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkMedia" (
    "id" TEXT NOT NULL,
    "artworkId" TEXT NOT NULL,
    "type" "ArtworkMediaType" NOT NULL,
    "url" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ArtworkMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Artist_userId_idx" ON "Artist"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Artist_userId_name_key" ON "Artist"("userId", "name");

-- CreateIndex
CREATE INDEX "Artwork_userId_idx" ON "Artwork"("userId");

-- CreateIndex
CREATE INDEX "Artwork_userId_favorite_idx" ON "Artwork"("userId", "favorite");

-- CreateIndex
CREATE INDEX "Artwork_artistId_idx" ON "Artwork"("artistId");

-- CreateIndex
CREATE INDEX "ArtworkTag_artworkId_idx" ON "ArtworkTag"("artworkId");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkTag_artworkId_name_key" ON "ArtworkTag"("artworkId", "name");

-- CreateIndex
CREATE INDEX "ArtworkNote_artworkId_idx" ON "ArtworkNote"("artworkId");

-- CreateIndex
CREATE INDEX "ArtworkMedia_artworkId_idx" ON "ArtworkMedia"("artworkId");

-- CreateIndex
CREATE INDEX "Citation_artworkId_idx" ON "Citation"("artworkId");

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artist" ADD CONSTRAINT "Artist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Artwork" ADD CONSTRAINT "Artwork_artistId_fkey" FOREIGN KEY ("artistId") REFERENCES "Artist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkTag" ADD CONSTRAINT "ArtworkTag_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkNote" ADD CONSTRAINT "ArtworkNote_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArtworkMedia" ADD CONSTRAINT "ArtworkMedia_artworkId_fkey" FOREIGN KEY ("artworkId") REFERENCES "Artwork"("id") ON DELETE CASCADE ON UPDATE CASCADE;
