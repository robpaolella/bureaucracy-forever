-- Additive: existing items remain open to reserves; no backfill.
CREATE TABLE "LootReserveSetting" (
    "templateId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "blocked" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "LootReserveSetting_pkey" PRIMARY KEY ("templateId", "itemId")
);
CREATE INDEX "LootReserveSetting_itemId_idx" ON "LootReserveSetting"("itemId");
ALTER TABLE "LootReserveSetting" ADD CONSTRAINT "LootReserveSetting_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RaidTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LootReserveSetting" ADD CONSTRAINT "LootReserveSetting_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LootItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
