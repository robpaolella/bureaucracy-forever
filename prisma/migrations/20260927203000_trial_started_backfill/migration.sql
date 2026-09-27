-- Trials that existed before the roster followed Discord get a clock, so the two-week check-in reaches them too.
UPDATE "User" SET "trialStartedAt" = COALESCE((SELECT c."joinedAt" FROM "Character" c WHERE c."userId" = "User"."id" AND c."isMain" = true LIMIT 1), CURRENT_TIMESTAMP) WHERE "rank" = 'TRIAL' AND "trialStartedAt" IS NULL;
