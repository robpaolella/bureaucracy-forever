-- Additive: pending-application reminder fields (SYNC-SPEC §3, §6 step 14). Nothing reads them yet.
-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "reminderActivityAt" TIMESTAMP(3),
ADD COLUMN     "reminderChannelId" TEXT,
ADD COLUMN     "reminderCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "reminderKey" TEXT,
ADD COLUMN     "reminderLastOn" TEXT,
ADD COLUMN     "reminderMessageId" TEXT,
ADD COLUMN     "reminderTriedOn" TEXT;
