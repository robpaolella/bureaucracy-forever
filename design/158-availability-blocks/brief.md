# Design: availability editor grouped time blocks

- Design issue: #158
- Revision: 1
- Replaces: none
- Source plan: build issue #157

## Job and audience
A guild member on Members → Availability paints the half-hours they can raid in a
recurring week, then comes back to adjust it. Officers plan raids from everyone's
painted weeks (PRODUCT.md: "Availability is a recurring weekly pattern").

Problem (Robert, 2026-10-06, after testing #151): "The boxes make it too difficult to see
where the time starts and ends. This will lead to confusion." Today every painted
half-hour is its own box. Success: a member can see at a glance where each stretch of
time starts and ends, and can stretch, shrink or remove it without repainting.

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #157 | Grouped blocks, range labels, edge handles, select-then-edit, × remove, paint modes reduced to Available / If needed, phone tap/select, keyboard route via the day list | Time labels and guild time (#147 / PR #151); storage format; officers' heatmap; the rest of the page |

## Boundaries and visual authority
DESIGN.md and the live site govern the look: `slot-available`, `slot-if-needed` and
`slot-empty` tokens, `line-*` grid rules, teal focus/selection, 120ms transitions.
Scope is the paint-mode bar and the grid only, at Robert's request ("We don't need the
full page mocked, just the blocks and selection tools"). Host components:
`components/availability/AvailabilityEditor.tsx`, `WeekGrid.tsx` (desktop),
`DayColumn.tsx` (phone), `DayListModal.tsx` (list route).

Must not change: the saved format (member-local half-hour slots per day), autosave and
Save, Clear week, the day list, phone one-day view with day switcher and swipe, the
grid's time gutters (PR #151 owns those labels).

New kinds of element for Robert's approval: the block (a grouped, labelled run), dot
grab handles, the × remove control on a selected block, the live range tag shown while
dragging.

## States, themes and content
One theme (`default`). Every state at 390×844 (one-day column) and 1440×900 (week grid).
Sample week only.

| State slug | Situation | Content | Actions / feedback |
| --- | --- | --- | --- |
| empty | First visit, nothing painted | No blocks; existing hint copy | Drag (desktop) or tap / hold-drag (phone) paints a new block |
| typical | Painted week, nothing selected | Several evening blocks in both colours; an Available block touching an If needed block (two blocks, thin gap); a single half-hour block (one line: range, then the state word) | — |
| hover | Desktop pointer over a block | Block brightens; dot handles appear top and bottom; resize cursor on them | Handles drag at once; click selects. Phone has no hover: renders as `typical` |
| selected | A block clicked (desktop) or tapped (phone) | Teal outline around the whole block, dot handles, × inside the top-right corner, range label | Drag a handle to resize; × removes; click/tap outside or Escape deselects |
| selected-short | A half-hour block selected (Thu 6:30 PM; phone shows Thursday) | One-line label, both handles and × fit without overlapping | As selected |
| dragging | Bottom handle mid-drag, Tue 11:00 → 11:30 PM over the If needed block below | Block grows in half-hour steps; live tag just above the dragged edge (clear of a thumb) reads the new range; the If needed block shrinks to 11:30 PM – 12:00 AM | Release commits; joining a same-colour block merges; crossing the other colour replaces it |
| all-day | Busy week, Monday's all-day block selected (phone shows Monday) | "All day"; handles at the grid's top and bottom sit inside the block | As selected |
| busy | Maximum content | A full-day block (reads "All day"), many half-hour blocks, blocks running to midnight | Labels never overflow; half-hour blocks use one line |

Not applicable here: loading, save error, no permission and roles. They are page-level and
unchanged (save status and toast; members-only route gate). Locked does not exist for
availability.

Keyboard: the day header (desktop) and the day switcher's centre (phone) open the day list,
which already creates, extends, shrinks and removes time. Blocks are not Tab stops. Each
block exposes its full range to screen readers ("Available, Tuesday 6:00 PM to 11:00 PM").

## Host snapshot and offline proof
Captured: `/members/availability` as `member`, sample seed via `npm run db:local`,
verify-guild Launch, Doctor, Editable offline page snapshot and Cleanup. Versions keep the
host's inlined styles and fonts but show only the paint bar and grid (Robert's scope).
The host is main, which still has the right-hand guild column; PR #151 removes it, so the
versions show only the left gutter. Gutters here are background, not authority: the build
keeps whatever #151 ships.

Draft wording. Desktop hint, a new line above the grid in the phone hint's style: "Drag
to paint a run of half-hours. Click a block to resize or remove it." Phone hint (replacing
today's): "Tap a half-hour to paint it, or tap a block
to resize or remove it. Hold, then drag, to paint a run. Swipe sideways for another day."
Ranges read "7:00 – 11:00 PM", "11:00 PM – 12:00 AM", "All day". Screen-reader label:
"Available, Tuesday 7:00 PM to 11:00 PM"; × reads "Remove available 7:00 – 11:00 PM".

Host evidence: commit 57ab872, `/members/availability` as `member` via
`/dev/session?as=member&back=/members/availability` (seeded Redtape, sample data),
verify-guild Launch/Doctor PASS, single-file export, localhost and Discord links replaced
with `#`, Cleanup PASS, offline 390/1440 proof with network Offline and only file/data
requests. Evidence: /tmp/verify-guild-9sxOOQ (not committed).

## Confirmed decisions
Robert, 2026-10-06, this session:
1. Range is printed inside each block, always visible (calendar style), with the state
   word (Labelled State Rule). While dragging, an instant tag beside the dragged edge shows
   the new range. Chosen over a hover-only tag. Every block, even a half-hour, has room for
   one line, so no hover tag is needed at rest.
2. Phone: tap a block to select it (finger-sized handles, range, ×). Tap empty paints one
   half-hour; hold then drag paints a run, as today.
3. Keyboard stays on the day list; blocks are not Tab stops.
4. Erase mode is removed. Paint modes are Available / If needed. Shrink by dragging an
   edge; remove with ×; switch colour by painting over in the other mode; Clear week stays.
   Cutting a gap out of the middle of a block takes shrink + repaint (accepted trade-off).
5. Desktop has two levels (Robert, refining the hover/click question): hover shows the
   dot handles, which can be dragged straight away; click selects the block (teal outline
   around the whole block, plus ×). Remove needs a click first, so a stray pointer can't
   delete time. Phone has no hover: tap selects (handles, outline, ×) in one step.

Shared rules: same-colour back-to-back half-hours form one rounded block with no internal
lines; different colours stay separate with a thin gap; minimum block is one half-hour; a
resize can't pass the block's other edge; dragging empty space paints a new block in the
chosen mode; painting over the same colour changes nothing.
While drag-painting a new run there is no separate tag: the new block appears at once
and its own label shows the live range. The tag is for resizing an edge only (as in the
approved prototype).

## Version question
Confirmed by Robert, 2026-10-06: where the start and end times sit in the block.
- a: one range line at the block's top ("6:00 – 11:00 PM").
- b: the start time at the top edge and the end time at the bottom edge.

## Real-site experiment
None.

## Open decisions
Brief confirmed by Robert, 2026-10-06 ("Brief looks good").
None. Desktop handle size exception (44×20) accepted by Robert, 2026-10-06 (decisions.md).
