# Design decisions: raid page sign-ups

- Design issue: #559; covered build issues: #561, #562, #563, #564, #567
- Revision: 1; replaces: none
- Maker: anthropic/claude-opus-5-5 (Pi provider claude-bridge)

## Choice and approval
Robert picked per decision on 2026-11-24 in the design-559 herdr tab ("1. Version B
2. Version B 3. Version A 4. Version B"). The picks come from both versions, so they are
combined in version c ("Version c · Robert’s picks"); it adds no behaviour that a or b
lacked, so the critique is not repeated for it.

**Chosen: version c, now `index.html`.** Robert, 2026-11-25 in the design-559 tab, after being
told what dropping a and b loses: "Approved. Build it." Reason: it is his pick on each of the
four decisions.

| # | Decision | Options (version) | Robert's pick and why |
| --- | --- | --- | --- |
| 1 | How No response and Absent show when opened | a: full roster-style rows with Answer, Via and Updated (Absent faded, reason under the name); b: compact two-column name list (avatar, name, "Character · Class", reason under; with the switch on, the answer select sits under each name) | b (2026-11-24) |
| 2 | Where the Manage sign-ups switch sits | a: its own strip at the top of the officer actions card, hint "Shows answer controls on each row and the bench."; phone: a switch row under the Officer actions button, outside the sheet; b: at the right end of the button row; phone: inside the sheet, button reads "Officer actions · Managing sign-ups" while on | b (2026-11-24) |
| 3 | How the character question lists characters | a: radio cards (avatar, class-coloured name, "Warrior · Protection · Tank · Level 60", Main tag); b: a select ("Redtape Quill (main)") with a summary card of the chosen character | a (2026-11-24) |
| 4 | How "Sign up with" is set in Manage characters | a: a select at the top, hint "Used when you accept or go tentative on a raid. You can still change the character on each raid."; b: a radio column in the character list, "Ask me each time" first | b (2026-11-24) |

Robert's exact confirmation authorizing the PR: "Approved. Build it." (2026-11-25, design-559 tab). Design PR: the
linked PR on the design issue once created. Only Robert merging that PR approves it for
building; chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
| Version | What differs / why rejected or chosen | Only this version had (lost) | Robert's OK to drop | Evidence |
| --- | --- | --- | --- | --- |
| a | Rejected on decisions 1, 2 and 4 | Full rows in the opened No response and Absent lists; the switch's own strip at the top of the officer actions card, with the phone switch outside the sheet; the "Sign up with" select | "Approved. Build it." (2026-11-25), replying to the message listing these losses | [manifest](screenshots/all/manifest.json), `screenshots/all/a-*` |
| b | Rejected on decision 3 | The character select with a summary card in the character question | Same reply | [manifest](screenshots/all/manifest.json), `screenshots/all/b-*` |
| c | Chosen: Robert's four picks | n/a | n/a | `screenshots/all/c-*`, identical to `screenshots/approved/` |

A version is removed, replaced or left out at freeze only after Robert confirms what it
alone had can go.

All-version captures (150 images: 3 versions × 25 states × 1 theme × 390 and 1440) were taken
and inspected as contact sheets before `versions/` was removed: `screenshots/all/`.
Approved evidence: [manifest](screenshots/approved/manifest.json), 50 images (25 states × 2
widths), pixel-identical (ImageMagick AE 0) to `screenshots/all/c-*`.
Offline proof: brief.md, "Offline proof of the versions"; then `index.html` itself on
2026-11-25, offline session `d559-offline`: switch on (17 selects), member Accept → Grimbo Ash →
"Sign up anyway" → toast, focus back on Accept; phone sheet → switch → Escape, focus back on
"Officer actions · Managing sign-ups"; no http or ws requests. The host snapshots (`hosts/`)
were removed after that proof; their capture record stays in brief.md.

## Independent critique
- Maker anthropic/claude-opus-5-5; reviewer GPT-5.6 Terra (openai/gpt-5.6-terra, thinking
  medium), routed by `node /git/maestro/routing/route.ts role checker --maker claude-bridge/claude-opus-5-5`.
- Command: `node /git/maestro/scripts/read-only-run.ts "$PWD" review /git/maestro/skills/design-feature/reviewer-prompt.md "Design: <folder>. Images and manifest: /tmp/design-review-ecA3Lr/versions. Maker: anthropic/claude-opus-5-5 …" -- --model openai/gpt-5.6-terra --thinking medium`
  (exit 0, worktree unchanged), 2026-11-24. Evidence: 92 images, 2 versions × 23 states × 1 theme × 2 widths.
- Verdict: FIXES, 4 findings:
  1. Loading and no-permission states not accounted for. Fix: brief.md now marks both not
     applicable with the reason (existing `loading.tsx` skeletons and `useSignup` pending
     pattern; `lib/auth/gate.ts` unchanged; raid-member is the no-officer view).
  2. b's phone switch inside the sheet not shown. Fix: new state `raid-officer-sheet` in both
     versions (sheet open at 390; no sheet at 1440).
  3. No interaction proof for the versions. Fix: offline interaction record added to brief.md.
  4. decisions.md was a blank template. Fix: this record (pre-choice).
- What it found working: genuinely different alternatives, DESIGN.md look kept, the under-60
  wording and "Sign up anyway", every listed state represented, the phone row fix, sample data only.
- Fixes-only re-check, same reviewer and command with a fixes-only request, evidence
  `/tmp/design-review-15XRSs/versions` (96 images, 24 states), 2026-11-24: **PASS**, all four fixes resolved.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| herdr, design-559 tab, 2026-11-24 | All versions / bench card with Manage sign-ups on | "This \"Move to roster\" button is awkward and will look really weird if there are multiple people on the bench" (screenshot: answer select, source and button squeezed on one line, meta cut to "Nota Rill · S…", button wrapping alone) | Bench rows with the switch on are two lines: avatar, name and full meta (wrapping, not cut) beside a small "Move to roster" button, then the answer select and source lined up under the name. Bench with the switch off is unchanged. New state raid-max-manage (6 on the bench, switch on) shows several rows; checked at 390 and 1440 in a, b and c | Done 2026-11-24 |

## Experiment
None.

## Open items
None affecting the approved scope. Out of scope and unchanged on purpose: the bench card
still truncates its meta line at 390 in the member view.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
