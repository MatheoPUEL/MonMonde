-- CreateEnum
CREATE TYPE "SourceType" AS ENUM ('BOOK', 'ARTICLE', 'INTERNET', 'PODCAST', 'FILM', 'SERIES', 'VIDEO', 'PERSON', 'OTHER');

-- CreateTable
CREATE TABLE "Citation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "author" TEXT,
    "sourceType" "SourceType" NOT NULL DEFAULT 'OTHER',
    "source" TEXT,
    "bookId" TEXT,
    "page" INTEGER,
    "chapter" TEXT,
    "comment" TEXT,
    "color" TEXT NOT NULL DEFAULT '#C4775A',
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Citation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CitationTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "citationId" TEXT NOT NULL,

    CONSTRAINT "CitationTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Citation_userId_idx" ON "Citation"("userId");

-- CreateIndex
CREATE INDEX "Citation_userId_favorite_idx" ON "Citation"("userId", "favorite");

-- CreateIndex
CREATE INDEX "Citation_userId_sourceType_idx" ON "Citation"("userId", "sourceType");

-- CreateIndex
CREATE INDEX "Citation_bookId_idx" ON "Citation"("bookId");

-- CreateIndex
CREATE INDEX "CitationTag_citationId_idx" ON "CitationTag"("citationId");

-- CreateIndex
CREATE UNIQUE INDEX "CitationTag_citationId_name_key" ON "CitationTag"("citationId", "name");

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Citation" ADD CONSTRAINT "Citation_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CitationTag" ADD CONSTRAINT "CitationTag_citationId_fkey" FOREIGN KEY ("citationId") REFERENCES "Citation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
