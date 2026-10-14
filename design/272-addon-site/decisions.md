# Design decisions: the site's pieces for the loot add-on and helper

- Design issue: #272; covered build issues: #274, #275, #276, #280, #293 (added 2026-10-13 by the conductor after Robert's answer B on #289) (plus a not-yet-filed helper-download follow-up)
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (Opus 5.5), thinking medium; sessions design-272, design-272-2 and design-272-3

## Choice and approval
Chosen: **version A** (`index.html`). The versions differed on one decision (12, placement); 13–15 were the same in both. Robert's pick per decision:

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 12 | Raid page placement | a: bar in the Loot log, import in a window; b: own card above the Loot log, paste box always open, results in the card | **a**: "Yeah, I'm fine with A. It's cleaner." (herdr, 2026-10-14) |
| 13 | Instance number label and hint | same in both versions | Keep as drafted: "Sure." (2026-10-14) |
| 14 | Instance number validation | same in both versions | Keep as drafted: "Sure." (2026-10-14) |
| 15 | Templates list instance line | same in both versions | Keep as drafted: "Sure." (2026-10-14) |

Robert's confirmation (herdr, 2026-10-14), after reviewing version A with decisions 12–15 recorded: "A looks good." Version A is the approved choice.

Design PR: linked on the design issue under `## Design PR`. Only Robert merging that PR approves the design for building;
chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
| Version | What differs / why rejected or chosen | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| a | Chosen: calmer raid page; import only when needed | — | — | [All-version manifest](screenshots/all/manifest.json) |
| b | Rejected for placement (decision 12) | The always-open paste box on the raid page and the results shown inline in the card | Robert was told before choosing ("If you pick A, B's always-open paste box and in-card results go away") and answered "Yeah, I'm fine with A. It's cleaner." (2026-10-14) | [All-version manifest](screenshots/all/manifest.json) |

All-version captures (2026-10-14, `design.ts shots`): 92 images, 2 versions × 23 states × 1 theme × 390/1440, in `screenshots/all/` ([manifest](screenshots/all/manifest.json)); every image inspected before `versions/` was removed. No layout faults.
Approved captures: 48 images, 24 states × 1 theme × 390/1440, in `screenshots/approved/` ([manifest](screenshots/approved/manifest.json)), all inspected. They match the inspected version-A captures except: the spinner frame in `importing`; `import-results`, which now lists one refused award of each reason; and the new `key-save-failed` state. The last two came from the PR review's fixes after the freeze (below), so the all-version captures don't show them.
Offline proof of `index.html` (2026-10-14): fresh browser session `d272-offline-M3yerB`, network Offline, `file://` only. States log-marks, import-results, addon-page, key-revoke and template-error, and after the review fixes key-save-failed and import-results again (session `d272-offline2-M3yerB`): `data-state`/`data-theme` set, no broken images, no requests other than the file and `data:` assets, site fonts (Cinzel, Newsreader, Archivo) loaded. The only font "errors" are the site's own metric-fallback faces pointing at local Times New Roman, absent on the capture host; no asset is missing. Offline 390/1440 captures matched.
Capture limitation: full-page captures show a window's backdrop covering only the first screen's height, so content below looks undimmed; in a browser the fixed backdrop always covers the viewport.

## Independent critique
Maker claude-bridge/claude-opus-5-5; reviewer openai/gpt-5.6-terra, thinking medium (route.ts role checker).
Command: `node /git/maestro/scripts/read-only-run.ts "$PWD" review /git/maestro/skills/design-feature/reviewer-prompt.md "<design, images, maker>" -- --model openai/gpt-5.6-terra --thinking medium`.
Evidence `/tmp/design-review-VAO9OP/versions` (manifest; 80 images at the first review, 92 after the template states). Verdicts: `critique-{1,2,3}.txt` beside it.

Before the critique (maker's own inspection, 2026-10-13): the prototype opened every captured dialog (site menu, Void, reserves) instead of only its own; result rows wrapped counts on phones; version B showed two labels for the paste box and kept the pasted text after an import; the helper line sat outside its box; the key form stretched across desktop; Revoke wandered on phones; the key wrapped badly; A's failed-import toast sat under the window's backdrop. All fixed and recaptured.

1. FIXES (2026-10-13, 80 images): (1) copy-blocked didn't show the snapshot selected; (2) key-list times didn't show `LocalTime`'s treatment, and the brief claimed more than the captures showed. Fixed: the snapshot is focused and selected; key times use `LocalTime`'s look; brief documents its offline pre-zone fallback.
2. Re-check of 1–2 plus first review of the new #293 template states (92 images): 1 and 2 resolved; new (3) template-error used only the form's bottom error line, not the site's invalid-field treatment. Fixed: `Field`'s error pattern (red field, message in place of the hint); brief updated.
3. Fixes-only re-check of 3: **PASS** (2026-10-13). Final verdict PASS; the reviewer selects no version.

## PR review fixes (after freeze)
Review of the design PR branch (openai/gpt-5.6-terra, thinking medium, cross-company) found two gaps against the brief, both fixed in `index.html` before the PR:
1. Import results showed only the practice-award refusal; the brief names three reasons. Now Refused 3 (Recorded 6, total still 14), one row each: "Practice award: only the staging site takes these.", "For another raid.", "From the other site (staging).".
2. The brief's key save failure ("Nothing was saved. Try again.") had no state. Added `key-save-failed`: the typed name stays and the site's stop toast reads "Nothing was saved." / "Try again." `key-error` now covers only the missing name.
Both are wording and states Robert had already confirmed in the brief (decisions 4 and 5), not new choices.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| herdr, Robert 2026-10-14 | Import (both versions) | Is there a duplicate tracker, so an award the helper already sent isn't recorded again on import? | No design change: every add-on award carries its own ID, kept on the award, and the helper upload and paste import share one writer (#282), so repeats show as "Already there (nothing was doubled)". Hand-entered vs add-on duplicates are a follow-up in `backlog.md` (Robert: flag "another entry for <item> to <character> on this raid, is this a duplicate?"). | Answered |

No Open Design comments were left on this design (`design.ts comments`: none open, 2026-10-14).

## Experiment
None. No real-site experiment was needed. The build reuses no prototype code.

## Open items
None affecting the approved scope. Deferred, out of scope: live helper status on the raid page and the hand-entered duplicate flag (both in `backlog.md`); a build issue for the helper download part, to be filed once the helper has releases (decision 9); format and result names stay placeholders until the spec (#271) settles them.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
