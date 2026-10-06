# Design decisions: officer item reserve controls

- Design issue: #131; covered build issues: #123, #122
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5, medium thinking

## Choice and approval
Chosen: **b** (the only version, by decision 1): a "Reserves" button on each item row opens a window
with the "Open to reserves" switch and the win limit; a change applies to the item on every boss.
Robert's confirmation, herdr design-loot-blocks tab, 2026-10-05: "approved". This authorizes the design PR.
Design PR: linked on design issue #131 once opened. Only Robert merging that PR approves the design for
building; chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
One version only, by Robert's decision 1 (2026-10-05: "I don't need three versions though, I just
want that one design to check."). Versions A (controls in every row) and C (a separate per-tier list)
were proposed in round 1 and not built.

| Version | What differs / why rejected or chosen | Evidence |
| --- | --- | --- |
| b | Chosen: row button opens one window per item | [All-version manifest](screenshots/all/manifest.json), 26 images (13 states × default theme × 390 and 1440) |

All-version captures were completed and inspected before `versions/` was removed. Approved evidence:
[manifest](screenshots/approved/manifest.json), 30 images: 15 states × default theme × 390 and 1440,
inspected. The all-version set (26 images) was captured at Robert's approval, before decisions 16–18
added `block-failed` and `block-direct-stale` and the Retry action. Full-page phone captures make the window small; readable 390×844 viewport captures were
inspected during review (outside git). The rejected-in-review layouts (three columns, faded tags, the raise
confirmation) are described in Comments and changes, not kept as files.
`index.html` rechecked with the network Offline (opened the window, blocked Netherwind Crown through the
confirmation, toast and tag shown; no non-file/data requests). The editable host snapshot (`host.html`)
was removed after this final offline proof; `index.html` is self-contained.

## Independent critique
- Maker: claude-bridge/claude-opus-5-5 (Anthropic). Reviewer: openai/gpt-5.6-terra, medium thinking
  (route `role checker --maker claude-bridge/claude-opus-5-5`), 2026-10-05.
- Command: `node /git/maestro/scripts/read-only-run.ts <worktree> review /git/maestro/skills/design-feature/reviewer-prompt.md "<design folder, evidence, issues>" -- --model openai/gpt-5.6-terra --thinking medium`.
  Repo confirmed unchanged by both runs. Evidence: `/tmp/design-review-MSQZoN` (outside git).
- First verdict: **FIXES** (22 manifest images, 8 phone viewport captures, host captures inspected):
  1. Direct-save and unblock toasts not shown. **Fixed:** states `blocked-direct`, `limit-lowered`,
     `unblocked` added with their exact toasts.
  2. 15-holder scroll not proven. **Fixed:** offline phone captures before/after scrolling; body
     scrollHeight 823 vs 615 visible, title and both buttons stay on screen (`phone-viewport/many-scroll.txt`).
  3. Layout and wording added while building are Robert's decisions. **Escalated to Robert** (decisions 10–14);
     Robert approved all five recommendations (herdr, 2026-10-05: "just do it").
- Fixes-only re-check (same reviewer and model): **PASS** on 1 and 2 (28 images inspected); 3 resolved by Robert's answer.
- PR review (code review skill): claude-bridge/claude-sonnet-5-5, high thinking, a same-company exception approved by
  Robert for this PR (#15: "A", relayed by the conductor, 2026-10-05; OpenAI was unavailable). Verdict: no Blocking;
  Worth-fixing 1 (singular wording) fixed, 2–3 decided by Robert (16–18), 4 left for re-prep of #122/#123; nits fixed.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| PR review nits (Sonnet 5.5) | b / wording, backdrop, truncation | One holder read "1 reserves"; decision 7 still listed the withdrawn raise wording; backdrop behaviour unstated; truncation not shown | Singular "Block and remove 1 reserve" / "Removed 1 reserve."; brief decision 7 marked withdrawn; brief states a click outside closes the window (as the site's Modal); 1280 capture added under `screenshots/extra/`. | 2026-10-05 |
| herdr, decisions 16–18 (Robert: "just decide whatz best and do it") | b / failures and stale direct block | PR review Worth-fixing 2 and 3 | Failed saves show "Couldn't save that — try again." with **Retry**; a failed block keeps the confirmation open (new state `block-failed`); a direct block that finds new holders shows the stale confirmation (new state `block-direct-stale`, "Block and remove 1 reserve"). Verified offline. | 2026-10-05 |
| herdr, decisions 10–14 | b / layout and added wording | "just do it" | Recommendations accepted as recorded in brief.md. | 2026-10-05 |
| cmt_0034fb33 (pin 1) | b / raise confirmation title | "Don't ask for confirmation." | Raise confirmation removed (state `raise-confirm` dropped); "+" saves straight away with toast "Win limit N.", like "−". Amends decisions 2 and 12. Verified offline. | 2026-10-05, resolved |
| cmt_a536bc04 (pin 2) | b / item row with tags | Long tags push the Reserves button to a second row; maybe fade them; decide a good practice. | Rows never wrap from 768px up: at most one tag (a blocked item shows only "Not open to reserves"), shown whole; the name truncates instead; one item column from 768 to 1279px, two from 1280px. Fading was tried and rejected (it hid the limit number). Verified offline at 1024, 1280 and 1440: no wrapped rows. | 2026-10-05, resolved |

## Experiment
None.

## Open items
None affecting the approved scope. Outside it:
- The existing refresh button's ↻ renders as an empty box on the live page (font lacks the glyph);
  for the backlog once #132 (which edits backlog.md) merges; unchanged by this design.
- Toasts must render above the open window (native dialog top layer); a build detail for #123/#122.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
