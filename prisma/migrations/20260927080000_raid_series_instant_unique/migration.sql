-- One instance per series per instant; generation from a request and from tick may race (SYNC-SPEC §6).
CREATE UNIQUE INDEX "Raid_seriesId_startsAt_key" ON "Raid"("seriesId", "startsAt");
