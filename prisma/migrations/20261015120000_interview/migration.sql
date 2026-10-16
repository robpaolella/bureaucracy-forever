-- Additive: interview attempts (SYNC-SPEC §3, §12). No existing table changes.
-- CreateEnum
CREATE TYPE "InterviewStatus" AS ENUM ('AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED', 'DONE', 'CANCELLED', 'NO_TIME', 'CLOSED');

-- CreateEnum
CREATE TYPE "InterviewEndReason" AS ENUM ('DECLINED', 'EXPIRED', 'PROPOSAL_LAPSED');

-- CreateTable
CREATE TABLE "Interview" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "status" "InterviewStatus" NOT NULL DEFAULT 'AWAITING_TIMES',
    "endReason" "InterviewEndReason",
    "activeKey" TEXT,
    "requestedById" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "timeZone" TEXT,
    "slots" TIMESTAMP(3)[],
    "timesRevision" INTEGER NOT NULL DEFAULT 0,
    "timesSubmittedAt" TIMESTAMP(3),
    "timesUpdatedAt" TIMESTAMP(3),
    "proposedStart" TIMESTAMP(3),
    "proposedById" TEXT,
    "proposedAt" TIMESTAMP(3),
    "bookedStart" TIMESTAMP(3),
    "bookedById" TEXT,
    "bookedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "endedById" TEXT,
    "remindedAt" TIMESTAMP(3),
    "joinedNotifiedAt" TIMESTAMP(3),
    "headsUpAt" TIMESTAMP(3),
    "requestDmId" TEXT,
    "timesMessageId" TEXT,
    "proposalMessageId" TEXT,
    "proposalDmId" TEXT,
    "bookedMessageId" TEXT,

    CONSTRAINT "Interview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Interview_activeKey_key" ON "Interview"("activeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Interview_applicationId_attempt_key" ON "Interview"("applicationId", "attempt");

-- AddForeignKey
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Prisma can't express these; the database keeps the rows honest whatever code writes them.
-- activeKey is the application id exactly while the attempt is active, so the unique index
-- above allows one active attempt per application.
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_activeKey_check" CHECK (
    CASE WHEN "status" IN ('AWAITING_TIMES', 'TIMES_RECEIVED', 'PROPOSED', 'BOOKED')
        THEN "activeKey" IS NOT NULL AND "activeKey" = "applicationId"
        ELSE "activeKey" IS NULL
    END
);

-- An end reason only with NO_TIME, and NO_TIME always has one.
ALTER TABLE "Interview" ADD CONSTRAINT "Interview_endReason_check" CHECK (("endReason" IS NOT NULL) = ("status" = 'NO_TIME'));
