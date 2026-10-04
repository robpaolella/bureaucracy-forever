# Officer roster availability

Officers inspect the roster's submitted hours, find possible raid windows and see
who has not submitted. The heatmap itself is read-only.

## Sub-features

- `roster-heatmap`: submitted count, desktop half-hour grid and phone day summary.
- `raid-windows`: duration/role minimums and matching windows with `Schedule` links.
- `not-submitted`: expandable member list; Discord nudge is outside this proof.

## How to get to it (user POV)

Open `Officers` → `Availability` for `/officers/availability`. The window finder
and `Hasn't submitted` list sit beside the desktop grid and below it on phones.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared rules in [the index](README.md).

- **Enter.** `open "$BASE/dev/session?as=officer&back=/officers/availability"`;
  resize to `1440 900`. Wait for the loading skeleton to become the heatmap, then
  `snapshot --full` (the default snapshot truncates this large grid).
- **Inspect.** Record `Submitted`, the roster total, week heading and a gridcell
  label such as `Tue 7:00 PM, 6 available`; actual labels depend on viewer timezone.
  Fresh seed includes submissions and seven people under `Hasn't submitted`.
  Click `Show all seven`; snapshot the expanded list. Do not hard-code that count
  after other feature tests change the roster or availability.
- **Find windows.** Fresh defaults are 3 hours and minimums 2/8/9/11, with
  `0 found`. Fill `MIN TANKS`, `MIN HEALERS`, `MIN MELEE`, `MIN RANGED` with
  0/0/0/1. Expect matching windows and named `Schedule <day> <time>` links.
  Record the displayed windows and guild-time labels; scheduling itself belongs
  to the calendar workflow and is not exercised here.
- **Phone/end state.** Capture the desktop result, `resize 390 844`, then capture
  the day-summary layout and snapshot. Full reload resets window-finder inputs
  and list expansion: these are view controls, not persisted mutations.

## Gotchas

- Non-officers get 404 (index). A failed heatmap fetch offers `Retry`; record the
  error and rerun Doctor before continuing rather than accepting an empty screen.
- Nobody-submitted heatmap state is not reached by this seed. Zero matching raid
  windows is reached and is different from nobody having submitted availability.
- Do **not** click `Nudge the rest in Discord`; it requests bot delivery and is
  outside local proof. No Discord reminders or delivery status are verified.
- Counts include role/conditional availability; record the rendered result rather
  than treating the colour scale as an exact count. Use guild time for planning.
