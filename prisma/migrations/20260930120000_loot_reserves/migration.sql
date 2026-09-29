-- Loot: tables per raid tier, cached Wowhead items, hard/soft reserves and the loot log.
-- Additive only. The features stay behind LOOT_ENABLED (lib/flags.ts).

-- CreateEnum
CREATE TYPE "ReserveKind" AS ENUM ('HR', 'SR');

-- CreateEnum
CREATE TYPE "LootMethod" AS ENUM ('HR', 'SR', 'MAIN_SPEC', 'OFF_SPEC', 'OPEN_ROLL', 'DISENCHANT_BANK');

-- CreateEnum
CREATE TYPE "ItemSource" AS ENUM ('CLASSIC', 'FOREVER');

-- CreateTable
CREATE TABLE "LootItem" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "quality" INTEGER NOT NULL,
    "icon" TEXT NOT NULL,
    "tooltipHtml" TEXT NOT NULL,
    "source" "ItemSource" NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LootItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootBoss" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "isTrash" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LootBoss_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootTableEntry" (
    "bossId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "LootTableEntry_pkey" PRIMARY KEY ("bossId","itemId")
);

-- CreateTable
CREATE TABLE "Reserve" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "characterId" TEXT NOT NULL,
    "itemId" INTEGER NOT NULL,
    "kind" "ReserveKind" NOT NULL,
    "setById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reserve_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootAward" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "bossId" TEXT,
    "bossName" TEXT,
    "itemId" INTEGER NOT NULL,
    "characterId" TEXT,
    "characterName" TEXT,
    "userId" TEXT,
    "method" "LootMethod" NOT NULL,
    "roll" INTEGER,
    "note" TEXT,
    "recordedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    "voidReason" TEXT,

    CONSTRAINT "LootAward_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LootBoss_templateId_name_key" ON "LootBoss"("templateId", "name");

-- CreateIndex
CREATE INDEX "LootTableEntry_itemId_idx" ON "LootTableEntry"("itemId");

-- CreateIndex
CREATE INDEX "Reserve_raidId_itemId_idx" ON "Reserve"("raidId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Reserve_raidId_userId_kind_key" ON "Reserve"("raidId", "userId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "Reserve_raidId_userId_itemId_key" ON "Reserve"("raidId", "userId", "itemId");

-- CreateIndex
CREATE INDEX "LootAward_raidId_idx" ON "LootAward"("raidId");

-- CreateIndex
CREATE INDEX "LootAward_characterId_itemId_idx" ON "LootAward"("characterId", "itemId");

-- AddForeignKey
ALTER TABLE "LootBoss" ADD CONSTRAINT "LootBoss_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RaidTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootTableEntry" ADD CONSTRAINT "LootTableEntry_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "LootBoss"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootTableEntry" ADD CONSTRAINT "LootTableEntry_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LootItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserve" ADD CONSTRAINT "Reserve_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserve" ADD CONSTRAINT "Reserve_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserve" ADD CONSTRAINT "Reserve_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reserve" ADD CONSTRAINT "Reserve_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LootItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_bossId_fkey" FOREIGN KEY ("bossId") REFERENCES "LootBoss"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "LootItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Every award names a character except disenchant/bank. Checked on the copied name, not the
-- id, because the id is nulled when a character is deleted and the record must survive.
ALTER TABLE "LootAward" ADD CONSTRAINT "LootAward_character_check" CHECK ("method" = 'DISENCHANT_BANK' OR "characterName" IS NOT NULL);
