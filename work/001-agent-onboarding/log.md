# 001 — Log

## 2026-09-30
- PR #54 ("align with user-level Claude config") touched the same files as this onboarding.
  Robert: don't merge it, it targets the retired `~/.claude` setup. Folded in its still-valid
  stack/checks/layout/deploy content and its new `REVIEW.md` by hand; close it once this PR
  is open.
- `ENFORCEMENT.md` described three enforcement layers: the Claude Code PreToolUse hook (now
  replaced by Maestro's guard), the repo's own `.githooks/` (kept, repointed at Maestro's
  git-workflow doc), and GitHub branch protection on `main` (already applied, one-time setup,
  not an ongoing rule — not carried forward as a doc).
- `staging` is a second protected branch in this repo (a live deploy target), not just `main`
  — kept that in `AGENTS.md` and left the hook logic for it untouched.
