-- Additive: how an add-on award reached the site, so the officers' loot log can say
-- "sent by <officer>'s helper" or "imported by <officer>". No backfill: awards stored
-- before this read as delivered by the officer in `recordedById`.
-- CreateEnum
CREATE TYPE "LootDelivery" AS ENUM ('HELPER', 'IMPORT');

-- AlterTable
ALTER TABLE "LootAward" ADD COLUMN     "deliveredVia" "LootDelivery";
