-- Additive: a character's level from Blizzard's WoW Forever API and when it was checked.
-- Existing characters stay null (level unknown, never checked).
-- AlterTable
ALTER TABLE "Character" ADD COLUMN     "level" INTEGER,
ADD COLUMN     "levelAttemptedAt" TIMESTAMP(3),
ADD COLUMN     "levelCheckedAt" TIMESTAMP(3);
