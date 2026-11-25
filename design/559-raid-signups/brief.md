# Design: raid page sign-ups (roster lists, Manage sign-ups switch, character question, levels)

- Design issue: #559
- Revision: 1
- Replaces: none
- Source plan: tracking issue #556 (Robert's decisions 1–10, 17–23: https://github.com/robpaolella/bureaucracy-forever/issues/556#issuecomment-7138280087)
- Base: `package/556-raid-signups` (the design PR targets it; the conductor closes #559 after the merge)

## Job and audience
- **Members** open a raid page from the calendar to sign up and see who's coming. They answer
  Accept / Tentative / Absent on the raid page head or on a calendar list row.
- **Officers** use the same page to see who has accepted, and sometimes to set answers for
  others. Today the "Answer for them" selects on every row hide who has accepted (#556 point 1).
- Members with alts must say which character they bring; members can set a default in
  Manage characters. Characters known to be under level 60 get a confirmation.

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #561 | Roster lists only Accept/Tentative by role; collapsible No response and Absent lists; Hasn't answered card removed, Nudge moves to No response | Bench changes, Discord embed |
| #562 | Manage sign-ups switch: officers see the member view by default; switch reveals Answer for them, Answer for someone not listed, Move to roster; phone placement | Hiding other officer controls, remembering the switch |
| #563 | Character question on first Accept/Tentative (raid page and calendar list row) | Discord |
| #564 | "Sign up with" setting in Manage characters | Officers setting someone's default |
| #567 | Under-60 confirmation (combined with the character question; Bringing switch; single-character/default case) and level display | Discord heads-up, blocking sign-ups |

## Boundaries and visual authority
- `DESIGN.md` and the live site govern the look; `PRODUCT.md` the voice (no exclamation marks,
  plain functional text) and accessibility (44px targets, status never colour alone).
- Reuse: `Modal`, `Toggle` (role="switch"), `Choice` (radio/checkbox, card variant),
  `Select`/`Field`, `SegmentedControl`, `Button`, `Toast`, `Sheet`, `ClassAvatar`,
  `SourceBadge`, AltsToggle-style chevron disclosure (`components/shell/NavGroup.tsx` Chevron).
- New kinds of element Robert approves through this design: collapsible No response/Absent
  lists, the Manage sign-ups switch on the raid page, the character question window, the
  "Sign up with" setting, level text.
- Must not change: composition summary counts, bench card (except its rows with Manage
  sign-ups on, part of #562, changed at Robert's request 2026-11-24), the head's own response control
  (apart from the question), Edit/Cancel/Delete/Discord link/Nudge/attendance/loot log for officers.
- Sample data only. Character names follow WoW Forever: a first and a second name, 2–12
  letters each (e.g. "Grimbo Ash"). People are named by Discord name, character in the meta line.

## States, themes and content
Theme: `default` (dark only). Widths 390×844 and 1440×900.
Planned state slugs (every version implements each):
raid-member, raid-officer, raid-officer-manage, raid-officer-sheet (phone sheet open; desktop
has no sheet, so it matches raid-officer-manage there), raid-lists-open, raid-everyone-answered,
raid-nobody-answered, raid-locked, raid-during, raid-cancelled, raid-after, raid-max,
raid-max-manage (6 on the bench, switch on),
ask-character, ask-character-under-60, ask-calendar, ask-error, under-60-confirm,
bringing-under-60, manage-characters, manage-default-set, manage-one-character,
manage-error, roster-members, roster-officers.

Not applicable, because this design changes neither:
- **Loading.** Page loads use the existing `loading.tsx` skeletons for `/members/calendar`,
  `/members/calendar/[raidId]` and `/members/roster`. Answers save optimistically through
  `components/calendar/useSignup.ts`, which disables the control while a save is pending; the
  character question and "Sign up with" reuse that pattern. A failed save is shown by
  ask-error and manage-error.
- **No permission.** `lib/auth/gate.ts` keeps the routes as they are: logged out goes to login,
  social members and non-officers on `/officers` get a 404. Inside the page, the member view
  (raid-member) is what anyone without the officer role sees: no switch, no officer controls.
  The switch is hidden after the raid and on cancelled raids (raid-after, raid-cancelled).

## Host snapshot and offline proof
- Verification skill: `.pi/skills/verify-guild/SKILL.md`. Evidence: `/tmp/verify-guild-PTXWuA`
  (launch.txt, Doctor PASS, cleanup.txt Cleanup PASS, live and offline screenshots, offline network logs).
- Source commit: `53f0450` (origin/package/556-raid-signups). Seeded sample data only.
- Hosts (single-file exports, scripts removed, CSP meta allows inline script; removed from the
  folder at freeze, 2026-11-25, after the final offline proof of index.html):
  - `hosts/raid-member.html`: member `redtape`, `/members/calendar/<Thu Dec 3 Onyxia's Lair>`, reached by clicking the raid title in the list.
  - `hosts/raid-officer.html`: officer `ledgerline`, same raid.
  - `hosts/calendar.html`: member, `/members/calendar` list view.
  - `hosts/roster-manage.html`: member, `/members/roster` with Manage characters open (dialog serialised; shows closed offline, author it in versions).
  - `hosts/officer-roster.html`: officer, `/officers/roster`.
- Offline proof: each host opened from disk in a fresh session with network Offline; all
  requests were the file and data: URIs; 390 and 1440 captures match the live ones.
- Host parts used: head (fonts, compiled CSS) from `raid-officer.html` up to `</head>`;
  `<header class="border-b border-line-faint">` from raid-officer (officer nav) and raid-member
  (member nav); `<footer class="mt-auto …">`; raid layout from `<main>`: section head,
  `grid gap-6 md:grid-cols-[minmax(0,1fr)_380px]`, `aside[aria-labelledby=raid-summary]`,
  `section[aria-labelledby=roster-heading]` rows; calendar `<ol class="flex flex-col gap-3">` rows;
  roster `<table class="w-full border-collapse text-sm">`.

## Confirmed decisions
Robert, 2026-11-24 in the design-559 tab, accepted D1–D9 (no change asked) and answered:
1. One window when both questions apply: levels shown per character; choosing one under 60 adds
   "Grimbo Ash is level 52, not yet 60." and the button becomes "Sign up anyway". ("I agree, a single window is best.")
2. Raid page rows show a level only when known and under 60; unknown shows nothing there.
   Manage characters and both roster pages show every level, including "Level unknown". ("Agreed.")
3. Phone: the switch sits outside the officer actions sheet, beside its button; one version still
   shows it inside to compare. ("Whatever you recommend.")

Settled by the session (D1–D9, shown to Robert):
- D1 Roster rows keep today's columns; only Accept/Tentative under Tank/Healer/DPS; an empty role says so in one line.
- D2 No response and Absent: closed disclosures with counts under the groups; rows like roster rows; Absent shows reasons.
- D3 Nudge in Discord on the No response header, visible while closed; same rules (officers, open, posted).
- D4 Nobody answered: groups say "Nobody has signed up yet"; everyone under No response, still closed.
- D5 After the raid: lists stay, Attended / Did not attend as today; bench unchanged.
- D6 Switch uses the existing Toggle in the officer actions card, off on every load; on shows the three controls.
- D7 Character question in a Modal: characters with class/spec/role, main preselected and labelled "Main";
  "Use this character by default" unticked, hint "You can change this in Manage characters on the Roster page.";
  buttons Cancel and Accept (or Tentative). Same on the calendar list row.
- D8 "Sign up with" at the top of Manage characters: "Ask me each time" then each character; one character shows it with a note.
- D9 "Level unknown", no reason given.

## Offline proof of the versions
2026-11-24, `versions/a.html` and `versions/b.html` opened from disk in a fresh named browser
session (`CHROME_DEVTOOLS_AXI_SESSION=d559-offline`) with `emulate --network Offline`; the
network log lists only the file itself and `data:` fonts and images. Real clicks (accessibility
uids), at 1440 and 390:
- Manage sign-ups switch on/off: 0 → 17 answer selects and back; focus stays on the switch.
- No response and Absent disclosures: open/close, `aria-expanded` follows, focus stays on the header.
- Nudge in Discord: toast "Nudged 5 members in Discord".
- Phone: Officer actions opens the sheet (focus on Close); Escape closes it and focus returns to
  the button, also in b after the switch inside the sheet re-renders it (button then reads
  "Officer actions · Managing sign-ups").
- Member Accept (a) / Tentative (b) opens the character question; picking Grimbo Ash (radio in a,
  select in b) shows "Grimbo Ash is level 52, not yet 60." and "Sign up anyway"; confirming
  closes it, shows the toast (with the default line when ticked), moves the member out of
  No response (5 → 4) and returns focus to the answer button.
- Manage characters "Sign up with": select (a) and radios (b) each show the saved toast.
- Version c (Robert's picks), same session and Offline network: switch on/off (17 selects),
  No response disclosure, Accept → radio-card question → Grimbo Ash → "Sign up anyway" → toast and
  focus back on Accept, "Sign up with" radio → toast; no http or ws requests.
- State switcher and `?state=` load the named state and set `data-state`/`data-theme`.
- raid-officer-sheet: the sheet opens at 390 and closes at 1440 when the width changes.
Known limitations: prototype saves are local only; nothing persists across reloads. While a
window or the sheet is open the page behind it, the prototype bar included, is inert (native
modal dialog); a click outside it or Escape closes it, then the bar works.

## Real-site experiment
None.

## Open decisions
None for the brief. Version differences go to Robert per decision in step 6.
