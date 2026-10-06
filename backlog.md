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
- Calendar (#77 dry run, #121 critique): raise role-label and roster/reserve caption contrast from the browser detector's measured 4.4:1 to PRODUCT.md's required 4.5:1 or better.
- Calendar (#77 dry run): make staffing requirements visible, not screen-reader-only, so sighted members can understand shortfalls without relying on count color.
- Calendar (#77 dry run): clarify roster-dependent absence choices and improve weekday scanning; weekdays are currently screen-reader-only.
- Loot sources (#93 review): remove the now-unused `ItemInput.explicit` field and its parser test assertions.
- Loot sources (#93 review): distinguish source conflicts from Wowhead failures in refresh responses, including the rare concurrent-insert refusal.
- Loot sources (#93 review): hide or disable Classic in the production add-item picker; keep both options locally and on staging.
- Reserve form (#95 critique): consider a brief draft-state hint explaining that Clear takes effect only after Save, alongside the copy work in #90.
- Reserve picker (#96/#119, #121 critique): keep Previously won readable for saved selections; native selects currently clip long count/ownership prefixes and require scrolling long option lists.
- Design documentation (#121 context): refresh the stale Impeccable sidecar from DESIGN.md with the document workflow when requested.
- Loot log (#121 review): include SR alongside HR in mergeAwards' pending-win list and test it; same-raid received-user filtering already prevents a wrong drop result, but the temporary list and comment lag the server rule.
- Reserve picker (#96 critique → #119): recover the approved phone inner width when moving the picker out of the nested inline form; recheck long item names and Save visibility.
- Reserve picker (#96 critique → #109): complete the approved “see who reserved it” promise with reserver details; keep the explicitly required interim wording until then.
- Reserve picker (#96 critique): seek approval before making a filled slot reveal its selected item's Remove action automatically, including what happens to an active search filter.
- Reserve picker (#96 review): render each row's Wowhead tooltip only while open instead of mounting ~160 hidden tooltips; add a draft-logic test for HR→SR auto-advance and Enter-doesn't-submit; skip search refocus after Choose on phone so the keyboard doesn't pop up.
- Loot table editor (#131 design → #123): the item row's refresh button shows ↻ as an empty box on the live site (the font lacks the glyph); swap it for an icon or a glyph the font has.
- Loot table editor (#123 critique): a disabled boss move arrow (↑ on the first boss) looks filled while the enabled one looks plain; check the ghost button's disabled style there.
- Reserve names pop-up (#109): say visibly which slot is "yours" (HR or SR).
- Reserve names pop-up (#109): list the member's own pick first.
- Site-wide: the dimmest grey text is just under the 4.5:1 contrast minimum; lift it.
- Loot blocks (#135): the two real-database suites (raids/[id]/reserves and the items route) copy the same container and lock-pause harness; move it into a shared test helper. `setItemBlocked(…, true)` is kept only for the reserves suite's direct-block cases; switch those to `blockItem` and drop it.
- Loot log (#122): `mergeAwards` counts only local HR records as reserve wins, so an SR win recorded in this tab doesn't hold that holder back from the next drop until the page refreshes; count SR too.
- Reserves section (#119): after the lock the lede still says reserves "will lock at", and a cancelled raid still shows the lock time (the approved design's wording); ask Robert for past-tense / no-time variants.
- Reserves (#119): HR/SR rules are no longer explained in the section (approved wording); link the lede or the slot cards to Loot rules.
- Reserves window (#119): an officer's own empty picks show "Change reserves" next to the chooser; "Pick reserves" may read better (state not in the approved design).
