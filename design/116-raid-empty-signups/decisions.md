# Design decisions: Raid detail with no sign-ups yet

> **[TEST maestro#68]** Disposable record for the Maestro #68 dry run. "Robert" below is
> the parent session simulating him; no real approval is recorded here.

- Design issue: #116; covered build issues: #115
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5, thinking medium (route `design-feature`), in Pi herdr tab w2:t9

## Choice and approval
Chosen: **version A, “Summary says it”**, with the `cmt_5d37befb` wording correction.
Reason given: the main summary explains the zero-answer state without an alarming red number.
Confirmation (simulated Robert, parent Pi session, 2026-10-04, test only): “Simulated Robert
FINAL TEST-ONLY APPROVAL: approved version A, Summary says it, with the comment correction.
This authorizes preparation of the disposable test PR only, never merging or releasing a
real build.” Design PR link: pending. Only Robert merging that PR approves it for building;
chat approval, a critique PASS and a closed/unmerged PR do not. This test PR will be closed
unmerged, so this record never becomes build authority.

## Alternatives
| Version | What differs / why rejected or chosen | Evidence |
| --- | --- | --- |
| a | **Chosen.** Summary says it: the summary card replaces the big "0 accepted of 40 needed" figure with "No answers yet" and the body line; roster below. Explains the zero-answer state without an alarming red number. | [All-version manifest](screenshots/all/manifest.json); `screenshots/all/a-*.png` |
| b | Rejected. Roster says it: the existing EmptyState panel heads the roster column; the summary keeps the red "0 accepted of 40 needed". On phones the panel falls below the summary, Hasn't answered and Bench cards. | [All-version manifest](screenshots/all/manifest.json); `screenshots/all/b-*.png` |

All-version captures were completed and inspected before pruning `versions/`: 12 entries
(2 versions × 3 states × 1 theme × 2 widths), every image opened, all widths exact,
copied unchanged from the helper's external output. Approved state × theme × width
evidence: [manifest](screenshots/approved/manifest.json), 6 entries (3 states × 1 theme ×
2 widths), byte-identical to the inspected version A captures. `index.html` is the
chosen `versions/a.html`, unchanged, and was rechecked offline (network Offline, all three
states through its switcher, fonts/images loaded, no overflow, only `file:`/`data:`
requests). Limitations: the prototype bar is included in every capture; full-page phone
captures truncate member names exactly as the live page does today (pre-existing, out of
scope). This is prototype evidence, not the after-build design check: the build of #115
must still pass the shared design-check gate against this record.
## Independent critique
- Maker: claude-bridge/claude-opus-5-5 (Anthropic). Reviewer: openai/gpt-5.6-terra, thinking
  medium, from `route.ts role checker --maker claude-bridge/claude-opus-5-5` (exit 0).
- Launch: `node /git/maestro/scripts/read-only-run.ts <repo> review <maestro#68 worktree>/skills/design-feature/reviewer-prompt.md "<design folder, evidence paths, maker>" -- --model openai/gpt-5.6-terra --thinking medium`
  (exact command saved outside git with the evidence). Launcher reported the checkout unchanged.
- Evidence: 12-image manifest (2 versions × 3 states × 1 theme × 2 widths), host/offline
  snapshot captures, offline network log, cleanup output and offline prototype-controls log.
- First verdict (2026-10-04): **FIXES**, 1 item. 1) `index.html` and `screenshots/` missing
  from the design folder. Maker response, no file change: these are created only after
  Robert's choice (design-feature steps 5 and 8; AGENTS.md describes an approved design).
- Fixes-only re-check (2026-10-04): **PASS**. Fix 1 resolved as correctly deferred to step 8.
  Final verdict: PASS. The reviewer selected no alternative; it noted the trade-off that A
  avoids treating no replies as a failure, while B keeps the red zero metric beside a
  separate explanation.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| Open Design `cmt_5d37befb`, pin 1 (posted by the parent Pi acting as Robert for this test, via an API client; not real Robert) | `versions/a.html`, summary empty-state body (state `empty`) | “TEST maestro#68: Change the opening sentence to ‘No one has answered this raid yet.’ Keep the rest unchanged.” | Body now reads “No one has answered this raid yet. Answer here or in Discord before sign-ups lock.” in both versions (same shared copy) and in `brief.md`; “Nobody has answered yet.” in Hasn't answered is unchanged. Verified offline in `empty` and `empty-no-roster` at 390 and 1440 for A and B (new text present, old absent, no overflow); 12 refreshed captures with unchanged dimensions. Copy-only change; the PASS critique stands. | Resolved 2026-10-04 after sync |

## Experiment
None.

## Open items
None affecting the approved scope. Out of scope and pre-existing: on phones the live roster
truncates member names to a few letters (seen in the host capture).

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
