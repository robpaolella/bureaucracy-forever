-- Feral fills two raid seats, so its recruitment need splits into one row per role: the old
-- 'Feral' row becomes 'Feral Tank' (keeping its status and star), and 'Feral Melee DPS'
-- starts at the same status. Officers can then set them apart. A row already written under
-- either new name wins over the old one.
INSERT INTO "ClassNeed" ("id", "class", "spec", "roles", "status", "featured", "updatedAt")
SELECT gen_random_uuid()::text, "class", 'Feral Tank', ARRAY['TANK']::"RaidRole"[], "status", "featured", now()
FROM "ClassNeed"
WHERE "class" = 'DRUID' AND "spec" = 'Feral'
ON CONFLICT ("class", "spec") DO NOTHING;

INSERT INTO "ClassNeed" ("id", "class", "spec", "roles", "status", "featured", "updatedAt")
SELECT gen_random_uuid()::text, "class", 'Feral Melee DPS', ARRAY['MELEE']::"RaidRole"[], "status", false, now()
FROM "ClassNeed"
WHERE "class" = 'DRUID' AND "spec" = 'Feral'
ON CONFLICT ("class", "spec") DO NOTHING;

DELETE FROM "ClassNeed" WHERE "class" = 'DRUID' AND "spec" = 'Feral';
