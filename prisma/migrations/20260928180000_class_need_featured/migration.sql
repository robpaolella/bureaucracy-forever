-- The one high-need spec officers star to lead the home page recruitment strip.
ALTER TABLE "ClassNeed" ADD COLUMN "featured" BOOLEAN NOT NULL DEFAULT false;
