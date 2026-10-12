# Design decisions: record an unlisted drop from the loot log

- Design issue: #239; covered build issues: #98
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (session design-239, 2026-10-12)

## Choice and approval
Chosen version and why. When versions differed on more than one independent decision,
Robert's pick for each, asked as its own numbered question; the chosen version combines
them, even if no single version had all of them:

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 1 | Where the unlisted-drop entry lives | a: "Item not on the table…" choice in the Item list, fields inline in the loot log; b: "Item not on the table?" link opening its own window | **a** — "Let's just go with A. It's fine." (herdr, 2026-10-12) |

Chosen: **A**, the unlisted drop as a choice in the existing Item list, because it keeps
officers in the form they already know with no extra layer mid-raid.

Robert's confirmation (herdr, 2026-10-12): "1. Yes. 2. A is approved, yes." This authorizes
preparing the design PR. The design PR link is on #239 (`## Design PR`). Only Robert merging
that PR approves it for building; chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
| Version | What differs / why rejected or chosen | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| a | Chosen: entry is a choice in the Item list; fields inline in the loot log | n/a (kept as `index.html`) | n/a | [All-version manifest](screenshots/all/manifest.json), `screenshots/all/a-*` |
| b | Rejected: an extra layer mid-raid and a link officers must notice | Its own focused window; the "Item not on the table?" link under Item; a Cancel button that closes and clears; the save-failed message inside the window above its buttons | "1. Yes." (herdr, 2026-10-12, answering "OK to drop those?") | [All-version manifest](screenshots/all/manifest.json), `screenshots/all/b-*` |

A version is removed, replaced or left out at freeze only after Robert confirms what it
alone had can go.

All-version captures (48: 2 versions × 12 states × default × 390/1440) were completed and
inspected before pruning `versions/`. Approved evidence (24: 12 states × default × 390/1440):
[manifest](screenshots/approved/manifest.json), all inspected. Offline proof of `index.html`
(2026-10-12): fresh browser, network Offline, only `file:` and `data:` requests, 6/6 images,
6 fonts; typing 18205 in the link box switched to the on-table path with focus on Winner.
Capture limits are as listed under Independent critique. `host.html` was removed after the
final offline proof.

## Independent critique
- Maker: claude-bridge/claude-opus-5-5. Reviewer: openai/gpt-5.6-terra, thinking medium
  (routed by `node /git/maestro/routing/route.ts role checker --maker claude-bridge/claude-opus-5-5`).
- Command: `node /git/maestro/scripts/read-only-run.ts /git/bureaucracy-forever review
  /git/maestro/skills/design-feature/reviewer-prompt.md "Design: <folder>. Images and manifest:
  <evidence>/versions. Maker: claude-bridge/claude-opus-5-5. …" -- --model openai/gpt-5.6-terra --thinking medium`
- Round 1 (2026-10-12), evidence `/tmp/design-review-HdIQIX/versions` (48 images: 2 versions ×
  12 states × default × 390/1440, all opened by maker and reviewer): **PASS**, no required fixes.
- Maker's own inspection found two B problems the reviewer did not; fixed in one batch:
  1. B save-failed: the "Nothing was saved." toast, fixed to the screen bottom, covered the
     window's Add and record button. Now shown inside the window directly above its buttons,
     wording unchanged. A keeps the page toast.
  2. B at 390: the window title slid under the prototype bar because the bar's height wasn't
     re-measured after a resize. Prototype-only fix: re-measure on resize.
- Fixes-only re-check (2026-10-12), evidence `/tmp/design-review-8R6bZo/versions` (48 images):
  **PASS** on both fixes; A unchanged.
- Capture limits: full-page captures are tall (roster above the loot log); A's toasts show at
  the bottom of the first viewport; B's modal states capture the first viewport only, which
  holds the whole window; all icons reuse one captured icon.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| herdr 2026-10-12 | b / entry point | "How does someone initiate the modal from version B?" | Answered: the "Item not on the table?" link under Item; no change | n/a |
| herdr 2026-10-12 | scope | "Oh, this is only for items not currently on the table?" | Confirmed: on-table items keep today's flow; recording an unlisted drop adds it to that boss's table; no change | n/a |
| Open Design | all | none (checked 2026-10-12: "No open comments.") | n/a | n/a |

## Experiment
None.

## Open items
None affecting the approved scope. Preserve any deferred, out-of-scope questions explicitly.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
