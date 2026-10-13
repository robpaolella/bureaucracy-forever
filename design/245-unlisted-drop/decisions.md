# Design decisions: record an unlisted drop from the loot log (revision 2)

- Design issue: #245; covered build issues: #98, #243
- Revision: 2; replaces: `design/239-unlisted-drop/` (revision 1, design issue #239, merged in PR #240 on 2026-10-12)
- Maker: claude-bridge/claude-opus-5-5 (design session for #239/#245, 2026-10-12)

## Why this revision
Coverage only. After Robert approved revision 1, #98 was split by the size rule: #98 kept
the server half (lookup, add-and-record, migration) and the loot log screen became #243.
A build counts as designed only when a merged record's `covers` lists it, so #243 needed a
revision. Revision 1 stays untouched; approved records are never rewritten in place.

## What changed from revision 1
- `design.json`: `design_issue` 245, `covers` [98, 243], `revision` 2. States, themes and the
  approved version are the same.
- `brief.md`: header, the Covers table (which issue builds which half) and Open decisions,
  which revision 1 left saying A versus B was open although Robert had chosen A. Everything
  else, including the States wording table, is revision 1's text.
- `index.html` and `screenshots/approved/` are byte-identical copies of revision 1.

## Choice and approval
Chosen: **A**, unchanged from revision 1. Robert's picks, confirmation and the dropped
version B are recorded in [revision 1's decisions](../239-unlisted-drop/decisions.md), with
B's screenshots in [revision 1's `screenshots/all/`](../239-unlisted-drop/screenshots/all/).

Robert's approval of this revision (conductor chat, 2026-10-12), answering question 36,
whose recommended option (a) read: "the design tab makes a tiny design PR that adds #243 to
the list and changes nothing else": **"36. A"**. Only Robert merging this PR approves it for
building.

## Alternatives
None new. See revision 1.

## Independent critique
Not repeated: the design is unchanged, so revision 1's critique (GPT-5.6 Terra, PASS)
stands. The PR gets the usual independent review.

## Comments and changes
None.

## Experiment
None.

## Open items
None.

## Build handoff
This merged folder/revision is the feature authority for #98 and #243; DESIGN.md and the
live site govern the site-wide look. Reconcile both issues in prep before marking ready.
