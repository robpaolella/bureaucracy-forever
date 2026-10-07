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
- Calendar (#77 dry run, #121/#180 critique): raise role-label and roster/reserve caption contrast from the browser detector's measured 4.4:1 to PRODUCT.md's required 4.5:1 or better.
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
- Shared time formatter (lib/time): use a non-breaking space before AM/PM so narrow cards don't break "7:00 / AM".
- Schedule week strip: when it returns to /schedule, its note adds "Day labels are guild days; your time may fall on the next day." (Robert, 2026-10-06)
- Reserves section (#119): after the lock the lede still says reserves "will lock at", and a cancelled raid still shows the lock time (the approved design's wording); ask Robert for past-tense / no-time variants.
- Reserves (#119): HR/SR rules are no longer explained in the section (approved wording); link the lede or the slot cards to Loot rules.
- Reserves window (#119): an officer's own empty picks show "Change reserves" next to the chooser; "Pick reserves" may read better (state not in the approved design).
- Availability desktop grid (#162): the pointer gestures (paint, select, resize, Escape-cancel) have no automated test; the repo has no DOM test library, so add one or a Playwright smoke test.
- Availability desktop grid (#162) and phone column (#163): × removes a block with no undo; offer Undo on the existing toast (new behaviour, Robert to approve).
- Availability desktop grid (#162): on tablets the desktop layout is touch, but its handles are 20px tall (Robert accepted them as a pointer-only exception); revisit with #163's touch handling.
- Site header at 768 wide: "Members" overlaps "Join Discord" and "Loot rules" wraps (pre-existing, seen during #162).
- Availability phone column (#163): the touch gestures (tap-select, hold-paint, handle resize, swipe) have no automated test; same gap as the desktop grid's.
- Availability phone column (#163): tapping empty space while a block is selected deselects and also paints a half-hour (as in the approved prototype); a deselect-only first tap may suit phones better (Robert to decide).
- Availability phone column (#163): no feedback when a 300ms hold turns into painting; check on a real phone and consider a brief highlight.
- Availability page intro says "Click and drag to paint", which reads wrong on phones next to the tap/hold hint.
- Availability phone column opens at 12:00 AM instead of 5:00 PM when the page loads at desktop width and is then narrowed (the scroll runs while the column is hidden; pre-existing).
- Availability desktop grid (#162): resizing measures from the edge rather than where the handle was grabbed, so a grab well off the edge can jump a half-hour (fixed on phone in #163; less likely on desktop's 20px handles).
- Raid page roster on phones squeezes member names to one letter (pre-existing; seen during design #167, local 390 capture).
- Loot history (#100): a date filter, if history grows long enough that Character + Raid + "Show more" isn't enough (Robert's idea, design #167).
- Loot history (#100 critique): preserve loaded raids on a paging failure with an inline retry; new failure wording/state needs Robert's approval before replacing the existing error boundary.
- Loot history (#100 critique): announce appended raids to screen readers and retain useful keyboard focus when the final "Show older raids" button disappears.
- Loot history (#100 review): run the opt-in Postgres paging tests in CI and add a mixed active/voided-award budget case; the current 9/9 local run is not CI coverage.
- Shared member loot row (#99/#100 critique): give screen readers the desktop column associations and an explicit bank-row winner description; current headers are aria-hidden and the labelled dash is not reliably announced.
- Members switch their own main (Robert, 2026-10-06: "We might want a method for someone to switch their main at some point.")
- Show socials on the roster so they can manage their alts (Robert, 2026-10-06: leave for now).
- verify-guild: a documented local-only recipe for populated loot history (started raids with recorded awards, enough for 'Show older raids'); #99 and #100 had to record awards by hand through the officer UI.
- Member character routes (#170): former guild members who keep a site login and a main can still edit their own characters; closing it needs a real Discord server-membership signal (bot contract + migration).
- Character switch (#173 review → #178/#175): consider switch-specific eligibility wording instead of the reused “Sign up as Accept or Tentative to reserve.”
- Character switch (#173 review → #189): decide how to align legacy reserves already on a different character; #173 deliberately preserves the specified same-character no-op (no writes).
