# Design: officer item reserve controls

- Design issue: #131
- Revision: 1
- Replaces: none
- Source plan: #89 (loot plan); covered build issues below

## Job and audience
Officers editing a raid tier's loot table at `/officers/loot/[templateId]`. Some items must
stay on the table but not be reservable (Robert, #89), and some can usefully be won more
than once (Robert, #118 pin 8). The job: open one item's reserve settings, block or unblock
it, or set how many times one character may win it through HR/SR (1 to 5, default 1).
Blocking removes reserves on raids that haven't locked yet, so the officer first sees who
loses one. Success: an officer changes an item's setting in a few clicks, knows exactly whose
reserves go, and sees on the table which items differ from the default.

Product facts: #97 (PR #130) stores `blocked` per item per raid tier and refuses new reserves;
#123 and #122 bodies; `reservesLocked()` (lock 2 hours before start); `lib/loot-blocks.ts`.

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #123 | "Reserves" row button and window; "Open to reserves" switch; block confirmation naming holders on unlocked raids (cancelled unlocked included); stale-list rejection; unblocking; "Not open to reserves" tag | Stored setting and rule (#97); member picker greyed item (#124) |
| #122 | Win limit − n + control (1 to 5) in the same window; raising and lowering save directly (Robert, pin 1); "Win limit n" tag | Rule changes in the picker and drop resolution (build work, not visible here); "Previously won" in the picker |

## Boundaries and visual authority
DESIGN.md and the live site govern the look. Reuse `Modal` (native dialog, card radius),
`Toggle` (switch), `Button` (secondary sm, danger), `Tag` (neutral chip), `ItemName`, toasts.
New kind of element for approval: the − n + stepper (no existing component). Unchanged:
boss headers and their controls, add boss/item forms, refresh and remove buttons, page header.

## States, themes and content
One theme (`default`, dark). Widths 390×844 and 1440×900. Sample data only: a Molten Core-
style tier (typical ~10 bosses, items per boss 8–15), one item on two bosses (shared), long
item names, up to ~15 holders across raids including a cancelled one.

| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| table-default | nothing changed | table as today plus a "Reserves" button on each row | opens window |
| table-changed | some items changed | one grey tag after a name: "Not open to reserves" or "Win limit 3"; shared item tagged on both bosses; a long blocked name with a raised limit (Ancient Cornerstone Grimoire) shows one tag and truncates on one line | — |
| settings | window for a normal item | title "Reserves: [item]"; switch "Open to reserves"; win limit − 1 + with hint "How many times one character can win this through a hard or soft reserve."; "Done" | − disabled at 1 |
| settings-shared | item on two bosses | adds "Also drops from [boss]. This setting applies there too." | — |
| settings-blocked | item blocked | switch off; limit greyed with "Blocked items can't be reserved, whatever the limit." | switch on unblocks; toast "[item] is open to reserves again. Removed reserves aren't restored." |
| limit-max | limit at 5 | + disabled; hint "5 is the most." | — |
| block-confirm | switch off, 2–3 holders | "Block [item]?" holders grouped by raid (raid name, date in guild time, "Cancelled" tag), each character + HR/SR; "Reserves on locked and past raids stay. They won't be told. Let them know in Discord." Cancel / "Block and remove N reserves" (danger) | confirm → toast "Blocked [item]. Removed N reserves." |
| block-confirm-many | ~15 holders across 4 raids | list scrolls inside the window; title and buttons stay | as above |
| block-stale | list changed meanwhile | notice "The list changed since you opened this. Check it and confirm again." with refreshed names | confirm again |
| blocked-direct | blocked an item nobody held | window shows the switch off; toast "Blocked [item]."; tag on the table behind | — |
| limit-lowered | lowered a limit from 3 to 2 | window shows 2; toast "Win limit 2. Existing reserves stay." | — |
| unblocked | switched a blocked item back on | window shows the switch on; toast "[item] is open to reserves again. Removed reserves aren't restored."; tag gone | — |
| save-failed | save errored | error toast (site's "Couldn't save" copy); setting shows its previous value | retry |

Blocking an item nobody holds and lowering a limit save straight away (blocked-direct,
limit-lowered). Not applicable: loading (page loading skeleton unchanged; controls use the
existing button loading state); empty table (no items, no button, unchanged); no permission
(non-officers get 404, unchanged); locked (settings apply per tier, not per raid).
Keyboard: the button opens the native dialog with focus inside; Escape closes the innermost
step; focus returns to the row's button. Status never by colour alone.

## Host snapshot and offline proof
- Source commit `bc69675` (origin/main), worktree `docs/131-design-loot-item-reserves`. Skill:
  `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor, Editable offline page snapshot, Cleanup).
- Launch: `npx tsx .pi/skills/verify-guild/run.ts launch $EVIDENCE` → Doctor PASS
  (`/tmp/verify-guild-5ThBfq/launch.txt`). Sample loot: `features/loot-data.md` Onyxia import,
  26 items, 0 failed (`import.txt`).
- Host page: role `officer` (sample Ledgerline) via `/dev/session?as=officer&back=/officers/loot`,
  clicked "Onyxia's Lair" → `/officers/loot/<generated id>`. Live captures `live-1440.png`, `live-390.png`.
- Exported with single-file-cli 2.16.4 per the skill; no scripts in the export. Generated ids
  replaced with `sample-id`, localhost links made inert (`#`). Cleanup PASS (`cleanup.txt`).
- Offline: fresh browser session, network Offline, `offline-390.png` and `offline-1440.png` match the
  live captures (fonts, brand images, item icons); network log shows only `file:` and `data:` requests.
- The version is the host plus one inline style block and one inline script (`versions/b.html`).
  The script adds a sample second boss ("Nefarian", holding two of the Onyxia items) to show shared items,
  the "Reserves" buttons, tags, the window and the prototype bar. Holder names are sample guild names.
- Version offline proof (network Offline): opened the window, blocked Netherwind Crown through the
  confirmation (toast and tag appeared), Escape closed and focus returned to the row's button; after
  pin 1, "+" raised a limit straight away ("Win limit 2." toast and tag), "−" lowered it; at 1024 and
  1280 and 1440 no row wraps; no non-file/data requests.

## Confirmed decisions
(Robert, design-loot-blocks tab, 2026-10-05)
1. One design only, version B: a "Reserves" button per row opening a window. Settings are per
   item per tier: a change on one row applies to every boss row showing that item.
2. Controls save immediately with a toast; raising above 1 asks first; lowering saves directly.
   **Changed by Roberts Open Design pin 1 (cmt_0034fb33): raising does not ask either; "+" saves with "Win limit N."**
3. Block confirmation lists holders by raid with guild time and "Cancelled" tags, scrolls up to
   ~15, closes with the Discord line; no holders → blocks directly; stale list reloads.
4. Grey tag after the name only when not default: "Not open to reserves", "Win limit 3".
5. Window contents as in the states table; confirmations replace the window's contents.
6. Small "Reserves" text button beside refresh/remove; phone rows wrap to a second line.
7. Wording in the states table approved, including "Let one character win [item] up to 2 times?",
   "Block and remove N reserves", the toasts and "5 is the most."
8. New element approved for the design: the − n + stepper (not a 1–5 select).
9. Brief confirmed; proceed (Robert, 2026-10-05: "7-9. All approved as you wrote.").

## Layout and wording added while building
Approved as recommended (decisions 10–14, Robert, 2026-10-05: "just do it").
- Item columns: two from 1280px wide (instead of today's three at 1280+), one from 768 to 1279px
  (instead of two), so names aren't cut short beside the new button; phones as decision 6.
  Tags sit after the name on desktop and on their own line on phones. On desktop the row never wraps
  (Robert, pin 2, cmt_a536bc04): an item has at most one tag, shown whole, and the item name truncates
  with an ellipsis to make room. A blocked item shows only "Not open to reserves" (its win limit
  doesn't apply while blocked and shows again once unblocked). The full name stays in the window.
- Confirmation lead-in: "Blocking removes these reserves on raids that haven't locked yet:".
- (Withdrawn by pin 1: the raise confirmation and its body text are gone.)
- Toast after a raise: "Win limit N." Toasts show above the window while it is open.
- On phones, window buttons stack full width, main action on top.

## Real-site experiment
None.

## Open decisions
None.
