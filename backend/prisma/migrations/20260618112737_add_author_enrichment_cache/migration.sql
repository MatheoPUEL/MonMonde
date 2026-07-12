-- CreateTable
CREATE TABLE "AuthorEnrichmentCache" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "olid" TEXT NOT NULL,
    "bio" TEXT,
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "photoPath" TEXT,
    "cachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorEnrichmentCache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AuthorEnrichmentCache_name_key" ON "AuthorEnrichmentCache"("name");

-- CreateIndex
CREATE UNIQUE INDEX "AuthorEnrichmentCache_olid_key" ON "AuthorEnrichmentCache"("olid");
