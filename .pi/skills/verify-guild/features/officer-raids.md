# Officer raid planning

Templates define raid sizes and composition; weekly series generate calendar raids.

## Sub-features

- `raid-templates`: create/edit name, short name, size, duration, role requirements
  and active state; template-admin deletion.
- `raid-series`: create/edit weekly slots, deactivate/reactivate and delete.
- `series-calendar`: generated raids and their notes at `/members/calendar`.

## How to get to it (user POV)

Open `Officers` → `Raid management` for `/officers/raids`. Templates are above the
series list and `New series` form. Each row has its own named `Edit` control.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared officer/access/evidence
rules in [the index](README.md). Use fresh handles after every action.

- **Enter.** `open "$BASE/dev/session?as=officer&back=/officers/raids"`; resize to
  `1440 900`, snapshot. Fresh seed: Barrow Deeps, Hyjal Summit and Onyxia's Lair, with `No series yet…`.
- **Template.** Click `New template`. Fill `NAME` = `Verification 85`, `SHORT` =
  `V85`, leave `SIZE` = 40 and `LENGTH (MINUTES)` = 180. Fill `Tank`, `Healer`,
  `Melee DPS`, `Ranged DPS` with 4, 12, 10, 14; keep `Active` checked. Capture
  the filled dialog, click `Save template`, and wait for the dialog to close.
  Fully reopen `/officers/raids`; expect the named row with those saved values.
- **Series.** In `New series`, select Onyxia's Lair, Thursday, `START (GUILD TIME)`
  20:00, `LENGTH` 3 hours, post-ahead 14 days, lock-before 120 minutes and horizon
  4 weeks. Fill `NOTES` = `Verification 85 weekly slot`. Click `Add series`, wait
  for the new row, then fully reopen the page. Expect the Thursday row, saved
  note and scheduled-raid count. Open `/members/calendar` to inspect generated
  Onyxia's Lair dates; record dates in guild time, not the worker's timezone.
- **End state.** Return to the planner, save the reloaded snapshot and desktop/
  phone screenshots. This baseline proves template and series creation, not all
  destructive branches below.

## Gotchas

- The dev `officer` has template-admin rights, so `Delete <template>` is visible.
  An ordinary officer need not have those rights. Non-officers get 404 (index).
- Template requirements must sum to size. Use a unique test name on repeat runs.
- Additional paths: `Edit <template>` → `Save template`; `Edit <template> <day>`
  → `Save this and future raids`; `Deactivate` opens confirmation, inactive rows offer
  `Reactivate`; named `Delete` controls open confirmation. After **each** mutation,
  fully reload the planner and inspect the row, edited dialog or absence. For series
  changes also reload the calendar: unposted future raids can move or disappear;
  posted/past raids are retained according to the confirmation text.
- Delete only disposable test data. A template still used by any series cannot be
  deleted; its dialog explains why. Template deletion is not an ordinary-officer test.
- `No templates yet…` is not reachable in the fresh seed; do not remove all seed
  templates just to manufacture it. `No series yet…` is reachable before creation.
- No bot posting or Discord delivery is proved by locally generated raids.
