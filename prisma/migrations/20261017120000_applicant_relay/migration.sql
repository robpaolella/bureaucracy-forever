-- Additive: the officer–applicant relay (SYNC-SPEC §3, §13). Nothing existing changes.
-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('TO_APPLICANT', 'FROM_APPLICANT');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('QUEUED', 'SENT', 'NOT_DELIVERED', 'NOT_SENT');

-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "relayPingAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ApplicantMessage" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "authorUserId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "MessageStatus",
    "dmChannelId" TEXT,
    "dmMessageId" TEXT,
    "copyChannelId" TEXT,
    "copyMessageId" TEXT,
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "editedAt" TIMESTAMP(3),
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "ApplicantMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ApplicantMessage_dmMessageId_key" ON "ApplicantMessage"("dmMessageId");

-- CreateIndex
CREATE INDEX "ApplicantMessage_applicationId_createdAt_idx" ON "ApplicantMessage"("applicationId", "createdAt");

-- AddForeignKey
ALTER TABLE "ApplicantMessage" ADD CONSTRAINT "ApplicantMessage_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

