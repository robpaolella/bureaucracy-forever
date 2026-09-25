# How the workflow is enforced

Three layers. Each catches what the one before it cannot.

| Layer | File | Catches | Bypass |
|---|---|---|---|
| 1. Claude Code PreToolUse hook | `.claude/hooks/git-guard.sh` | A bad git command before it runs, with an explanation the agent acts on | Trivial — any shell indirection |
| 2. Git hooks | `.githooks/pre-commit`, `.githooks/pre-push` | The same actions however git is invoked — shell, agent, IDE, `bash -c`, `xargs` | `--no-verify` or `-c core.hooksPath=…` (layer 1 denies both) |
| 3. GitHub branch protection | Server side | Anything that reaches the remote | None |

## Why layer 1 is not the important one

It inspects the *text* of a Bash command. Shell has unlimited ways to spell the
same action, so a determined agent can always get past it. Its job is to catch
mistakes early and restate the workflow in the moment — not to be a boundary.

Do not keep hardening it against evasion. Every added pattern widens the
false-positive surface, and the gap it closes is already closed by layer 2.
Fix it only when it wrongly denies real work, or misses an ordinary mistake.

## Layer 2 setup

```
git config core.hooksPath .githooks
chmod +x .githooks/*
```

`core.hooksPath` is required — `.git/hooks` is not version-controlled, so
without it a fresh clone has no protection. The setting is per-clone, so it
must be re-run after cloning.

## Layer 3 setup

```
gh api -X PUT repos/:owner/:repo/branches/main/protection \
  -f 'required_pull_request_reviews[required_approving_review_count]=0' \
  -F 'enforce_admins=false' \
  -F 'required_status_checks=null' \
  -F 'restrictions=null' \
  -F 'allow_force_pushes=false' \
  -F 'allow_deletions=false'
```

Requires a private repo on a paid plan, or any public repo. If branch
protection isn't available, layers 1 and 2 still hold for local work.

Set `enforce_admins=true` once you're confident — it stops you bypassing it too.

## Tests

```
bash .claude/hooks/test-git-guard.sh
```

36 cases. Run it after any change to `git-guard.sh`. Add a case for every bug
found rather than fixing silently.

The `.githooks/` scripts have no automated suite. To check them, build a bare
remote plus a clone under a temp dir, point `core.hooksPath` at this repo's
`.githooks/`, and confirm: `bash -c 'git commit'` on `main` is refused, a push
to `main` is refused, and an amend-then-push to a feature branch is refused as
non-fast-forward. Use `git commit --amend` for that last one — a reset followed
by a new commit is still a fast-forward.

## Known limits of layer 1, accepted deliberately

- Any indirection — `bash -c`, `eval`, aliases, `xargs`, `$(...)` — is not
  detected. Layer 2 covers all of it.
- Quote-blind splitting: a literal `;` or `|` inside a quoted string splits a
  segment. Worst case is a spurious deny, never a missed one.
- Branch is resolved before the command runs, so a combined
  `git switch -c x && git commit` is judged against the old branch and denied.
  Split it into two calls.
