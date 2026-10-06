-- Additive: existing items read as limit 1, the "won once" rule; no backfill.
ALTER TABLE "LootReserveSetting" ADD COLUMN "winLimit" INTEGER NOT NULL DEFAULT 1;
-- The routes enforce 1 to 5 (lib/loot-rules.ts parseWinLimit); this backs them up.
ALTER TABLE "LootReserveSetting" ADD CONSTRAINT "LootReserveSetting_winLimit_check" CHECK ("winLimit" BETWEEN 1 AND 5);
