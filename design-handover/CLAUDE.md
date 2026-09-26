# Bureaucracy — guild site

Next.js site for **Bureaucracy**, a competitive 40-player raiding guild on **WoW Forever**
(Blizzard's Classic-era relaunch, live 4 November 2026). Public marketing pages plus a
Discord-authenticated members area.

This folder is the design handover. Read `docs/` before writing components; use `design/`
as the source of truth for every visual value.

---

## Read in this order

| File | What it settles |
|---|---|
| `docs/01-design-system.md` | Palette, type, spacing, the rules that keep it coherent |
| `docs/02-components.md` | Every primitive, its props, its variants and states |
| `docs/03-information-architecture.md` | Routes, nav, roles, what each session sees |
| `docs/04-pages.md` | Page-by-page layout and content spec |
| `docs/05-availability.md` | The availability grid and officer heatmap — the hard part |
| `docs/06-data-model.md` | Schema, API routes, Discord bot sync |
| `docs/07-build-order.md` | Suggested sequence of work |

`design/tokens.css`, `design/tailwind.config.ts` and `design/class-colors.ts` are meant to
be copied into the repo as-is.

`reference/*.html` are the design artboards, self-contained. The eight static pages open
directly in a browser and are the visual truth — **match them, don't reinterpret them.**
`Availability-Member.html` and `Availability-Officer.html` are templated and won't render
standalone; `docs/05` specs them in full.

---

## Stack assumptions

- Next.js App Router, TypeScript, React Server Components where the page is static
- Tailwind, extended with `design/tailwind.config.ts` — no arbitrary hex values in JSX
- Auth.js (NextAuth) with the Discord provider; roles derived from Discord guild roles
- Postgres via Prisma
- The existing self-hosted Discord bot is the other half of sign-ups — see `docs/06`

Adjust freely if the repo already disagrees with any of this. The design does not depend on it.

---

## Non-negotiables

1. **No Blizzard or World of Warcraft assets.** No official logos, artwork, fonts or
   screenshots. The one borrowed convention is the class colors, and only for names and
   role counts — never as a background fill.
2. **Dark theme only** for v1. There is no light theme; don't build the toggle.
3. **Every time is shown twice** — realm time and the viewer's local time, each labelled.
   Never render a bare time. See `docs/01 § Time`. *Build note (Sept 2026):* WoW Forever
   has no realm clock, so wherever the docs say "realm" or "server" time the site says
   **guild time**, anchored on `GUILD_TIMEZONE` (`America/Los_Angeles`) in `lib/config.ts`.
   The dual-time rule is otherwise unchanged.
4. **44px minimum hit target** on every control, mobile included. The one exception is the
   availability grid cell, which is a paint surface.
5. **Text contrast ≥ 4.5:1** on ink (3:1 at 24px+). Shaman and Warlock class colors are
   lifted for this reason — use the `onInk` values, keep `canonical` for exports.
6. **Status is never color alone.** Every status pill carries a word as well as a fill.
7. Real `<button>`, `<a href>`, `<input>` + `<label>` everywhere. No clickable divs.

---

## Content that is placeholder

The artboards are populated so the layouts read properly. These are **invented** and must be
replaced before launch:

- The loot policy (`reference/Loot.html`) — written as a loot council, marked
  `[confirm this is still your system]`
- Progression kill counts on the home page
- Raid nights and times (Tue/Wed 8–11 PM server, Sun 7–10 PM optional)
- Class/spec recruitment statuses
- Every character name — Ledgerline, Redtape, Subclause, Paperclip, Formfiller, Memoranda,
  Rubberstamp, Triplicate, Quorum, Addendum

The guild's real, verified claims — use these as written:

- Multiple server-first kills and fastest clear times on **Smolderweb** in WoW Classic
- Top 500 guilds worldwide to clear **Naxxramas** at release
- Competitive, prepared, small and close-knit

---

## Voice

Confident, plain, slightly dry. Short sentences. Never grandiose, never sentimental,
no exclamation marks, no emoji. The home page headline sets the register:

> We don't out-play people. We out-prepare them.

When writing new copy, prefer the concrete over the aspirational: "First pull on the hour"
beats "We value punctuality."

---

## Brand assets

`reference/assets/` — `wordmark.png` (horizontal lockup, transparent, ice #E8EDF7),
`mark.png` (column only), `tile.png` (teal app tile). Request SVGs from the guild before
launch; these are traced from a raster original and will soften above ~300px.

Usage: wordmark in the header at 22px tall and the footer at 16px; mark alone for mobile,
avatars, empty states and the hero watermark at 5–15% opacity; tile for favicon, Discord
and the OG card.
