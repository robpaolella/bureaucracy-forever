# Guild inputs to the shared design check

Follow [Maestro's shared design-check skill](/git/maestro/skills/design-check/SKILL.md)
for the full procedure, authority, manifest, captures, impeccable critique, independent
verdict and PR evidence. Supply [the guild checklist](design-reviewer.md) as an additional
input to its reviewer. This file supplies only the site-specific verification inputs.

## Routes, roles and state recipes

Use [SKILL.md](SKILL.md) for Launch, Doctor, Drive and Cleanup on **every** checkout.
The [feature index](features/README.md) maps public, member and officer routes,
entry points, seeded fixtures and actual user steps. Follow the relevant map rather
than visiting only the final URL. Never use real member data or real Discord calls.

- Public: `/`, `/about`, `/schedule`, `/recruitment`, `/loot`; role `out`.
- Member: `/apply`, `/members/calendar`, `/members/calendar/<seeded raid>`,
  `/members/availability`; roles `member` (Redtape) and `member-unsubmitted`
  (availability/application prompt), as appropriate to the feature map.
- Officer: planning, loot, availability, applications, class needs and roster routes
  in the feature index; role `officer` (Ledgerline). Include member denial checks
  for affected officer routes, per the index's shared officer proof.

Sign in through `/dev/session?as=ROLE&back=/ROUTE` on the Doctor-verified localhost
server, then explicitly select the page. `out` clears the stub login. This is not
proof of Discord OAuth or role syncing.

For each approved design state, record its ID, real route, role, seed fixture
(name/date plus this run's generated ID), entry point and exact user actions in the
shared evidence manifest. Reach states as follows:

| State kind | How to reproduce on the build |
| --- | --- |
| Route or audience | Use the role substitute above, then follow the feature's entry point. |
| Seeded data | Launch a fresh run; select the named fixture through the UI. IDs and dates vary, so record them rather than copying an old raid URL. Use only the feature map's approved fixture/import recipe. |
| Saved response or edited data | Use the feature map's real clicks/forms, wait for the result and reload to prove persistence. Never set state with JavaScript, internal actions or ad-hoc database writes. |
| Open menu, dialog, tab, filter or form validation | Reach it with real UI actions and fresh snapshot handles. Record entered sample values, selected controls and expected labels. |
| Empty, loading or error | Use an existing documented fixture/user path. If none reliably produces the approved state, report the missing safe recipe as a blocker to the conductor; do not fabricate the DOM or break the database/server. |
| Responsive or theme state | Use `resize 390 844` and `resize 1440 900`, plus any approved extra widths; use only a supported site theme/control. Calendar month is desktop-only; phone uses the list. Unsupported design states need Robert's decision. |

Capture all affected consumers of shared components. Calendar list changes require
both member and officer coverage at both widths. Include open menus/dialogs and
empty/error states; unreachable approved states block their comparison, not vanish
from it. Keep seed data, selected dates, viewer timezone and guild-time labels
comparable, and record dynamic differences.

## Checkouts and evidence

Keep the branch in place; main captures use a fresh detached worktree at
`origin/main`. Main and branch each follow this repo's Launch/Doctor with their own
throwaway database, server, named browser session and evidence subdirectory. Never
reuse a worker's resources or copy/inspect settings files. Follow Cleanup on each
run and retain its PASS output; do not remove a checkout containing work.

Evidence stays outside git in `$EVIDENCE`, including the shared manifest, snapshots,
main/build/approved images, critique, verdict and cleanup output. Use full-page
captures and `resize`, not viewport `emulate`. PR images must actually be attached
and viewable, not local paths. Follow AGENTS.md's per-PR Preview and separate staging
rules; local session proof does not prove real OAuth or authorize deployment/merge.
