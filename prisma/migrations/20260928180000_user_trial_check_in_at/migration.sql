-- When the next trial check-in is due, set by "Extend trial" in Discord. Null means
-- fourteen days after trialStartedAt, so existing trials keep their current due date.
ALTER TABLE "User" ADD COLUMN "trialCheckInAt" TIMESTAMP(3);
