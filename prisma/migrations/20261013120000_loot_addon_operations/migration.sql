-- Additive: where an award came from, its game time, who handed it out, whether the game
-- confirmed it and the practice mark (ADDON-SPEC sections 2 and 4), plus the receipts that
-- make the add-on's operations safe in any order (section 4.2). Existing awards read as
-- typed into the loot log and confirmed, through the column defaults.
-- CreateEnum
CREATE TYPE "LootSource" AS ENUM ('LOOT_LOG', 'ADDON');

-- CreateEnum
CREATE TYPE "LootConfirmation" AS ENUM ('ANNOUNCED', 'CONFIRMED', 'NOT_CONFIRMED');

-- CreateEnum
CREATE TYPE "LootOperationType" AS ENUM ('AWARD', 'CONFIRM', 'NOT_CONFIRMED', 'VOID', 'REPLACE');

-- CreateEnum
CREATE TYPE "LootOperationStatus" AS ENUM ('PENDING', 'APPLIED');

-- AlterTable
ALTER TABLE "LootAward" ADD COLUMN     "awardedAt" TIMESTAMP(3),
ADD COLUMN     "confirmation" "LootConfirmation" NOT NULL DEFAULT 'CONFIRMED',
ADD COLUMN     "confirmedAt" TIMESTAMP(3),
ADD COLUMN     "handedOutById" TEXT,
ADD COLUMN     "handedOutByName" TEXT,
ADD COLUMN     "practice" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "source" "LootSource" NOT NULL DEFAULT 'LOOT_LOG';

-- CreateTable
CREATE TABLE "LootOperation" (
    "id" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "type" "LootOperationType" NOT NULL,
    "key" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "status" "LootOperationStatus" NOT NULL,
    "deliveredById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedAt" TIMESTAMP(3),

    CONSTRAINT "LootOperation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LootOperationRejection" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "opId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "deliveredById" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LootOperationRejection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "LootOperation_opId_key" ON "LootOperation"("opId");

-- CreateIndex
CREATE INDEX "LootOperation_raidId_key_idx" ON "LootOperation"("raidId", "key");

-- CreateIndex
CREATE INDEX "LootOperationRejection_raidId_idx" ON "LootOperationRejection"("raidId");

-- AddForeignKey
ALTER TABLE "LootOperation" ADD CONSTRAINT "LootOperation_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

