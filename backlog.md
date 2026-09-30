- `.githooks/pre-commit` and `.githooks/pre-push` have no automated test suite (the old
  `.claude/hooks/test-git-guard.sh` only tested the retired PreToolUse hook, not these). Build
  one if they change again.
- `SYNC-SPEC.md:428` still lists `bash .claude/hooks/test-git-guard.sh` under "Done means", but
  that file is deleted as part of onboarding this repo to Maestro. It's a shared contract with
  the Discord bot repo, so left alone here — needs a coordinated edit to both copies once
  that repo's onboarding also lands.
