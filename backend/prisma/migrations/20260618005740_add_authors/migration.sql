/*
  Warnings:

  - You are about to drop the column `author` on the `Book` table. All the data in the column will be lost.
  - Added the required column `authorId` to the `Book` table without a default value. This is not possible if the table is not empty.

*/

-- CreateTable
CREATE TABLE "Author" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bio" TEXT,
    "birthDate" TIMESTAMP(3),
    "deathDate" TIMESTAMP(3),
    "nationality" TEXT,
    "photoUrl" TEXT,
    "openLibraryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Author_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Author_userId_idx" ON "Author"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Author_userId_name_key" ON "Author"("userId", "name");

-- AddForeignKey (Author -> User)
ALTER TABLE "Author" ADD CONSTRAINT "Author_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: add authorId as nullable first
ALTER TABLE "Book" ADD COLUMN "authorId" TEXT;

-- Migrate data: create one Author per unique (userId, author) combo
INSERT INTO "Author" ("id", "userId", "name", "createdAt", "updatedAt")
SELECT
  md5(random()::text || clock_timestamp()::text || b."userId" || b."author"),
  b."userId",
  b."author",
  NOW(),
  NOW()
FROM (
  SELECT DISTINCT "userId", "author" FROM "Book"
) b;

-- Link books to their author
UPDATE "Book" b
SET "authorId" = a."id"
FROM "Author" a
WHERE a."userId" = b."userId" AND a."name" = b."author";

-- Set NOT NULL constraint now that all rows have an authorId
ALTER TABLE "Book" ALTER COLUMN "authorId" SET NOT NULL;

-- Drop old author column
ALTER TABLE "Book" DROP COLUMN "author";

-- AddForeignKey (Book -> Author)
ALTER TABLE "Book" ADD CONSTRAINT "Book_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "Author"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
