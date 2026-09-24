# 07 — Build order

Ordered so something is reviewable early and the risky part is de-risked before the easy
part is polished.

---

### 1. Foundations

Copy `design/tokens.css`, `design/tailwind.config.ts` and `design/class-colors.ts` into the
repo. Wire the three Google Fonts through `next/font`. Put `reference/assets/*` in
`public/brand/`.

**Done when** a scratch page renders the type scale and the full palette and matches
`reference/Main.html` side by side.

### 2. Primitives

Build everything in `docs/02` as a component library with a route at `/dev/components` that
mirrors `reference/Components.html`. Do not start pages before this exists — the whole point
of the system is that no page styles anything itself.

**Done when** `/dev/components` and the artboard are indistinguishable.

### 3. Shell

`SiteHeader`, `Footer`, the mobile drawer, the layout wrapper, and Auth.js with Discord.
Stub the three session states behind a dev-only switcher so the header can be reviewed
without three real accounts.

**Done when** all three states in `reference/Nav-States.html` are reachable.

### 4. Public pages

Home, About, Schedule, Recruitment, Loot — static, no database yet, content in a
`content/` module. Ship these; they're the pages that recruit people and they don't depend
on anything else.

**Done when** each matches its artboard at 1440 and reads correctly at 390.

### 5. Data layer

Prisma schema, migrations, seed script with a realistic 41-person roster, the API routes in
`docs/06`.

**Done when** the seed produces a roster and a week of availability you can query.

### 6. Availability — member

The hard one, and the reason it comes before the easy member pages. Grid, drag-paint, the
window-wide mouseup, autosave, dirty state, timezone detection, the keyboard alternative,
then the mobile single-day view with swipe.

**Done when** you can paint a week on a phone and on a desktop and both round-trip through
the API.

### 7. Availability — officer

Heatmap, aggregation endpoint, hover inspector, window finder, hasn't-submitted list.
Port the window algorithm from the artboard's logic block — it's correct and tested by eye
against the seeded data.

**Done when** changing a minimum re-ranks the windows instantly with 41 seeded members.

### 8. Roster and calendar

Roster table with filters, sorting, grouping and the mobile card list. Calendar list, raid
detail, the three-way response control, the toast. Both are spec-only pages — read
`docs/04` carefully.

**Done when** sign-ups write optimistically and the role counts move.

### 9. Applications

The public form, the submitted page, the officer inbox and detail, officer notes, accept and
decline with their confirmation modals.

**Done when** an application submitted from an incognito window appears in the inbox with an
unread dot.

### 10. Discord sync

Both directions, the shared secret, the conflict rule, the `/recruiting` and nudge surfaces.

**Done when** a sign-up made in Discord shows on the web with a Discord source badge, and
vice versa.

### 11. Pass

Empty states, loading skeletons, `noindex` on member routes, focus order, a keyboard pass
over the availability grid and the modals, contrast spot-check on anything added along the
way, OG cards using the tile asset.

---

## Worth knowing before you start

- **The availability grid is the whole project's risk.** 336 interactive cells, drag state,
  two timezones and a mobile gesture. Everything else is ordinary CRUD. Build it sixth, not
  last.
- **The header never changes shape between sessions** — public links stay put and groups are
  added. Build it that way from the start or you'll rewrite it.
- **`source` on sign-ups and `onInk` on class colors** are the two details most likely to get
  dropped as "detail", and both are load-bearing.
- The artboards are 1440 and 390. Between those, let the content column cap at 1200 and the
  gutters breathe — there is no tablet design, and it doesn't need one.
