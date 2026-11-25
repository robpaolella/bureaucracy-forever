-- Additive: a member's optional default sign-up character. Existing members stay null
-- (no default); deleting the character clears it.
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultCharacterId" TEXT;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_defaultCharacterId_fkey" FOREIGN KEY ("defaultCharacterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;
