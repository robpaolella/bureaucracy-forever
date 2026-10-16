# Design: interview picker as 1-hour buttons (revision 2)

- Design issue: #367
- Revision: 2
- Replaces: `design/341-interview-scheduling/` revision 1 (version F), approved by Robert
  merging PR #361. Revision 1 stays as its record; this folder supersedes it for #344
  and #345 once merged.
- Source: Robert, 2026-10-16 (conductor chat, recorded on #344 and #363): "I've changed my
  mind. I want to just go back to the 1-hour block selectors, not the drag-to-paint
  calendar selector. Then it's still in 1-hour blocks. They still need to pick at least
  5 blocks across the week spanning at least 2 different days. They should pick as many
  as possible."

## Job and audience
Unchanged from revision 1 (its `brief.md`, Job and audience): an applicant opens the
private interview page from the bot's DM, picks every hour they could start a 15–20
minute interview over the next week, and sends them; officers book one. The officer
card shows where an interview stands. Success: the applicant sends usable times in
under a minute, picks as many hours as they can, and always knows what happens next.

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #344 | The applicant page, as revision 1, with the picker's day panel as 1-hour buttons; the minimum (5 hours on 2 or more guild days) | The officer card; member availability; Discord messages |
| #345 | The officer Interview card, as revision 1, plus the "Earlier interview" line for any earlier attempt and the cancel-without-booking wording | Officer actions on the web; the applicant page |

Split parts of #344 inherit via `Covered via parent #344`: #362 (route, access, read-only
states, including the cancel-before-booking wording), #363 (the picker; the part this
revision changes), #364 (send and update), #365 (answer a proposal).

## What changes from revision 1
1. **Picker day panel.** The chosen day's hours are 1-hour toggle buttons (as version E),
   not F's drag-to-paint column. A picked hour means "I could start any time in it" and
   saves both of its half-hour starts, so SYNC-SPEC and the bot are unchanged. At the
   window's edge an hour may hold one start (Thursday 15 Oct's first button reads
   "8:30 PM" in Eastern). Each button's accessible name gives the hour in both zones.
2. **Kept from F unchanged:** squeeze page, info panel, month calendar with Teal "has
   picks" dots, phone day-chip strip, "Your time / Guild time" switch, Pick all / Clear
   this day, the lede ("Mark your availability for a 15–20 minute interview with an
   officer. Choose all times that you're available to make scheduling easier."), the
   minimum (at least 5 hours on 2 or more **guild** days, to send and to update) with
   F's footer wording and Send disabled until met, and **Clear all** with its confirm.
3. **Cancel before booking** (#362, Robert "Agreed", 2026-10-16): the applicant's
   cancelled page reads "Your interview has been cancelled. An officer will be in touch."
   (no time) when nothing was booked. New state `ended-cancelled-unbooked`.
4. **Officer card** (#345, Robert "Agreed", 2026-10-16): the "Earlier interview:
   <outcome>, <date>" line shows for any earlier attempt, with the status pill's outcome
   words (Done, Cancelled, No time found, Closed); a cancel with no booking drops "It had
   been booked for…". The outcome word is written exactly as the pill shows it:
   "Earlier interview: Done, Saturday 10 Oct." (revision 1 showed lowercase "done").
   New states `officer-cancelled-unbooked`, `officer-second-cancelled`,
   `officer-second-no-time` and `officer-second-closed`.

Everything else (states, wording, officer card A, layout, widths) is revision 1's.

## Boundaries and visual authority
As revision 1: `DESIGN.md` and the live site govern the look; `PRODUCT.md` voice and time
rules; `REVIEW.md` time handling (viewer's zone labelled, guild time on hover, tap, focus
and in the accessible name). Must not change: member availability, the rest of the
officer application page, the site shell.

New kinds of element: none beyond revision 1 and version E (hour toggle buttons were
shown in E and C). Any a version adds is named in `decisions.md`.

## States, themes and content
One theme (`default`); every state at 390×844 and 1440×900. Sample data only, as
revision 1 (applicant Quillfeather, officers Ledgerline and Redtape; request Thu Oct 15,
3:10 PM guild time; viewer America/New_York, so interview hours cross the viewer's
midnight).

All 28 states of revision 1 (33 here) (its `brief.md` tables and `design.json`), plus:
| State slug | Situation | Content | Actions |
| --- | --- | --- | --- |
| ended-cancelled-unbooked | Officer cancelled before anything was booked | "Your interview has been cancelled. An officer will be in touch." | none |
| officer-cancelled-unbooked | Card: cancelled, never booked | "Cancelled by Redtape on Friday 16 Oct." (no "It had been booked for…") | Open the thread |
| officer-second | Card: second attempt after an earlier done one (revision 1's state, word now capitalised) | Current attempt plus "Earlier interview: Done, Saturday 10 Oct." | Open the thread |
| officer-second-cancelled | Card: second attempt after an earlier cancelled one | "Earlier interview: Cancelled, Saturday 10 Oct." | Open the thread |
| officer-second-no-time | Card: second attempt after an earlier one that found no time | "Earlier interview: No time found, Saturday 10 Oct." | Open the thread |
| officer-second-closed | Card: second attempt after an earlier closed one | "Earlier interview: Closed, Saturday 10 Oct." | Open the thread |

Picker states with the new buttons: pick-empty, pick-short (4 hours on one day), pick-partial
(typical), pick-max (every bookable hour on most days), changing, error-offline.
Keyboard: each hour is a toggle button (Tab, Enter or Space), focus kept on re-render;
44px targets.

## Host snapshot and offline proof
Reuses revision 1's host snapshots (`application.html`, `apply-out.html`,
`availability.html`), captured on commit 25fbf92 with `.pi/skills/verify-guild/SKILL.md`
and proven offline at both widths (revision 1's `brief.md`). Reason: everything but the
picker must stay identical to the approved design. Since 25fbf92, main changed only
bot API routes and self-hosted the same fonts (#360); no change to the pages used.
Parts used: as revision 1 (each host's `<head>`, `<header>`, `<footer>`; the
application's `<main>`; the `StatusPage` mark image). Versions are generated outside
the repo from those hosts plus the prototype stylesheet and script.

## Confirmed decisions
Robert, 2026-10-16, this session:
1. A note above the day's buttons: "Pick every hour you're available. The more you pick,
   the easier it is to schedule." (his wording; replaces E's "Pick an hour if you could
   start any time in it."). The lede and F's footer messages stay.
2. Buttons are labelled with the start time ("10:00 PM"), as E (recommendation accepted).
3. Brief agreed: change only the picker, add the two agreed answers, keep everything
   else from F ("Agreed.").

Versions: **G**, only the bookable hours (E's three-column buttons, a dashed break where
the day has a gap); **H**, all 24 hours of the day as buttons, hours with no interview
start hatched and disabled (F's "show the full day" request, 2026-10-16).

## Real-site experiment
None.

## Open decisions
None. Robert chose G, 2026-10-16 ("I like G. It makes more sense on this style design.
Approved, go forward with it."); see `decisions.md`.
