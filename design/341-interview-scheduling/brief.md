# Design: the applicant's interview page and the officer Interview card

- Design issue: #341
- Revision: 1
- Replaces: none
- Source plan: robpaolella/bureaucracy-forever-discord-bot#44 (Robert's answers, rounds 1–5);
  interview rules and approved DM wording in #340 (`SYNC-SPEC.md`).

## Job and audience
**Applicant page.** Someone who has applied to Bureaucracy (usually a Discord Guest, site
role `social`) gets a DM from the bot: "…would like to set up a quick 15–20 minute
interview with you. Please share your availability over the next week…", with a
**Share my availability** button. It opens this private page. They sign in with Discord
if needed, paint the half-hours they could start an interview, and send them. Later they
come back to see where things stand: their times are with the officers, an officer
proposed another time (Accept or Decline), the interview is booked (join Public Lounge
then), or it ended. If their DMs are closed, an officer passes them the link instead, so
the page explains the current state on its own, never relying on a DM.
Success: the applicant sends usable times in under a minute and always knows what
happens next.

**Officer card.** An officer on the existing application page sees, without leaving it,
whether an interview is underway and where it stands: the applicant's times, any
proposed or booked time and who set it, and how it ended. Every action stays in Discord
(Robert, plan Q8, Q13).

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #344 | The applicant page: sign-in gate, nothing to schedule, pick and send times, change them, answer a proposal, booked, ended, and the error states | The officer card; the member availability page and its data; Discord messages |
| #345 | The read-only Interview card on `/officers/applications/<id>` | Officer actions on the web; the applicant page |

#344's recommended split (page shell and read-only states / pick and change times /
answer a proposal) inherits this design via `Covered via parent #344`.

## Boundaries and visual authority
`DESIGN.md` and the live site govern the look; `PRODUCT.md` the voice and time rules;
`REVIEW.md` time handling (viewer's zone with its label, guild time on hover, tap and
focus and in the accessible name, never an unlabelled time).

Reused, from the host pages:
- Picking times: the member availability editor (`AvailabilityEditor`, `WeekGrid`,
  `DayColumn`, `DayBlock`, `DayListModal`): paint grid, blocks, one-day phone view with
  day switcher, the day list as the keyboard route, legend, and the "Your time / Guild
  time" labels. `TimezoneBar`'s "Use a different timezone" picker.
- Other states: `StatusPage` (the centred column the apply page uses), `Button`,
  `ButtonLink`, `StatusPill`, `Toast`, `LocalTime`.
- Officer card: `ApplicationView`'s bordered `ink-800` section (as Officer notes),
  label style and `StatusPill`.

Differences from member availability (from #341): seven **dated** days starting on the
request day, not a recurring week; one paint state only (**Available**); only the
half-hours officers can interview are paintable (starts 9:00 AM–10:30 PM guild time,
from request + 2 h to request + 7 d, never in the past). No autosave: an explicit
**Send my times** / **Update my times** button (Q1).

Must not change: the member availability page, its data and its look; the rest of the
officer application page (answers, notes, decision bar); the site shell.

New kinds of element for Robert's approval: none expected beyond what's shown. Any that a
version introduces (for example a shaded "can't book" cell) is named in `decisions.md`.

## States, themes and content
One theme (`default`). Every state at 390×844 and 1440×900. Sample data only:
applicant **Quillfeather** (sample), officers **Ledgerline** and **Redtape** (seeded
sample officers). Sample request: Thu Oct 15, 3:10 PM guild time; window Thu Oct 15
5:30 PM – Thu Oct 22 3:00 PM guild time. Sample viewer zone: America/New_York, so the
interview hours (12:00 PM–1:30 AM Eastern) cross the viewer's midnight.

Draft wording below; final wording comes from the versions Robert approves.

### Applicant page
| State slug | Situation | Content | Actions / feedback |
| --- | --- | --- | --- |
| signed-out | Opened the link without a site session | StatusPage. Eyebrow "Interview". Title "Sign in to share your times". Body: "Sign in with the Discord account you applied with, and we'll bring you back here." | **Sign in with Discord** → returns to this page |
| nothing | Signed in, no interview for this account (forwarded link, wrong account, never requested) | StatusPage. Title "Nothing to schedule". Body: "There's no interview waiting for this Discord account. If an officer asked you to pick times, check you're signed in with the account you applied with." | **Back to the home page** |
| pick-empty | Interview requested, nothing painted | Editor. Eyebrow "Interview". Title "When could you talk?" Lede: "Paint the half-hours you could start a 15–20 minute interview over the next week. Pick as many as you can; we'll book one." Dated grid, unpaintable times marked | **Send my times** disabled until at least one half-hour is painted |
| pick-short | (F) Under the minimum: four hours on one day | Status "4 of 5 hours picked · add 1 more, on another day" | **Send my times** disabled until the minimum is met |
| pick-partial | Some painted, not sent | Typical: three evenings. Status "Not sent yet" | **Send my times**; leaving warns |
| pick-max | Many painted | Every paintable half-hour on most days | Labels never overflow |
| submitted | Times sent, no booking yet | StatusPage-style. Title "Your times are with the officers". Body: "We'll let you know on Discord when your interview is booked. You can change your times until then." Then the sent times grouped by day, in the viewer's zone | **Change my times** reopens the grid with them painted |
| changing | Editing after sending | Editor with sent times; status "Changes not sent" | **Update my times**; **Cancel** keeps the sent times |
| proposed | An officer proposed a time | StatusPage. Title "Could you do this time instead?" Body: "The officers couldn't make any of your times." The proposed time (zone label, guild time on hover/tap/focus) | **Accept**, **Decline** (decline confirms first) |
| booked | A time is booked | Title "Your interview is booked". Time with zone and relative ("in 2 days"). Body: "At that time, please join the Public Lounge voice channel in our Discord and an officer will bring you in." | **Open Discord** |
| ended-cancelled | Officer cancelled | "Your interview on <time> has been cancelled. An officer will be in touch." | none |
| ended-no-time | Declined, expired or lapsed | "We couldn't find a time. An officer will reach out to you directly to arrange one." | none |
| ended-closed | Application decided | "This interview is closed because your application has been decided. An officer will be in touch on Discord." (Q5) | none |
| ended-done | Interview took place | "Thanks for talking with us. We'll get back to you on Discord within a few days." | none |
| error-too-soon | Accept pressed under 15 minutes before the proposed start | Proposed state with an error: "This time starts in less than 15 minutes, so it can't be booked now. An officer will reach out to arrange another." | Accept disabled |
| error-stale | Sent or answered after an officer acted (booked, cancelled) | Toast or banner: "This changed while the page was open." The page shows the current state | — |
| error-offline | The site couldn't be reached on send or answer | Painted times kept. Toast: "Couldn't send your times. Check your connection and try again." | **Retry** |

Loading (state `loading`, added after critique in session 3): A and B show the site's
existing `PageSkeleton` in the full page; C and D show the same skeleton bars inside the
squeeze card, so loading never brings back the nav and footer. Not applicable: no-permission
is `nothing` (a signed-in person only ever sees their own interview, so there's no
"not allowed" view); there are no roles on this page beyond signed out / signed in.

### Officer card
| State slug | Interview state | Content |
| --- | --- | --- |
| officer-none | Never had an interview | No card; page as today |
| officer-awaiting | `AWAITING_TIMES` | "Waiting for times", requested by Ledgerline, when; heads-up after 3 days |
| officer-times | `TIMES_RECEIVED` | The applicant's times by day, in the viewer's zone; "updated" note when changed |
| officer-proposed | `PROPOSED` | Proposed time, by whom, waiting for the applicant |
| officer-booked | `BOOKED` | Booked time, by whom |
| officer-ended | `DONE` / `CANCELLED` / `NO_TIME` (declined, expired, lapsed) / `CLOSED` | Outcome word, date, who (where one acted) |
| officer-second | A second attempt after an earlier `DONE` | Current attempt plus one line "Earlier interview: done, Oct 3" (Q3) |

Every card says actions happen in the Discord thread and links "Open the thread".

Keyboard and accessibility: the grid keeps the day list as the keyboard route; every
time carries its zone and guild time in its accessible name; status pills carry words;
44px targets except paint cells.

## Host snapshot and offline proof
Captured on commit 25fbf92 with `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor,
Editable offline page snapshot, Cleanup PASS; evidence `/tmp/verify-guild-xwR8aw`):
- `hosts/availability.html`: `/dev/session?as=member&back=/members/availability`
  (seeded member Redtape). Used for the applicant's header (renamed Quillfeather/QU, the
  members menu's "My availability" link removed, as a social doesn't get it).
- `hosts/apply-out.html`: `/dev/session?as=out&back=/apply` (signed-out `StatusPage`).
  Used for the signed-out header and the mark image.
- `hosts/application.html`: officer, from `/officers/applications`, the seeded "backlog"
  row's own page (renamed quillfeather/Quillfeather/QU, its ID replaced). The card goes
  after the article's `</header>`.

All three hosts were checked offline at 390×844 and 1440×900 against the running pages.
Parts used: each host's `<head>`, `<header>` and `<footer>`; the application's `<main>`;
the `StatusPage` mark `<img>`. Every captured `href="http…"` becomes `#`; the canonical
link and URL-bearing meta tags are removed.

The versions are generated outside the repo from the hosts plus a prototype stylesheet
and script (the editor, states, sample data and controls). Both versions were checked
offline with the network set to Offline at both widths: paint and drag, send, change and
cancel, remove a block, day list, time-zone change (Eastern, Pacific, UK), decline with
confirm and Escape, accept, retry after an error, and the phone day view keeping its
scroll while painting. The only requests were inline `data:` images.
Versions C and D were checked the same way (session 3, network Offline, 1440 and 390):
toggle times (focus and the panel's scroll kept), pick a day on the calendar and the
phone strip (strip scroll kept), Pick all / Clear this day, the Your/Guild switch keeping
the same day, send, change, cancel, update, zone changes (UK, Pacific hides the switch),
send error and Try again, decline dialog and Escape, D's drag-paint, block remove and day
list, and the officer states keeping the full page. Regenerating also rewrote A and B;
their 104 captures are pixel-identical to the critiqued ones.

## Confirmed decisions
Robert, 2026-10-15, this session:
1. Explicit **Send my times** / **Update my times** button, no autosave; unsent changes
   are flagged and leaving warns.
2. The paint grid only while picking or changing times; every other state uses the
   centred `StatusPage` layout. After sending: a thanks with the sent times and
   **Change my times**.
3. The officer card sits under the application's header, above the answers; hidden when
   there has never been an interview; an earlier attempt adds one line.
4. The brief and its draft wording: "Yeah, good to go."
5. Decided-application wording: "…An officer will be in touch on Discord." ("Yes"), so
   it holds when the decision DM couldn't be delivered.

## Version questions
Versions A–D differ on these independent decisions (details in `decisions.md`):
0. **Page layout.** A, B: the full site page with the editor. C, D: the squeeze page.
4. **Picker (squeeze page).** C: month calendar and the day's times as buttons. D: a
   compact paint grid. E: C with hour buttons (question 5).
5. **Button size (C or E).** C: half-hour buttons. E: hour buttons.

The first three apply as follows (1 and 2 only matter if A or B is chosen):
1. **Grid days.** A: the viewer's own calendar dates, all 48 rows when interview hours
   cross the viewer's midnight, outside hours hatched. B: one column per interview day
   (guild day), 28 rows of starts in the viewer's time, a "Next day" line at the rollover.
2. **Time-zone control.** A: compact "Your time / Guild time" labels plus "Change".
   B: the full `TimezoneBar` card.
3. **Officer card.** A: compact, like Officer notes, times listed by day. B: definition
   rows like the answers list, times as chips.

Everything else is the same in both: wording, states, the status pages and the phone
day view.

### Versions C and D: the squeeze page (Robert, 2026-10-15)
Robert asked for a squeeze page in the style of a Calendly/Zoom Scheduler booking page:
"too much distraction on the page overall… The scheduling portion is smaller and right in
the center. It's obvious what you do and what you click." He confirmed the plan and kept
the approved flow: the applicant sends **several** times and an officer books one.

Boundary: every applicant state (signed-out through the error states) drops the site nav
and footer. A top bar holds only the site logo (linking home), and the page is one card
centred on `ink-950` with a `line` border, `ink-850` fill and card corners, and no resting
shadow (DESIGN.md). Officer states keep the full site page, because only their card is new.
- **Picker card (both):** an info panel (mark, "Interview" eyebrow, "Officer interview",
  a short what-to-expect, then 15–20 minutes, Discord voice · Public Lounge, start times
  in the viewer's zone with guild time on hover/tap/focus, the time-zone button that opens
  the existing zone dialog, "Signed in as …"). A card footer across the full width holds
  the status ("Nothing picked yet" / "19 times picked on 4 days · not sent yet" /
  "… changes not sent") and **Send my times** (Cancel + **Update my times** when changing).
  A failed send shows in the footer ("Couldn't send your times…") with **Try again**,
  in place of the toast (the toast would cover the footer).
- **C:** info | October month calendar (days with interview times enabled; the shown day
  filled Sand; a Teal dot under days with picks) | that day's start times as toggle
  buttons (3 columns, scrolling inside the panel; a dashed break where the day has a gap,
  such as after the viewer's midnight), "Pick all" / "Clear this day", and a
  "Your time | Guild time" switch that re-dates the calendar and times in that zone. Each
  button's accessible name carries both times. Days are the viewer's own dates.
- **D:** info | a compact paint grid (the B grid: one column per interview day in guild
  days, 28 rows of 15px, the "Next day" rollover line, the day list as keyboard route).
- **Phone (both):** one full-width card: a condensed info panel, a horizontal strip of
  day chips, the day's time buttons, and a sticky footer with Send. D's phone matches C's,
  because tap-painting a 28-row column is harder than tapping times.
- **Status states:** the same squeeze page, with a 520px card holding today's StatusPage
  content (sent times say "start times").
- **Officer card:** C carries card A; D carries card B; E carries card A (question 3 stays independent).

### Version E: C with hour buttons (Robert, 2026-10-16)
Robert: "Can we try version C but with 60 minute increments, not 30 minutes? That might
make it cleaner. Right now, it's a bit too busy." E is C with one button per hour. A
picked hour means "I could start any time in it" and saves both of its half-hour starts,
so SYNC-SPEC's half-hour starts, the officers' list and the bot's Book/Propose stay
unchanged; officers can still book 8:00 or 8:30. At the window's edges an hour may hold
one start (the first button on Thursday 15 Oct reads "8:30 PM"). A note above the buttons
says "Pick an hour if you could start any time in it."; each button's accessible name
gives the hour in both zones. Counts say "hours" ("10 hours picked on 4 days"). Hours
follow guild hours, which are whole hours in every sample zone.


### Version F: E with a one-day paint column and a minimum (Robert, 2026-10-16)
Robert chose E for layout, picker, hour buttons and officer card ("I like E for all of
them"), then: "I just don't know that it's obvious enough that a user needs to pick all
available times since this UX looks like 'Let me pick one availability time.' And I
certainly wouldn't want to accept any submissions with less than 5 1-hour slots
selected. Maybe when they choose a day, it gives them the calendar painter instead of
blocks. But fit within the existing design." His answers: the 5 hours must fall on at
least 2 days ("Sure"); changing times always needs the minimum too ("Always needs 5 at
least"); keep Pick all / Clear this day ("Yes").
- **Painter:** the chosen day's panel is one paint column, one row per hour (the member
  editor's day view: hour labels in a gutter with guild time on hover/tap/focus, Teal
  "Available" blocks labelled with their range). Press and drag paints; starting on a
  painted hour clears instead. Each hour is a toggle button, so Tab and Enter/Space are
  the keyboard route and each carries both zones in its name. A dashed break marks a gap
  in the day (the viewer's midnight). Phone rows are 40px and the column takes the drag
  (`touch-action: none`), while the hour labels still scroll the page.
- **Minimum:** at least 5 hours on at least 2 days, for sending and for updating. Days
  are **guild days** (an evening across the viewer's midnight is one day), so the
  server can check the same rule. The footer says what's missing ("Nothing picked yet ·
  pick at least 5 hours on 2 or more days", "4 of 5 hours picked · add 1 more, on another
  day", "5 hours picked on 1 day · add an hour on another day") and Send stays disabled
  until it's met. The build enforces the same rule on the server (#344).
- **Wording:** the lede asks for every free hour: "Paint every hour you're free this
  week: at least 5 hours, on 2 or more days. The more you give us, the sooner we can book
  one; we'll let you know on Discord once it's booked."
- Desktop picker card is 600px tall (E's 540).
- **Full day and Clear all** (Robert, 2026-10-16, after seeing F: "There needs to be a
  clear all button that wipes out all times. We also need to show the full day, not just
  the times that we're available in. They can be darkened out like before, but they need
  to be there, otherwise the time jump is jarring and could be missed."):
  - The column shows all 24 hours of the day (in the zone the switch shows). Hours with
    no interview start are hatched, as A's "Outside interview hours" cells, with that
    legend under the note; they can't be painted. No more dashed gap.
  - On desktop the column scrolls inside the panel and opens on the day's first painted
    hour, else its first bookable hour. On phone it's part of the page (36px rows).
  - **Clear all** (a text button in the card footer, shown once anything is picked)
    opens a confirm, "Clear all your times? This removes every hour you've picked, on
    every day." with **Keep them** / **Clear all** (danger). When changing sent times
    it adds "The times you sent stay with the officers unless you update them."

## Real-site experiment
None.

## Open decisions
None. Brief confirmed by Robert, 2026-10-15 (Q4: "Yeah, good to go.").
