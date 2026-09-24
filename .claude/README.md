# Claude Code development-practice config

Drop the `.claude/` folder at the root of the guild-site repo and append
`CLAUDE.md.snippet` to the repo's `CLAUDE.md`.

## The four layers, and why it isn't just a skill

| Layer | File | Loads | Can be skipped? |
|---|---|---|---|
| Always-on rules | `.claude/rules/git-workflow.md` | Every session, via the `@` import in CLAUDE.md | In principle, like any instruction |
| Procedures | `.claude/skills/start-work/`, `.claude/skills/ship/` | When invoked as `/start-work`, `/ship`, or when the description matches | Yes — the model decides |
| Review | `.claude/agents/code-reviewer.md` | When delegated to | Yes |
| Enforcement | `.claude/hooks/git-guard.sh` + `settings.json` | Before every Bash call | **No.** It denies the tool call outright |

Rules and skills shape behaviour. Only the hook makes a rule impossible to skip,
so the hook covers the handful of things that must never happen: a commit on
`main`, a force push, a destructive history rewrite.

## Requirements

- `jq` must be on PATH, or the hook silently allows everything (it fails open by
  design, so a missing dependency never wedges a session).
- `gh` CLI authenticated, for `gh pr create`.
- The scripts in step 2 of `/ship` assume `lint`, `typecheck`, `test` and `build`
  exist in `package.json`. Add them, or the skill will skip them and say so.

## Verifying it works

```
chmod +x .claude/hooks/git-guard.sh
claude
/hooks          # confirm the PreToolUse hook is registered
```

Then, on `main`, ask Claude Code to make a trivial commit. It should be blocked
and told to branch.

## Tuning

- **Protected branches** — edit `PROTECTED_RE` in `git-guard.sh` if you add
  `develop` or a release branch.
- **Running lint/tests on every commit** — deliberately not done here. It makes
  small commits slow and pushes the agent toward fewer, larger commits, which is
  the opposite of the cadence you want. `/ship` runs the checks once, before the
  PR. A normal `.husky` pre-commit hook is the better place if you want them
  earlier, since it also catches your own commits, not just Claude's.
- **Attribution lines** — Claude Code appends `Co-Authored-By:` and a session
  link to commits by default. If you'd rather it didn't, look for
  `includeCoAuthoredBy` in settings; confirm the current key name in the docs
  before relying on it.

## Docs

- Skills: https://code.claude.com/docs/en/skills
- Memory / CLAUDE.md: https://code.claude.com/docs/en/memory
- Hooks: https://code.claude.com/docs/en/hooks
- Subagents: https://code.claude.com/docs/en/sub-agents
