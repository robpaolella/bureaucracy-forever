# Design decisions: bottom of the Recruitment and Raiding pages

- Design issue: #254; covered build issues: #255 (Recruitment), #256 (Raiding)
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (Opus 5.5)

## Choice and approval
Robert's picks combine three versions, so `versions/combined.html` (C's head box, A's Apply section, B's Raiding rows) was added. It reuses parts already in the critiqued versions and adds no new behaviour, so the critique was not repeated.

Chosen: `versions/combined.html`, now `index.html` (`design.json` versions: `approved`). Robert, 2026-10-13, in the design tab: "4. Approved." and, on dropping versions A, B and C after being told what only each had, "5. Drop them." This authorises preparing the design PR; only his merge approves it for building.

The versions differ on three independent decisions. Each is asked as its own question:

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| D1 | Recruitment "Right now" side box | A: keep it ("Right now", the reply line, "Jump to the form →"); B: drop it, heading takes the full width; C: it becomes an "Apply" box with the reply line and both Apply buttons | **C**, with the heading top-aligned to the box (pin 1). Robert, 2026-10-13: "I like option C." (recommendation was A) |
| D2 | Recruitment Apply section | A: one card, each Apply button with its line beside it, sign-in note, "What happens next" in a column on the right; questions in a teal strip below the card. B: "Apply" heading over two side-by-side cards (Raider, sand-framed; Social), sign-in note, then the three steps in a row with sand numerals, then the questions line. C: an open closing section like the home page's (no card), large "Apply", both buttons side by side with their lines underneath, steps on the right with large sand numerals, questions line along the bottom | **A**. Robert, 2026-10-13: "I like option A." |
| D3 | Raiding bottom section | A: three cards in a row (Attendance, Sign-ups, Loot); B: one card with three labelled rows (sand labels left, sentence right); C: an open band between hairlines, three columns with Cinzel eyebrow labels, no cards | **B**. Robert, 2026-10-13: "I also like option B." |

Design PR: linked on the design issue once created. Only Robert merging that PR approves
it for building.

## Alternatives
| Version | What differs | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| a | D1 keep, D2 one card, D3 three cards | The "Right now" label with "Jump to the form →"; the three Raiding cards in a row (its Apply card is kept) | "Drop them." 2026-10-13 | [manifest](screenshots/all/manifest.json), `a-*.png` |
| b | D1 drop, D2 two doors, D3 labelled rows | Full-width heading with no box; the two side-by-side Raider/Social cards (sand frame on Raider); the three steps in a row (its Raiding rows are kept) | "Drop them." 2026-10-13 | [manifest](screenshots/all/manifest.json), `b-*.png` |
| c | D1 Apply box, D2 closing section, D3 open band | The open closing section with no card (large "Apply", buttons side by side with lines underneath, large sand step numbers); the open band on Raiding (its head Apply box is kept) | "Drop them." 2026-10-13 | [manifest](screenshots/all/manifest.json), `c-*.png` |
| combined | D1 C, D2 A, D3 B | Chosen | n/a | [manifest](screenshots/all/manifest.json), `combined-*.png` |

All-version captures: 16 images (4 versions × 2 states × 1 theme × 2 widths) plus manifest in `screenshots/all/`, captured and inspected 2026-10-13 before `versions/` was removed.

Approved captures: 4 images (approved × 2 states × 1 theme × 2 widths) plus manifest in `screenshots/approved/`, all inspected 2026-10-13. `index.html` rechecked offline the same day (named browser session, network Offline): only the file and its embedded data loaded, fonts and images decoded, and the page switcher updated the URL and `data-state`.

## Independent critique
- 2026-10-13. Maker claude-bridge/claude-opus-5-5; reviewer OpenAI GPT-5.6 Terra (`openai/gpt-5.6-terra`, medium), routed by `node /git/maestro/routing/route.ts role checker`.
- Command: `node /git/maestro/scripts/read-only-run.ts <worktree> review /git/maestro/skills/design-feature/reviewer-prompt.md "Design: <folder>. Images and manifest: /tmp/design-review-9SUwvc/versions. Maker: claude-bridge/claude-opus-5-5. …" -- --model openai/gpt-5.6-terra --thinking medium`; exit 0, worktree unchanged.
- Evidence: 12 captures (3 versions × 2 states × 1 theme × 2 widths), `/tmp/design-review-9SUwvc/versions/manifest.json`, all inspected by the maker too.
- Verdict: **PASS**, no fixes. All six checklist items passed: brief, authority and alternatives, coverage, usability, prototype contract, safety and decisions. The reviewer judged A, B and C as genuinely different in both pages' composition. Its evidence limits: no fresh browser run, relying on the recorded offline proof and the code.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| cmt_e92e23a1 (Open Design pin 1) | c.html, head eyebrow "Recruitment" | "This and the following text is bumped down the page a bit because of the box on the right. I think it should be bumped back up to align with the top of the box." | From 1024px up, the head grid aligns to the top when the side box is the Apply box (C and combined), so the eyebrow lines up with the box's top edge. Phone layout unchanged (stacked). Checked c and combined at 390 and 1440 (`/tmp/design-review-9SUwvc/round2`). | Resolved 2026-10-13 after sync |

## Experiment
None.

## Open items
None affecting the approved scope.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.

