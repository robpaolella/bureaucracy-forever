-- Additive: a nullable, unique key per submission so a retried award can't record twice.
-- Existing awards keep NULL, which a unique index allows any number of times.
ALTER TABLE "LootAward" ADD COLUMN "requestKey" TEXT;

CREATE UNIQUE INDEX "LootAward_requestKey_key" ON "LootAward"("requestKey");
