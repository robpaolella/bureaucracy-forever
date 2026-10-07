# Design decisions: members' loot history

- Design issue: #167; covered build issues: #99, #100
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5, medium thinking

## Choice and approval
Chosen: **b2** with set 1's **a** raid list (decisions 13 and 15). The raid page shows members one complete
"Loot" list in recorded order (Item, Winner, Method · roll, Boss); the Loot history page groups everyone's
loot by raid and shows one character's loot as a flat table with the raid as a column.
Why: a complete list is what Robert wanted on the raid page; one character's history reads fastest as a table.
Robert's confirmation, herdr design-loot-history tab, 2026-10-06: "Approved." This authorizes the design PR.
Design PR: linked on design issue #167 once opened. Only Robert merging that PR approves the design for
building; chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
Set 1 evidence (all versions, captured before a and b were removed): [manifest](screenshots/all/set-1/manifest.json),
16 images (2 versions × 4 states × default × 390/1440).

Set 2 evidence (all versions, captured at approval before b1 was removed, with decision 15 applied):
[manifest](screenshots/all/set-2/manifest.json), 40 images (2 versions × 10 states × default × 390/1440).
Approved evidence: [manifest](screenshots/approved/manifest.json), 20 images (10 states × default ×
390/1440), inspected. `index.html` rechecked offline: a character link on the raid page opened that
character's flat history; network log file:/data: only. The editable host snapshot (`host.html`) was
removed after this final offline proof; `index.html` is self-contained.

Set 2 (2026-10-06): one decision varied, one character's layout (Robert, decision 9). Both carry set 1's b.

| Version | What differs | Outcome |
| --- | --- | --- |
| b1 | Grouped by raid in both Everyone and one character's view | Not chosen (decision 13) |
| b2 | Everyone grouped by raid; one character's view is a flat table with Raid + date as a column | **Chosen** (Robert, 2026-10-06: "B2") |

Both set 2 versions were updated to set 1's a raid list (decision 15) before final evidence. Version names
keep their b1/b2 labels from the round in which they were made.

Set 1 (2026-10-06): one decision varied, list layout (Robert, decision 3).

| Version | What differs | Outcome |
| --- | --- | --- |
| a | One flat list in recorded order; boss is a column (desktop) or the last item of the meta line (phone) | **Chosen** (decision 15, after seeing b inside set 2) |
| b | The same awards grouped under boss headings (count beside each, like the roster's role groups); no boss column | First chosen ("I like B."), then replaced by a: Robert wanted one complete list |

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
| herdr, Robert 2026-10-06 | b1/b2 raid page Loot section | "the Loot section at the bottom is showing per boss where I wanted a complete list, not grouped by boss" | Raid list switched to set 1's flat a layout with a Boss column, recorded order; lede "In the order officers record it."; checked offline at 1440 (recorded, live-failed) | 2026-10-06 |
| herdr, decision 12 | review evidence | "I accept your check." | Menu and filter-sheet evidence accepted on the maker's inspection | 2026-10-06 |

## Experiment
None.

## Open items
None affecting the approved scope. For the builds (re-prep):
- #99's paused branch `feat/99-member-raid-loot` (0eb6a93) differs from this design: per-award label/value
  grid instead of the table row, "Character no longer available" instead of the recorded name with
  "deleted", a different lede and refresh-failed wording, shown before the raid starts and to officers.
- #99 body: the section and link appear only once the raid has started, and not for officers (decisions 2, 5).
- #100 body: Raid filter means raid instance (decision 10); paging by whole raids with "Show older raids" (14).
- Prototype detail, not a decision: the prototype bar still names the version "B2".
Outside this design, in backlog.md: on phones the raid page roster already squeezes member
  names to one letter (live local page, `/tmp/verify-guild-AEZRbI/live-390.png`).

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
