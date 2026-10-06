# Design decisions: reserve picker

- Design issue: #118; covered build issues: #96, #109, #119
- Revision: 1; replaces: none
- Maker: claude-bridge/claude-opus-5-5, medium thinking (route `role design-feature`)

## Choice and approval
Chosen: **B2** (round 2 variant of version B) with the round-3 refinements below. Why: B gives the clearest
decision context (pick a slot, see the item, then choose); B2 keeps the panel and the raid page short by
showing HR/SR counts that open the names on hover or tap.
Robert's confirmation, herdr design-96 tab, 2026-10-05: "B2 is approved." This authorizes the design PR.
Design PR: linked on design issue #118 once opened. Only Robert merging that PR approves the design for
building; chat approval, a critique PASS and a closed/unmerged PR do not.

## Alternatives
Round 1 (2026-10-05): three compositions. Robert chose **B**. All-version evidence, captured before A and C
were removed: [round-1 manifest](screenshots/all/round-1/manifest.json) (90 images: 3 versions × 15 states
× 1 theme × 2 widths; this capture includes the round-1 critique fixes).

| Version | What differs | Outcome |
| --- | --- | --- |
| a | Two search fields like softres.it; details expand inside the list | Rejected: Robert chose B ([images](screenshots/all/round-1/), `a-*`) |
| b | Pick a slot (HR/SR), browse one list, details in a side panel (bottom sheet on phone) | **Chosen**, refined in round 2 (`b-*`) |
| c | One list with HR and SR buttons on every row; details beside the window | Rejected: Robert chose B (`c-*`) |

Round 2 (2026-10-05): B with Robert's comments applied, in three variants that answer his pins 5 and 6
(how reserver names are shown in the details panel and in "Who reserved what"). Everything else is identical.
Robert chose **B2**. All-version evidence, captured with round-3 refinements before b1 and b3 were removed:
[round-2 manifest](screenshots/all/round-2/manifest.json) (90 images: 3 variants × 15 states × 1 theme × 2 widths).

| Variant | Names in the details panel (pin 5) | "Who reserved what" (pin 6) |
| --- | --- | --- |
| b1 | Plain vertical list, one name per line, character on the right | Folded behind "Show who reserved what · N items" |
| b2 | "Reserved by HR 4 / SR 7" count buttons; hover or tap opens the names in a pop-up | One line per item with the same HR/SR count buttons |
| b3 | Vertical list of the first 4 names, then "Show all N" | One line per item with the first three names and "+N more" |

## Independent critique
- Maker: claude-bridge/claude-opus-5-5 (Anthropic). Reviewer: openai/gpt-5.6-terra, medium thinking
  (route `role checker --maker claude-bridge/claude-opus-5-5`), 2026-10-05.
- Command: `node /git/maestro/scripts/read-only-run.ts <worktree> review /git/maestro/skills/design-feature/reviewer-prompt.md "<design folder, evidence, issues>" -- --model openai/gpt-5.6-terra --thinking medium`.
  Repo confirmed unchanged by the run.
- First verdict: **FIXES** (78 images inspected, all readable):
  1. No "Shared" item shown. **Fixed:** new state `shared-item` (search "scale"; Shard of the Scale shows
     "Shared" in the row and "Drops from Onyxia and Nefarian" in details; Nefarian is a sample second boss).
  2. Officer coverage incomplete. **Fixed:** "Reserves for" chooser added inside the window for officers;
     new state `officer-locked` shows the locked message with the chooser and Change reserves still available.
  3. Window didn't demonstrate the site's dialog keyboard contract. **Fixed:** opening moves focus into the
     window (search field), the page behind is inert, Tab/Shift+Tab stay inside the window (or the open
     phone details sheet), Escape closes the innermost layer, and focus returns to the opener. Verified
     offline in all three versions.
  4. Decision 5 (when the window appears) still Robert's. **Escalated to Robert** with the versions.
- Round 1 fixes-only re-check (same reviewer and model, 2026-10-05): **PASS** on fixes 1, 2 and 3; all 90 refreshed
  images readable and inspected. Fix 4 remains with Robert. Evidence: `/tmp/design-review-y87Bak` (outside git).

- Round 2 (b1/b2/b3), same reviewer and model, 2026-10-05: **FIXES**, 90 images and 36 crops inspected.
  1. "Previously won" rule not settled or owned. **Fixed:** Robert's words recorded (pin 8); rule is #121,
     X-times limit #122. Offline proof: Deathbringer refused for both HR and SR in b1–b3, with reason and hover text.
  2. Tooltip "follows the mouse" not demonstrated. **Fixed:** offline proof records the tooltip moving with
     the pointer (x 322→430 moves tooltip 338→446) in all three variants.
  3. b1 phone sheet at maximum density. **Fixed (proof):** sheet body scrolls (691 vs 617 px), Tab reaches
     "Item stats" inside the sheet and scrolls it into view; capture kept.
  Proof: `offline/proof-fixes.txt` in the round-2 evidence folder.
- Round 2 fixes-only re-check: **PASS** on fixes 1, 2 and 3 (2026-10-05).

## Comments and changes
Robert chose version **B** (herdr, 2026-10-05: "I've decided to go with option B"). Decision 5 confirmed: "Agreed, this is the right behavior."

| ID / source | Version / element | Original note | Agreed change and verification | Resolved |
| --- | --- | --- | --- | --- |
| cmt_e80e9f35 (pin 1) | b / disabled Choose button | Hover on the unavailable button should say "This item is ineligible to be reserved for this raid." | Done in b1–b3: hover or focus on the unavailable button shows "This item is ineligible to be reserved for this raid." plus the reason; reason also stays as text for touch. Verified offline. | 2026-10-05, resolved |
| cmt_8e1c75df (pin 2) | b / row icon | Icon should fill the row's height. | Done: 36px icons in list rows (b1–b3), verified in captures at 390/1440. | 2026-10-05, resolved |
| cmt_fdd24a52 (pin 3) | b / slot card icon | Icon larger here too. | Done: 36px icons in HR/SR cards and the details panel (28px on phone cards). | 2026-10-05, resolved |
| cmt_0ce10cdb (pin 4) | b / item stats in panel | Stats tooltip too long; make it a real Wowhead-style tooltip that follows the mouse over icon or name, not permanent in the panel. | Done: stats removed from the panel; hovering icon or name shows the Wowhead tooltip following the mouse; "Item stats" button opens it for keyboard/touch; Escape closes. Verified offline. | 2026-10-05, resolved |
| cmt_800017cb (pin 5) | b / who reserved in panel | Names list hard to read; options wanted: vertical list, hover HR/SR count to show list, others. | Robert chose B2 (herdr, 2026-10-05: "I like B2"): HR/SR count pills open the names on hover or tap. | 2026-10-05, resolved |
| cmt_30576e0a (pin 6) | section / Who reserved what | Too long; maybe don't show at all, but it must change. | Robert chose B2 (herdr, 2026-10-05: "I like B2"): one line per item with HR/SR count pills that open the names. | 2026-10-05, resolved |
| cmt_a800b259 (pin 7) | window / lede | "Please select one hard and soft reserve item. They must be separate items. You can change your selection until {lock time}." | Done: window lede uses Robert's wording with "one hard and one soft" and the guild + local lock time; the separate lock line was removed. | 2026-10-05, resolved |
| cmt_0240d3a1 (pin 8) | row / unavailable reason | "Previously won", red, and a won item (HR or SR) can't be reserved again for either; officers need per-item "reservable X times" (new issue via conductor). | Done in design: "Previously won" in red on both reserves. Rule change #121, per-item limit #122 (conductor). | 2026-10-05, resolved |
| cmt_edb96ff2 (pin 9) | calendar page lede | "Bureaucracy's upcoming raids and attendance. Attendance answers in Discord are reflected on the web calendar as well." | Handed off: page-level calendar copy sent to the guild conductor (outside this design, per 011 Q14). | 2026-10-05, resolved |
| cmt_094976ee (pin 10) | section / lede | "You may select one hard and one soft reserve per raid, on different items. Reserves for this raid will lock at {lock time}." | Done: section lede uses Robert's wording with the dynamic lock time; header lock line removed so it appears once. | 2026-10-05, resolved |
| cmt_75821ff1 (pin 11) | section / locked | "Reserves are locked. Please contact an officer to request a change." | Done for members. Officers see "Reserves are locked. As an officer, you can still change them." | 2026-10-05, resolved |
| cmt_9540d78d (pin 12) | section / not eligible | "You must be signed up to this raid to reserve items." | Done: "You must be signed up for this raid to reserve items." | 2026-10-05, resolved |

Round 3 (Robert, herdr, 2026-10-05, after choosing B2): "change the wording to \"Currently reserved by\" with
wider pills below them" and "remove the Item Stats button since they can just hover the item."
- Done: caption "Currently reserved by" with two full-width HR/SR pills below it.
- "Item stats" button removed. Hover over the icon or name still shows the following tooltip. Keyboard and
  touch can't hover, so the item's name in the details panel is itself the control: tap or Enter opens
  the same tooltip, Escape closes it (as the live site's `ItemName` does today). No separate button.
  Verified offline (`offline/proof-round3.txt`).
Robert confirmed decision 19: officers keep "Reserves are locked. As an officer, you can still change them."

Approved evidence: [manifest](screenshots/approved/manifest.json), 30 images (15 states × default theme ×
390 and 1440), all inspected; below the prototype bar they are pixel-identical to the inspected round-2 B2
captures. `index.html` rechecked with the network Offline (open "Pick reserves", search, open names,
choose, save; no non-file/data requests). Screenshots were losslessly recompressed (pixels verified identical).
The editable host snapshot (`host.html`) was removed after this final offline proof; `index.html` is
self-contained.

## Experiment
None. No real-site experiment was needed; all behaviour was decided in the static versions.

## Open items
None affecting the approved scope. Outside it, tracked elsewhere:
- #121 (won items can't be reserved again) and #122 (per-item reserve limit): rule changes the design displays.
- Calendar page lede copy (Robert's pin 9): handed to the guild conductor.
- Discord bot prompt after sign-up and the reserve reminder: bot repo issues (relayed to the bot session; #120 on the site side).
- Clear saving immediately without undo (Robert, decision 3): backlog, unchanged by this design.

## Build handoff
Merged folder/revision is the feature authority; DESIGN.md/live site govern site-wide
look. Reconcile issues and paused branches in prep before marking ready. Without a
conductor, the design session owns that follow-up. Later revisions use new issues/PRs.
