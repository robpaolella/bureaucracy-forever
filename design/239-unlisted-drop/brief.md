# Design: record an unlisted drop from the loot log

- Design issue: #239
- Revision: 1
- Replaces: none
- Source plan: #89 (loot plan, Robert's decision #22); covered build issue below

## Job and audience
Officers recording loot mid-raid on the raid page's **Loot log** (officers only; members and
the public never see it). WoW Forever's loot tables aren't published, so an item can drop that
isn't on the tier's table yet. Today that means leaving the raid page for
`/officers/loot/[templateId]`. The job: paste the item's Wowhead Forever link (or id), confirm
it's the right item, and record who got it in one step, without leaving the page. Rare in
practice (Robert: "I don't think it's going to be used all that often").

Product facts: #98 (one all-or-nothing action: fetch from Wowhead Forever, add to the chosen
boss's table, record the award; boss must belong to this raid's tier; Forever items only in
production, per #93; retry after a timeout never records twice, using a request key; two copies
of the same item stay possible; an item already on the table is just recorded; the award then
behaves like any other).

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #98 | Entry point in the loot log; link/id box with automatic Wowhead lookup; boss choice; found / already on the table / errors; the one-step "Add and record"; saving, failure and success; tier with no bosses | Bulk table loading (#203's design); the request-key migration itself (not visible) |

## Boundaries and visual authority
DESIGN.md and the live site govern the look. Reuse the loot log's existing form (`Field`,
selects, `Input`, `Button` primary/secondary/ghost and loading state, `Choice` cards for "Who
rolls", `ItemName`, toasts), `Modal` (plain, 480px) for version B, and `TextLink` styling for
B's link. No new kind of element. Unchanged: the rest of the raid page, the Recorded list rows,
the Void window, the normal record path.

## The one decision the versions vary
Where the unlisted path lives (Robert, #1):
- **A — inside the form:** the Item dropdown ends with a group "Not on the list?" holding
  "Item not on the table…". Choosing it adds the link box under Boss/Item; the rest of the
  form is the normal one. An item already on the table switches the Item dropdown to it.
- **B — its own window:** an "Item not on the table?" link under the Item dropdown opens
  "Record an item not on the table" with the link box, Boss, and the award fields.
Everything else (wording, lookup, errors, saving, toasts) is the same in both.

## States, themes and content
One theme (`default`, dark). Widths 390×844 and 1440×900. Sample data only: raid Onyxia's
Lair (seeded), tier bosses Onyxia and Trash, the table's 26 items from the local Onyxia import,
one earlier award (Deathbringer to ballot). New item (invented): "Whelp-Scale Bracers of the
Brood Mother", #231044, Epic, link
`https://www.wowhead.com/forever/item=231044/whelp-scale-bracers-of-the-brood-mother`.
On-table item: Eskhandar's Collar #18205, hard reserved by notary. All icons reuse the one
captured icon, so they don't match names.

| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| log | loot log as today | Boss / Item; A: Item's last group "Not on the list?" → "Item not on the table…"; B: link "Item not on the table?" under Item | opens the path |
| entry | path open, box empty | label "Wowhead Forever link or item id"; placeholder "wowhead.com/forever/item=…"; hint "Paste the item’s link from wowhead.com/forever, or just its number."; B also shows Boss (defaults to the log's boss) | lookup runs by itself once the box holds a valid link or id |
| looking-up | waiting for Wowhead | spinner + "Looking up on Wowhead…" | — |
| found | new to the table | icon, name in quality colour, "#231044"; "New to the table. Recording adds it to **Onyxia**’s list." (follows the boss); "Nobody reserved it: open roll."; Winner, Roll, Method, Note | "Disenchant / bank" or primary **"Add and record"** (disabled until a winner) |
| on-table | link is for an item already on the table | A: Item dropdown switches to it, note "Eskhandar’s Collar is already on the table (Onyxia), so it’s recorded the usual way."; B: note "Already on the table (Onyxia). Recording it the usual way." Then the normal reserve check: "Hard reserved: only these members roll.", Who rolls card | primary "Record" |
| not-forever | Classic or other link, or text | "That isn’t a WoW Forever item link. Use a link from wowhead.com/forever, or the item’s number." (red box) | — |
| not-found | Wowhead Forever has no such id | "Wowhead Forever has no item 999999. Check the link." | — |
| wowhead-down | Wowhead didn't answer | "Couldn’t reach Wowhead." + "Try again" button | retries the lookup |
| saving | after Add and record | button spinner, controls disabled | — |
| save-failed | save failed or timed out | form kept; toast "Nothing was saved." / "Press Add and record again. It won’t be recorded twice." | press again safely (request key) |
| recorded | success | form resets (A: Item "Pick an item"; B: window closes); new row on top of Recorded; toast "Added Whelp-Scale Bracers of the Brood Mother to Onyxia’s table and recorded it to notary (Notary)." (DE/bank: "Added X to Onyxia’s table. Disenchanted or banked.") | — |
| no-bosses | tier's table has no bosses | "No bosses on this tier’s loot table yet, so there’s nothing to record against. Add a boss first." + link "Open the Onyxia’s Lair loot table"; Recorded shows "Nothing recorded yet." | link to the tier's table page |

Not applicable: no permission (members/public don't get the loot log; unchanged); locked
(awards aren't locked); cancelled raid (log hidden, unchanged); other themes (dark only);
boss mismatch (the Boss choice lists only this tier's bosses, so the server's refusal of a
boss from another tier, tested in #98, has no screen of its own).
Keyboard: real selects, inputs and buttons; A moves focus to the link box when "Item not on the
table…" is chosen; B is a native modal (focus inside, Escape closes, focus returns to the link);
lookup results and errors are announced (`role="status"`, error tied with `aria-describedby`).
Status is never colour alone.

## Host snapshot and offline proof
- Source commit `origin/main` at 2026-10-12 (`Loot table loading: … (#227)`), branch
  `docs/239-design-unlisted-drop`, folder `/git/bureaucracy-forever`. Skill:
  `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor, Editable offline page snapshot, Cleanup).
  Evidence `/tmp/verify-guild-ebSI2j` (`launch.txt` Doctor PASS, `import.txt`, `cleanup.txt` Cleanup PASS).
- Sample loot: `features/loot-data.md` Onyxia import (26 items, 0 failed).
- Route: `/dev/session?as=officer&back=/members/calendar`, clicked the first "Onyxia's Lair"
  raid → `/members/calendar/<generated id>`. One award recorded through the real loot log
  (Deathbringer, ballot, roll 87) so the Recorded list has a row. Live captures `live-1440.png`,
  `live-390.png`.
- Exported with single-file-cli 2.16.4 per the skill; no scripts. Generated ids replaced with
  `sample-N`, localhost and Discord links made `#`, Open Graph/Twitter tags removed,
  `loading="lazy"` dropped so the item icon loads in full-page captures.
- Offline: fresh browser, network Offline: 5/5 images, 6 fonts, only `file:` and `data:`
  requests; `offline-390.png` (390×6151) and `offline-1440.png` (1440×4099) match the live captures.
- Host parts used (`host.html`): `section[aria-labelledby="loot-log-heading"]` (its `form` is
  replaced by the prototype's; its second `select` supplies the table's items; the first
  `ul li` of Recorded is the row template and its `img` the icon).
- Versions were the host plus one `<style>` and one `<script>`, generated outside the repo.
  At freeze, A became `index.html`; `host.html` and `versions/` were removed (the host is
  the same page with no prototype style or script). All-version captures are in
  `screenshots/all/`.

## Confirmed decisions
(Robert, this tab, 2026-10-12; recorded on #239 "Robert's answers")
1. Build both A (inside the form) and B (window); lean A. "Agreed."
2. Look the item up before recording; an item already on the table switches to the normal
   reserve path; saving is one all-or-nothing step. "Agreed."
3. Boss defaults to the log's chosen boss, changeable; this tier's bosses only, Trash included. "Yes."
4–6. Wording, after-record behaviour, failure and edge cases as recommended: "why don't you
   just go with all your own personal recommendations? … Give me something to react to, and
   then I'll give you my feedback afterwards". Primary button "Add and record" (my
   recommendation within that delegation).

## Real-site experiment
None.

## Open decisions
1. Version A or B (Robert, after trying them).
