#!/usr/bin/env bash
# Regression suite for git-guard.sh. Run from the repo root:
#   bash .claude/hooks/test-git-guard.sh
# Builds throwaway repos in a temp dir; touches nothing in this one.
set -uo pipefail

HOOK="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/git-guard.sh"
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
PASS=0; FAIL=0

run() { jq -n --arg c "$1" '{tool_name:"Bash",tool_input:{command:$c}}' > "$TMP/p.json"
        bash "$HOOK" < "$TMP/p.json" | jq -r 'if .hookSpecificOutput then "DENY" else "allow" end' 2>/dev/null || echo allow; }
chk() { local want="$1" cmd="$2" got; got=$(run "$cmd"); [ "$got" = "DENY" ] || got=allow
        if [ "$got" = "$want" ]; then PASS=$((PASS+1)); printf '  ok   %-5s %s\n' "$got" "$(printf '%s' "$cmd" | head -1 | cut -c1-56)"
        else FAIL=$((FAIL+1)); printf '  FAIL %-5s (want %s) %s\n' "$got" "$want" "$(printf '%s' "$cmd" | head -1 | cut -c1-44)"; fi; }

cd "$TMP" && git init -q -b main r && cd r
git config user.email t@t.t; git config user.name t
mkdir -p sub && (cd sub && git init -q -b main . && git config user.email t@t.t && git config user.name t && : > f && git add . && git commit -qm i)

echo "unborn branch"; chk DENY 'git commit -m bootstrap'
: > a && git add a && git commit -qm init

echo "on main — deny"
chk DENY 'git commit -m x'
chk DENY 'git push'
chk DENY 'git push origin main'
chk DENY 'git push origin :main'
chk DENY 'git push origin HEAD:main'
chk DENY 'git push origin +main'
chk DENY 'git push -fu origin feat/x'
chk DENY 'git commit --no-verify -m x'
chk DENY 'git commit -nm x'
chk DENY 'git branch -Dv old'
chk DENY 'git reset --hard HEAD~1'
chk DENY 'cd sub && git commit -m x'
chk DENY 'git -C sub commit -m x'
chk DENY 'cat > f.txt <<EOF
body
EOF
git commit -m sneaky'
chk DENY 'git push origin HEAD'
chk DENY 'git push -u origin HEAD'
chk DENY 'git push origin "main"'

echo "on main — allow"
chk allow 'git commit --help'
chk allow 'echo "git push --force" > n.md'
chk allow 'grep -rn "git commit" .claude/'
chk allow 'git log --grep="commit to main"'
chk allow 'git status --short'
chk allow 'git switch -c feat/x'
chk allow 'cat > ci.yml <<EOF
run: git push --force origin main
EOF'

git switch -qc feat/thing
echo "on feat/thing"
chk allow 'git commit -m "feat: x"'
chk allow 'git push -u origin HEAD'
chk allow 'git push origin feat/thing'
chk allow 'git commit -m "docs: never push --force"'
chk DENY  'git push --force'
chk DENY  'git push origin main'
chk DENY  'npm test && git push origin main'
chk DENY  'git push origin feat/thing:main'
chk DENY  'git -c core.hooksPath=/dev/null commit -m x'
chk DENY  'git -c core.hooksPath=/dev/null push origin feat/thing'
chk allow 'git -c user.name=x commit -m y'

echo; echo "passed $PASS, failed $FAIL"
[ "$FAIL" -eq 0 ]
