# Design decisions: availability editor grouped time blocks

- Design issue: #158; covered build issues: #157
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5 (design session in Robert's herdr tab)

## Choice and approval
Robert chose **version A** (one range line at the top of each block), 2026-10-06, in this
herdr tab: "Version A approved." That permits preparing the design PR; only Robert's merge
approves it for building.

Polish after the choice, before freezing (no behaviour change): while inspecting the
final captures, a selected block's bottom dots covered the label of a block touching it.
The dots now sit centred on the edge (hit areas unchanged, still leaning outward) and
block labels start 3px lower (desktop 6px, phone 9px). Verified in every A capture and
re-run of the offline interaction checks.

## Alternatives
| Version | What differs / why rejected or chosen | Evidence |
| --- | --- | --- |
| a | **Chosen.** Times as one range line at the top of each block ("7:00 – 11:00 PM"), state word below. Reads like a calendar event; one place to look | [manifest](screenshots/all/manifest.json), `screenshots/all/a-*.png` |
| b | Rejected. Start time at the top edge, end time at the bottom edge, state word top-right. Ties each time to its edge, but tall blocks split the range far apart, and one-hour desktop blocks are cramped (see `b-busy-default-1440.png`, Fri 12:00 PM) | [manifest](screenshots/all/manifest.json), `screenshots/all/b-*.png` |

The one varied decision is where the times sit inside a block (Robert, 2026-10-06: "I'm
fine testing them against one another"). Everything else is shared (brief.md, Confirmed
decisions 1–5).

All-version capture: 32 images (2 versions × 8 states × 1 theme × 390/1440), every image
opened and inspected before `versions/` was removed. Approved capture: 16 images
(8 states × 1 theme × 2 widths), byte-identical to the `a-*` captures; full-page images,
so heights exceed the 844/900 viewports. `index.html` is a byte copy of `versions/a.html`;
rechecked offline (network Offline, markers `selected`/`default`, fonts loaded, paint and
select worked, no requests other than file:/data:).

Host snapshot: commit 57ab872, `/members/availability` as the seeded sample member via the
verify-guild recipe; offline-proven at 390/1440, then removed from the folder once the
final offline proof was retained (`index.html` carries its inlined styles and fonts).

Offline proof of the versions (2026-10-06): both versions opened from disk with network
Offline at 1440 and 390. On desktop, drag-paint, click to select, bottom-handle resize
(with live tag; over the other colour it replaces), and × remove all worked. On phone,
tap to select, top-handle resize and tap-to-paint worked. Only file:/data: requests.
Fixed during this check: resize lost the pointer after re-render; half-hour phone
blocks overlapped their two labels; a 24-hour block read "12:00 – 12:00 AM" (now "All day").

## Independent critique
Robert approved a same-company reviewer for this design only (2026-10-06, answer "7. A"):
OpenAI is switched out until Fri Oct 9.

Round 1 (2026-10-06): Claude Sonnet 5.5, thinking high, via
`node /git/maestro/scripts/read-only-run.ts "$PWD" review /git/maestro/skills/design-feature/reviewer-prompt.md "<design folder, evidence, maker>" -- --model claude-bridge/claude-sonnet-5-5 --thinking high`
(route: `route.ts role checker --maker claude-bridge/claude-opus-5-5 --approved-same-vendor`).
Evidence: 24 images + manifest in /tmp/design-review-34gVMs/versions. Verdict: **FIXES**, 8 items.

| # | Finding | Fix |
| --- | --- | --- |
| 1 | State word at 78% white on Available is 3.81:1; hover brightening drops text under 4.5:1 | State word full white (5.13:1); hover is a 1px inner white ring, no brightening |
| 2 | B: × covers the top-right state word | × sits inside the block's top-right corner; a selected block's label keeps clear of it |
| 3 | Half-hour block selection not shown; handle hit areas could overlap | Handle hit areas lean outward from their edge, so a half-hour block's two never overlap; new state `selected-short` |
| 4 | Controls at grid edges could clip (Sunday ×, midnight handles) | × inside the block; handles at 12:00 AM / midnight sit inside the block; new state `all-day` |
| 5 | Dragging state dragged the top edge, brief says bottom | Static state now drags the bottom edge 11:00 → 11:30 PM over the If needed block; tag sits just above the dragged edge (clear of a thumb) and, in B, replaces the end label it would cover |
| 6 | No phone evidence of All day or midnight | `all-day` shows Monday on phone; `selected-short` shows Thursday |
| 7 | Desktop × hit area ~32px; desktop handles 44×14 | × hit area 44×44. Handles 44×20: rows are 19px, so 44px tall handles would cover neighbouring rows. Asked Robert to accept this like the paint-cell exception (keyboard route via day list) |
| 8 | No desktop wording | Draft desktop hint above the grid, in the phone hint's style |

Re-check (2026-10-06, same model and command, fixes only): fixes 1–6 and 8 **pass**. Fix 7
remained: the × on a selected half-hour block was 40×40 (desktop) / 42×42 (phone), and the
handle exception wasn't recorded where Robert reads it. After the re-check, the half-hour ×
hit area was raised to 44×44 on both and the question was added to Open items and the brief.
The remaining handle-size exception is escalated to Robert (Open items 1), not re-reviewed
a third time. Reviewer non-blocking notes for the build: check a selected Sunday block's
ring at the grid edge; the dragged bottom handle briefly overlaps the next block's label;
test hold-then-drag on a real phone.

Also fixed after inspecting the new captures: on phone, a long block scrolled past its top
showed no times or ×; the top label and × now stay pinned in view while it scrolls.

## Comments and changes
| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| Open Design | — | No comments left | — | `comments` printed "No open comments." |
| herdr, Robert | Desktop hover/click | "on hover maybe the circles at the top and bottom just become visible, but then clicking on it makes the more clearly selected with an outline" | Hover shows handles (draggable); click adds teal outline and ×. In both versions | 2026-10-06 |
| herdr, Robert | Erase mode | "I don't love the 'Erase' feature… Can we do that?" | Erase removed; shrink by edge, remove by ×, recolour by painting over | 2026-10-06 |

## Experiment
None.

## Open items
None affecting the approved scope.

Resolved: desktop handles are 44px wide × 20px tall, under PRODUCT.md's 44px minimum,
because rows are 19px. Accepted as a pointer-only exception like the paint cells (keyboard
route: day list; phone handles 56×44). Robert, 2026-10-06: "8. I'm fine with whatever
here", given the recommendation to accept.

Build notes (non-blocking, from critique): check a selected Sunday block's ring at the
grid edge; test hold-then-drag on a real phone; DESIGN.md's "labelled guild/local time
gutters" line is already out of date via #151.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
