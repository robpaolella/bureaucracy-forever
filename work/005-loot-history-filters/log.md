# 005 — Log

## 2026-10-07
- Implementation is committed as `e8e0692 feat(loot): add history filters`. It changes only dispatched paths and adds `components/loot/LootHistory.test.tsx`, also an expected dispatched path. It supplies separate URL parameters `characterId`, `characterName`, and `templateId`, so a recorded name cannot be interpreted as an id.
- Automated evidence passed before the commit: `npm run lint`, `npm run typecheck`, `npm run test` (909 passed, 62 skipped), `npm run build`, plus `LOOT_HISTORY_INTEGRATION=1 npm run test -- 'app/(site)/members/loot/older/route.test.ts'` (10 passed). The integration test owns a disposable Postgres container and covers totals, valid/unknown character and template filters, former names, and paging.
- First verification run `/tmp/verify-guild-uYxDna` imported Onyxia verification loot (26 items, 0 failures), captured/inspected the empty history at 1440 and 390, then Cleanup PASS. It had no awards, so cannot prove filters.
- Second verification run `/tmp/verify-guild-Ikqk2c` also imported 26/0 and opened the existing Onyxia raid as dev officer. An attempted record did not appear in history because that raid had not started under the server clock. Cleanup PASS. Do not reuse either run.
- Conductor clarified this is settled: create/populate started raids via the actual officer UI (same approved method as #99/#100), record several awards over two/three raids for several characters including an alt, void one, then capture populated Everyone, filtered, character, and no-results states at 390/1440. Hand-recording >50 awards is not required; the Postgres test is acceptable paging proof and must be stated in the PR.
- The next worker should start a single new run, use the local verification map's actual UI flow, and edit a generated raid's start to a few minutes in the future through the UI, wait until it starts, then use officer loot log. Do not direct-write the database or fake time. Keep one local site at a time and do not read many screenshots into the session.

## 2026-10-07 — Retry progress
- Rebased unpublished branch on main `89e38b0` (#194). Checks passed: lint, typecheck, test (911 passed / 79 skipped), build; explicit disposable-Postgres older-route tests 10 passed.
- Evidence root `/tmp/loot-180-evidence`. Main baseline history captured with real recorded awards; first main raid capture timed out on lazy image decoding, so a second owned run recaptures it. First main run Cleanup PASS.
- Build browser proof completed through real officer UI on two Onyxia raids: 7 awards, one voided, member history 6 visible, Ledgerline 3. Character link, native filters, phone sheet, Done/Clear, no-results and unknown-filter fallback exercised. No private void reason in member output. Build Cleanup PASS.
- Browser InputTime `fill` did not persist the edit; actual keyboard Hours/Minutes + Tab did. Reload verified future times before waiting for real starts. Never changed database/time directly.
- Dual isolated Impeccable critique: 33/40, two fixes (44px link targets; approved character metadata grouping/grid). Fixed both; refreshed captures. Corrected X-of-X filtered totals/default Everyone selection and added regression test. Existing calendar contrast finding already in backlog, added #180 reference. No redesign.
- Pending: finish main raid recapture; independent design verdict then code review; final Checks; PR with actual attachments. See manifest and critique reports in evidence root.

## Next session
Route resolved: OpenAI GPT-6 Astra, low thinking.

Exact start command:
```bash
cd /git/bureaucracy-forever-worktrees/feat-180-loot-history-filters && pi --model openai/gpt-6-astra --thinking low "Continue conductor-dispatched Bureaucracy issue #180. Read work/005-loot-history-filters/brief.md, plan.md and log.md first. Finish browser verification using the real officer UI, then the required design check, review and ship to an open PR. Do not merge or ask Robert directly."
```
