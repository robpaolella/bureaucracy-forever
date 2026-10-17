-- Additive: officers' loot-helper keys (ADDON-SPEC section 7.2). Only each key's SHA-256
-- hash is stored, never the key.
-- CreateTable
CREATE TABLE "HelperKey" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "HelperKey_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HelperKey_keyHash_key" ON "HelperKey"("keyHash");

-- CreateIndex
CREATE INDEX "HelperKey_userId_idx" ON "HelperKey"("userId");

-- AddForeignKey
ALTER TABLE "HelperKey" ADD CONSTRAINT "HelperKey_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

