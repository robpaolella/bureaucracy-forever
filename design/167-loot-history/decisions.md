# Design decisions: members' loot history

- Design issue: #167; covered build issues: #99, #100
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5, medium thinking

## Choice and approval
Pending. Set 1 (raid page "Loot" list, #99) first; set 2 (history page, #100) after Robert
chooses set 1. Only Robert merging the design PR approves the design for building.

## Alternatives
Set 1 evidence (all versions, captured before a and b were removed): [manifest](screenshots/all/set-1/manifest.json),
16 images (2 versions × 4 states × default × 390/1440).

Set 2 (2026-10-06): one decision varied, one character's layout (Robert, decision 9). Both carry set 1's b.

| Version | What differs | Outcome |
| --- | --- | --- |
| b1 | Grouped by raid in both Everyone and one character's view | Pending |
| b2 | Everyone grouped by raid; one character's view is a flat table with Raid + date as a column | Pending |

Set 1 (2026-10-06): one decision varied, list layout (Robert, decision 3).

| Version | What differs | Outcome |
| --- | --- | --- |
| a | One flat list in recorded order; boss is a column (desktop) or the last item of the meta line (phone) | Not chosen (decision 8) |
| b | The same awards grouped under boss headings (count beside each, like the roster's role groups); no boss column | **Chosen for set 1** (Robert, 2026-10-06: "I like B.") |

## Independent critique
- Maker: claude-bridge/claude-opus-5-5 (Anthropic). Reviewer: openai/gpt-5.6-terra, medium thinking
  (route `role checker --maker claude-bridge/claude-opus-5-5`), 2026-10-06. Routing first returned
  no reviewer (OpenAI switched out); Robert said OpenAI is available again, so the vendor switch was
  set back to `on` (`route.ts vendor openai on`).
- Command: `node /git/maestro/scripts/read-only-run.ts <worktree> review /git/maestro/skills/design-feature/reviewer-prompt.md "<design folder, evidence, issues>" -- --model openai/gpt-5.6-terra --thinking medium`.
  Repo confirmed unchanged. Evidence: `/tmp/design-review-UKCNrZ` (outside git), verdict in `critique-1.txt`.
- Set 1 verdict: **FIXES**, 16 images inspected, all readable; checklist items 3–5 pass.
  1. Version b groups by boss, but #99 says "ordered by the order recorded". **Escalated to Robert**
     (decision 8): choosing b changes #99's rule to "grouped by boss in kill order, recorded order
     within each boss"; a keeps #99 as written.

- Set 2 verdict (same reviewer and model, `critique-2.txt`): **FIXES**, 32 images inspected, all readable.
  1. History dates didn't say they're guild dates (#100). **Fixed:** lede adds "Raid dates are in guild time."
  2. Open menu and phone filter sheet had no images. **Fixed:** states `history-menu` and `history-filters`.
- Fixes-only re-check (`critique-3.txt`): **1 PASS**; **2 still FIXES**: the helper resizes after load, so
  the prototype opened the control for the wrong width (closed menus at both widths, a sheet at 1440).
  The maker then made both states follow resizes and refreshed all 40 images; the maker inspected
  the eight affected captures (menu dropdown at 1440, phone menu at 390, sheet at 390 with Treaty,
  Molten Core, Clear filters and Done, desktop bar at 1440) and they show the open states. Per the
  one-re-check rule this was escalated to Robert rather than re-reviewed (decision 12).

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |

## Experiment
None.

## Open items
- Set 2 decisions (history page).
- Outside this design, for the backlog: on phones the raid page roster already squeezes member
  names to one letter (live local page, `/tmp/verify-guild-AEZRbI/live-390.png`).

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
