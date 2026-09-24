# 05 — Availability

The feature the site exists for. Two views over the same data.

Artboards: `reference/Availability-Member.html`, `reference/Availability-Officer.html`.
Both are templated and won't render standalone — this document is the spec, and the logic
block at the bottom of each file is working reference code for the grid maths.

---

## Shared model

The week is **7 days × 48 half-hour slots**, slot 0 = 00:00, slot 47 = 23:30.

Slots are stored **in the member's own local time** along with the timezone they painted in,
not in server time. Storing local and converting on read is what keeps a DST change from
silently shifting someone's whole week.

```ts
type SlotState = 'available' | 'if-needed';          // absence of a key = not available
type Week = Record<`${DayIndex}:${SlotIndex}`, SlotState>;
```

Day 0 is Monday. Availability is a recurring weekly pattern, not dated — the week label on
the grid is the upcoming week, but the data repeats until the member changes it.

---

## Member view — `/members/availability`

### Layout

Page head with a save control on the right, a controls row, the grid, a legend row.

**Save control** — a status dot and label beside a primary "Save" button. Clean state:
`ok` dot, "Last saved 4 minutes ago". Dirty state: `warn` dot, "Unsaved changes". Saving:
the button goes to its loading state. The label is relative time and re-renders on a 30s
interval. Autosave 2s after the last paint as well — the button is reassurance, not the
only path.

**Controls row, left** — a `label`-token "Paint" caption then three 44px toggle buttons,
each with a 14px color chip: Available (`--slot-available`), If needed
(`--slot-if-needed`), Erase (empty with a `line-strong` border). The active one gets
`teal-wash` fill and a `teal` border. Then a divider and a ghost "Clear week".

**Controls row, right** — the dual-time block: "Your time / America/Los_Angeles · PDT
*detected*" in teal, and "Server / CDT · 2 hours ahead" in sand.

### The grid

A bordered `ink-900` block, radius `card`, `overflow: hidden`.

- **Header row**, 46px, `ink-850`: a 92px "Yours" cell in teal `label` type, seven day
  columns each showing the day name (13px/600) over the date (11px/`fg-3`), and a 92px
  "Server" cell in sand, right-aligned.
- **48 body rows**, 19px each. Left: local time, shown only on the hour, 10px tabular.
  Middle: seven cells. Right: server time, same rule, right-aligned. On-the-hour rows use a
  `line-faint` bottom border; half-hour rows use `#0D1117` — that alone gives the hour
  banding, no extra rule needed.
- **Cells are real `<button>` elements**, not divs, each with an `aria-label` of
  "Tue 8:30 PM". They are the one exception to the 44px rule; keyboard users get the
  alternative below.

### Painting

`onMouseDown` sets `painting: true` and applies the current mode to that cell.
`onMouseEnter` applies it while `painting` is true. A `mouseup` listener on `window`
(registered in an effect, removed on unmount) ends the stroke — a listener on the grid
misses the release when the pointer leaves it mid-drag.

`user-select: none` on the grid container, or a drag selects the time labels.

Touch: `touchmove` with `document.elementFromPoint` to find the cell under the finger, and
`touchAction: 'none'` on the grid. On mobile this is a single-day column, so the gesture is
vertical only — see below.

**Keyboard alternative, required:** each day column header is a button that opens a
44px-row list of that day's hours with Available / If needed / Off radios. Nobody should
have to drag to use this page.

### Legend row

Below the grid: the two fills with live counts ("Available — 41 half-hours"), the empty
swatch, and a right-aligned note: "Bronze rows on the left mark the top of each hour. Only
officers see who painted what."

### Mobile — one day at a time

- A day switcher pinned under the header: left chevron, the day name and date, right
  chevron, all 44px. Beneath it, seven 6px dots showing position in the week; a dot is
  `teal` if that day has any painted slots, `line-strong` if empty.
- Swipe left and right moves between days, with the days wrapping (Sunday → Monday).
  Chevrons do the same thing — never gesture-only.
- One column of 48 rows at 34px each, in a scroll region about 520px tall, opened scrolled
  to 17:00 local. Time labels on the left (local) and right (server), on the hour.
- Paint mode is a three-up segmented control above the grid, full width.
- Tap paints one cell; press-and-drag vertically paints a run.
- The save bar pins to the bottom of the viewport: status label left, "Save" right.

---

## Officer view — `/officers/availability`

Same grid geometry, different cell meaning, plus a right-hand panel.

### Head

Title and a one-line explanation, then two things on the right: a "Submitted 32 of 41" stat
block, and a secondary "Nudge the rest in Discord" button that DMs the non-submitters
through the bot.

### Heatmap

Identical 7 × 48 grid at 17px rows and a 72px time gutter. Each cell is filled from the
count of members available in that slot, using the six-step ramp in `tokens.css`:

```
0 → --heat-0     1–8 → --heat-1     9–16 → --heat-2
17–24 → --heat-3   25–32 → --heat-4   33+ → --heat-5
```

The ramp is single-hue and sequential on purpose — a rainbow scale would imply categories
where there's only more and less. A legend sits above the grid: "0", six swatches, "41
available".

**"If needed" counts as half.** A slot with 20 available and 8 if-needed reads as 24.
Show the split in the tooltip.

Cells are buttons with `cursor: default` and an `aria-label` carrying the count, so the
information is reachable without a pointer.

### Hover inspector

`onMouseEnter` on a cell sets `{day, slot}`; `onMouseLeave` on the grid container clears it.
A 260px popover renders absolutely inside the grid, offset from the hovered cell and
flipping to the left of the column once the column index passes the midpoint so it never
runs off the edge. Contents:

- The slot in the viewer's local time, with the server time beneath in `fg-3`
- The count as a 28px teal tabular figure and "of 41 available"
- A 2×2 grid of role counts: Tanks, Healers, Melee, Ranged
- A divider, then the available members' names in their class colors, wrapping, capped at
  about 12 with "+N more"

`pointer-events: none` on the popover so it never eats the hover it depends on.

### Find raid windows

An accolade-bordered panel beside the grid.

**Inputs** — raid length as three 44px buttons (2h / 3h / 4h, i.e. 4 / 6 / 8 slots), then a
2×2 grid of number inputs: min tanks, healers, melee, ranged. Defaults 2 / 8 / 9 / 11.
Results recompute on change — there is no "search" button.

**Algorithm** — for every `(day, startSlot)` where `startSlot + length ≤ 48`, take the
**minimum** of each role count across all slots in the window. The window qualifies if every
minimum meets its threshold. Score it by the minimum total across the window, so a window
that dips in the middle ranks below one that holds. Sort by score descending, then day, then
start. Show at most one window per day so the list isn't five overlapping versions of
Tuesday, and cap at five results. The artboard's logic block implements exactly this.

**Result rows** — the window in local time as the title ("Tue 6:00 PM – 9:00 PM"), the
server range beneath in `fg-3`, and on the right the guaranteed total in `ok` with the role
minima beneath as "2T · 8H · 9M · 11R".

Clicking a result should prefill the "Schedule a raid" form with that day and time. The
panel header shows the full count ("23 found") even though only five render.

**No results** — the inline message from `docs/03`, inside the panel. Never an empty list.

### Hasn't submitted

A card below the panel: a heading with a `warn` count pill, then rows of character name in
class color and class · role in `fg-3`, five shown, then a "Show all nine" button. This is
the list the nudge button acts on.

### Mobile

The officer view is desktop-first and honestly so — a 7×48 heatmap with hover is not a phone
interaction. On mobile, show the window finder and the hasn't-submitted card full width, and
replace the heatmap with a per-day summary: seven rows, each with the day, a sparkline-style
strip of 48 heat blocks at 4px wide, and the day's peak count. Tapping a row opens that day
as a single column with tap-to-inspect instead of hover.
