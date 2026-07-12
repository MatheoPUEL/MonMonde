-- CreateEnum
CREATE TYPE "Mood" AS ENUM ('EXCELLENT', 'GOOD', 'NEUTRAL', 'BAD', 'VERY_BAD');

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "contentText" TEXT NOT NULL DEFAULT '',
    "mood" "Mood",
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "draft" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,

    CONSTRAINT "JournalTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JournalEntry_userId_idx" ON "JournalEntry"("userId");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_draft_idx" ON "JournalEntry"("userId", "draft");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_favorite_idx" ON "JournalEntry"("userId", "favorite");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_pinned_idx" ON "JournalEntry"("userId", "pinned");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_mood_idx" ON "JournalEntry"("userId", "mood");

-- CreateIndex
CREATE INDEX "JournalEntry_userId_createdAt_idx" ON "JournalEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JournalTag_entryId_idx" ON "JournalTag"("entryId");

-- CreateIndex
CREATE UNIQUE INDEX "JournalTag_entryId_name_key" ON "JournalTag"("entryId", "name");

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalTag" ADD CONSTRAINT "JournalTag_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
