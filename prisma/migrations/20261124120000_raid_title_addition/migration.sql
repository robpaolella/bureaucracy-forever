-- Additive: an optional title addition on raids and series ("Key Run"). Existing rows stay null.
-- AlterTable
ALTER TABLE "Raid" ADD COLUMN     "titleAddition" TEXT;

-- AlterTable
ALTER TABLE "RaidSeries" ADD COLUMN     "titleAddition" TEXT;
