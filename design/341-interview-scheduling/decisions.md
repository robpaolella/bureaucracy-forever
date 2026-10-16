# Design decisions: the applicant's interview page and the officer Interview card

- Design issue: #341; covered build issues: #344 (applicant page), #345 (officer card)
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (four sessions: `design-341` and its successors), medium thinking

## Choice and approval
**Chosen: version F**, now `index.html`. Robert, 2026-10-16, after leaving one copy
change as an Open Design comment: "Alright, I made one copy change to F. I think it's
ready to go. I don't need to see it with the new copy, just approve it and get it ready
to build." Earlier, when asked to approve F, he was told it drops E (its hour buttons),
which F replaces.

Why F: it keeps E's squeeze page, calendar and officer card A, and answers Robert's
worry that hour buttons read as "pick one time": a full-day paint column, a minimum of
5 hours on 2 or more guild days, and Clear all.

Picks per decision (F carries E's picks, with the picker reworked):

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 0 | Page layout | a, b: the full site page (nav, footer, editor); c, d: a squeeze page (logo-only top bar, one centred card, no footer) for every applicant state | e (squeeze page). Robert, 2026-10-16: "I like E for all of them." |
| 4 | Picker on the squeeze page (e is c with question 5's hour buttons) | c: info panel, a month calendar and the chosen day's start times as toggle buttons with a "Your time / Guild time" switch; d: info panel and a compact version of B's paint grid. Both use the same phone layout (day chips and time buttons) | e (calendar), with the day's picker reworked: see Comments, 2026-10-16. Robert, 2026-10-16: "I like E for all of them." |
| 5 | Start-time buttons (C or E) | c: one button per half-hour start; e: one button per hour, saving both of its half-hour starts | e (hours). Robert, 2026-10-16: "I like E for all of them." |
| 1 | Grid days when interview hours cross the viewer's midnight | a: the viewer's own calendar dates (8 columns for an Eastern viewer); every row of the day shows, and hours outside interview hours are hatched; b: one column per guild day (interview day), with 28 rows of starts labelled in the viewer's time, and a teal "Next day" line where the viewer's date rolls over | not applicable: A and B not chosen |
| 2 | Time-zone control on the picker | a: the member editor's compact "Your time / Guild time" labels plus a "Change" link; b: the full `TimezoneBar` card from the Raiding page with "Use a different timezone" | not applicable: A and B not chosen |
| 3 | Officer Interview card (C uses a's, D uses b's) | a: a compact card styled like Officer notes, with the pill beside the heading and times listed by day; b: definition rows like the answers list (Status / Where it stands / Their times), with times as chips | card A (carried by e). Robert, 2026-10-16: "I like E for all of them." |

The approved picker is F's one-day paint column (Comments and changes, 2026-10-16), in
place of decision 5's hour buttons; picks still save both half-hour starts of each hour.

Design PR: linked on the design issue once created. Only Robert merging that PR
approves it for building.

## New kinds of element shown
For Robert's go-ahead through the approved design (AGENTS.md, Designs):
- The hatched "Outside interview hours" grid cell, with its legend entry (both versions).
- The "Next day" rollover line across the grid and its date tag on phone (B only).
- The time line card on status pages: a bordered box holding a large time and a
  relative "in 2 days" (proposed, booked).
- Time chips in the officer card (B only).
- The "Change" link next to the compact time-zone labels (A only; the member editor
  has no zone control there today).

Versions C and D add (squeeze page):
- The squeeze page shell: a logo-only top bar and one centred bordered card, no footer.
- Info-panel icons (clock, microphone, calendar, globe, person; 16px line icons).
- The time-zone button in the info panel (opens the existing zone dialog).
- The card footer with status and Send, sticky on phone; send errors shown in it.
- The month calendar with Sand selected day and Teal "has picks" dots (C).
- Start-time toggle buttons, "Pick all" / "Clear this day", and the "Your time / Guild
  time" segmented switch (C, and both versions on phone).
- The horizontal day-chip strip (phone, C and D).
- The compact paint grid with two-line block labels (D).

Version F adds:
- The one-day paint column in the picker card (the member editor's day view with one row
  per hour across the whole day; hours outside interview times hatched, with A's
  "Outside interview hours" legend; a press on a painted hour clears).
- The footer's minimum message, with Send disabled until 5 hours on 2 or more days.
- The footer's **Clear all** text button and its confirm dialog (the site's existing
  dialog, as Decline's).

The prototypes approximate block editing. In the approved F, each bookable hour is a
toggle button (Tab, then Enter or Space), which is the keyboard route; the build may
reuse the member editor's painting code but keeps that per-hour keyboard route.

## Alternatives
**A, B, C and D removed, 2026-10-16** (Robert, to "Can I drop versions A to E once F is
built? … I recommend dropping A to D now and keeping E until you've seen F": "Yes").
What only they had, as listed to him:
- A and B: the full site page with nav and footer; the week-at-a-glance paint grid; the
  hatched "outside interview hours" cells; the "Next day" rollover line; the full
  `TimezoneBar` card (B) and the compact "Change" link (A).
- C: half-hour start buttons (half-hour precision when picking).
- D: the week-at-a-glance compact paint grid on the squeeze page; officer card B.
Their last captures (all 27 states at 390 and 1440, session 3) are in
`screenshots/all/` (files `a-…` to `d-…`; `pick-short` didn't exist yet).

**E removed at approval, 2026-10-16.** What only E had: one tap-button per hour on the
chosen day (no painting), and the shorter 540px card with no hidden hours. Robert was
told approving F drops E and approved F (quote above). Captures of E and F, all 28
states at 390 and 1440, are in `screenshots/all/` (`e-…`, `f-…`), with one
`manifest.json` covering all six versions (328 images).

## Independent critique
- Maker: claude-bridge/claude-opus-5-5. Reviewer: openai/gpt-5.6-terra, medium thinking
  (`route.ts role checker`), a different company.
- Command: `node /git/maestro/scripts/read-only-run.ts /git/bureaucracy-forever review
  /git/maestro/skills/design-feature/reviewer-prompt.md "<design folder, evidence, maker,
  issues, capture notes>" -- --model openai/gpt-5.6-terra --thinking medium`; exit 0,
  repo unchanged.
- Evidence: `/tmp/design-review-POgefT/versions`, 104 images (2 versions × 26 states ×
  1 theme × 390/1440) and `manifest.json`, all opened by the maker and the reviewer.
- Verdict, 2026-10-15: **PASS**, no numbered fixes. Checklist items 1–6 all pass. The
  reviewer named the trade-offs between versions for Robert to decide; it did not choose
  between them. Limits it stated: it did not run the prototypes itself and relied on
  the recorded offline interaction proof.
- Before the critique the maker fixed its own findings: site classes missing from the
  compiled stylesheet, the phone day view's scroll, the officer card's header on phone,
  day labels wrapping, toast placement, wording ("Requested by … on …"), ended states
  following the brief (no actions), and the too-soon state's disabled Accept.

### Round 2: versions C and D (session 3, 2026-10-16)
- Maker: claude-bridge/claude-opus-5-5. Reviewer: openai/gpt-5.6-terra, medium thinking
  (`route.ts role checker`), a different company.
- Command: `node /git/maestro/scripts/read-only-run.ts /git/bureaucracy-forever review
  /git/maestro/skills/design-feature/reviewer-prompt.md "<design folder, evidence, maker,
  scope: new versions c and d; a and b as comparison>" -- --model openai/gpt-5.6-terra
  --thinking medium`; exit 0, repo unchanged.
- Evidence: `/tmp/d341-shots-oZnUck/v2`, 208 images (4 versions × 26 states × 1 theme ×
  390/1440) and `manifest.json`, all opened by the maker and the reviewer.
- Verdict: **FIXES**, one: loading is applicable but had no capture, so nothing showed
  that loading keeps the squeeze shell. Checklist items 1, 2, 4, 5 and 6 passed.
- Fix: a `loading` state in every version (A/B: the site's `PageSkeleton` in the full
  page; C/D: the same bars inside the squeeze card). Evidence `/tmp/d341-shots-oZnUck/v3`,
  216 images. Re-check of fix 1 only: **PASS**. A and B's other captures are
  pixel-identical to round 1.
- Reviewer's trade-offs for Robert (not fixes): C is the clearer first-time flow (date,
  then several start times) and makes "send several, officers book one" obvious; D keeps
  the faster paint and a week at a glance, with the phone switching to time buttons.

### Round 3: version E (session 3, 2026-10-16)
- Reviewer: openai/gpt-5.6-terra, medium thinking; same command, scope version E only
  (C with hour buttons), compared with C. Evidence `/tmp/d341-ev-CrMLLb/v`, 270 images
  (5 versions × 27 states × 390/1440) and `manifest.json`; A–D unchanged apart from the
  animated loading pulse. Exit 0, repo unchanged.
- Verdict: **PASS**, no fixes. Trade-off named for Robert: E is less precise when picking
  (a whole hour rather than a half-hour) but cleaner, and it keeps the half-hour contract.

### Round 4: version F (session 4, 2026-10-16)
- Maker: claude-bridge/claude-opus-5-5. Reviewer: openai/gpt-5.6-terra, medium thinking
  (`route.ts role checker`), a different company. Same command; scope version F, E as
  comparison. Evidence `/tmp/design-review-2rPTIk/v`: 112 images (2 versions × 28 states ×
  390/1440) and `manifest.json`, all opened by the maker (contact sheets plus full-size
  picker captures). E's captures match session 3's apart from the prototype bar's
  wider state menu.
- First run: exit 0, repo unchanged. Its table marked `f-pick-short` as "Fix 1", but the
  maker cut the output to its last lines and lost the verdict and the fix text (it was
  not saved anywhere). The maker's best reading of the capture: the full-page phone
  capture's sticky footer covers two rows of the painter, the capture effect named in
  the scope note.
- Second run, same inputs, output saved in full: **PASS**, no fixes; checklist 1–6
  pass. Trade-off named for Robert: F's painter makes "give us all your free time"
  clearer; E's hour buttons are cleaner and more scannable.
- After the critique the maker changed one style: painted hours now draw as one rounded
  block inset from the column (as the member editor's blocks), where the first build
  left a notched right edge. No behaviour changed; the offline interaction script was
  re-run with the same results and no network requests.

### Round 5: F's full day and Clear all (session 4, 2026-10-16)
- Reviewer: openai/gpt-5.6-terra, medium thinking (`route.ts role checker`); same
  command, scope F's two new changes, E as comparison. Evidence
  `/tmp/design-review-KkZsm0/v`, 112 images and `manifest.json`, all opened by the maker
  (full-size picker states at both widths). Exit 0, repo unchanged; output saved in full.
- Before the run the maker fixed its own finding: desktop captures opened the column at
  midnight, hiding the picks, because the column was scrolled while the desktop panel
  was hidden; it now also scrolls when the panel first shows.
- Verdict: **PASS**, no fixes; checklist 1–6 pass. Trade-off named for Robert: F is
  taller and denser than E because it shows unavailable hours, which makes the day's
  boundaries and "give us all your free time" clearer; E is faster to scan and tap.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| herdr, 2026-10-15 (Robert) | A and B, whole applicant page | "I think the whole design needs to change. It needs to be a squeeze page, first of all. There's too much distraction on the page overall. We don't have to copy the raid time availability 1 for 1. Look at this example from Calendly [a Zoom Scheduler booking page: one centred card with an info panel, a month calendar and that day's times]. The scheduling portion is smaller and right in the center. It's obvious what you do and what you click to go to the next page. We need to shrink the grid down a bit, centralize it, get rid of the additional noise." | New versions C and D: applicant states as a squeeze page (logo only, no site nav or footer), one centred card. C: info panel, month calendar, the day's times as multi-select buttons. D: info panel and a compact paint grid. Both: a card-footer Send. A and B stay until Robert confirms what only they had can go. | resolved: squeeze page chosen; A and B removed with his yes |
| herdr, 2026-10-15 (Robert, session 3) | Plan for C and D | Asked: (1) go ahead with C and D as described? (2) keep "send several times, an officer books one" or switch to booking one time instantly like Calendly? | "1. Yes 2. Several times." Build C and D as planned; the applicant still picks several times and an officer books one (the approved flow in #340). | answered |
| herdr, 2026-10-16 (Robert) | C, day times | "Can we try version C but with 60 minute increments, not 30 minutes? That might make it cleaner. Right now, it's a bit too busy." | New version E: C with hour buttons; each saves both half-hour starts, so SYNC-SPEC and the bot are unchanged. C kept for comparison. | resolved: E chosen, then reworked as F |
| herdr, 2026-10-16 (Robert, session 4) | E, the day's picker | "I just don't know that it's obvious enough that a user needs to pick all available times since this UX looks like "Let me pick one availability time." And I certainly wouldn't want to accept any submissions with less than 5 1-hour slots selected. Maybe when they choose a day, it gives them the calendar painter instead of blocks. But fit within the existing design." | Asked 4 questions; answers "1. Sure. 2. Always needs 5 at least. 3. Yes. 4. Yes." New version F (E with a one-day paint column; at least 5 hours on 2 or more guild days to send or update; the footer says what's missing; new state `pick-short`). Details in brief.md, Version F. | resolved: F built and approved |
| herdr, 2026-10-16 (Robert) | F, painter and footer | "There needs to be a clear all button that wipes out all times. We also need to show the full day, not just the times that we're available in. They can be darkened out like before, but they need to be there, otherwise the time jump is jarring and could be missed." | F's column shows all 24 hours with non-interview hours hatched (A's cell and legend); a footer **Clear all** with a confirm. Details in brief.md, Version F. Verified offline at both widths; round-5 critique PASS. | resolved |
| cmt_03ed3c1d (Open Design, Robert) | F, `p.iv-lede` (picker intro) | "Copy change: "Mark your availability for a 15-20 minute interview with an officer. Choose all times that you're available to make scheduling easier."" | The picker lede (new and Send-error states) now reads "Mark your availability for a 15–20 minute interview with an officer. Choose all times that you're available to make scheduling easier." (en dash, as elsewhere on the site). The minimum stays in the footer from the start ("Nothing picked yet · pick at least 5 hours on 2 or more days"). Checked in the approved captures. | resolved |

## Experiment
None.

## Open items
None affecting the approved scope. For the build (#344): the server enforces the same
minimum (5 hours on 2 or more guild days) when times are sent or updated.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
