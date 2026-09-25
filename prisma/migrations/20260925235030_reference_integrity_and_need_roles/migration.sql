-- AlterTable
ALTER TABLE "ClassNeed" DROP COLUMN "role",
ADD COLUMN     "roles" "RaidRole"[];

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Application" ADD CONSTRAINT "Application_decidedByUserId_fkey" FOREIGN KEY ("decidedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

