# #100 — Member loot history, Everyone view

Issue: https://github.com/robpaolella/bureaucracy-forever/issues/100
Branch: `feat/100-loot-history` in `/git/bureaucracy-forever-worktrees/feat-100-loot-history`.
Conductor-dispatched worker. Finish through ship to an open PR; do not merge, deploy or ask Robert directly. Report decisions to the conductor.

Deliver `/members/loot`, member/officer-only and gated by LOOT_ENABLED. Group safe, non-voided awards by started, non-cancelled raids whose tier still has loot entries. Newest raids first; recorded order within. Whole-raid paging, about 50 awards per request. Reuse raid award rows; leave raid output unchanged. Add Loot history after Raid calendar in desktop/phone menus. Filters/character links are #180, not this PR.

Authority: `design/167-loot-history`, revision 1, covers #100. Design #167 is closed, PR #179 merged and closes it. Approval Robert 2026-10-06 “Approved.” Gate change authorized in #100 comments. State scope here: history-everyone, history-empty, history-menu at 390/1440; shared raid list regression too.

Allowed paths: original dispatch plus conductor's explicit `lib/nav.ts` and its test. Original: `app/(site)/members/loot`, `lib/member-loot.ts`, `lib/member-loot.test.ts`, `components/loot/`, `content/loot.ts`, `lib/auth/gate.ts`, `lib/auth/gate.test.ts`, `proxy.ts`, `components/shell/`. Work folder added at explicit context-handoff request. Do not edit the verification skill or seeds.

Done: checks, behavior/data-boundary proof, main/build/approved captures, dual-agent Impeccable critique, independent design and high-risk code review, sync main, Conventional Commits, PR closes #100 with uploaded evidence and Preview link.
