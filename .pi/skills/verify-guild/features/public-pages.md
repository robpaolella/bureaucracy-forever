# Public pages

Visitors can learn who Bureaucracy is, when it raids, what it needs, and begin an
application from the public site.

## Sub-features

- `home`: guild record, progression, schedule teaser, recruitment teaser and application
  calls to action at `/`.
- `about`: guild story, history, leadership and roster link at `/about`.
- `schedule`: guild/viewer time display, raid-week cards and member-calendar link at
  `/schedule`.
- `recruitment`: needs table, expectations, next steps and application-path calls to
  action at `/recruitment`.

## How to get to it (user POV)

- Select the wordmark for home, then `About`, `Raiding` or `Recruitment` in the site
  navigation. On a phone, select `Open menu` first.
- From home, use `Full history →`, `Full schedule →` or `Every class and spec →` for
  the equivalent page routes.
- On Recruitment, use `Jump to the form →`, then `Apply as a Raider` or `Apply as
  Social`. Those start the application flow mapped in [application](application.md).

## Driving it with chrome-devtools-axi

Preconditions: Launch and Doctor PASS; set `BASE` and the isolated browser session as in
`../SKILL.md`. These pages do not need a signed-in session. Use the visible navigation
and fresh snapshot handles rather than assuming a route remains unchanged.

- **Home.** `open "$BASE/"`, then `snapshot`. Expect the `Smolderweb's #1 raiding guild.
  Now on WoW Forever.` heading, `Guild record`, `Full schedule →` and `Apply to raid`.
  Select a visible public-page link and confirm its destination.
- **About.** `open "$BASE/about"`, then `snapshot`. Expect `The story of Bureaucracy`,
  `Guild history` and `Meet the leadership`. The `Full roster →` destination requires a
  member session, so record it but do not follow it while signed out.
- **Schedule.** `open "$BASE/schedule"`, then `snapshot`. Expect `Raid schedule`,
  `GUILD TIME`, `YOUR TIME`, three raid-week cards and `Open the calendar →`. Do not
  change the stored viewer timezone while mapping this public page.
- **Recruitment.** `open "$BASE/recruitment"`, then `snapshot`. Expect `Open needs by
  class and role`, its `High need`/`Medium`/`Closed` legend, `What we expect of a raider`
  and both application-path links. Use `Jump to the form →` to confirm the in-page
  anchor, then return to the page before capturing proof.
- **Proof.** Save snapshots for all four routes. Capture Recruitment at `resize 1440 900`
  and `resize 390 844`; it visibly proves the needs table and application entry points.
  Record each route, entry point and observed headings in the evidence notes.

## Gotchas

- Recruitment needs come from the local seeded database and can change after officer
  edits; verify labels and paths, not a fixed class ordering.
- `Open the calendar →` and `Full roster →` are gated member destinations. Their
  authentication behaviour is covered by their member feature maps, not this public
  proof.
- Application links can open a client-side dialog on an interactive page, but remain
  regular `/apply?path=…` links. Drive the submitted application through the direct
  route in the application map.
