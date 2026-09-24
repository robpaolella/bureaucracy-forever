#!/usr/bin/env bash
# PreToolUse guard for Bash calls that touch git.
#
# Blocks, with an explanation Claude Code will read and act on:
#   - commits made while on main/master
#   - pushes to main/master
#   - force pushes
#   - history rewrites (reset --hard, rebase on a shared branch, filter-branch)
#
# Fails open: if anything here is unexpected, it allows the call rather than
# wedging the session.

set -uo pipefail

INPUT=$(cat)

# No jq, no guard. Allow rather than block.
command -v jq >/dev/null 2>&1 || exit 0

TOOL=$(jq -r '.tool_name // empty' <<<"$INPUT" 2>/dev/null) || exit 0
[ "$TOOL" = "Bash" ] || exit 0

CMD=$(jq -r '.tool_input.command // empty' <<<"$INPUT" 2>/dev/null) || exit 0
[ -n "$CMD" ] || exit 0

# Only care about git commands.
case "$CMD" in
  *git*) ;;
  *) exit 0 ;;
esac

deny() {
  jq -n --arg reason "$1" '{
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: $reason
    }
  }'
  exit 0
}

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
PROTECTED_RE='^(main|master)$'

# 1. No commits on a protected branch.
if [[ "$CMD" =~ git[[:space:]]+commit ]] && [[ "$BRANCH" =~ $PROTECTED_RE ]]; then
  deny "Blocked: you are on '$BRANCH', which is protected. Per .claude/rules/git-workflow.md, create a branch first: git switch -c <type>/<short-description>, then commit there and open a PR."
fi

# 2. No pushes to a protected branch.
if [[ "$CMD" =~ git[[:space:]]+push ]]; then
  if [[ "$CMD" =~ (origin[[:space:]]+(main|master)|(main|master):(main|master)) ]]; then
    deny "Blocked: direct push to a protected branch. Push your feature branch and open a pull request instead: git push -u origin HEAD && gh pr create"
  fi
  if [[ "$BRANCH" =~ $PROTECTED_RE ]] && [[ ! "$CMD" =~ (origin[[:space:]]+[A-Za-z0-9._/-]+) ]]; then
    deny "Blocked: you are on '$BRANCH' and this push would go to it. Move the work to a feature branch and open a pull request."
  fi
  # 3. No force pushes, ever, without me.
  if [[ "$CMD" =~ (--force([^-]|$)|[[:space:]]-f([[:space:]]|$)|--force-with-lease) ]]; then
    deny "Blocked: force push. A branch under review must never be force-pushed. Push a follow-up commit instead, and squash at merge time. If a rewrite is genuinely required, ask Robert first."
  fi
fi

# 4. Destructive history operations need a human.
if [[ "$CMD" =~ git[[:space:]]+reset[[:space:]]+.*--hard ]] \
  || [[ "$CMD" =~ git[[:space:]]+filter-branch ]] \
  || [[ "$CMD" =~ git[[:space:]]+reflog[[:space:]]+delete ]] \
  || [[ "$CMD" =~ git[[:space:]]+branch[[:space:]]+.*-D ]]; then
  deny "Blocked: destructive git operation. This discards work that cannot be recovered from the working tree. Explain what you are trying to achieve and ask Robert before running it."
fi

exit 0
