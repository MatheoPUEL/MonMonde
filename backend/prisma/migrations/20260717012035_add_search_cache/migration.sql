-- CreateTable
CREATE TABLE "BookSearchCache" (
    "id" TEXT NOT NULL,
    "googleBooksId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "synopsis" TEXT,
    "isbn" TEXT,
    "pageCount" INTEGER,
    "genres" TEXT[],
    "coverUrl" TEXT,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ArtworkSearchCache" (
    "id" TEXT NOT NULL,
    "sourceApi" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "dateDisplay" TEXT,
    "year" INTEGER,
    "century" INTEGER,
    "currents" TEXT[],
    "themes" TEXT[],
    "technique" TEXT,
    "medium" TEXT,
    "dimensions" TEXT,
    "country" TEXT,
    "museum" TEXT NOT NULL,
    "imageUrl" TEXT,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ArtworkSearchCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookSearchCache_googleBooksId_key" ON "BookSearchCache"("googleBooksId");

-- CreateIndex
CREATE INDEX "BookSearchCache_title_idx" ON "BookSearchCache"("title");

-- CreateIndex
CREATE INDEX "BookSearchCache_author_idx" ON "BookSearchCache"("author");

-- CreateIndex
CREATE INDEX "BookSearchCache_isbn_idx" ON "BookSearchCache"("isbn");

-- CreateIndex
CREATE INDEX "ArtworkSearchCache_title_idx" ON "ArtworkSearchCache"("title");

-- CreateIndex
CREATE INDEX "ArtworkSearchCache_artist_idx" ON "ArtworkSearchCache"("artist");

-- CreateIndex
CREATE UNIQUE INDEX "ArtworkSearchCache_sourceApi_sourceId_key" ON "ArtworkSearchCache"("sourceApi", "sourceId");
