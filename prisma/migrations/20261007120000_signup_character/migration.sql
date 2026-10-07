-- Fail rather than choose arbitrarily if existing data violates either rule.
CREATE UNIQUE INDEX "Character_one_main_per_user" ON "Character"("userId") WHERE "isMain" = true;
CREATE UNIQUE INDEX "Character_name_lower_key" ON "Character"(lower("name"));

ALTER TABLE "Signup" ADD COLUMN "characterId" TEXT;
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_characterId_fkey"
  FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "Signup_characterId_idx" ON "Signup"("characterId");

UPDATE "Signup" AS s SET "characterId" = c."id"
FROM "Character" AS c WHERE c."userId" = s."userId" AND c."isMain" = true;
