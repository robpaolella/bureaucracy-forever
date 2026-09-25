-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SOCIAL', 'MEMBER', 'OFFICER');

-- CreateEnum
CREATE TYPE "WowClass" AS ENUM ('WARRIOR', 'PALADIN', 'HUNTER', 'ROGUE', 'PRIEST', 'SHAMAN', 'MAGE', 'WARLOCK', 'DRUID');

-- CreateEnum
CREATE TYPE "RaidRole" AS ENUM ('TANK', 'HEALER', 'MELEE', 'RANGED');

-- CreateEnum
CREATE TYPE "Rank" AS ENUM ('OFFICER', 'RAIDER', 'TRIAL', 'SOCIAL');

-- CreateEnum
CREATE TYPE "Response" AS ENUM ('ACCEPT', 'TENTATIVE', 'ABSENT');

-- CreateEnum
CREATE TYPE "Source" AS ENUM ('WEB', 'DISCORD');

-- CreateEnum
CREATE TYPE "AppPath" AS ENUM ('RAIDER', 'SOCIAL');

-- CreateEnum
CREATE TYPE "AppStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "NeedStatus" AS ENUM ('HIGH', 'MEDIUM', 'CLOSED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "discordName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SOCIAL',
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "class" "WowClass" NOT NULL,
    "spec" TEXT NOT NULL,
    "raidRole" "RaidRole" NOT NULL,
    "rank" "Rank" NOT NULL DEFAULT 'TRIAL',
    "isMain" BOOLEAN NOT NULL DEFAULT true,
    "attendance" DOUBLE PRECISION,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "slots" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "Raid" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 180,
    "notes" TEXT,
    "discordEventId" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "requirements" JSONB NOT NULL,

    CONSTRAINT "Raid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Signup" (
    "id" TEXT NOT NULL,
    "raidId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "response" "Response" NOT NULL,
    "source" "Source" NOT NULL,
    "reason" TEXT,
    "setByUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Signup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Application" (
    "id" TEXT NOT NULL,
    "path" "AppPath" NOT NULL,
    "status" "AppStatus" NOT NULL DEFAULT 'PENDING',
    "discordId" TEXT NOT NULL,
    "discordName" TEXT NOT NULL,
    "character" TEXT NOT NULL,
    "class" "WowClass",
    "spec" TEXT,
    "logsUrl" TEXT,
    "answers" JSONB NOT NULL,
    "readAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "decidedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficerNote" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficerNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClassNeed" (
    "id" TEXT NOT NULL,
    "class" "WowClass" NOT NULL,
    "spec" TEXT NOT NULL,
    "role" "RaidRole" NOT NULL,
    "status" "NeedStatus" NOT NULL DEFAULT 'CLOSED',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClassNeed_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "Character_name_key" ON "Character"("name");

-- CreateIndex
CREATE INDEX "Character_userId_idx" ON "Character"("userId");

-- CreateIndex
CREATE INDEX "Raid_startsAt_idx" ON "Raid"("startsAt");

-- CreateIndex
CREATE UNIQUE INDEX "Signup_raidId_userId_key" ON "Signup"("raidId", "userId");

-- CreateIndex
CREATE INDEX "Application_status_createdAt_idx" ON "Application"("status", "createdAt");

-- CreateIndex
CREATE INDEX "OfficerNote_applicationId_idx" ON "OfficerNote"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "ClassNeed_class_spec_key" ON "ClassNeed"("class", "spec");

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_raidId_fkey" FOREIGN KEY ("raidId") REFERENCES "Raid"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Signup" ADD CONSTRAINT "Signup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerNote" ADD CONSTRAINT "OfficerNote_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OfficerNote" ADD CONSTRAINT "OfficerNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
