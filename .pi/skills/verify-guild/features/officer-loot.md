# Officer loot tables

Officers open a raid tier to see its boss-by-boss loot table. The local seed reaches
the empty template pages. For a populated table, use the approved local-only import in
[Loot data for local verification](loot-data.md).

## Sub-features

- `loot-tiers`: raid-tier links, loot counts/empty labels and inactive badges.
- `loot-template`: `/officers/loot/[templateId]`, its empty boss list and populated boss/item table.

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
start the local server and enter as an officer.

- **Open the imported tier.** At `/officers/loot`, expect Onyxia's Lair to show a
  non-zero boss and item count. Click its link and record the real detail URL.
- **Confirm the table.** Expect the `Onyxia's Lair` heading, named boss sections and
  item links rather than `No bosses yet.` Confirm the page shows 26 imported item
  entries in total, then fully reopen the detail URL and confirm the bosses and items
  remain. This proves the imported local data is available to the page; do not edit,
  reorder or refresh it.
- **Proof.** Save list/detail snapshots and capture the populated detail page at
  1440 × 900 and 390 × 844. Record the count and artifact paths in `$EVIDENCE/notes.md`.

## Gotchas

- The page and loot APIs return 404 without `LOOT_ENABLED=true`. The local launcher
  already sets it through `childEnvironment` in `prisma/local-database.ts`; no
  settings-file change or extra flag is needed. Non-officers also get 404 (index).
- The seed has raid templates but **no loot data**. Do not add bosses/items or click
  `Refresh items from Wowhead`; for the approved populated local proof, follow
  [Loot data for local verification](loot-data.md) instead.
- The no-templates tier-list state is not reached by the seed. Empty boss lists and
  `No loot table yet` are reached. Populated editing, ordering and item persistence
  remain unverified; do not claim this map proves them.
