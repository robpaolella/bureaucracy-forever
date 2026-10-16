# Design decisions: the applicant's interview page and the officer Interview card

- Design issue: #341; covered build issues: #344 (applicant page), #345 (officer card)
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (two sessions: `design-341`, then its successor), medium thinking

## Choice and approval
Not chosen yet. Versions A and B differ on three independent decisions, each asked as
its own numbered question:

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 1 | Grid days when interview hours cross the viewer's midnight | a: the viewer's own calendar dates (8 columns for an Eastern viewer); every row of the day shows, and hours outside interview hours are hatched; b: one column per guild day (interview day), with 28 rows of starts labelled in the viewer's time, and a teal "Next day" line where the viewer's date rolls over | pending |
| 2 | Time-zone control on the picker | a: the member editor's compact "Your time / Guild time" labels plus a "Change" link; b: the full `TimezoneBar` card from the Raiding page with "Use a different timezone" | pending |
| 3 | Officer Interview card | a: a compact card styled like Officer notes, with the pill beside the heading and times listed by day; b: definition rows like the answers list (Status / Where it stands / Their times), with times as chips | pending |

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

The prototypes approximate block editing (paint, select, ×). The build keeps the member
editor's existing resize handles and keyboard behaviour; the day list stays the
keyboard route.

## Alternatives
To be filled at freeze.

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

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |

## Experiment
None.

## Open items
The three version questions above.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
