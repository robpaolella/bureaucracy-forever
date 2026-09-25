# Bureaucracy — guild site

Next.js site for the Bureaucracy raiding guild. Design handover, specs and design tokens live in
`design-handover/` — read `design-handover/CLAUDE.md` before writing components.

## Development workflow

Follow @.claude/rules/git-workflow.md on every change. It is not optional, and
it applies even when I have not mentioned git in my request.

The short version:

- Never commit to `main`. Branch as `<type>/<short-kebab-description>`.
- Conventional Commits. One logical change per commit. Every commit builds.
- Before a PR: lint, typecheck, test, build — then the `code-reviewer` subagent.
- Open PRs with `gh pr create`. Once checks are green and the `code-reviewer` finds
  nothing blocking, squash-merge it yourself, delete the branch, and pull `main`.
  Bring me decisions in plain language, not git.

Two skills drive this: `/start-work` at the beginning of a task and `/ship` at
the end. Use them rather than improvising the sequence.

A PreToolUse hook blocks commits on `main`, force pushes and destructive history
operations. If it blocks you, it is telling you the workflow, not malfunctioning —
follow what the message says rather than looking for a way around it.
