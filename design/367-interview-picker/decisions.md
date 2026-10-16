# Design decisions: interview picker as 1-hour buttons (revision 2)

- Design issue: #367; covered build issues: #344 (applicant page; split parts #362–#365
  inherit via `Covered via parent #344`), #345 (officer card)
- Revision: 2; replaces: `design/341-interview-scheduling/` revision 1 (version F,
  approved by Robert merging PR #361)
- Maker: claude-bridge/claude-opus-5-5, medium thinking (session `design-367`)

## Why this revision
Robert, 2026-10-16 (conductor chat, recorded on #344 and #363): "I've changed my mind. I
want to just go back to the 1-hour block selectors, not the drag-to-paint calendar
selector. Then it's still in 1-hour blocks. They still need to pick at least 5 blocks
across the week spanning at least 2 different days. They should pick as many as
possible." Also folded in, both "Agreed." by Robert on 2026-10-16: a cancel before
booking reads "Your interview has been cancelled. An officer will be in touch." (#362);
the officer card's "Earlier interview" line shows for any earlier attempt, and a cancel
with no booking drops "It had been booked for…" (#345).

Folder: a new folder rather than revision 1's, because an approved record is never
rewritten in place (design-feature, step 9); the Design gate selects the highest merged
revision covering a build, so this folder supersedes revision 1 for #344 and #345.

## Interview (this session)
| # | Question | Robert's answer, 2026-10-16 |
| --- | --- | --- |
| 1 | Encourage more picks with a note above the buttons? | "Pick every hour you're available. The more you pick, the easier it is to schedule." (his wording) |
| 2 | Button label: start time ("10:00 PM", E) or range ("10–11 PM")? | "I like your recommendation." (start time) |
| 3 | Brief: change only the picker, add the two agreed answers, keep the rest of F | "Agreed." |

## Versions
Both keep everything in F except the day panel: squeeze page, info panel and lede,
month calendar and phone day strip, "Your time / Guild time" switch, Pick all / Clear
this day, the minimum (5 hours on 2 or more guild days, F's footer wording, Send
disabled until met), Clear all with its confirm, the 600px desktop card, officer card A.
Each hour button saves both of its half-hour starts (as E), so SYNC-SPEC and the bot are
unchanged.

| Decision | G | H |
| --- | --- | --- |
| Which hours the day panel shows | Only the bookable hours, three per row (E); a dashed break where the day has a gap (the viewer's midnight) | All 24 hours in order; hours with no interview start hatched and not clickable, with F's "Outside interview hours" legend. Desktop: the panel scrolls and opens on the first picked, else first bookable hour. Phone: two or more outside hours in a row collapse into one full-width hatched bar ("2:00 AM – 12:00 PM · outside interview hours") |

Trade-off: G is the shortest and cleanest, but the jump at a gap (for example 1:00 AM
then 12:00 PM) is only a dashed line. H shows where the day's interview hours start and
stop, which Robert asked for in F ("otherwise the time jump is jarring and could be
missed"), at the cost of a busier panel.

## Choice and approval
**Chosen: version G**, now `index.html`. Robert, 2026-10-16: "1. I like G. It makes more
sense on this style design. Approved, go forward with it."

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 1 | Which hours the day panel shows | g: only the bookable hours, dashed break at a gap; h: all 24 hours, outside hours hatched and disabled, collapsed into one bar on phone | g: "It makes more sense on this style design." |

The maker had recommended H (it keeps F's full-day boundary); Robert chose G knowing
what H offered (both were described to him in the same question).

Design PR: linked on the design issue once created. Only Robert merging that PR
approves it for building.

## New kinds of element shown
None new to the site's approved designs: the hour toggle buttons, dashed run break,
hatched outside-hours cell and its legend were shown in revision 1's versions (C/E, A, F).
H's hatched, disabled hour button and phone gap bar are those cells in button form.

## Independent critique
### Round 1 (2026-10-16)
- Maker: claude-bridge/claude-opus-5-5. Reviewer: openai/gpt-5.6-terra, medium thinking
  (`route.ts role checker`), a different company.
- Command: `node /git/maestro/scripts/read-only-run.ts /git/bureaucracy-forever review
  /git/maestro/skills/design-feature/reviewer-prompt.md "<folder, evidence, revision 1
  comparison, maker, scope, capture note, offline proof>" -- --model
  openai/gpt-5.6-terra --thinking medium`; exit 0, repo unchanged.
- Evidence: `/tmp/design-review-PJwNA9/versions`, 124 images (2 versions × 31 states ×
  390/1440) and `manifest.json`, opened by the maker (contact sheets and full-size
  picker captures) and the reviewer.
- Verdict: **FIXES**:
  1. `decisions.md` missing from the folder. Fix: this file.
  2. H on phone: a field of disabled hours pushes the bookable ones down. Fix: on phone,
     two or more outside hours in a row collapse into one full-width hatched bar.
- Trade-off for Robert (not a fix): G is the cleaner composition for the main task; H
  keeps the full-day boundary he asked for in F.
- Fixes evidence: H recaptured (`/tmp/design-review-PJwNA9/h2`, 62 images, copied over
  the round-1 set so `versions/manifest.json` stays complete; desktop H unchanged,
  pixel-identical), plus a 390px viewport capture scrolled to the panel
  (`/tmp/design-review-PJwNA9/h-phone-scrolled-pick-short-partial.png`). Offline
  interaction re-run after the fix: same results, only file and `data:` requests.
- Re-check of fixes 1 and 2 only, same reviewer and command: **PASS**, exit 0, repo
  unchanged.

## Alternatives
| Version | What differs / why rejected or chosen | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| h | Full day of hour buttons; not chosen | The whole day shown in order, with hatched, unclickable hours outside interview times and the "Outside interview hours" legend; desktop panel scrolling to the first pick; the phone's collapsed "… · outside interview hours" bar | Robert chose G over it in the question that described exactly these features, 2026-10-16: "I like G. … Approved, go forward with it." | [All-version manifest](screenshots/all/manifest.json), files `h-…` |

All-version captures were completed and inspected before pruning `versions/`:
`screenshots/all/`, 124 images (2 versions × 31 states × 390/1440) and `manifest.json`,
pixel-identical to the critiqued set apart from the animated loading skeleton
(3 images). Approved evidence: [manifest](screenshots/approved/manifest.json),
62 images (31 states × 390/1440), pixel-identical to G's all-version captures.
Final offline proof of `index.html` (network Offline, 390 and 1440): toggle hours with
focus kept, minimum messages and disabled Send, Pick all, Clear all confirm and Keep
them, send → submitted; no requests other than the file and `data:` URIs.
**After freeze, from the pre-PR review** (below): the officer card's "Earlier interview"
outcome word now matches the status pill ("Done", "Cancelled", as #345's agreed answer
says) and two states show the remaining earlier outcomes (`officer-second-no-time`,
`officer-second-closed`). `index.html` was regenerated from the same sources with only
these changes; `screenshots/approved/` was recaptured: 66 images (33 states ×
390/1440), all opened; against the previous approved set only `officer-second` and
`officer-second-cancelled` differ (the capital letter) and the four new images are
added. `screenshots/all/` stays the pre-freeze record of G and H (31 states, lowercase
words). These follow Robert's agreed #345 answer, so no new decision was needed.
Capture limitation: in full-page phone captures the sticky card footer shows part-way
down the image (as in revision 1).

## Pre-PR review (ship)
- Reviewer: openai/gpt-5.6-terra, medium thinking, a different company; command
  `node /git/maestro/scripts/read-only-run.ts . review
  /git/maestro/skills/review/reviewer-prompt.md "<issue, base main, design folder and
  evidence>" -- --model openai/gpt-5.6-terra --thinking medium`; exit 0, repo unchanged.
- Verdict: **Blocking**, two:
  1. The "Earlier interview" line for any earlier attempt had evidence only for Done and
     Cancelled; No time found and Closed had none. Fix: states `officer-second-no-time`
     and `officer-second-closed`.
  2. The line used lowercase words, not the pill's ("Done", "Cancelled"), as #345's
     agreed answer requires. Fix: capitalised.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| herdr, 2026-10-16 (Robert) | Day panel note | Interview 1 | The note reads "Pick every hour you’re available. The more you pick, the easier it is to schedule." Checked in the approved captures. | resolved |
| herdr, 2026-10-16 (Robert) | G vs H | "I like G. It makes more sense on this style design." | G frozen as `index.html`. | resolved |

No Open Design comments were left on this revision.

## Experiment
None.

## Open items
None affecting the approved scope. Carried unchanged from revision 1 (not asked here):
the officer card's "sent N half-hours" counts in Times received and Closed; Robert said
to keep F's officer card as it was.

## Build handoff
Merged folder/revision is the feature authority for #344 (and its split parts via
`Covered via parent #344`) and #345; DESIGN.md/live site govern site-wide look. For the
build: each hour button saves both of its half-hour starts (one at a window edge); the
footer and server use one counting function (5 hours on 2 or more guild days). #363's
brief describes F's paint column and needs re-prep against this revision. Later
revisions use new issues/PRs.
