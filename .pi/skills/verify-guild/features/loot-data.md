# Loot data for local verification

The local seed creates the WoW Forever raid templates but deliberately has no loot tables.
When a proof needs a populated table, load the approved public test data into **this
worktree's throwaway local database** after `npm run db:local` (or the `Launch` step in
`../SKILL.md`) and before starting the local server.

## Load Onyxia's Lair

`npm run db:local` prints `Local database ready on port N`. Substitute that port below;
do not put this URL in a settings file. Pass it only to this one command's process
environment as both URLs:

```bash
LOCAL_DATABASE_URL="postgresql://worker:worker@127.0.0.1:<port>/bureau"
DATABASE_URL="$LOCAL_DATABASE_URL" DIRECT_URL="$LOCAL_DATABASE_URL" \
  npm run loot:import -- --template "Onyxia's Lair" --atlas Onyxia --source classic
```

The importer reads `DIRECT_URL` first, which is why both are set. It fetches the public
AtlasLoot table and its item details from Wowhead. This is approved only for the
worker's own folder-labelled local database; never use it for staging or production.
`prisma/write-guard.ts` makes the importer refuse non-local targets, so confirm that
rule by reading the guard rather than trying a real database.

Classic loot is verification material only. It is not WoW Forever's real loot table.
For the current Onyxia import, expect the command to report 26 table entries. Then
continue with [Officer loot tables](officer-loot.md)'s populated-table path.
