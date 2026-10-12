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
  with removals shows `+N −M`, which only a seeded audit row can show locally.
- **Guild time.** The popup shows only when your browser zone differs from guild time.
  To see it, set the site's own viewer-zone override (`localStorage` key
  `bureaucracy.viewer-timezone`, e.g. `Asia/Tokyo`), reload, then hover or Tab to a time:
  expect `<day> <time> guild time (PDT)`. Remove the key afterwards.
- **Not proved locally.** Replace loads (#126) and a 10-row history cap need rows the
  UI can't yet create cheaply; the component tests cover both.

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
