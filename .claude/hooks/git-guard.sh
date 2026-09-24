#!/usr/bin/env bash
# PreToolUse guard for Bash calls that touch git.
#
# Denies, with an explanation Claude Code will read and act on:
#   - commits made while on a protected branch
#   - pushes to a protected branch
#   - force pushes
#   - destructive history operations
#
# Only inspects commands that ACTUALLY INVOKE git. A command that merely
# mentions git in a string, a grep pattern, or a heredoc body is left alone.
#
# Fails open: any unexpected condition allows the call rather than wedging
# the session.

set -uo pipefail

PROTECTED_RE='^(main|master)$'

INPUT=$(cat)

command -v jq >/dev/null 2>&1 || exit 0

TOOL=$(jq -r '.tool_name // empty' <<<"$INPUT" 2>/dev/null) || exit 0
[ "$TOOL" = "Bash" ] || exit 0

CMD=$(jq -r '.tool_input.command // empty' <<<"$INPUT" 2>/dev/null) || exit 0
[ -n "$CMD" ] || exit 0

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

# Everything from the first heredoc operator onward is data being written to a
# file, not commands being run. Ignore it.
SCAN="${CMD%%<<*}"

# Split on shell command separators so each segment is a candidate command.
# `&&`, `||` and `|` collapse to empty segments, which are skipped below.
mapfile -t SEGMENTS < <(printf '%s\n' "$SCAN" | tr ';|&\n' '\n\n\n\n')

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "")
# An unborn branch (no commits yet) reports "HEAD". Resolve the configured
# initial branch so a first commit on main is still caught.
if [ "$BRANCH" = "HEAD" ] && ! git rev-parse HEAD >/dev/null 2>&1; then
  BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "")
fi

for SEG in "${SEGMENTS[@]}"; do
  # Trim leading whitespace.
  SEG="${SEG#"${SEG%%[![:space:]]*}"}"
  [ -n "$SEG" ] || continue

  # Strip leading VAR=value environment assignments.
  while [[ "$SEG" =~ ^[A-Za-z_][A-Za-z0-9_]*=[^[:space:]]*[[:space:]]+(.*)$ ]]; do
    SEG="${BASH_REMATCH[1]}"
  done
  # Strip a leading sudo.
  [[ "$SEG" =~ ^sudo[[:space:]]+(.*)$ ]] && SEG="${BASH_REMATCH[1]}"

  # Only a segment that begins with `git` is a git invocation.
  [[ "$SEG" =~ ^git([[:space:]]|$) ]] || continue

  # shellcheck disable=SC2206
  TOKENS=($SEG)
  SUB=""
  i=1
  while [ $i -lt ${#TOKENS[@]} ]; do
    T="${TOKENS[$i]}"
    case "$T" in
      -C|-c|--git-dir|--work-tree|--namespace) i=$((i + 2)); continue ;;
      -*) i=$((i + 1)); continue ;;
      *) SUB="$T"; break ;;
    esac
  done
  [ -n "$SUB" ] || continue

  ARGS="${SEG#*"$SUB"}"

  case "$SUB" in
    commit)
      if [[ "$BRANCH" =~ $PROTECTED_RE ]]; then
        deny "Blocked: you are on '$BRANCH', which is protected. Per .claude/rules/git-workflow.md, branch first — git switch -c <type>/<short-description> — then commit there and open a PR."
      fi
      ;;

    push)
      if [[ "$ARGS" =~ (--force([^-]|$)|[[:space:]]-f([[:space:]]|$)|--force-with-lease) ]]; then
        deny "Blocked: force push. A branch under review must never be force-pushed. Push a follow-up commit instead and squash at merge time. If a rewrite is genuinely required, ask Robert first."
      fi
      if [[ "$ARGS" =~ [[:space:]](origin[[:space:]]+)?(main|master)([[:space:]]|$) ]] \
        || [[ "$ARGS" =~ (main|master):(main|master) ]]; then
        deny "Blocked: direct push to a protected branch. Push your feature branch and open a pull request instead: git push -u origin HEAD && gh pr create"
      fi
      # A bare `git push` while sitting on a protected branch.
      if [[ "$BRANCH" =~ $PROTECTED_RE ]] && [[ ! "$ARGS" =~ [^[:space:]] ]]; then
        deny "Blocked: you are on '$BRANCH' and a bare push would go to it. Move the work to a feature branch and open a pull request."
      fi
      ;;

    reset)
      [[ "$ARGS" =~ --hard ]] && deny "Blocked: git reset --hard discards work irrecoverably. Say what you are trying to achieve and ask Robert before running it."
      ;;

    filter-branch)
      deny "Blocked: git filter-branch rewrites history. Ask Robert first."
      ;;

    branch)
      [[ "$ARGS" =~ [[:space:]]-D([[:space:]]|$) ]] && deny "Blocked: force-deleting a branch can discard unmerged commits. Use -d, or ask Robert if the branch really should go."
      ;;

    reflog)
      [[ "$ARGS" =~ [[:space:]]delete([[:space:]]|$) ]] && deny "Blocked: deleting reflog entries removes the last safety net for recovering lost commits. Ask Robert first."
      ;;
  esac
done

exit 0
