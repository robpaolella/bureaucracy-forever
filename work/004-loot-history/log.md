# Log / handoff — 2026-10-07

## Start the next session

Routing run at handoff:
`node /git/maestro/routing/route.ts worker --floor hard --task 'Continue bureaucracy-forever issue #100: implementation complete; finish local evidence and design critique, independent high-risk review, sync main, checks, and open PR. Preserve existing work and follow handoff.'`

Resolved **openai/gpt-6-astra, thinking low** (`--model openai/gpt-6-astra --thinking low`). Router's Jev helper failed on a missing Pi typebox module; it explicitly fell back to minimum hard tier. This was not a review/model-availability refusal.

Exact start command, in a new labelled tab in this project's herdr workspace (conductor obtains returned pane ID, never split):
```
cd /git/bureaucracy-forever-worktrees/feat-100-loot-history && pi --model openai/gpt-6-astra --thinking low "Continue conductor-dispatched #100. Read work/004-loot-history/brief.md, plan.md and log.md first. These uncommitted changes belong to this task, not stray work. Preserve them. Complete verification, reviews and ship to an open PR; report its link to the conductor and stop. Do not merge or ask Robert directly."
```
Equivalent herdr launch after creating the new tab:
`herdr agent start guild-100-finish --kind pi --pane <returned-pane-id> -- --model openai/gpt-6-astra --thinking low`
Then prompt it with the quoted handoff instruction above. Do not start in old context.

## Current state

No PR, push or commit yet. All implementation edits remain in the worktree. No stray/unrelated edits. HEAD `f98d7904ffe1c68927eaa28580aa9c28b52b3d51`; fetched origin/main `4a65bbdc14f77092e35039d725df1b594e773fbf` (#185 officer roster rules). No overlapping open PR initially; #185 has since merged. Sync after committing owned changes (unpublished → rebase per sync skill). No auth/seed/migration/deploy settings changed beyond explicitly authorized gate regex.

Files changed/new:
- `lib/member-loot.ts`: extracts shared safe select and mapper; new `loadMemberLootHistory(before)` checks flag and role itself. Repeatable-read transaction selects up to 51 *raid metadata/counts*, excluding cancelled/future/no-table/no-active-award raids. Orders startsAt desc then id desc; picks whole raids while count <=50, always at least one (oversized raid alone). Only selected raids' safe awards fetched, createdAt asc/id asc. Cursor tuple startsAt/id avoids equal-date skips. No total summary query (optional in issue).
- `components/loot/RaidLoot.tsx`: exports `MemberAwardList`, reuses in original wrapper; rendered award markup unchanged.
- `components/loot/LootHistory.tsx`: initial server data, grouped linked headings/date in GUILD_TIMEZONE/count, shared list; append older via authenticated endpoint. Button's existing loading state; timeout 15s. Access loss clears list + refresh; other failure goes to site's existing error boundary (Retry), no new error UI. Uses client local history state. Review async race/unmount/focus behavior as normal; no special test for client append yet.
- `app/(site)/members/loot/page.tsx`: member loader/notFound, approved page head, EmptyState via client.
- `app/(site)/members/loot/older/route.ts`: validates ISO date/id cursor; private,no-store; loader result or 404. Invalid cursor 400.
- tests: existing member loader access tests extended; new `older/route.test.ts` has route denial/malformed tests and opt-in real Postgres fixtures (own fresh Docker, all migrations, cleanup; never browser DB). Covers ties, 30+20 exact budget, 51 oversized alone, next single raid/end, order, omissions, bank, deleted names, private-field exclusion. `LOOT_HISTORY_INTEGRATION=1 npx vitest run 'app/(site)/members/loot/older/route.test.ts'` passed 9/9.
- `lib/nav.ts` new MEMBER_LINKS.loot, its test. Both shell menus require Session.loot and role != social. New `components/shell/loot-navigation.test.tsx` SSR tests for every role/flag.
- `lib/auth/gate.ts` MEMBER_ONLY regex covers availability|loot; tests extend both loot page and older endpoint. Existing proxy already matches, unchanged.
- copy in `content/loot.ts` LOOT_HISTORY. Exact approved lede still mentions picking a character as required by issue, even though filters/character links intentionally come in #180.

Implementation ~310 changed lines before work-folder docs, within approximate 400 threshold. Do not expand silently. First repo checks all passed in required order; logs `/tmp/guild-100-evidence/tests.txt` (820 passed, 33 skipped), `build-check.txt`. This includes new shell tests. Initial failed typecheck (wrong fixture property sortOrder) was fixed to position; later all pass. Build ran while local server was up; subsequent Doctor passed and browser rendered normally.

## Conductor decisions (all answered)

1. `lib/nav.ts` and its test were omitted from dispatch paths. Conductor explicitly added them; use shared MEMBER_LINKS and flag-gating. No further path question open.
2. Safe fixture gap: conductor says **no new recipe/seed/skill changes in this PR**. On isolated local sample site import as mapped, record awards via real dev-officer loot log, void one. If enough raids/awards for browser second page impractical, prove whole-raid paging with route/loader tests on isolated Postgres and plainly state browser tested first page only. Conductor owns fixture-recipe follow-up.
3. Handoff requested explicitly at 72.1% context. Work folder added for multi-session continuation. No unanswered numbered questions.

## Evidence and RUNNING resources (transferred to successor)

Evidence root **`/tmp/guild-100-evidence/`**. Both runs are still running to preserve expensive UI-created sample data for review. This is an intentional handoff, NOT Cleanup PASS. Require Doctor before driving; cleanup both at finish even if blocked. No helper Pi/herdr tabs created yet.

Build: current worktree, `/tmp/guild-100-evidence/build/run.json`, server `http://localhost:39921`, named browser `guild-100-build`, selected page 2. Main: fresh detached worktree **`/tmp/guild-100-main`**, baseline 4a65bbd, evidence `/tmp/guild-100-evidence/main/run.json`, server `http://localhost:45935`, browser `guild-100-main`, selected page 2. Each owns distinct loopback Docker DB/server/process group. Helpers hold IDs; do not kill by process name.

Commands:
```
npx tsx .pi/skills/verify-guild/run.ts doctor /tmp/guild-100-evidence/build
(cd /tmp/guild-100-main && npx tsx .pi/skills/verify-guild/run.ts doctor /tmp/guild-100-evidence/main)
bash /tmp/guild-100-evidence/browser <axi command>
GUILD_RUN=main bash /tmp/guild-100-evidence/browser <axi command>
```
Wrapper clears auto-connect/URL/profile/MCP_SERVER/PORT and isolates session. It invokes npx chrome-devtools-axi. Browser startup worked; `newpage` reports no selected page until explicit `selectpage 2` (done). Use resize 390 844 / 1440 900, never viewport emulate. `eval` used only read-only DOM/font/image inspection. No JS state/DB mutations.

Outside-repo helper `/tmp/guild-100-evidence/act.py` finds a **fresh** handle from `snapshot --full` by exact button/combobox/textbox/spinbutton/Date/InputTime/link label and then real CLI click/fill. E.g. `python3 .../act.py fill ITEM 'Deathbringer'`. `GUILD_RUN=main` targets main. It writes action-before.txt under build regardless of target (don't treat that file as stable evidence). It sleeps .8sec; navigation may need explicit wait. Its output is truncated CLI snapshot; retain full final snapshots separately.

### Build fixture / completed proof

Approved Onyxia import: 26 items, 0 failed (`build/import.txt`). Imported into run's Docker-derived port through process environment only; no settings files opened/copied. `write-guard.ts` was read before import.

Raid **Onyxia's Lair**, ID **cmuyaj0qe002d9ap0j0tn9jpr**, URL `/members/calendar/cmuyaj0qe002d9ap0j0tn9jpr`.
Originally Oct7 20:00 guild. Real Edit raid UI rejects past starts (“That start is already in the past.”); don't fake clock or mutate DB. Set start a few minutes ahead, **Oct7 09:09 guild** (16:09Z), saved and reloaded, waited naturally. Now started/live until 12:09 guild. `started-schedule.txt` confirms saved time.
IMPORTANT native date/time `fill` changes DOM but React state didn't reliably commit. Use real keyboard on sub-spinbuttons: click Hours Hours, press ArrowUp; click Minutes Minutes, press digit keys (0 then9 etc); click AM/PM AM/PM, ArrowDown; Tab, Save changes. Day spinbuttons likewise. Do not use eval setters. Earlier attempts to set Oct6 failed validation; no unintended changes persisted.

Recorded via real officer log, persisted by full reopen:
1. Deathbringer → Charter, Open roll 74, note `Sample private officer note`.
2. Sapphiron Drape → Treaty, Soft reserve 62.
3. Onyxia Hide Backpack → Disenchant / bank via named button.
4. Ring of Binding → Ledgerline, Hard reserve, no roll.
5. Head of Onyxia → bank, then Void through real dialog with `Sample private void reason`.
Officer full readback `build/officer-recorded-voided.txt`. Member history contains exactly four active awards in recorded order; no private note/reason or Head of Onyxia. Browser first page only, paging proved by opt-in Postgres tests per conductor permission.

Build screenshots existing:
- history-empty-390.png, history-empty-1440.png (before awards)
- history-everyone-390.png, history-everyone-1440.png
- history-menu-390.png, history-menu-1440.png
- raid-recorded-390.png, raid-recorded-1440.png (actually live due to 09:09 start; label manifest accordingly)
All six history screenshots opened with image read and inspected. Correct layout/no clipping, no horizontal overflow at 390/1440. Prototype comparison: omitted prototype toolbar, filter bar, character links intentionally excluded by scope; only one sample raid/four awards vs four prototype groups; heading link min44 high for touch requirement; count uses brighter existing fg-muted. EmptyState matches approved. Need inspect both raid captures yet.
Phone menu was actually used to navigate from member raid to Loot history. `build/history-populated.txt` retains snapshot. Browser currently on history at 1440 with Members menu open. Additional officer-history and logged-out checks / item keyboard tooltip / raid-link proof still worth completing and recording.

### Main baseline / next immediate action

Captured and stored `main/roster-390.png`, `roster-1440.png`, `menu-390.png`, `menu-1440.png`. New history route doesn't exist on main; roster serves as predecessor shell/head/menu. Both **menu** images inspected; roster images not yet inspected.
Imported Onyxia on main (26 items/0 failed). Main raid ID **cmuyak1p4002drnp021ifqdxp**. Real officer UI changed start from20:00 to **09:13 guild on Oct7** (16:13Z), a few minutes ahead; saved. Recorded same four active awards as build via UI, no voided fifth needed for visual baseline. At last command clock was 16:11:55Z; simply wait until >=16:13Z, sign in as member with `.../dev/session?as=member&back=/members/calendar/cmuyak1p4002drnp021ifqdxp`, fully reload, confirm Loot section, settle fonts/images, capture at both widths. This gives shared-row before/after with comparable data. Main browser currently officer on that raid at1440.

Cleanup later:
```
bash /tmp/guild-100-evidence/browser stop
npx tsx .pi/skills/verify-guild/run.ts cleanup /tmp/guild-100-evidence/build | tee /tmp/guild-100-evidence/build/cleanup.txt
GUILD_RUN=main bash /tmp/guild-100-evidence/browser stop
(cd /tmp/guild-100-main && npx tsx .pi/skills/verify-guild/run.ts cleanup /tmp/guild-100-evidence/main) | tee /tmp/guild-100-evidence/main/cleanup.txt
```
Require both Cleanup PASS; preserve evidence and don't remove unrecognized data/worktrees.

## Design/review inputs and remaining work

Read skills again as needed: shared design-check, verify-guild, review, ship, sync-branch. All were loaded this session. Impeccable context ran once with components/loot/RaidLoot.tsx, successfully loaded PRODUCT.md and DESIGN.md. Reported existing stale `.impeccable/design.json`; disclosed to conductor, no changes. No detector/critique/reviewer started yet. Need A+B separate isolated subagents, A not primed with detector; live browser new tabs/sessions plus Doctor. Use read-only-run launcher for independent design and code verdicts; risky-review for high risk, checker for design, actual maker openai/gpt-6-astra. Fresh review model must be other company. Follow one fixes-only recheck limit.

All 20 approved images opened in this session. Brief, decisions, design.json, approved manifest read. index.html is huge embedded export (~1MB first line); `read` couldn't return line1. A sanitized **evidence-only** copy at `/tmp/100-design-readable.html` strips embedded data payloads and splits tags/braces. Read complete prototype JS at lines4720–5291, which contains page/row layout/interactions; generated exported CSS and unrelated original raid DOM earlier in the file not fully read. Source never modified. Do not claim full raw index read. Useful relevant styles around2177; same layout already visible in inspected approved images.

Need evidence manifest outside git with exact IDs/routes/roles/state recipes/fixtures/main/build revision/dirty diff, viewport and actual PNG dimensions, inspected paths, per-state design comparison. Map six history entries in scope; #180 owns other history states, #99 shipped raid states. Include shared row regression captures. Don't claim absent browser pagination proof; Postgres test allowed alternative. Include build first-page-only limitation in PR.

Before reviews/PR commit implementation in logical commits (all current work ours), sync origin/main (unpublished rebase), rerun checks in order. Read git workflow as needed. No branches switched in primary repo. Keep schema/auth scope limited. Current code risk high (member data exposure + gate). Open PR only after complete design/code verdicts. PR attach actual PNGs using gh --attach; no /tmp-only evidence. Need per-PR Vercel Preview URL (and note signed-in OAuth needs staging; do not stage/merge without conductor explicit direction). User requested PR link and stop.

## Recovery checkpoint — after VM restart, 2026-10-07

HEAD is `9154ee7`; implementation and previous handoff are committed, worktree clean at arrival. The earlier “No PR, push or commit yet” and running-resource descriptions above are historical, not current.

`/tmp/guild-100-evidence/` and `/tmp/guild-100-main` are gone. No screenshots, assessment outputs or ownership `run.json` records survived there. All evidence-dependent plan items must be revalidated; earlier checked captures record historical completion only.

Two old verification databases survive **stopped**: `2e43bf28730e` (`bureau-feat-100-loot-history-326a12f3e3941e30`) and `b0c75b672326` (`bureau-guild-100-main-ff0c89f38c37a04c`). No database was started, reset or removed. The verification helper refuses launch in this checkout while its database exists, and Cleanup requires the missing original ownership record. Do not fabricate that record or reset the surviving sample awards. The old main worktree is no longer registered.

Reported recovery decision to conductor: recommend fresh detached verification worktrees for build and current main, sequentially, leaving the stopped containers intact; alternative is an explicitly approved recovery procedure for the old sample databases. Fresh runs require recreating imported loot/sample awards via the approved real-UI recipe. No images read in this continuation, no servers started, no review verdict claimed, no PR opened.

## Still open

- Recovery approach for the surviving stopped verification databases and lost ownership records (recommend fresh verification worktrees, preserve old containers).
- Remaining execution: recreate evidence, independent assessments/design verdict, high-risk code review, sync, final checks and PR.
