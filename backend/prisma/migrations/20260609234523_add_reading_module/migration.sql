-- CreateEnum
CREATE TYPE "ReadingStatus" AS ENUM ('WISHLIST', 'TO_READ', 'READING', 'FINISHED', 'ABANDONED');

-- CreateTable
CREATE TABLE "Book" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "synopsis" TEXT,
    "isbn" TEXT,
    "pageCount" INTEGER,
    "genres" TEXT[],
    "coverUrl" TEXT,
    "coverType" TEXT,
    "googleBooksId" TEXT,
    "status" "ReadingStatus" NOT NULL DEFAULT 'WISHLIST',
    "owned" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "review" TEXT,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "rereadCount" INTEGER NOT NULL DEFAULT 0,
    "currentPage" INTEGER,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,

    CONSTRAINT "BookTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookNote" (
    "id" TEXT NOT NULL,
    "bookId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "chapter" TEXT,
    "page" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Book_userId_idx" ON "Book"("userId");

-- CreateIndex
CREATE INDEX "Book_userId_status_idx" ON "Book"("userId", "status");

-- CreateIndex
CREATE INDEX "BookTag_bookId_idx" ON "BookTag"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookTag_bookId_name_key" ON "BookTag"("bookId", "name");

-- CreateIndex
CREATE INDEX "BookNote_bookId_idx" ON "BookNote"("bookId");

-- AddForeignKey
ALTER TABLE "Book" ADD CONSTRAINT "Book_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookTag" ADD CONSTRAINT "BookTag_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookNote" ADD CONSTRAINT "BookNote_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
