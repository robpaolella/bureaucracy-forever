# Bureaucracy — guild site

Next.js site for the Bureaucracy raiding guild on WoW Forever: public marketing pages plus a
Discord-authenticated members and officers area. Live at https://www.bureauguild.com on Vercel.

## Stack
Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3 with the handover tokens,
Auth.js v5 (Discord provider, roles from Discord guild roles), Prisma 7 on Neon Postgres
(pg driver adapter), Vitest. npm. Vercel.

## Checks
Run in this order before any PR. `/ship` reads this section.
```
npm run lint
npm run typecheck
npm run test
npm run build
```
The build must not need a database or Discord secrets. CI runs it with neither.

## Setup after clone
```
git config core.hooksPath .githooks
```
`npm install` also sets it, through the `prepare` script.

## Run locally
```
npm install
cp .env.example .env.local   # fill in; never commit .env.local
npm run dev                  # http://localhost:3000
```
In development, `/dev/session` sets a dev-session cookie that stands in for a real login
(out / member / officer). It's ignored in production.

## Layout
- `app/(home)`, `app/(site)` — public pages, plus `members/` and `officers/` areas.
- `app/api/` — route handlers; `app/api/bot/*` is the bot's signed API (SYNC-SPEC).
- `app/actions/` — server actions. `app/dev/` — component and foundation playground.
- `proxy.ts` + `lib/auth/gate.ts` — route gating by role. `lib/auth/roles.ts` — Discord role → access.
- `lib/` — domain logic with co-located `*.test.ts`. `lib/config.ts` holds `GUILD_TIMEZONE`.
- `components/` — UI by feature. `content/` — page copy.
- `prisma/` — schema, migrations, seed.
- `design-handover/` — design docs, tokens, reference artboards.

## Deploy
Vercel with the GitHub integration: a merge to `main` deploys production, and branches get
previews. `vercel.json` runs `npm run build:vercel`, which runs `prisma migrate deploy` on
production builds only. Env vars (see `.env.example`) live in Vercel. `BOT_SHARED_SECRET`
must match the bot's `.env`.

## Watch out for
- Get a go-ahead before changing migrations, auth, or anything under `design-handover/`.
- Merging a migration applies it to production on the next deploy. Keep migrations additive.
- WoW Forever has no realm clock. Wherever the handover says "realm" or "server" time, the site says **guild time**, anchored on `GUILD_TIMEZONE`.
- Prisma's CLI doesn't read `.env.local` on its own; `prisma.config.ts` loads it. Migrations use `DIRECT_URL` (non-pooled), and the app uses pooled `DATABASE_URL`.

## Verifying a change
Render affected routes in a browser and compare them with the matching artboard in
`design-handover/reference/` at 1440 and 390 widths. PR "How to verify" names the artboard
and widths.

## Reference material
- `design-handover/CLAUDE.md` — read before writing components. It covers non-negotiables, voice and placeholder content.
- `design-handover/docs/`, `design-handover/design/`, `design-handover/reference/*.html` — specs, tokens, artboards.
- `REVIEW.md` — project rules the code-reviewer weights: access control, time handling, design system, migrations.
- `SYNC-SPEC.md` — shared contract with the Discord bot (`~/git/bureaucracy-forever-discord-bot`). The same file lives in both repos; change both in the same PR.
