# Reference artboards

These are the design artboards exported from the canvas. They are **visual truth** — when a
doc and an artboard disagree, the artboard wins for anything visual and the doc wins for
anything behavioural.

Open them directly in a browser:

- `Main.html` — foundations: palette, class colors, type scale, spacing, radius, depth
- `Components.html` — every primitive
- `Nav-States.html` — header in all three sessions, mobile bar and drawer, footer
- `Home.html`, `About.html`, `Schedule.html`, `Recruitment.html`, `Loot.html` — public pages

These two are templated and **will not render standalone** — the markup uses `{{...}}`
holes and `<sc-for>` loops from the canvas runtime:

- `Availability-Member.html`
- `Availability-Officer.html`

Read them as source rather than opening them. The `<script type="text/x-dc">` block at the
bottom of each is plain, working JavaScript and is the reference implementation for:

- slot indexing and 12-hour formatting (`fmt`)
- drag-paint state and the window-level `mouseup` (member file)
- the heatmap ramp, role split and the **raid-window search algorithm** (officer file)

Port that logic; don't re-derive it.

## Notes

- Image paths point at `./assets/` — `wordmark.png`, `mark.png`, `tile.png`. These are
  traced from a raster original; get SVGs from the guild before launch.
- Fonts load from Google Fonts, so these need a connection to look right.
- Every page is a fixed-width comp at 1440 (or 390 for the mobile fragments in
  `Nav-States.html`). They are not responsive — the responsive behaviour is specified in
  `docs/04` and `docs/05`.
- All content is placeholder except the guild's real claims. See the "Content that is
  placeholder" section of `CLAUDE.md`.
