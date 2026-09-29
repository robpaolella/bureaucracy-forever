# Git workflow

These rules apply to every change in this repository. They are not suggestions.

## Branching

- **Never commit directly to `main`.** `main` is always deployable.
- Branch from an up-to-date `main`: `git switch main && git pull && git switch -c <branch>`
- Branch names: `<type>/<short-kebab-description>`, where type is one of
  `feat`, `fix`, `chore`, `docs`, `refactor`, `test`, `perf`, `build`.
  Examples: `feat/availability-grid`, `fix/heatmap-dst-offset`, `chore/tailwind-tokens`.
- One branch per unit of work. If the task grows a second unrelated concern,
  finish the first, open its PR, then branch again.
- Keep branches short-lived. If a branch is more than a couple of days old,
  rebase it onto `main` rather than letting it drift.

## The `staging` branch

`staging` is a long-lived deploy target, not a unit of work. It deploys to
https://staging.bureauguild.com (Vercel Authentication, Neon branch `staging`,
migrations run on every deploy).

- It is the one exception to the branch-naming rule.
- Never commit to it directly (`.githooks/pre-commit` refuses). It moves only by
  merging a feature branch or `main` into it:
  `git switch staging && git pull && git merge --no-ff <branch> && git push`
- Never force-push it, rebase it or reset it. If it drifts, merge `main` in.
- Feature branches still ship to `main` by PR as usual. Merging into `staging` is
  for trying work on a real deployment first; it is never a substitute for the PR.
- Reset or reseed its database with `npm run db:staging:reset` and
  `npm run db:staging:seed` (they read `.env.staging`). Seeding and
  `prisma migrate reset` refuse any database that is not local or staging.
- The staging badge and the staging migrations key off Vercel's system variables
  (`VERCEL_ENV`, `VERCEL_GIT_COMMIT_REF`); keep "Automatically expose System
  Environment Variables" on in the Vercel project.

## Commits

- Use Conventional Commits: `<type>(<scope>): <subject>`
  - Types as above. Scope is optional but preferred — the area touched
    (`availability`, `auth`, `roster`, `tokens`, `ci`).
  - Subject: imperative mood, lowercase, no trailing period, under 72 characters.
    "add drag-paint to availability grid", not "Added drag painting."
- Body (wrap at 72 chars) is required when the change is not self-evident.
  Explain **why**, not what — the diff already says what.
- Breaking changes: `!` after the type/scope and a `BREAKING CHANGE:` footer.
- Reference issues in the footer: `Refs #12`, `Closes #12`.

Example:

```
feat(availability): store slots in member-local time

Slots were being normalised to UTC on write, which shifted every
painted week by an hour when the US and EU clocks changed on
different dates. Store weekday + local time + IANA zone and convert
on read instead.

Closes #34
```

## Commit cadence

- Commit one logical change at a time. A commit should be revertable on its own.
- Commit when a coherent piece works — not every file save, and not one
  1,000-line commit at the end of a session.
- Every commit must build. Do not commit a known-broken tree to "save progress";
  use a WIP branch that you rebase before opening the PR.
- Never mix refactors with behaviour changes in the same commit.
- Never commit secrets, `.env` files, credentials or tokens. If one is committed,
  stop and tell me immediately — rotating the secret comes before rewriting history.
- Do not commit generated output, `node_modules`, or build artifacts.

## Before opening a pull request

Run all of these and fix what they surface:

1. `npm run lint`
2. `npm run typecheck` (or `tsc --noEmit`)
3. `npm run test` if tests exist for the touched area
4. `npm run build`

Then have the `code-reviewer` subagent review the branch diff, and address its
findings before asking me to look.

## Pull requests

- Open with `gh pr create`. Never merge without the `code-reviewer` pass and green
  checks. With both, merge it yourself — Robert does not operate git day to day.
- Title: same Conventional Commit format as the commit subject.
- Body must cover:
  - **What** changed, in one or two sentences.
  - **Why** — the problem, or the build-order step it completes.
  - **How to verify** — the exact steps or routes to check, including which
    artboard to compare against and at which widths.
  - **Risks / follow-ups** — anything deliberately left undone.
- Keep PRs reviewable. Over roughly 400 changed lines, split the work unless
  it is genuinely one atomic change.
- Never force-push a branch that is under review. Push follow-up commits;
  squash at merge time.

## Merging

- Squash-merge into `main` with the PR title as the commit subject.
- Delete the branch after merge.
- Never merge with a failing check, and never bypass a required check.
- After merging, `git switch main && git pull` before starting the next task.

## What to do when blocked

If any rule here conflicts with what I have asked for, stop and say so rather
than silently picking one. If a rule would require a destructive git operation
(`push --force`, `reset --hard`, `rebase` on a shared branch, history rewrites),
ask me first — always.
