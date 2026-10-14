# Design decisions: the site's pieces for the loot add-on and helper

- Design issue: #272; covered build issues: #274, #275, #276, #280, #293 (added 2026-10-13 by the conductor after Robert's answer B on #289) (plus a not-yet-filed helper-download follow-up)
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (Opus 5.5), thinking medium; sessions design-272 and design-272-2

## Choice and approval
Chosen version and why. When versions differed on more than one independent decision,
Robert's pick for each, asked as its own numbered question; the chosen version combines
them, even if no single version had all of them:

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 12 | Raid page placement | a: bar in the Loot log, import in a window; b: own card above the Loot log, paste box always open, results in the card | **a**: "Yeah, I'm fine with A. It's cleaner." (herdr, 2026-10-14) |
| 13 | Instance number label and hint | same in both versions | Keep as drafted: "Sure." (2026-10-14) |
| 14 | Instance number validation | same in both versions | Keep as drafted: "Sure." (2026-10-14) |
| 15 | Templates list instance line | same in both versions | Keep as drafted: "Sure." (2026-10-14) |

Robert's exact confirmation and date/reference authorizing the
PR. Design PR: use the linked PR on the design issue once created; the session adds
that link there after opening it. Only Robert merging that PR approves it for building;
chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
| Version | What differs / why rejected or chosen | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| a | Chosen: calmer raid page; import only when needed | — | — | [All-version manifest](screenshots/all/manifest.json) |
| b | Rejected for placement (decision 12) | The always-open paste box on the raid page and the results shown inline in the card | Robert was told before choosing ("If you pick A, B's always-open paste box and in-card results go away") and answered "Yeah, I'm fine with A. It's cleaner." (2026-10-14) | [All-version manifest](screenshots/all/manifest.json) |

A version is removed, replaced or left out at freeze only after Robert confirms what it
alone had can go.

All-version captures were completed and inspected before pruning versions/. Approved
state × theme × width evidence: [manifest](screenshots/approved/manifest.json).
Record actual counts, inspected image paths, offline proof and any capture limitations.

## Independent critique
Maker claude-bridge/claude-opus-5-5; reviewer openai/gpt-5.6-terra, thinking medium (route.ts role checker).
Command: `node /git/maestro/scripts/read-only-run.ts "$PWD" review /git/maestro/skills/design-feature/reviewer-prompt.md "<design, images, maker>" -- --model openai/gpt-5.6-terra --thinking medium`.
Evidence `/tmp/design-review-VAO9OP/versions` (manifest; 80 images at the first review, 92 after the template states). Verdicts: `critique-{1,2,3}.txt` beside it.

Before the critique (maker's own inspection, 2026-10-13): the prototype opened every captured dialog (site menu, Void, reserves) instead of only its own; result rows wrapped counts on phones; version B showed two labels for the paste box and kept the pasted text after an import; the helper line sat outside its box; the key form stretched across desktop; Revoke wandered on phones; the key wrapped badly; A's failed-import toast sat under the window's backdrop. All fixed and recaptured.

1. FIXES (2026-10-13, 80 images): (1) copy-blocked didn't show the snapshot selected; (2) key-list times didn't show `LocalTime`'s treatment, and the brief claimed more than the captures showed. Fixed: the snapshot is focused and selected; key times use `LocalTime`'s look; brief documents its offline pre-zone fallback.
2. Re-check of 1–2 plus first review of the new #293 template states (92 images): 1 and 2 resolved; new (3) template-error used only the form's bottom error line, not the site's invalid-field treatment. Fixed: `Field`'s error pattern (red field, message in place of the hint); brief updated.
3. Fixes-only re-check of 3: **PASS** (2026-10-13). Final verdict PASS; the reviewer selects no version.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| <Open Design ID or herdr reference> | <target> | <note> | <result> | <date/status> |

## Experiment
None, or Robert's permission, question, branch/preview, chosen behaviour, rejected
attempts, static-version updates and unmerged/closed experiment PR. Code reuse: forbidden
unless specific parts are explicitly authorized here. Keep the branch as a primary source.

## Open items
None affecting the approved scope. Preserve any deferred, out-of-scope questions explicitly.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
