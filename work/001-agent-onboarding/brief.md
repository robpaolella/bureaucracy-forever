# 001 — Onboard repo to the Maestro standard

## Ask
Bring this repo in line with Maestro: one `AGENTS.md` with all repo-specific instructions,
`CLAUDE.md` reduced to `@AGENTS.md`, `.claude/` removed (Maestro now provides git workflow,
ship, start-work, review and the git guard), and `ENFORCEMENT.md` folded into `AGENTS.md`
where still true, deleted where obsolete.

## Starting point
Instructions were split across `CLAUDE.md`, `.claude/rules/git-workflow.md`,
`.claude/skills/{ship,start-work}`, `.claude/agents/code-reviewer.md`, `.claude/hooks/`,
`.claude/README.md`, `ENFORCEMENT.md`, plus repo-specific stack/checks/layout info that had
never been written down anywhere. A parallel PR (#54) had already rewritten `CLAUDE.md` with
that stack/checks/layout content, but for the retired `~/.claude` setup — not Maestro. Robert
asked to fold in what still applies from #54 and close it once this PR is open.

## Done means
- `AGENTS.md` holds the repo's stack, Checks, setup, layout, deploy and review-relevant
  detail; `CLAUDE.md` is just `@AGENTS.md`.
- `.claude/` is gone.
- `REVIEW.md` (site-specific review rules) exists for the `review` skill to read.
- `ENFORCEMENT.md` is gone; anything still true and repo-specific (the `staging` branch
  protection, the git-hooks setup) lives in `AGENTS.md`.
- `.githooks/pre-commit` and `.githooks/pre-push` still protect `main` and `staging`, with
  messages pointing at `/git/maestro/docs/git-workflow.md`.
- Checks pass (or a pre-existing failure is recorded in `backlog.md`).
- PR #54 is closed with a comment pointing at this PR.
