-- CreateEnum
CREATE TYPE "Standing" AS ENUM ('ROSTER', 'BENCH');

-- CreateEnum
CREATE TYPE "RaidStatus" AS ENUM ('SCHEDULED', 'LOCKED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "discordThreadId" TEXT,
ADD COLUMN     "nudgedAt" TIMESTAMP(3),
ADD COLUMN     "reopenedAt" TIMESTAMP(3),
ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "OfficerNote" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "editedAt" TIMESTAMP(3),
ADD COLUMN     "source" "Source" NOT NULL DEFAULT 'WEB';

-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "detached" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "discordMessageId" TEXT,
ADD COLUMN     "discordThreadId" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "locksAt" TIMESTAMP(3),
ADD COLUMN     "postedAt" TIMESTAMP(3),
ADD COLUMN     "remind24At" TIMESTAMP(3),
ADD COLUMN     "remind72At" TIMESTAMP(3),
ADD COLUMN     "seriesId" TEXT,
ADD COLUMN     "status" "RaidStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Backfill rows that existed before the sync (additive: no existing value changes).
UPDATE "Raid" SET "locksAt" = "startsAt" - INTERVAL '120 minutes' WHERE "locksAt" IS NULL;
UPDATE "Raid" SET "status" = 'CANCELLED' WHERE "cancelledAt" IS NOT NULL;
UPDATE "Raid" SET "status" = 'DONE' WHERE "cancelledAt" IS NULL AND "startsAt" + ("durationMin" * INTERVAL '1 minute') + INTERVAL '60 minutes' < NOW();
UPDATE "Raid" SET "status" = 'LOCKED' WHERE "status" = 'SCHEDULED' AND "locksAt" <= NOW();
ALTER TABLE "Raid" ALTER COLUMN "locksAt" SET NOT NULL;
ALTER TABLE "Raid" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Signup" ADD COLUMN     "attended" BOOLEAN,
ADD COLUMN     "standing" "Standing" NOT NULL DEFAULT 'ROSTER',
ALTER COLUMN "response" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RaidTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "short" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 180,
    "requirements" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "RaidTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RaidSeries" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "durationMin" INTEGER NOT NULL,
    "notes" TEXT,
    "postAheadDays" INTEGER NOT NULL DEFAULT 14,
    "lockMinutesBefore" INTEGER NOT NULL DEFAULT 120,
    "horizonWeeks" INTEGER NOT NULL DEFAULT 4,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaidSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutboxJob" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "runAfter" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "result" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OutboxJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotRequest" (
    "key" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "body" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotRequest_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "RaidTemplate_name_key" ON "RaidTemplate"("name");

-- CreateIndex
CREATE INDEX "OutboxJob_status_runAfter_idx" ON "OutboxJob"("status", "runAfter");

-- CreateIndex
CREATE UNIQUE INDEX "Application_discordThreadId_key" ON "Application"("discordThreadId");

-- CreateIndex
CREATE UNIQUE INDEX "OfficerNote_discordMessageId_key" ON "OfficerNote"("discordMessageId");

-- CreateIndex
CREATE UNIQUE INDEX "Raid_discordEventId_key" ON "Raid"("discordEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Raid_discordThreadId_key" ON "Raid"("discordThreadId");

-- CreateIndex
CREATE INDEX "Raid_status_locksAt_idx" ON "Raid"("status", "locksAt");

-- AddForeignKey
ALTER TABLE "RaidSeries" ADD CONSTRAINT "RaidSeries_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RaidTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RaidTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Raid" ADD CONSTRAINT "Raid_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "RaidSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

