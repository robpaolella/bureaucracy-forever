# Loot data for local verification

The local seed creates the WoW Forever raid templates but deliberately has no loot tables.
When a proof needs a populated table, load the approved public test data into **this
worktree's throwaway local database** after it exists. Run this after `npm run db:local`,
or after `Launch` and Doctor PASS in `../SKILL.md`; the importer is safe while the local
development server is running.

## Load Onyxia's Lair

With `npm run db:local`, take `N` from its `Local database ready on port N` message. With
`Launch`, retrieve the same local-only port from the recorded container without printing a
database URL:

```bash
LOCAL_DATABASE_CONTAINER=$(node -p "require(process.argv[1]).container" "$EVIDENCE/run.json")
LOCAL_DATABASE_PORT=$(docker container inspect "$LOCAL_DATABASE_CONTAINER" --format '{{(index (index .NetworkSettings.Ports "5432/tcp") 0).HostPort}}')
```

Substitute that port below; do not put the URL in a settings file. Pass it only to this
one command's process environment as both URLs:

```bash
LOCAL_DATABASE_URL="postgresql://worker:worker@127.0.0.1:<port>/bureau"
DATABASE_URL="$LOCAL_DATABASE_URL" DIRECT_URL="$LOCAL_DATABASE_URL" \
  npm run loot:import -- --template "Onyxia's Lair" --atlas Onyxia --source classic
```

The importer reads `DIRECT_URL` first, which is why both are set. It fetches the public
AtlasLoot table and its item details from Wowhead; allow about a minute. This is approved
only for the worker's own folder-labelled local database; never use it for staging or
production. `prisma/write-guard.ts` makes the importer refuse non-local targets, so
confirm that rule by reading the guard rather than trying a real database.

Classic loot is verification material only. It is not WoW Forever's real loot table.
For the current Onyxia import, expect 26 imported items. If the command reports failed
items, record the count and do not claim the populated path passed. Then continue with
[Officer loot tables](officer-loot.md)'s populated-table path.
