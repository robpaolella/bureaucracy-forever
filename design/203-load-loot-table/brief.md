# Design: load a whole loot table

- Design issue: #203
- Revision: 1
- Replaces: none
- Source plan: #89 (loot plan); covered build issues below

## Job and audience
Officers on a raid tier's loot table page (`/officers/loot/[templateId]`) who need the whole
table in place before Dec 9 (first clears are not open-rolled). Today they add items one at a
time; whole tables load only through the CLI importer, which refuses production. The job:
load a whole table from a file or AtlasLoot, see exactly what will change, then confirm.
Success: a 100+ item table loads in a couple of minutes with no surprises, and nothing is
written until the officer confirms.

Product facts: #101 (file format `{ "bosses": [{ "name", "trash"?, "items": [ids] }] }`,
merge keeps manual entries and blocked-item settings, stale previews refused, batched fetching,
audit), #125 (AtlasLoot version is a server setting; officers pick only AtlasLoot and a raid,
Robert #46), #126 (replace keeps items with reserves or awards and their boss, Robert #47),
#93 (production accepts WoW Forever items only). Existing batch: 30 items per request.

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #101 | "Load table" button; file source; malformed-file message; Wowhead fetching with progress, Stop and retry; merge preview; not-found list; nothing-to-change; stale refusal; confirm and result; "Last loaded" line and load history | AtlasLoot source, replace mode; the CLI and its write guard |
| #125 | AtlasLoot source with a raid dropdown; greyed AtlasLoot on the live site with its reason; raid missing from the data | Where the AtlasLoot version is set (server setting, not visible) |
| #126 | Replace checkbox; "Removes" list; "Kept: has awards" / "Kept: has reserves" and "Boss kept" tags; red confirm | Merge behaviour itself |

## Boundaries and visual authority
DESIGN.md and the live site govern the look. Reuse `Modal`, `Button` (primary, secondary,
ghost, danger), `Field`/`Select`, `Choice` (radio, checkbox), `Tag`, `ItemName`, toasts and the
toolbar card that holds "Refresh items from Wowhead". Outside the feature, by Robert's Open Design pin 1: the add boss checkbox label (shared with the Edit boss window) becomes "Trash drops". Otherwise unchanged: boss headers and controls,
item rows, Reserves window, add boss/item forms, page header.

New kind of element for approval: a fetch progress bar (the existing `ProgressTrack` is a
requirement meter that turns amber when short, so it doesn't fit; the new bar uses the same
6px track with a teal fill and the count beside it).

## The one decision the versions vary
Where the flow lives (Robert, #1):
- **A:** a "Load table" window over the page; source, fetching, preview and confirm all inside it.
- **B:** a panel opening at the top of the page; the preview sits full width above the table.
Everything else is identical between A and B.

## States, themes and content
One theme (`default`, dark). Widths 390×844 and 1440×900. Sample data only: a tier named
Molten Core with 10 bosses and trash, a file of 112 item ids (3 that Wowhead can't find), a
table before loading with 4 bosses and 15 items (2 of them protected), giving 101 items to
add, 9 new bosses, 5 removals and 1 removed boss in replace mode, and one maximum-length item
name. Item names are invented; icons and quality colours are reused from the host capture,
so they don't match the names. Sample officer names Ledgerline and Redtape.

| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| table-empty | first load, table empty | "No bosses yet." as today; "Load table" button; no "Last loaded" line until the first load | opens the flow |
| table | page as today | "Load table" button in the toolbar; under it "Last loaded from molten-core.json by Ledgerline · Oct 6, 8:14 PM PDT · merge" and a "Load history" toggle | opens the flow |
| history | history open | "Load history" toggle becomes "Hide load history"; up to 10 loads, newest first, columns Source, Officer, When, Mode, Changes ("+96 −12") | toggle closes |
| source-empty | step 1, File, nothing chosen | heading "Load table" under the tier name; radio File / AtlasLoot; "Loot list file (.json)" with "Choose file" and "No file chosen"; hint "A list of bosses, each with its item ids, in kill order."; checkbox "Replace: remove bosses and items the source doesn't have" with "Items with reserves or awards are always kept, with their boss." off; foot "Nothing is written until you confirm." Cancel / Preview | Preview disabled until a file is chosen |
| source | file chosen | as above with "molten-core.json" | Preview fetches |
| source-atlas | AtlasLoot chosen | "Raid" dropdown of AtlasLoot's raids, the one matching this tier selected; hint "From the AtlasLoot version this site uses." | Preview |
| source-atlas-off | live site, AtlasLoot is Classic | AtlasLoot greyed; "AtlasLoot has Classic items only. The live site takes WoW Forever items." | File only |
| file-invalid | malformed file | the parser's plain reason, e.g. "This file isn't a loot list: “Ragnaros” needs “items”: a list of item ids." | Preview disabled until another file is chosen |
| atlas-missing | raid not in the data (e.g. the version setting changed) | "AtlasLoot's data on this site has no Molten Core. Choose another raid or load a file." | Preview disabled until the raid or source changes |
| fetching | Wowhead batches | "Fetching items from Wowhead: 60 of 112"; bar; "About a minute left. Wowhead limits how fast we may ask. Keep this window open." (B: "page"); foot "Reading molten-core.json. Nothing is written until you confirm."; Stop | runs every batch by itself (Robert, #2) |
| stopped | Stop pressed | back to step 1 with "Stopped. Nothing was loaded. Items fetched so far are saved, so the next try is quicker." | Preview again |
| preview | merge, typical | summary "Adds 101 items: 9 new bosses and 2 bosses already on the table. Nothing is removed."; then "Wowhead couldn't find 3 items" / "They won't be loaded. Check the ids in the file, or try again if Wowhead was busy." with the ids by boss and "Try again"; then "Adds" by boss in kill order, each with "New boss"/"Trash" tags and "5 new · 4 already on the table · 3 not found", listing new items with icons and ids; foot "From molten-core.json · merge"; Back / "Load 101 items" | confirm writes |
| preview-replace | replace on | summary adds "Removes 5 items and 1 boss. Keeps 2 items with reserves or awards."; a "Removes" list above "Adds", by boss: removed items struck through, protected ones tagged "Kept: has awards" or "Kept: has reserves", bosses tagged "Boss removed" or "Boss kept: has reserves or awards"; red "Load and remove 5 items" | confirm writes |
| preview-nothing | same file again | "Nothing to change. The table already matches this file." no confirm | Close |
| preview-stale | table changed meanwhile | "The table changed since this preview." / "Preview again to see the current changes." above the old preview; confirm replaced | Cancel / Preview again |
| apply-failed | confirm failed | preview stays; toast "Couldn't save that — try again." with Retry | Retry |
| loaded | success | flow closes; toast "Loaded molten-core.json: added 101 items." (after replace: "…added 101 items, removed 5."); table shows the new items; "Last loaded" updated | — |

Not applicable: no permission (non-officers get 404, unchanged); page loading (existing
skeleton, unchanged; the Preview and Load buttons use the existing button loading state);
locked (tables aren't locked); other themes (dark only). Keyboard: every control is a real
button, radio, checkbox or select; the window traps focus and Escape closes it, returning
focus to "Load table" (A); the panel moves focus to its heading on open and back to the
button on close (B). The progress bar is a `progressbar` with its count as text. Status is
never colour alone. Times show the viewer's zone with guild time on hover/focus.

## Host snapshot and offline proof
- Source commit `666a157` (origin/main), worktree `docs/203-design-load-loot-table`. Skill:
  `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor, Editable offline page snapshot, Cleanup).
- Launch: `npx tsx .pi/skills/verify-guild/run.ts launch $EVIDENCE` → Doctor PASS
  (`/tmp/verify-guild-uZ0DbL/launch.txt`). Sample loot: `features/loot-data.md` Onyxia import,
  26 items, 0 failed (`import.txt`).
- Host page: role `officer` (sample Ledgerline) via `/dev/session?as=officer&back=/officers/loot`,
  clicked "Onyxia's Lair" → `/officers/loot/<generated id>`. Live captures `live-1440.png`, `live-390.png`.
- Exported with single-file-cli 2.16.4 per the skill; no scripts in the export. Generated ids
  replaced with `sample-tier`/`sample-boss`, localhost and Discord links made inert (`#`), Open
  Graph tags removed. Cleanup PASS (`cleanup.txt`).
- Offline: fresh browser session, network Offline; `offline-390.png` (390×3716) and
  `offline-1440.png` (1440×1362) match the live captures (fonts, brand images, item icons); the
  network log shows only `file:` and `data:` requests.
- `index.html` (version A) is the host plus one inline style block and one inline script. The script renames
  the tier to Molten Core, replaces the table with the sample data above (same row markup and
  classes as the page; the add item form is summarised as one line), and adds the toolbar
  button, "Last loaded" line, the flow and the prototype bar. While version A's window is open
  the page behind is held to one screen so full-page captures show what an officer sees.


## Confirmed decisions
(Robert, this tab, 2026-10-07)
1. Versions vary on where the flow lives: A window, B panel. Robert leans A; build both.
2. Fetching runs every batch by itself, with a progress bar and Stop; failures listed with "Try again".
3. Audit: one "Last loaded" line by the button plus a "Load history" toggle (last 10).
4. AtlasLoot raid is a dropdown, preselected to this tier; on the live site AtlasLoot is greyed with its reason ("Whatever": recommendation accepted).
5. Replace is a checkbox, off by default; "Removes" list, "Kept: has reserves or awards" tags, red confirm with the count.
6. Preview grouped by boss with counts and new items; not-found items at the top; "Nothing to change" on a repeat load.
7. New element approved for the design: the teal fetch progress bar with its count ("Sure").
8. Brief confirmed ("Confirmed").

## Approval
Robert chose version A and dropped B (decisions.md); "Approved." 2026-10-07.

## Real-site experiment
None.

## Open decisions
None.
