# Member raid calendar and sign-up

Members find upcoming raids, open a raid's roster, and answer Accept, Tentative or
Absent. The saved answer is shared between the calendar and raid detail page.

Initial proof (#75): list/detail entry, Past/Upcoming, Tentative and Absent changes,
persistence, Undo and desktop Month display were driven. Menu entry, Month arrows
and chip entry are mapped from the UI/code but not yet verified end to end.

## Sub-features

- `calendar-list`: Upcoming/Past scopes and the empty past state.
- `calendar-month`: desktop Month view, Previous month/Next month and raid links.
- `signup-list`: answer from a list row, observe confirmation and Undo.
- `signup-detail`: answer from the detail header and confirm persistence in both views.

## How to get to it (user POV)

- Open signed-in navigation's `Members` menu, then `Calendar` for `/members/calendar`.
- Select a raid name from the list, or its chip in the desktop Month view, to open
  `/members/calendar/[raidId]`. Dates distinguish raids with the same name.
- A direct raid link opens the same detail page. Record which entry point you used.

## Driving it with chrome-devtools-axi

Preconditions: Launch and Doctor PASS; use the `member` session, not the row-less
`member-unsubmitted` fixture. Set `BASE` and the isolated browser session as in the
skill. Seeded raids are relative to today's date; never hard-code their IDs.

- **Enter.** `npx -y chrome-devtools-axi open "$BASE/dev/session?as=member&back=/members/calendar"`;
  then `snapshot`. Expect `Raid calendar`, `Upcoming`, `Past` and named raid links.
  For navigation coverage, click the `Calendar` link from another member page.
- **List/scopes.** Use `click @<uid>` on the `Past` radio from the snapshot;
  freshly seeded data shows `No raids have happened yet.` Click `Upcoming` to return.
- **Month.** `resize 1440 900`, snapshot, click `Month`. Expect a calendar with raid
  links; click `Previous month`/`Next month`, check the heading, then choose a raid
  chip. Record its date. Return to the calendar and click `List` for list coverage.
- **Choose an open raid.** Click a future raid-name link in the list; snapshot again.
  Expect its name, time and `Your response to <raid name>` group. Choose one before
  its displayed sign-up lock with enabled controls. Record the current selected answer.
- **Change the answer.** Save a before snapshot. Click an unselected `Tentative`
  or `Accept` radio in that response group; capture the confirmation and selected
  state in an after snapshot. Expect an `Undo` action, not `Couldn't save that`.
- **Prove persistence.** Record the detail URL from the snapshot. `open` that URL
  again (full navigation), then snapshot. The selected answer and sign-up roster
  must agree. `open "$BASE/members/calendar"`; find the same name **and date** and
  confirm the same selected answer. This read-back proves more than the toast.
- **List response/Undo.** In that row choose a different answer, snapshot the
  confirmation, then click `Undo`. Reopen the detail URL and confirm the previous
  answer returned. Also exercise `Absent` when the member is on the roster.
- **Proof.** Save the detail and list snapshots and action notes. Capture the
  member page with `resize 1440 900` and `resize 390 844` then `screenshot` using
  the skill's evidence paths. Finish Cleanup and confirm artifacts remain.

## Gotchas

- Month controls are hidden on phones; use the list at 390 wide.
- Off-roster members cannot choose Absent; Accept places them on the bench.
- Locked, cancelled and past raids show read-only responses. Don't alter data to
  bypass this; choose an open future raid and report any unreachable case.
- List rows may reorder after answering. Re-snapshot and match name/date, not position.
- Use guild-time labels as displayed; local dates can differ from guild dates.
- Undo is temporary. Click promptly; if it expires, repeat the change before testing.
- Session stubs are development scaffolding, not proof of access control or OAuth.
