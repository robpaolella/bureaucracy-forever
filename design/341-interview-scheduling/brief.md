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

Not applicable: loading uses the site's existing route loading skeleton; no-permission
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
To be filled in at capture: `/members/availability` (member), `/apply` signed out
(StatusPage), `/officers/applications/<id>` (officer), via
`.pi/skills/verify-guild/SKILL.md` Launch, Doctor, Editable offline page snapshot and
Cleanup. Hosts in `hosts/`.

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
To be listed with the versions (for example: how the grid's days handle interview hours
that cross the viewer's midnight).

## Real-site experiment
None.

## Open decisions
None. Brief confirmed by Robert, 2026-10-15 (Q4: "Yeah, good to go.").
