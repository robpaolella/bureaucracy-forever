# Member availability

Members paint the half-hours when they can raid, choose whether each is available or only
available if needed, and have the saved week shown again after a reload.

## Sub-features

- `availability-grid`: desktop paint mode and the weekly half-hour grid at
  `/members/availability`.
- `availability-mobile`: phone day list and the fixed save control.
- `availability-save`: autosave/manual save status and persistent saved week.
- `availability-timezone`: saved-zone mismatch prompt and guild-time offset display.

## How to get to it (user POV)

- Sign in, open the `Members` menu, then select `Availability` for
  `/members/availability`.
- On desktop, choose `Available` or `If needed`, then drag in the weekly grid to paint a
  run; painted time shows as labelled blocks. Hover a block for its edge handles, click it
  to select (teal outline, × to remove), drag a handle to resize. Select a day heading for
  the keyboard-friendly day list.
- On a phone, one day shows at a time as blocks: tap a half-hour to paint it, hold then
  drag to paint a run, tap a block to select it (teal outline, handles, × to remove) and
  drag a handle to resize; swipe or use the chevrons for another day. The day switcher's
  centre opens the keyboard-friendly list. Use the fixed bottom `Save` control when
  reassurance is needed.

## Driving it with chrome-devtools-axi

Preconditions: Launch and Doctor PASS; set `BASE` and the isolated browser session as in
`../SKILL.md`. Use the seeded `member` state, never the row-less `member-unsubmitted`
state. Seeded availability already contains blocks, so pick an unpainted half-hour and
record the block label it produces.

- **Enter.** `open "$BASE/dev/session?as=member&back=/members/availability"`; resize to
  `1440 900`, then `snapshot`. Expect `When can you raid?`, the `Paint` radio group,
  `YOUR TIME`, `GUILD TIME`, the `Weekly availability` grid and `Save`.
- **Paint.** With `Available` selected, click an unpainted half-hour in a day column
  (the `Weekly availability` group holds one list per day). Snapshot after: a new
  `Available, <Day> <start> to <end>` block label appears, the count rises, and
  `Unsaved changes` shows before saving begins.
- **Drag, hover, resize.** `click` cannot drag or hover. chrome-devtools-axi has no raw
  pointer moves, so use trusted mouse input (Puppeteer `page.mouse` against this run's
  localhost page) for drag-painting, hovering a block, dragging its `data-edge` handles
  and clicking its ×. Use a viewport tall enough to reach the whole grid (about 1440×1400);
  a pointer below the viewport does nothing. Never change state with page JavaScript.
- **Prove persistence.** Wait slightly longer than the two-second autosave, then snapshot.
  Expect `Last saved…` rather than `Unsaved changes`. `open "$BASE/members/availability"`
  and snapshot again; the same block labels must remain. This reload is the required
  read-back, not the status text alone.
- **Phone path.** `resize 390 844`, snapshot, and use a visible day button such as
  `Saturday …: set hours from a list` to open its dialog. Record the list controls; do
  not needlessly overwrite the desktop proof slot. Close the dialog before the screenshot.
- **Phone touch.** chrome-devtools-axi cannot send touch, so use Puppeteer's
  `page.touchscreen` (viewport 390×844 with `hasTouch`) against this run's localhost page
  for tap-to-paint, hold (over 300ms) then drag, tap-to-select, handle drags and swipes.
  Load the page at 390 wide: a page loaded at desktop width and then narrowed opens the
  day column at 12:00 AM rather than 5:00 PM. Keep taps clear of the fixed save bar, and
  re-centre the column after a full-page screenshot, which can move the page.
- **Proof.** Save before/after/reload snapshots. Capture the saved page at `1440 × 900`
  and `390 × 844`, then record the painted label, chosen mode and saved/reload result in
  the evidence notes.

## Gotchas

- A timezone prompt can appear when the browser's detected zone differs from seeded
  availability. Keep the saved zone during this proof unless timezone migration itself is
  under test.
- Blocks and their handles are pointer targets, not Tab stops; the day-heading dialog is
  the accessible keyboard alternative. Use real `click` actions, never JavaScript to modify
  availability.
- Autosave is debounced. If it remains unsaved after the wait, select `Save` and capture
  the result; if saving fails, record the error and stop rather than retrying against a
  different database.
- Guild labels are relative to `GUILD_TIMEZONE`; record labels as displayed rather than
  converting them with the worker's local clock.
