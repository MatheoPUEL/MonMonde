-- CreateEnum
CREATE TYPE "RoutineType" AS ENUM ('HABIT', 'TASK', 'OBLIGATION');

-- CreateEnum
CREATE TYPE "TargetPeriod" AS ENUM ('WEEK', 'MONTH');

-- CreateTable
CREATE TABLE "Routine" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "RoutineType" NOT NULL DEFAULT 'HABIT',
    "category" TEXT,
    "color" TEXT NOT NULL DEFAULT '#C4775A',
    "icon" TEXT NOT NULL DEFAULT '✅',
    "rruleString" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "hasQuantity" BOOLEAN NOT NULL DEFAULT false,
    "unit" TEXT,
    "targetCount" INTEGER,
    "targetPeriod" "TargetPeriod",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Routine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoutineCompletion" (
    "id" TEXT NOT NULL,
    "routineId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,
    "value" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutineCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Routine_userId_idx" ON "Routine"("userId");

-- CreateIndex
CREATE INDEX "Routine_userId_active_idx" ON "Routine"("userId", "active");

-- CreateIndex
CREATE INDEX "Routine_userId_type_idx" ON "Routine"("userId", "type");

-- CreateIndex
CREATE INDEX "RoutineCompletion_routineId_idx" ON "RoutineCompletion"("routineId");

-- CreateIndex
CREATE INDEX "RoutineCompletion_routineId_date_idx" ON "RoutineCompletion"("routineId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RoutineCompletion_routineId_date_key" ON "RoutineCompletion"("routineId", "date");

-- AddForeignKey
ALTER TABLE "Routine" ADD CONSTRAINT "Routine_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RoutineCompletion" ADD CONSTRAINT "RoutineCompletion_routineId_fkey" FOREIGN KEY ("routineId") REFERENCES "Routine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
