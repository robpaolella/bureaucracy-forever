-- Additive: what Discord tags in bot-sent notes and relay messages point to (SYNC-SPEC §4, Mentions). Existing rows stay null.
-- AlterTable
ALTER TABLE "OfficerNote" ADD COLUMN     "mentions" JSONB;

-- AlterTable
ALTER TABLE "ApplicantMessage" ADD COLUMN     "mentions" JSONB;
