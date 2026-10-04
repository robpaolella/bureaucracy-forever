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
- On desktop, choose `Available`, `If needed` or `Erase`, then click/drag half-hours in
  the weekly grid. Select a day heading for the keyboard-friendly day list.
- On a phone, select a day and set hours from the list; use the fixed bottom `Save`
  control when reassurance is needed.

## Driving it with chrome-devtools-axi

Preconditions: Launch and Doctor PASS; set `BASE` and the isolated browser session as in
`../SKILL.md`. Use the seeded `member` state, never the row-less `member-unsubmitted`
state. Seeded availability may already contain painted cells, so select an unpainted
half-hour and record its visible label.

- **Enter.** `open "$BASE/dev/session?as=member&back=/members/availability"`; resize to
  `1440 900`, then `snapshot`. Expect `When can you raid?`, the `Paint` radio group,
  `YOUR TIME`, `GUILD TIME`, the `Weekly availability` grid and `Save`.
- **Paint.** With `Available` selected, click an unpainted `gridcell` from a fresh
  snapshot (use `Mon 12:00 AM` only if it is unpainted; otherwise record another label).
  Capture an after snapshot. Expect that cell to be selected with description
  `Available`, the count to increase, and `Unsaved changes` before saving begins.
- **Prove persistence.** Wait slightly longer than the two-second autosave, then snapshot.
  Expect `Last saved…` rather than `Unsaved changes`. `open "$BASE/members/availability"`
  and snapshot again; the same labelled gridcell must remain selected. This reload is the
  required read-back, not the status text alone.
- **Phone path.** `resize 390 844`, snapshot, and use a visible day button such as
  `Saturday …: set hours from a list` to open its dialog. Record the list controls; do
  not needlessly overwrite the desktop proof slot. Close the dialog before the screenshot.
- **Proof.** Save before/after/reload snapshots. Capture the saved page at `1440 × 900`
  and `390 × 844`, then record the painted label, chosen mode and saved/reload result in
  the evidence notes.

## Gotchas

- A timezone prompt can appear when the browser's detected zone differs from seeded
  availability. Keep the saved zone during this proof unless timezone migration itself is
  under test.
- Grid cells are intentionally small pointer targets; the day-heading dialog is the
  accessible keyboard alternative. Use real `click` actions, never JavaScript to modify
  availability.
- Autosave is debounced. If it remains unsaved after the wait, select `Save` and capture
  the result; if saving fails, record the error and stop rather than retrying against a
  different database.
- Guild labels are relative to `GUILD_TIMEZONE`; record labels as displayed rather than
  converting them with the worker's local clock.
