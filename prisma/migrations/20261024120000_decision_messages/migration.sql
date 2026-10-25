-- Additive: decision messages and the social switch (SYNC-SPEC §3, §4 Decision request). Old rows stay null.
-- CreateEnum
CREATE TYPE "DecisionMessageKind" AS ENUM ('STANDARD', 'CUSTOM', 'NONE');

-- CreateEnum
CREATE TYPE "DecisionMessageStatus" AS ENUM ('QUEUED', 'SENT', 'NOT_DELIVERED', 'UNCONFIRMED');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "decisionId" TEXT,
ADD COLUMN     "decisionMessageKind" "DecisionMessageKind",
ADD COLUMN     "decisionMessageStatus" "DecisionMessageStatus",
ADD COLUMN     "decisionMessageText" TEXT,
ADD COLUMN     "switchedAt" TIMESTAMP(3);

