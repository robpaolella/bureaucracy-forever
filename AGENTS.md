# Bureaucracy — guild site

Next.js site for the Bureaucracy raiding guild on WoW Forever: public marketing pages plus a
Discord-authenticated members and officers area. Live at https://www.bureauguild.com on Vercel.

Design handover, specs and design tokens live in `design-handover/` — read
`design-handover/CLAUDE.md` before writing components.

## Stack
Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 3 with the handover tokens,
Auth.js v5 (Discord provider, roles from Discord guild roles), Prisma 7 on Neon Postgres
(pg driver adapter), Vitest. npm. Vercel.

## Checks
Run in this order before any PR. The `ship` skill reads this section.
```
npm run lint
npm run typecheck
npm run test
npm run build
```
The build must not need a database or Discord secrets. CI runs it with neither.

## Setup after clone
```
npm install
```
`postinstall` runs `prisma generate`; `prepare` sets `git config core.hooksPath .githooks`
so this repo's pre-commit/pre-push protection (below) is active in a fresh clone.

## Run locally
```
npm install
cp .env.example .env.local   # fill in; never commit .env.local
npm run dev                  # http://localhost:3000
```
In development, `/dev/session` sets a dev-session cookie that stands in for a real login
(out / member / member-unsubmitted / officer). The whole `/dev` tree returns 404 in production.

## Layout
- `app/(home)`, `app/(site)` — public pages, plus `members/` and `officers/` areas.
- `app/api/` — route handlers; `app/api/bot/*` is the bot's signed API (SYNC-SPEC).
- `app/actions/` — server actions. `app/dev/` — dev-only playground (components, foundations,
  shell) and the session stub.
- `proxy.ts` + `lib/auth/gate.ts` — route gating by role. `lib/auth/roles.ts` — Discord role →
  access.
- `lib/` — domain logic with co-located `*.test.ts`. `lib/config.ts` holds `GUILD_TIMEZONE`.
- `components/` — UI by feature. `content/` — page copy.
- `prisma/` — schema, migrations, seed.
- `design-handover/` — design docs, tokens, reference artboards.

## Branches and deploy
Besides `main`, `staging` is a live deploy target: a branch merged into it deploys to the
staging environment. Never commit directly to `staging` either — merge a feature branch in.
Vercel's GitHub integration deploys a merge to `main` to production, and every branch gets a
preview. `vercel.json` runs `npm run build:vercel`, which runs `prisma migrate deploy` when
`VERCEL_ENV=production` or the branch is `staging`. Env vars (see `.env.example`) live in
Vercel. `BOT_SHARED_SECRET` must match the bot's `.env`. GitHub branch protection on `main`
requires the CI check.

This repo's own git hooks (`.githooks/pre-commit`, `.githooks/pre-push`, wired by
`core.hooksPath`) refuse commits to `main`/`staging`, force pushes and branch deletions no
matter how git is invoked. Maestro's own guard covers the same ground at the tool-call level;
if either blocks you, follow the message rather than looking for a way around it. Full rules:
`/git/maestro/docs/git-workflow.md`.

## Watch out for
- Get a go-ahead before changing migrations, auth, or anything under `design-handover/`.
- Merging a migration to `main` or `staging` applies it on the next deploy. Keep migrations
  additive.
- WoW Forever has no realm clock. Wherever the handover says "realm" or "server" time, the
  site says **guild time**, anchored on `GUILD_TIMEZONE`.
- Prisma's CLI doesn't read `.env.local` on its own; `prisma.config.ts` loads it. Migrations
  use `DIRECT_URL` (non-pooled), and the app uses pooled `DATABASE_URL`.

## Verifying a change
Render affected routes in a browser and compare them with the matching artboard in
`design-handover/reference/` at 1440 and 390 widths. PR "How to verify" names the artboard
and widths.

## Reference material
- `design-handover/CLAUDE.md` — read before writing components. It covers non-negotiables,
  voice and placeholder content.
- `design-handover/docs/`, `design-handover/design/`, `design-handover/reference/*.html` —
  specs, tokens, artboards.
- `REVIEW.md` — project rules the `review` skill weights: access control, time handling,
  design system, migrations.
- `SYNC-SPEC.md` — shared contract with the Discord bot
  (`bureaucracy-forever-discord-bot`). The same file lives in both repos; change both in the
  same PR.
