-- The roster follows Discord: rank and guild membership live on the user, so a member
-- without a character on the site still appears. Backfilled from the main character and
-- the site role; the bot's first member snapshot then takes over.
ALTER TABLE "User" ADD COLUMN "rank" "Rank" NOT NULL DEFAULT 'SOCIAL';
ALTER TABLE "User" ADD COLUMN "inGuild" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "trialStartedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "trialNudgedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "discordSyncedAt" TIMESTAMP(3);

UPDATE "User" u SET "rank" = c."rank" FROM "Character" c WHERE c."userId" = u."id" AND c."isMain" = true;
UPDATE "User" SET "inGuild" = true WHERE "role" IN ('MEMBER', 'OFFICER');
