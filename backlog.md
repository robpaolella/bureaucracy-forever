- `.githooks/pre-commit` and `.githooks/pre-push` have no automated test suite (the old
  `.claude/hooks/test-git-guard.sh` only tested the retired PreToolUse hook, not these). Build
  one if they change again.
- The `staging` branch has ~54 commits not on `main` (mostly merge commits); decide whether to
  bring it back in line with `main`, and how without force-pushing.
- Agents can't open Vercel previews or staging (Vercel login). If the trial shows workers need
  to check deployed pages, set up Vercel's "protection bypass for automation" (Robert would
  create the secret).
- `SYNC-SPEC.md:428` still lists `bash .claude/hooks/test-git-guard.sh` under "Done means", but
  that file is deleted as part of onboarding this repo to Maestro. It's a shared contract with
  the Discord bot repo, so left alone here — needs a coordinated edit to both copies once
  that repo's onboarding also lands.
- Local database commands (#74): consider clearer Docker failure diagnostics, tests for rejected port bindings, and cleanup when initial setup is interrupted; normal reruns already recover interrupted setup.
- Add automated failure-path tests for server identity, container ownership/replacement and cleanup refusal before extending the verification lifecycle helper (review #75; happy-path teardown is browser-run verified).
- Calendar (#77 dry run): raise role-label contrast from the browser detector's measured 4.4:1 to PRODUCT.md's required 4.5:1 or better.
- Calendar (#77 dry run): make staffing requirements visible, not screen-reader-only, so sighted members can understand shortfalls without relying on count color.
- Calendar (#77 dry run): clarify roster-dependent absence choices and improve weekday scanning; weekdays are currently screen-reader-only.
