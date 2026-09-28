# Review guidance — guild site

Project rules the `code-reviewer` subagent weights on top of its generic checklist.
Flag each violation with file:line and the concrete failure.

## Access control
- Anything under a members or officers route needs a gate in `proxy.ts` / `lib/auth/gate.ts`,
  not only in the component. A page that hides content client-side is still exposed.
- `/api/bot/*` accepts only the bot's shared secret (SYNC-SPEC §2). No other route should
  accept a Bearer token.

## Time handling
- Availability is stored in member-local time: one row per member, `slots` keyed `day:slot`
  (day 0 = Monday, 48 half-hour slots) in that member's own `timezone`, converted on read. Flag any UTC normalisation of availability slots. It shifts painted
  weeks when US and EU clocks change on different dates.
- Every time renders twice, guild time and the viewer's local time, each labelled. Flag any
  bare time render.
- Guild time comes from `GUILD_TIMEZONE` in `lib/config.ts`. Flag any page that derives or
  hardcodes the zone itself.

## Design system
- No arbitrary hex values or one-off spacing in JSX. Use the tokens (`app/tokens.css`,
  `tailwind.config.ts`).
- Real `<button>`, `<a href>`, `<input>` + `<label>`. No clickable divs, no missing labels.
- Hit targets under 44px fail, except the availability grid cell.
- Status is never color alone. Every status pill carries a word.
- Class colors only for names and role counts, never as a background fill. No Blizzard or
  WoW assets.

## Migrations
- Production runs `prisma migrate deploy` on every Vercel production build. A migration that
  drops, renames or truncates reaches live data on merge. Treat it as Blocking unless the PR
  says how the data survives.
