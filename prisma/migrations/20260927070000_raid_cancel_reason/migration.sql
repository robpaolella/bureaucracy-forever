-- SYNC-SPEC §8: the cancel reason survives the bot re-rendering the message.
ALTER TABLE "Raid" ADD COLUMN "cancelReason" TEXT;
