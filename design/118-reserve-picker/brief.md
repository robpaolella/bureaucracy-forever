# Design: reserve picker

- Design issue: #118
- Revision: 1
- Replaces: none
- Source plan: #89 (loot plan); covered build issues below

## Job and audience
Guild members (and officers) signing up for a raid that has a loot table. Today they answer
Accept/Tentative at the top of the raid page or in the calendar list, then have to find a
native drop-down of ~160 item names far below the roster, with HR/SR counts written into
the names (#91 walkthrough, findings 1, 2 and 5). The job: right after saying they're coming,
pick one hard and one soft reserve quickly, seeing which boss drops each item and who else
wants it, then see and change those picks later. Success: a member finds an item by typing
part of its name, sees the competition before choosing, saves, and can change it until
reserves lock.

Product facts: PRODUCT.md (members' area; loot policy is placeholder; status never colour
alone; 44px targets; guild time labels); `lib/loot-rules.ts` (one HR and one SR on different
items; Accept/Tentative only; lock 2 hours before start, officers can override; an HR
already won is blocked). Reference for the list: softres.it search (Robert's feedback on #96).

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #96 | The searchable item chooser: type to filter, rows with icon, quality-coloured name, boss / "Trash" / "Shared", HR/SR counts in their own column, own pick and unavailable reasons outside the name; keyboard and touch | Reserver names (#109); reserve rules |
| #109 | Item details before choosing: who reserved it (HR/SR, "yours"), totals, Wowhead tooltip, "no one yet"; by tap, keyboard and screen reader | Blocking items from reserves |
| #119 | The reserves window: opens after Accept/Tentative (calendar list and raid page) and from a link; the "Loot reserves" section shows saved picks with "Change reserves" | Discord bot prompt and reminder (bot repo issues) |

## Boundaries and visual authority
DESIGN.md and the live site govern the look: ink surfaces, Sand for HR/officer emphasis,
Teal for interaction and SR, Archivo controls, Newsreader titles, item-quality colours as
text only with the quality word for screen readers. Reuse `Modal`/`Sheet` (dialog surface),
`Field`/`CONTROL` (input), `Button`, `ItemLabel`/`ItemName` (icon, name, Wowhead tooltip),
toasts. New kind of element for approval: the searchable item combobox/list (approved in
principle by the #89 plan). Unchanged: sign-up controls and their toast/Undo, roster,
"Who reserved what" list, loot log, reserve rules, saving model (Save reserves; Clear as
today, its no-undo issue is backlogged).

## States, themes and content
One theme (`default`, dark). Widths 390×844 and 1440×900. Sample data only: a Molten Core-
style table of ~160 items (min: a short Onyxia-style table), raids up to 40 people, a popular
item with ~12 reservers, long names ("Robe of the Archmage"-length and longer), an item from
two bosses ("Shared"), Trash items.

| State slug | Role / situation | Content | Actions / feedback |
| --- | --- | --- | --- |
| after-signup | member just answered Accept on the raid page | window open, no picks, full list | search, open details, choose HR and SR, Save reserves / Not now |
| from-calendar | member answered Tentative in the calendar list | same window over the calendar | as above |
| searching | member typed a partial name | filtered rows; one item's details open with max reservers (~12, HR and SR, "yours") | choose or close details |
| details-empty | member opened an item nobody reserved | "no one yet" message plus tooltip | choose |
| unavailable | member has an SR picked and an HR already won | those items visible, not choosable, reason shown | — |
| no-matches | query matches nothing | short message, None still available | clear search |
| save-failed | save errored | error toast, picks kept in the window | retry |
| shared-item | member searched "scale" | an item from two bosses shows "Shared"; details say "Drops from Onyxia and Nefarian" (sample second boss) | choose |
| officer-for | officer reserving for another member | "Reserves for" chooser in the window (codicil, addendum, ledgerline (you)) and in the section; "editing" marks that member's pick | save for them |
| section-saved | member with saved picks, before lock | section summary of HR and SR, Change reserves | opens window |
| section-none | signed up via Discord, no picks yet | prompt to pick, Pick reserves | opens window |
| locked | after lock | read-only picks, locked message; officers still see Change | — |
| officer-locked | officer after lock | locked message; "Reserves for" chooser and Change reserves still available | opens the picker for the chosen member |
| not-eligible | Absent / unanswered | "Sign up as Accept or Tentative to reserve." no button | — |
| cancelled | raid cancelled | cancelled message, read-only | — |

Not applicable: loading (data is on the page before the window opens); empty loot table and
loot switched off (the section and window don't appear at all, as today); no permission
(social members and logged-out visitors never see the raid page's loot section). A link
(#119, for the Discord bot) opens the same window as after-signup, so it has no separate state.

## Host snapshot and offline proof
- Source commit `81b4803` (origin/main), worktree `docs/118-design-reserve-picker`. Skill:
  `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor, Editable offline page snapshot, Cleanup).
- Launch: `npx tsx .pi/skills/verify-guild/run.ts launch $EVIDENCE` → Doctor PASS
  (`/tmp/verify-guild-to0GBM/launch.txt`, `doctor.txt`). Sample loot: `features/loot-data.md` Onyxia import, 26 items, 0 failed (`import.txt`).
- Host page: role `member` (sample Redtape) via `/dev/session`, `/members/calendar` → second
  "Onyxia's Lair" (Wednesday, Oct 7, 8:00 PM guild); route `/members/calendar/<generated id>`.
  Sample reserves were entered through the real form as Redtape and as officer Ledgerline on behalf of
  sample members (no scripts, no database writes); persistence confirmed by reload.
- Also captured: `/members/calendar` (member) for the calendar-list state, and the officer loot table
  page only as the source of the 26 public Wowhead icons and tooltips used in the item rows.
- Exported with single-file-cli 2.16.4 per the skill; no scripts in the export. Cleanup PASS
  (`cleanup.txt`), then a fresh browser with network Offline: all three pages render with fonts,
  brand images and item icons at 390 and 1440 (`offline-*-390.png`, `offline-*-1440.png`); network log shows
  only `file:` and embedded `data:` requests (`offline-network.txt`).
- The raid page export (`host.html` while designing; removed at approval, see decisions.md) is the host. Versions combine it with the calendar list's `<main>` (hidden
  unless the `from-calendar` state) and replace only the reserves section's inner form with prototype markup.
  Live navigation links are made inert. Only sample names from the local seed appear.
- Versions offline proof: in a fresh browser with network Offline, each version opened "Pick reserves",
  filtered "crown" to 2 of 26 items, chose Netherwind Crown as HR, closed with Escape, then saved and
  showed "Reserves saved" with the section updated; no non-local requests (`/tmp/design-review-V9PVMY/offline/`).

## Confirmed decisions
(Robert, design-96 tab, 2026-10-05)
1. Versions compare two separate HR/SR fields against a single list with Hard/Soft buttons per row.
2. Each version places item details differently (expand in the row, side panel, bottom sheet on phone); all usable without hover.
3. Saving stays as today; Clear's no-undo saving goes to the backlog.
4. The window opens from both the calendar list and the raid page; Discord sign-ups pick in the section. The bot should link to the window after a Discord sign-up and remind unreserved members ~2 hours before lock (bot repo issues, relayed to the bot session).
6. Picks are saved and shown in the section, changeable until lock via "Change reserves" (also for officers on behalf).
7. A third build issue covers the window: #119.
8. Draft wording accepted for now (window title "Pick your reserves", "Save reserves" / "Not now", "Search items", "No items match. Try another name.", "No one has reserved this yet.", "Your reserves" + "Change reserves", "You haven't picked reserves for this raid." + "Pick reserves", reasons "Your soft reserve" / "Your hard reserve" / "Already won with HR"); Robert will suggest changes after seeing the design.
9. Brief confirmed; proceed to versions (Robert, 2026-10-05).

## Real-site experiment
None.

## Open decisions
None. Decisions 13–20 from the comment rounds are recorded in decisions.md.

## Confirmed later
5. (Robert, 2026-10-05: "Agreed, this is the right behavior.") When the window appears: recommended only on Accept/Tentative, a loot table exists, before lock, no reserves yet; switching Accept↔Tentative after reserving doesn't ask again; "Save reserves" and "Not now"; sign-up Undo still works.
