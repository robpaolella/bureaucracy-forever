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

For staging testers, set optional `STAGING_TESTERS=111:officer,222:member` in staging's settings before `npm run db:staging:seed`; the destructive seed adds each account with a main character and Accept signups on every seeded raid (never put real ids in the repo).

## Run locally
```
npm install
cp .env.example .env.local   # fill in; never commit .env.local
npm run dev                  # http://localhost:3000
```
Workers use `npm run db:local` to create this folder’s throwaway Docker database (Postgres 17, supported by Neon) and reset its sample data; repeat runs reuse the container.
Run `npm run dev:local` to start the site with database details passed through the process environment, not a copied settings file.
Run `npm run db:local:down` to remove only this folder’s labelled container and its data; none of these commands manages settings files.

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

## PR links and staging
Use the per-PR Vercel **Preview** link from Vercel's PR comment in every PR's "How to
verify" section. It appears a minute or two after the push. Previews need Vercel login, and
Discord login does not work there because preview addresses change. Verify public pages on a
preview; say clearly when signed-in pages need staging instead.

Use `https://staging.bureauguild.com` only when the issue requires a database change or a
real Discord login. After checks and review pass, check `gh pr list --label on-staging`; if
another open PR has that label, report it and wait. Otherwise run `git fetch`, then
`git switch staging && git merge --no-ff <branch> && git push`, and switch back to the feature
branch. Add `on-staging` to the PR and say in its body that it is on staging now. State that
the staging deploy applied any migration in the PR. Only one open PR may have `on-staging`; the
conductor removes the label when its PR merges or closes.

## Watch out for
- Get a go-ahead before changing migrations, auth, or anything under `design-handover/`.
- Merging a migration to `main` or `staging` applies it on the next deploy. Keep migrations
  additive.
- WoW Forever has no realm clock. Wherever the handover says "realm" or "server" time, the
  site says **guild time**, anchored on `GUILD_TIMEZONE`.
- Prisma's CLI doesn't read `.env.local` on its own; `prisma.config.ts` loads it. Migrations
  use `DIRECT_URL` (non-pooled), and the app uses pooled `DATABASE_URL`.

## Verifying a change
Use `.pi/skills/verify-guild/SKILL.md` to launch, safely drive and capture evidence from the local site.

Every UI change follows Maestro's shared `/git/maestro/skills/design-check/SKILL.md`,
using `.pi/skills/verify-guild/design-check.md` for this site's routes, states and safe
verification: main/build captures at 390 and 1440, approved-design comparisons when
linked, impeccable critique and an independent verdict.

## Designs

Before building a new screen, flow or kind of element, Robert approves a clickable
design. Approved designs live in `design/<issue>-<name>/`: `brief.md`, `decisions.md`,
`index.html` and `screenshots/`. Merge them to main in their own `docs(design)` PR
before implementation; record Robert's approval and link the design from the build issue.
For that feature, the approved design wins on layout, content, wording, states and
behaviour. `DESIGN.md` and the live site win on the site-wide look; `PRODUCT.md` still
supplies product facts. Gaps or ambiguous conflicts go to Robert through the conductor,
not an invented compromise. A new kind of element shown in an approved design counts
as Robert's go-ahead for it; otherwise explicit approval is still required.

This repo is public: designs and page snapshots use sample data only, never real
member data. The offline snapshot recipe is in `.pi/skills/verify-guild/SKILL.md`.
Maestro's `skills/design-feature/` workflow arrives with maestro#68; this recipe does
not depend on that unmerged work.

## Reference material
- The live site and `DESIGN.md` — the site-wide visual authority; approved feature
  designs govern their feature as described above.
- `design-handover/CLAUDE.md` — read before writing components. It covers non-negotiables,
  voice and placeholder content; it is background rather than the source of truth.
- `design-handover/docs/`, `design-handover/design/`, `design-handover/reference/*.html` —
  background specs, tokens and artboards.
- `REVIEW.md` — project rules the `review` skill weights: access control, time handling,
  design system, migrations.
- `SYNC-SPEC.md` — shared contract with the Discord bot
  (`bureaucracy-forever-discord-bot`). The same file lives in both repos; change both in the
  same PR.
