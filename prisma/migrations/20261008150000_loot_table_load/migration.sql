-- Additive load history; no member relation, so officer snapshots outlive accounts.
CREATE TABLE "LootTableLoad" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "sourceName" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "officerName" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'merge',
    "added" INTEGER NOT NULL,
    "removed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LootTableLoad_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "LootTableLoad_mode_check" CHECK ("mode" IN ('merge', 'replace')),
    CONSTRAINT "LootTableLoad_counts_check" CHECK ("added" >= 0 AND "removed" >= 0)
);

CREATE INDEX "LootTableLoad_templateId_createdAt_idx" ON "LootTableLoad"("templateId", "createdAt");
ALTER TABLE "LootTableLoad" ADD CONSTRAINT "LootTableLoad_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "RaidTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
