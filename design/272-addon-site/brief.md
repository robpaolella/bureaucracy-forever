# Design: the site's pieces for the loot add-on and helper

- Design issue: #272
- Revision: 1
- Replaces: none
- Source plan: robpaolella/bureaucracy-forever-addon#3 (plan v3, https://github.com/robpaolella/bureaucracy-forever-addon/issues/3#issuecomment-6153154989, with the round-3 fixes, https://github.com/robpaolella/bureaucracy-forever-addon/issues/3#issuecomment-6153220512)
- Base: `package/addon-3-loot-addon`

## Job and audience
Officers only. Members, socials and the public never see any of it. Officers run loot in
game with the guild's own add-on; the site's loot log stays the single record. The site's
side has three jobs:
- **Before a raid:** copy the raid's reserves to paste into the add-on (Copy reserves).
- **After a raid** (or whenever the helper isn't used): paste the add-on's copy-out text
  into the site and see exactly what happened to each award (Import awards).
- **Once per computer:** get the add-on, and a key for the desktop helper that delivers
  reserves and awards automatically (In-game addon page).
The loot log shows which awards came from the add-on, who handed them out, how they
arrived, and which the game didn't confirm, so the officer watching the log can fix
mistakes there (void and re-record).

Product facts: plan v3 and Robert's decisions on addon#3; build issues #274, #275, #276,
#280. Formats (snapshot text, copy-out text, result categories) come from the spec,
#271, which has no text yet: the prototype's pasted/copied text and the import category
names are **placeholders** the spec fills in (marked as such in the prototype).

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #274 | Copy reserves on the raid page: button, status line, copied / blocked-clipboard / no-reserves / no-table states | The snapshot format (#271); the helper API that reuses it (#277) |
| #275 | Import awards on the raid page: paste box, importing, results (recorded, already there, voided, refused with reason, not on the site), unreadable / nothing new / failed; loot log marks (from the add-on, handed out by, sent by / imported by, not confirmed, practice) | Helper's automatic upload (#277); the members' loot list (unchanged) |
| #276 | Helper keys on the In-game addon page: create, shown once, list with created / last used, revoke with confirmation, empty | The API that checks keys (#277) |
| #280 | Get the add-on on the In-game addon page: release, no release, GitHub unreachable; install guide link; the In-game addon menu entry | Publishing releases (addon#18) |
| #293 | The in-game instance number in the template's Edit/New window on Raids and series (`/officers/raids`): field, hint, error, and the templates list | The schema and migration; the snapshot and raids list carrying it (#274, #277); the add-on's matching |
| Follow-up (not yet filed) | Get the helper on the In-game addon page: Mac and Windows downloads, no release yet | The helper's own releases and window (bureaucracy-forever-helper) |

## Boundaries and visual authority
DESIGN.md and the live site govern the look; PRODUCT.md the facts and voice. Reuse:
the raid page's Loot log section and its Recorded rows (`LootLog`, `AwardRow`), `Button`
(primary, secondary, ghost, danger, loading), `Field`/`Input`/textarea, `Modal`,
`StatusPill`, `Tag`, `TextLink`, toasts, the teal info panel and red error box already used
by the unlisted-drop path, the officer page head (eyebrow, title, lede) used by Loot tables
and Raid management, and `LocalTime` for every time. New kinds of element Robert is asked
to approve through this design: the one-time key reveal box with Copy; the import results
summary (counts with words). Unchanged: the rest of the raid page, the Loot log's record
form, the Void window, the members' loot list, every other officer page.

## The decision the versions vary
Where Copy reserves and Import awards live on the raid page (decision 2):
- **A, bar in the Loot log:** a "Loot add-on" bar at the top of the Loot log section with
  Copy reserves and Import awards; Import opens a window with the paste box, then results
  in the same window.
- **B, its own card:** a "Loot add-on" card just above the Loot log, Copy reserves with its
  status line, and the paste box always open in the card; results show inline under it.
Everything else (wording, marks, the In-game addon page) is the same in both.

## States, themes and content
One theme (`default`, dark). Widths 390×844 and 1440×900. Sample data only: raid Onyxia's
Lair (seeded, local Classic Onyxia import as the table), invented "First Last" character
names and seeded users Ledgerline (officer) and Redtape (member). Content range: a 40-person
raid; up to about 60 awards in one copy-out; Recorded list of 0 to 30 rows; 0 to 5 keys per
officer; key names up to 40 characters.

Raid page (`/members/calendar/<raid>`, officer):
| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| log-marks | Loot log with mixed awards | rows: by hand ("by Ledgerline"); from the add-on, sent by helper ("From the add-on" tag, "Handed out by Notary Public · sent by Ledgerline's helper"); imported ("Handed out by Notary Public · imported by Ledgerline"); "Not confirmed" (amber word + "The game didn't confirm the hand-out. Check in game and void it if it wasn't handed out."); a voided add-on award | Void on each live row |
| copy-ready | before copying | Copy reserves; "Includes 23 reserves and 4 awards so far." | Copy reserves |
| copied | copy worked | "Copied. In game, open the add-on's Sync tab and paste it." (status, announced) | — |
| copy-blocked | clipboard refused | text box with the snapshot text selected; "Couldn't copy automatically. Select all of this and copy it." | select/copy by hand |
| no-reserves | nobody reserved | "Nobody has reserved yet. Every drop will be an open roll until you copy again." | Copy reserves still works |
| no-table | tier has no loot table | no add-on controls; the existing "No bosses on this tier's loot table yet…" message | link to the tier's table |
| import-empty | paste box open, empty | label "Add-on copy-out text"; hint "In game, open the Sync tab, press Copy out, and paste all of it here." | Import (disabled while empty) |
| importing | waiting | button spinner "Importing…", box disabled | — |
| import-results | mixed outcome | "Imported 14 awards from the add-on." Recorded 8 · Already there 2 (nothing was doubled) · Voided 1 · Refused 1 · Not on the site 2; refused rows with reason; not-on-site rows "item · character name" + "Record these by hand in the loot log." New rows appear in Recorded. | Done / import more |
| import-nothing-new | repeat paste | "Nothing new. All 14 awards were already in the loot log." | — |
| import-unreadable | not copy-out text | the field-error pattern (red border and text under the box): "That isn't the add-on's copy-out text. In game, open the Sync tab, press Copy out, and paste all of it." | fix and import again |
| import-failed | server/network failure | stop toast "Nothing was imported." / "Press Import again. Nothing will be recorded twice."; the window (A) or box (B) stays open with the text kept | Import again |

In-game addon page (`/officers/addon`, officer; menu entry "In-game addon"):
| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| addon-page | release and 3 keys | "Version 1.2.0 · released Nov 3, 2026", Download the add-on (zip), Install and update guide; helper line; Get the helper: "Version 0.3.0 · released Nov 8, 2026", Download for Mac, Download for Windows; keys "Rob's PC" (last used today), "Rob's MacBook" (Never used), a 40-character name | Create key, Revoke |
| addon-no-release | no release yet (add-on and helper) | "No release yet. It will appear here once the first version is published." in each part | guide link stays |
| addon-github-down | GitHub unreachable | last version seen + "Couldn't check for a newer version just now."; none seen: "Couldn't check for the latest version just now." + "See all releases on GitHub" (shown for the helper) | — |
| keys-empty | no keys | "No helper keys yet. Create one for each computer you raid on." | Create key |
| key-created | just created | key in a highlighted box, Copy, "Copy this key into the helper now. You won't be able to see it again." | Copy, Done |
| key-revoke | revoke confirmation | "Revoke Rob's PC? The helper on that computer stops working until you give it a new key." | Cancel / Revoke key |
| key-error | name missing or save failed | "Give the key a name." / toast "Nothing was saved. Try again." | — |

Raids and series (`/officers/raids`, officer; #293, added 2026-10-13 after Robert's answer B on #289):
| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| template-edit | Edit template, number set | "In-game instance number" field after Size and Length, value 249; hint "Optional. The add-on shows this number when you're inside the raid; Onyxia's Lair is 249."; list rows end "· Instance 249" or "· No instance number" | Save template / Cancel |
| template-blank | a custom raid with none set | field empty, same hint (blank means not set) | Save template |
| template-error | not a positive whole number ("24.9") | the field-error pattern (`Field`'s error: red border and wash, message in place of the hint): "The instance number is a whole number above 0, or leave it blank." Nothing saved | fix and save |

Not applicable: no permission (members and socials get the existing 404 on officer pages and
never get the Loot log; unchanged); locked (copying and importing work before, during and
after a raid); cancelled raid (Loot log and add-on controls hidden, as today); page loading
(the officer area's existing loading skeleton; button-level loading shown in importing);
other themes (dark only). Keyboard: real buttons, labelled textarea and inputs; results and
copy messages announced (`role="status"`); version A's import window and the revoke window are
native modals (focus inside, Escape closes, focus returns); the key box is selectable text
plus a Copy button. Status is never colour alone. Every time uses `LocalTime` (viewer's zone,
guild time on hover/focus). The offline versions show `LocalTime`'s own fallback before the viewer's zone is known
(the time once, labelled "guild time", no popup), as the captured host's Recorded row does; the
build uses `LocalTime` everywhere, which then shows the viewer's zone with guild time on hover/focus.

## Host snapshot and offline proof
- Source commit `d3534e4` (`origin/package/addon-3-loot-addon`, 2026-10-13), branch
  `docs/272-design-addon-site`, worktree `/git/bureaucracy-forever-worktrees/docs-272-design-addon-site`.
  Skill `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor, Editable offline page snapshot, Cleanup).
  Evidence `/tmp/verify-guild-xYw0mZ` (`launch.txt` Doctor PASS, `import.txt` Onyxia 26 items 0 failed,
  `cleanup.txt` Cleanup PASS).
- Routes: `/dev/session?as=officer&back=/members/calendar`, clicked the first "Onyxia's Lair" raid
  → `/members/calendar/<generated id>`; one award recorded through the real loot log (Netherwind
  Crown to carboncopy) so Recorded has a row. Officer shell: `/officers/loot` as officer.
  Live captures `raid-live-{390,1440}.png`, `officer-live-{390,1440}.png`.
- Export: single-file-cli 2.16.4 per the skill, with one change: the image-decode wait is capped
  at 3 s per image (a below-the-fold lazy image never decoded and hung the export). Scrubbed:
  generated ids → `sample-N`, localhost and Discord links → `#`, Open Graph/Twitter tags removed,
  `loading="lazy"` dropped. No scripts.
- Offline: fresh browser, network Offline, only `file:` and `data:` requests;
  `offline-{raid,officer}-{390,1440}.png` match the live captures.
- Host parts used: `hosts/raid.html`: `section[aria-labelledby="loot-log-heading"]` (bar/card
  placement; its `form` for no-table; first `ul li` of Recorded is the row template), the
  Officers menu links "Loot tables" (desktop menu and mobile drawer; "In-game addon" inserted
  after), `main` (replaced for the In-game addon page states), roster `h3` role groups
  (Healer, Melee DPS, Ranged DPS hidden for shorter captures; Tank kept). `hosts/officer.html`:
  reference only for the officer page head (eyebrow/title/lede classes); versions are built on
  `hosts/raid.html` alone.
- Second host `hosts/planner.html` (2026-10-13, for #293): same commit and skill; evidence `/tmp/verify-guild-zarWck`
  (`launch.txt` Doctor PASS, `cleanup.txt` Cleanup PASS). Route `/dev/session?as=officer&back=/officers/raids`,
  clicked "Edit Onyxia's Lair" so the Edit template window is open; exported at 1440 with the same
  recipe and scrub (3 generated ids → `sample-N`, localhost and Discord links → `#`, Open Graph tags
  removed). Live `planner-live-{390,1440}.png`, `planner-edit-live-{390,1440}.png`; offline
  `offline-planner-{390,1440}.png` (network Offline, only `file:`/`data:` requests) match.
  Parts used: its `main` (templates list rows and the open Edit template `dialog` and `form`), copied
  into each version as a `<template>` by `build.js`; the two hosts share the same stylesheet.
- Versions are the raid host plus one `<style>` and one `<script>`, built outside the repo by
  `/git/bureaucracy-forever-worktrees/d272-build/build.js` from `proto.css` and `proto.js`
  (`node build.js hosts/raid.html versions`, run in the design folder).
- Versions offline proof (2026-10-13): fresh browser session `d272-offline-VAO9OP`, network Offline,
  `file://` only; a and b at log-marks, import-results, addon-page, key-revoke: fonts loaded, no
  broken images, no console errors, only the local file and `data:` requests; the State switcher
  updates the URL and `data-state`. Evidence `/tmp/design-review-VAO9OP/offline/`.

## Confirmed decisions
(Robert, this tab, 2026-10-13)
1. One new officer page, named **In-game addon** (Robert renamed it from "Loot add-on"), in the Officers menu, shown only while loot is on: "Get the add-on" (version, download, install guide) and "Helper keys". "Let's call it In-game addon, but otherwise this is good."
2. Raid page placement is the versions' question: A, a bar at the top of the Loot log with Copy reserves and Import awards (import in a window); B, its own card above the Loot log with the paste box inline. Both hidden on a cancelled raid. "Yeah, I'd like to see both and I'll pick one."
3. Loot log marks: neutral "From the add-on" tag; line "Handed out by <loot master> · sent by <officer>'s helper" or "imported by <officer>"; amber "Not confirmed" with "The game didn't confirm the hand-out. Check in game and void it if it wasn't handed out."; Void is the only fix; members' loot list unchanged. "Yes."
4. Helper keys: each officer sees and manages only their own. Create: "Key name" (hint "So you can tell your computers apart, such as Rob's PC"), **Create key**; the key shown once with **Copy** and "Copy this key into the helper now. You won't be able to see it again."; list shows name, created, last used ("Never used"); Revoke confirms "Revoke Rob's PC? The helper on that computer stops working until you give it a new key."; empty "No helper keys yet. Create one for each computer you raid on." "I'm fine with this approach."
5. Import results: "Imported 14 awards from the add-on."; counts Recorded / Already there (nothing was doubled) / Voided / Refused / Not on the site, each with its word; refused listed with reason ("Practice award: only the staging site takes these.", "For another raid.", "From the other site (staging)."); not-on-site listed as item + character with "Record by hand in the loot log."; unreadable paste: "That isn't the add-on's copy-out text. In game, open the Sync tab, press Copy out, and paste all of it."; nothing new: "Nothing new. All 14 awards were already in the loot log." Final category names from the spec (#271), placeholders until then. "Yes."
6. Copy reserves: success "Copied. In game, open the add-on's Sync tab and paste it."; clipboard blocked shows the text selected with "Couldn't copy automatically. Select all of this and copy it."; status "Includes 23 reserves and 4 awards so far."; no reserves still copies, "Nobody has reserved yet. Every drop will be an open roll until you copy again."; no loot table: no button, existing no-bosses message. "Yes."
7. "Get the add-on": release "Version 1.2.0 · released Nov 3, 2026", **Download the add-on (zip)**, "Install and update guide" link (the add-on repo's guide, addon#25); no release "No release yet. It will appear here once the first version is published."; GitHub unreachable shows the last version seen plus "Couldn't check for a newer version just now.", or "See all releases on GitHub" if none was ever seen; one helper line "The desktop helper delivers reserves and awards for you. Create a key for it below." "Yes. And I'd ultimately like for the helper download link to live here as well." (see Open decisions 9)
8. Live helper status on the raid page is out of this design; noted in `backlog.md`. "Okay, let's just note it for the future. That would be a good feature to have."
9. A "Get the helper" part on the In-game addon page: Mac and Windows downloads, and "No release yet. It will appear here once the first version is published." No build issue covers it yet; a small follow-up build issue is filed once the helper has releases. "Include it."
10. A neutral **Practice** tag beside "From the add-on" for practice awards in the loot log (only staging accepts them; production never shows it), part of #275. "Sure."
11. Brief confirmed with 9 and 10 as recommended. "Yes."

12. Raid page placement: **version A**, a bar in the Loot log with the import in a window. "Yeah, I'm fine with A. It's cleaner." (2026-10-14)
13. Instance number wording: label "In-game instance number", hint "Optional. The add-on shows this number when you're inside the raid; Onyxia's Lair is 249." "Sure."
14. Validation: optional; blank means not set; anything but a whole number above 0 is refused with the field-error pattern (red field, message under it), "The instance number is a whole number above 0, or leave it blank." "Sure."
15. Templates list shows "· Instance 249" when set and "· No instance number" when not, so a template the add-on can't match stands out. "Sure."

## Real-site experiment
None.

## Open decisions
None.
