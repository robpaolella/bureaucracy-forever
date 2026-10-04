# Officer loot tables

Officers open a raid tier to see its boss-by-boss loot table. This seed-only map
stops at the empty template pages; it does not add loot data.

## Sub-features

- `loot-tiers`: raid-tier links, loot counts/empty labels and inactive badges.
- `loot-template`: `/officers/loot/[templateId]` and its empty boss list.

## How to get to it (user POV)

Open `Officers` → `Loot tables` for `/officers/loot`, then select a named raid tier.
`All loot tables` returns to the tier list.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared rules in [the index](README.md).

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

## Gotchas

- The page and loot APIs return 404 without `LOOT_ENABLED=true`. The local launcher
  already sets it through `childEnvironment` in `prisma/local-database.ts`; no
  settings-file change or extra flag is needed. Non-officers also get 404 (index).
- The seed has raid templates but **no loot data**. Do not add bosses/items or click
  `Refresh items from Wowhead`: item imports and external requests are not this proof.
- The no-templates tier-list state is not reached by the seed. Empty boss lists and
  `No loot table yet` are reached. Populated editing, ordering and item persistence
  remain unverified; do not claim this map proves them.
