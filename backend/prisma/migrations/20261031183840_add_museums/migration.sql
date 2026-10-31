-- CreateTable
CREATE TABLE "Museum" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT,
    "country" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "wikidataId" TEXT,
    "geocodedAt" TIMESTAMP(3),
    "wishlist" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Museum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MuseumVisit" (
    "id" TEXT NOT NULL,
    "museumId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MuseumVisit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Museum_userId_idx" ON "Museum"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Museum_userId_name_key" ON "Museum"("userId", "name");

-- CreateIndex
CREATE INDEX "MuseumVisit_museumId_idx" ON "MuseumVisit"("museumId");

-- AddForeignKey
ALTER TABLE "Museum" ADD CONSTRAINT "Museum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MuseumVisit" ADD CONSTRAINT "MuseumVisit_museumId_fkey" FOREIGN KEY ("museumId") REFERENCES "Museum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
