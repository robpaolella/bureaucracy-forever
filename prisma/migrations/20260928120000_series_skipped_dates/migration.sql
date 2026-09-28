-- Guild dates whose series instance an officer deleted, so tick does not regenerate them.
ALTER TABLE "RaidSeries" ADD COLUMN "skippedDates" TEXT[] DEFAULT ARRAY[]::TEXT[];
