-- Additive: a per-raid "Reserves allowed" switch (#451). Existing and new raids default to on.
-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "reservesAllowed" BOOLEAN NOT NULL DEFAULT true;
