# Officer loot tables

Officers open a raid tier to see its boss-by-boss loot table, load a whole table from a
file with `Load table`, and read when it was last loaded. The local seed reaches the empty
template pages. For a populated table, use the approved local-only import in
[Loot data for local verification](loot-data.md); for the load flow, follow
[Load a table and read its history](#load-a-table-and-read-its-history).

## Sub-features

- `loot-tiers`: raid-tier links, loot counts/empty labels and inactive badges.
- `loot-template`: `/officers/loot/[templateId]`, its empty boss list and populated boss/item table.
- `loot-load-history`: the `Last loaded from …` line and `Load history` list under `Load table`.

## How to get to it (user POV)

Open `Officers` → `Loot tables` for `/officers/loot`, then select a named raid tier.
`All loot tables` returns to the tier list.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared rules in [the index](README.md).

### Empty seeded table

- **Enter.** `open "$BASE/dev/session?as=officer&back=/officers/loot"`; snapshot.
  Expect `Loot tables`, `Raid tiers` and the three seeded tier links: Barrow Deeps,
  Hyjal Summit and Onyxia's Lair. A template created during the raid-planner proof also
  appears here; do not assume a fixed total then.
- **Open a tier.** Click the link beginning `Onyxia's Lair · Ony`. Record its real
  `/officers/loot/<id>` URL from the snapshot rather than hard-coding a seed ID.
  Expect heading `Onyxia's Lair`, `No bosses yet.`, `BOSS NAME`, the `Trash`
  checkbox, disabled `Add boss` while the name is blank, and `Refresh items from Wowhead`.
- **Read back.** Fully reopen that detail URL and confirm the empty state remains;
  use `All loot tables` to check the tier still says `No loot table yet`. There is
  no saved mutation to prove in this scope. Save list/detail snapshots and capture
  the empty detail page at desktop and phone widths.

### Populated local test table

After loading Onyxia's Lair through [Loot data for local verification](loot-data.md),
enter as an officer.

- **Open the imported tier.** At `/officers/loot`, expect Onyxia's Lair to show a
  non-zero boss and item count. Click its link and record the real detail URL.
- **Confirm the table.** Expect the `Onyxia's Lair` heading, named boss sections and
  item links rather than `No bosses yet.` Confirm the page shows 26 imported items,
  then fully reopen the detail URL and confirm the bosses and items
  remain. This proves the imported local data is available to the page; do not edit,
  reorder or refresh it.
- **Proof.** Save list/detail snapshots and capture the populated detail page at
  1440 × 900 and 390 × 844. Record the count and artifact paths in `$EVIDENCE/notes.md`.

### Load a table and read its history

Run this on a tier that has never been loaded (Hyjal Summit in the seed), so the
table is empty and the Onyxia import above stays untouched. The page's read of the
history is the only thing proved here; the Load table window is covered by its own states.

- **Never loaded.** Open the tier. Expect the toolbar with `Load table` and
  `Refresh items from Wowhead`, and **no** `Last loaded from` line and no `Load history`
  toggle. Capture full-page at 1440 × 900 and 390 × 844 (design state `table-empty`).
- **Cache Forever items first.** `Load table` fetches an item from Wowhead only when it
  is not already cached as a WoW Forever item, so cache some into a *different* tier
  and the loads below make no Wowhead request. Write a file outside git, for example
  `{"bosses":[{"name":"Lucifron","items":[17073,18814,18815,18820]},{"name":"Magmadar","items":[18821,18879,19138]}]}`,
  and import it into Onyxia's Lair with the database URL passed as in
  [Loot data for local verification](loot-data.md), but
  `npm run loot:import -- --template "Onyxia's Lair" --ids <file> --source forever`
  (the importer's own public Wowhead fetches, approved there, local database only).
  The Classic Onyxia import above cannot be reused: ids cached as Classic are refused
  ("already saved from a different game").
- **Make two loads into Hyjal Summit.** Write a second file with only
  `{"bosses":[{"name":"Lucifron","items":[17073,18814]}]}`. Click `Load table`, `upload`
  a file onto `Choose file`, `Preview` (it answers at once, with no fetching progress),
  then `Load N items`; do the small file first, then the full one. Fresh handles after
  each step.
- **Line.** After the second load, fully reopen the tier URL. Expect `Last loaded from
  <second file> by Ledgerline · <date>, <time> · merge`. The time is in your zone; the
  guild-time popup shows only when your zone differs from guild time.
- **History.** Click `Load history`: it becomes `Hide load history` and lists both
  loads newest first with Source, Officer, When, Mode (`Merge`) and Changes (`+5`, `+2`).
  Capture full-page at both widths (design state `history`; also `table` with the history closed). A merge shows only `+N`; a replace
  with removals shows `+N −M`. Make replace rows through the window: tick `Replace` on the source step, then
  Preview and Load a file that drops items or a boss from the table.
- **Guild time.** The popup shows only when your browser zone differs from guild time.
  To see it, set the site's own viewer-zone override (`localStorage` key
  `bureaucracy.viewer-timezone`, e.g. `Asia/Tokyo`), reload, then hover or Tab to a time:
  expect `<day> <time> guild time (PDT)`. Remove the key afterwards.
- **Window states by real clicks.** Items are fetched from the Forever Wowhead database, which
  lacks most Molten Core ids; use ids that exist there (for example 19019, 18879, 19147, 18564,
  17204) and ids that don't to see "Wowhead couldn't find". `fetching` and `stopped`: a file of
  about 30 unknown ids, press `Preview`, capture, then `Stop`. `preview-replace`: tick `Replace`
  after a reserve (raid page, `Change reserves`) and an award (raid page, loot log `Record`) on
  items already in the table. `preview-stale`: open the window in tab A and Preview, load another
  file in tab B, then press `Load` in A; capture with `--full-page` and crop, because a viewport
  screenshot crashed the browser here. `apply-failed`: after Preview, `emulate --network Offline`,
  press `Load`, check with `eval` and screenshot within 4 seconds (the toast goes after 4); the CLI
  reports an error for snapshots and screenshots while offline, but the screenshot file is written.
  Get the button's handle before going offline. Reset with `emulate --network "Fast 4G"`.
- **Not proved locally.** A 10-row history cap needs more loads than is cheap to make by
  hand; the component tests cover it. `source-atlas-off` needs the server to run with
  `VERCEL_ENV=production`, which the launcher refuses, and `atlas-missing` needs AtlasLoot's raid
  list to change between the list and the load; neither is reachable from the window.

### Record an unlisted drop (raid page loot log)

Load Onyxia's Lair with `--source forever` (not `classic`: a Classic-cached id is refused as
"not Forever") so its table items count as Forever items; expect 10 imported, the rest "Entity not
found". Enter as `officer`, open a seeded Onyxia's Lair raid and scroll to `Loot log`.

- **Not on the table.** Pick `Item not on the table…` in Item; focus moves to the link box.
  Type `wowhead.com/for` (`not-forever`, no request), `999999` (`not-found`), then `19019`
  (Wowhead answers: found, `New to the table…`). Pick a winner, press `Add and record`; the row
  appears on top of Recorded and the tier's table page count goes up by one.
- **Already on the table.** Repeat with `19019`: Item switches to it, the teal note shows,
  button reads `Record`.
- **Wowhead down / save failed.** The browser can't make Wowhead fail, but `emulate --network
  Offline` makes the lookup (`Couldn't reach Wowhead.`, `Try again`) and the save (`Nothing was
  saved.`) fail; go back with `--network "Fast 4G"` and press the button again. Screenshots report
  an error after `emulate` but the file is written.
- **No bosses.** Open a Hyjal Summit raid (seeded, no table): the log shows the no-bosses message
  and a link to that tier's table, and `Nothing recorded yet.`

## Gotchas

- The page and loot APIs return 404 without `LOOT_ENABLED=true`. The local launcher
  already sets it through `childEnvironment` in `prisma/local-database.ts`; no
  settings-file change or extra flag is needed. Non-officers also get 404 (index).
- The seed has raid templates but **no loot data**. Do not click
  `Refresh items from Wowhead`. For a populated table follow
  [Loot data for local verification](loot-data.md); `Load table` is the one approved way
  to bring in external loot data besides that import, and only into this local database.
  Classic ids from the Onyxia import are refused by `Load table` ("already saved from a
  different game"); use the Forever-cache recipe in the section above.
- The no-templates tier-list state is not reached by the seed. Empty boss lists and
  `No loot table yet` are reached. Populated editing, ordering and item persistence
  remain unverified; do not claim this map proves them. Loading and the history read-back
  are proved only as far as the section above says.
