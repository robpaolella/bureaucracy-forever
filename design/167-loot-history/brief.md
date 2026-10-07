# Design: members' loot history

- Design issue: #167
- Revision: 1
- Replaces: none
- Source plan: #89 (loot plan); covered build issues below

## Job and audience
Guild members (not socials, not logged-out visitors) who want to know who got what. During a
raid they glance at the raid page to see drops as officers record them; afterwards they check
what a raid gave out, or what one character has won across raids. Today only officers see loot,
in the officer loot log. Success: a member opens the raid page and reads the night's loot at a
glance, follows a character's name to that character's history, and filters the history page
by character or raid.

Product facts: #99 and #100 bodies; `loadAwards()` and the officer loot log (`LootLog`, `AwardRow`);
methods from `METHOD_LABEL` (Hard reserve, Soft reserve, Open roll, Disenchant / bank, and the
legacy Main spec / Off spec); `LOOT_ENABLED`; PRODUCT.md (members' area, guild time labels,
status never colour alone, 44px targets, item-quality colours as text only).

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #99 | Set 1: the members' read-only "Loot" section on the raid page, its header jump link, award rows, empty and during-raid states | Officer loot log (unchanged); the member-safe loader's field filtering (build) |
| #100 | Set 2: the "Loot history" members page, its nav item, filters, character links from the raid page, deleted characters, empty and no-results states | Alt characters; per-character profile pages |

## Boundaries and visual authority
DESIGN.md and the live site govern the look. Reuse the raid page's card section (`rounded-card
border-line bg-ink-850`, Newsreader 2xl heading, as "Loot reserves"), `ItemName` (icon, quality
colour, click/tap tooltip), class-coloured character names, the header text link pattern
("Loot reserves"), `TextLink`, `Field` selects. Unchanged: roster, summary, bench, the "Loot
reserves" section and its "Who reserved what" fold, the officer loot log and its form.

## Set 1: raid page "Loot" list (#99)
Decision varied: how awards are listed. **a** one flat list in recorded order; **b** the same
awards grouped under each boss heading, bosses in kill order. Everything else is identical.
Chosen: **a** (decision 15, superseding 8). The lede reads "In the order officers record it."

Fixed in both:
- Members see a "Loot" section directly below "Loot reserves"; the raid header gets a "Loot"
  jump link beside "Loot reserves" (Robert, decision 3).
- The section and its link appear only once the raid has started (decision 5).
- Officers don't see it; they keep the officer loot log unchanged (decision 2).
- Each award: item (icon, quality colour, tooltip), character in class colour linking to their
  loot history, method, roll when there is one, boss. Disenchant / bank shows that label and no
  character. A deleted character shows the name recorded with the award, without a link.
- Cancelled raids show nothing new (no section).

| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| recorded | after the raid | 16 awards over 10 bosses plus trash: HR, SR, open roll, a disenchant / bank row, a deleted character, long names (Bindings of the Windseeker) | item opens tooltip; character goes to their history (inert in set 1) |
| empty | raid started, nothing recorded yet | "Nothing recorded yet." | — |
| live | during the raid, 6 awards so far | "Updates every 30 seconds during the raid." plus, when an update fails, "Loot couldn't update. Trying again." (status, warn colour plus words) | the list grows without a reload |

Not applicable: loading (data arrives with the page); no permission (socials and logged-out
visitors never get the section or its data); officer view (unchanged loot log).

## Set 2: loot history page (#100)
Both set 2 versions carry set 1's chosen raid page (b) and add the history page; one file per
version covers both pages, so the approved `index.html` shows the whole flow.

Decision varied: how one character's history is laid out. **b1** grouped by raid everywhere;
**b2** grouped by raid for Everyone, but a flat table (Raid + date as a column, newest first)
once a character is picked (Robert, decision 9).

Fixed in both:
- "Loot history" in the Members menu after "Raid calendar" (desktop dropdown and phone menu);
  members and officers see it, socials and logged-out visitors don't; only while `LOOT_ENABLED`.
- Page head as the roster's: eyebrow "Members", title "Loot history", lede "Every item handed out
  in our raids, newest raid first. Pick a character to see everything they’ve won. Raid dates are in
  guild time." (critique fix 1: dates are guild dates, #100)
- The roster's filter bar: Character select ("Everyone", current characters A–Z, then a "No longer on
  the roster" group for deleted characters) and Raid select ("All raids", then each raid instance, e.g.
  Molten Core, Onyxia's Lair) (decision 10); summary "47 awards" or "6 of 47 awards"; "Clear filters" while
  a filter is on. On phones the controls sit behind "Filters" (count badge) in the site's sheet.
- Everyone: a heading per raid (raid name linking to its raid page, date, award count), newest raid
  first, then the award row from set 1 with a Boss column. With a character picked the Winner column
  is dropped (it's the picked character).
- The newest raids show first, about 50 awards' worth, whole raids at a time; "Show older raids" adds more (decision 11).
- A character name on the raid page opens this page filtered to that character.

| State slug | Situation | Content and wording | Actions / feedback |
| --- | --- | --- | --- |
| history-everyone | default view | 4 raids (Molten Core and Onyxia's Lair, Sep 30 to Oct 7), 39 awards shown of 47; "Show older raids" | filters, raid links, character links, show older |
| history-character | after clicking "Treaty" | 6 of 47 awards over 4 raids (one in an older raid); b1 grouped, b2 flat table | change or clear filters |
| history-no-results | Codicil + Molten Core | dashed box "No loot matches those filters." with "Clear filters" (the roster's pattern) | clear filters |
| history-menu | Members menu open | desktop dropdown (1440) or phone menu (390) with "Loot history" after "Raid calendar", current | pick a page |
| history-filters | Treaty + Molten Core | phone: the Filters sheet open with both selects, "Clear filters" and "Done"; desktop: the bar with both filters on, "5 of 47 awards", "Clear filters" | change, clear, done |
| history-empty | nothing recorded anywhere | the site's EmptyState: "No loot recorded yet" / "Officers record each drop during the raid, and it shows up here."; no filter bar | — |

Not applicable: loading (server-rendered with the page); no permission (socials and logged-out visitors are
denied like other member pages, as today); officer view (identical to a member's).

State slugs in `design.json` are prefixed by page: set 1's states become `raid-recorded`,
`raid-empty`, `raid-live`, `raid-live-failed`.

## Sample content
History adds an Onyxia's Lair raid type using the 26 Onyxia items (icons, tooltips) from the first
host run's officer loot table export (`/tmp/verify-guild-AEZRbI/officer-loot.html`), plus one deleted
character ("Stipulate") and six sample raids.
One theme (`default`, dark). Widths 390×844 and 1440×900. Sample data only: the captured local
raid page relabelled "Molten Core" (40-person sample roster from the local seed); Molten Core
items from AtlasLoot Classic (test material, not WoW Forever's table) with Wowhead icons and
tooltips embedded; winners are seed sample characters.

## Host snapshot and offline proof
- Source commit `2332e71` (origin/main), worktree `docs/167-design-loot-history`. Skill:
  `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor, Editable offline page snapshot, Cleanup).
- Launch: `npx tsx .pi/skills/verify-guild/run.ts launch $EVIDENCE` → Doctor PASS
  (`/tmp/verify-guild-AEZRbI/launch.txt`). Sample loot: `features/loot-data.md` Onyxia import,
  26 items, 0 failed (`import.txt`).
- Host page: role `member` (sample Redtape) via `/dev/session?as=member&back=/members/calendar`,
  clicked the first "Onyxia's Lair" (Wednesday, Oct 7, 8:00 PM guild time) →
  `/members/calendar/<generated id>`. Through the real UI: answered Accept, then in the reserves
  window picked Deathbringer (HR) and Sapphiron Drape (SR) and saved; reload confirmed.
  Live captures `live-1440.png`, `live-390.png`.
- Exported with single-file-cli 2.16.4 per the skill; no scripts in the export. Generated id
  replaced with `sample-raid`, localhost links made inert (`#`). Cleanup PASS (`cleanup.txt`).
- Offline: fresh browser session, network Offline; `offline-390.png` and `offline-1440.png` match
  the live captures (fonts, brand images, item icons); network log shows only `file:`/`data:`.
- Molten Core items: a second local run (`/tmp/verify-guild-irA6dk`) imported AtlasLoot
  MoltenCore into the local "Hyjal Summit" tier (160 items, 0 failed) to confirm the data; the
  page export timed out, so the 23 sample items' names, qualities, tooltips and 18×18 icons were
  fetched from the same Wowhead endpoints the importer and `ItemName` use, and embedded as data.
  Cleanup PASS.

- History page shell: no live page exists. It reuses the captured raid page's header and footer, and
  copies the roster page's head, filter bar, phone filter sheet, no-match box and EmptyState
  classes. Roster reference capture: role `member`, `/dev/session?as=member&back=/members/roster`,
  third local run `/tmp/verify-guild-4MM306` (Doctor PASS, `live-roster-{390,1440}.png`, export
  `roster.html`, Cleanup PASS). The brand mark for EmptyState is inlined from `public/brand/mark.png`.

## Confirmed decisions
(Robert, design-loot-history tab, 2026-10-06)
1. Two version sets, raid page first; set 2 reuses set 1's chosen award row.
2. Officers keep the loot log and don't get the members' list ("Loot log is fine").
3. Set 1 varies only list layout: a flat (Robert's instinct) vs b grouped by boss; placement fixed.
4. Set 1 states: recorded, empty, live (with the update-failed message).
5. The section and its header link appear only once the raid has started.
6. The winner shows as the character name only, in class colour (not the Discord name).
7. OpenAI available again for the critique (vendor switch back to `on`).
8. Set 1 choice first recorded as **b**, grouped by boss (Robert: "I like B."). **Superseded by 15.**
9. Set 2 varies one character's layout: b1 grouped by raid, b2 flat table; Everyone is grouped by raid
   in both (Robert: "B is actually better sounding for this, but I like your idea for varying for
   overall vs character view").
10. Raid filter = raid instance; Character = Everyone or one character; deleted characters listed last.
    No date filter for now (Robert's idea; backlogged as not worth a new control yet).
11. History states: everyone, character, no-results, empty; newest raids first with "Show older raids".
12. Robert accepted the maker's check of the menu and filter-sheet captures after the failed re-check
    ("I accept your check.").
13. Set 2 choice: **b2** (one character's history as a flat table; Everyone grouped by raid).
14. Paging by whole raids, about 50 awards' worth, with "Show older raids" ("That's fine.").
15. The raid page Loot section is one complete list, not grouped by boss (Robert: "the Loot section at the
    bottom is showing per boss where I wanted a complete list"): set 1's **a** layout (Item, Winner,
    Method · roll, Boss), in recorded order, as #99 says. Both set 2 versions were updated to it.

## Real-site experiment
None.

## Open decisions
None.
