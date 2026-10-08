# Design decisions: load a whole loot table

- Design issue: #203; covered build issues: #101, #125, #126
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (thinking low)

## Choice and approval
Version A, the "Load table" window, chosen for matching the site's Reserves and Edit boss windows and
keeping the Load button in view on phones. One decision varied between the versions (Robert, #1):

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 1 | Where the flow lives | a: window over the page; b: panel above the table | **A**, "I like version A." (Robert, this tab, 2026-10-07) |

Every other decision was settled in the interview and is identical in both versions (brief.md,
Confirmed decisions 2–8). Robert's confirmation: "Approved." (this tab, 2026-10-07), after
"10. Drop B, let's go with A." This authorises the design PR; only Robert merging it approves
the design for building.

## Alternatives
| Version | What differs / why rejected or chosen | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| a | Window over the page (wide Modal; bottom sheet on phones). Chosen: matches the Reserves and Edit boss windows; the Load button stays in view on phones. | — | — | [All-version manifest](screenshots/all/manifest.json), `a-*.png` |
| b | Panel above the table. Dropped. | The preview at full page width (three item columns on desktop) with the table still visible below; the Load table button highlighted while the panel is open; "Keep this page open" during fetching. | "10. Drop B, let's go with A." (Robert, this tab, 2026-10-07) | [All-version manifest](screenshots/all/manifest.json), `b-*.png` |

All-version captures (68 images: 2 versions × 17 states × 1 theme × 2 widths) were completed and spot-checked
before `versions/b.html` was removed; every state had been inspected in earlier rounds.
Approved evidence: [manifest](screenshots/approved/manifest.json), 34 images (17 states × default ×
390 and 1440), inspected. `index.html` re-checked with network Offline (state preview-replace: window
open, 127/127 images and 6 fonts loaded, only `file:` and `data:` requests). Known capture
limits: toasts are fixed to the bottom of the screen, so in tall full-page captures (loaded) they
sit mid-page, and on phones the toast covers the window's footnote line, as the site's toasts do.
The host snapshot (`host.html`) was removed after the offline proof; its live and offline captures
are kept in `/tmp/verify-guild-uZ0DbL`.

## Independent critique
- Maker: claude-bridge/claude-opus-5-5. Reviewer: routed checker `openai/gpt-5.6-terra`, thinking
  medium (its first reply named itself "OpenAI GPT-5.2", its re-check `gpt-5.6-terra`). Command:
  `node /git/maestro/scripts/read-only-run.ts <worktree> review /git/maestro/skills/design-feature/reviewer-prompt.md "Design: <folder>. Images and manifest: <evidence>/versions. Maker: claude-bridge/claude-opus-5-5." -- --model openai/gpt-5.6-terra --thinking medium`
  (2026-10-07). Evidence: `/tmp/design-review-69daIF/versions` (68 images after fixes), verdicts `critique-1.txt`, `critique-2.txt`.
- First verdict: FIXES (64 images, all inspected).
  1. Brief said 104 items, versions show 101. Fixed: brief uses the prototype's numbers and exact wording.
  2. No "no file chosen / Preview disabled" state. Fixed: added `source-empty`; the flow opens with no file.
  3. Preview stayed enabled on a broken file or missing raid. Fixed: disabled until the file or raid changes.
- Fixes-only re-check: PASS on all three. Reviewer's accepted trade-offs: A's capped phone sheet keeps
  the confirm visible; B's phone preview is very long, a valid alternative for Robert to judge.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| cmt_310a3b56 (pin 1) | a.html, add boss checkbox label "Trash (drops from trash, not a boss)" | Just change this to say "Trash drops" | Label reads "Trash drops" in both versions (existing add boss form; the Edit boss window shares the same label, so the build changes both). Checked in Open Design after sync. | 2026-10-07 |
| herdr, Robert | Version A window | Can't comment on the window: choosing the comment tool closes it | Inside Open Design's preview frame the window now opens non-modally over a scrim (a modal window makes the page inert, which blocks the comment tool); Escape and the close button still close it. Prototype aid only; the built window stays a normal modal. Verified: comment box opened on an element inside the window, window stayed open. Follow-up (Robert: it still closed when he pressed Comment): choosing a state from the prototype bar reloaded the page, and Open Design then reset the preview when Comment was turned on. The bar now switches states in place and leaves the frame's address alone inside Open Design. Verified in Open Design: bar → "Preview: replace", Comment on, window still open, comment box opened on its summary line. | 2026-10-07 |

## Experiment
None.

## Open items
None affecting the approved scope. Outside it: backlog line on long item names making the loot
table scroll sideways on phones (seen while building this prototype).

Prototype-only aids (not part of the design): the purple state bar; inside Open Design the window
opens without locking the page so comments work; while the window is open the page behind is held
to one screen so full-page captures show it. The built window is the site's normal wide Modal.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
