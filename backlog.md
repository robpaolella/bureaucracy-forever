- `.githooks/pre-commit` and `.githooks/pre-push` have no automated test suite (the old
  `.claude/hooks/test-git-guard.sh` only tested the retired PreToolUse hook, not these). Build
  one if they change again.
