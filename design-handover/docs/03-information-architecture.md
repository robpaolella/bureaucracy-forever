# 03 — Routes, roles and access

## Routes

| Route | Access | Artboard |
|---|---|---|
| `/` | public | `reference/Home.html` |
| `/about` | public | `reference/About.html` |
| `/schedule` | public | `reference/Schedule.html` |
| `/recruitment` | public | `reference/Recruitment.html` |
| `/recruitment/submitted` | public | spec only — `docs/04 § Submitted` |
| `/loot` | public | `reference/Loot.html` |
| `/members/availability` | member | `reference/Availability-Member.html` |
| `/members/roster` | member | spec only — `docs/04 § Roster` |
| `/members/calendar` | member | spec only — `docs/04 § Calendar` |
| `/members/calendar/[raidId]` | member | spec only — `docs/04 § Raid detail` |
| `/officers/availability` | officer | `reference/Availability-Officer.html` |
| `/officers/applications` | officer | spec only — `docs/04 § Applications` |
| `/officers/applications/[id]` | officer | spec only — `docs/04 § Application detail` |
| `/api/auth/*` | — | Auth.js Discord provider |

Everything under `/members` and `/officers` is `noindex` and gated in middleware, not just
in the component. Public pages are statically rendered; member pages are dynamic.

---

## Roles

Three levels, derived from Discord guild roles at sign-in and cached on the session:

| Role | Gets |
|---|---|
| `social` | Public pages, roster, calendar. No availability, no sign-ups. |
| `member` | Everything social has, plus availability, raid sign-ups, trial or raider rank |
| `officer` | Everything, plus the heatmap, window finder, applications inbox, class-need editing |

Map Discord role IDs to these in one config file. If a Discord role is removed, the next
sign-in demotes them — don't cache role beyond the session.

`rank` (Officer / Raider / Trial / Social) is a **display** attribute on the roster and is
stored separately from `role`, which is the access level. An officer is always rank Officer,
but a Trial is `role: member`.

---

## Session states to build and test

1. **Logged out** — no Members or Officers nav, both Discord buttons in the header,
   member routes redirect to Discord OAuth.
2. **Member** — Members group, avatar pill, no Officers group; `/officers/*` returns 404
   (not 403 — don't confirm the route exists).
3. **Officer** — both groups, pending-application count badge in the nav and the menu.
4. **Member who hasn't submitted availability** — the Members menu shows a warn-toned
   "Not submitted" note against My availability, and the calendar shows a one-line prompt
   above the list. Nothing blocks.

---

## Empty states that need designing into the build

Each names what will fill it and who fills it — no "Nothing here yet."

- **Empty roster** — before the first sync. "The roster syncs from the guild roster export.
  Officers can trigger it from the Officers menu."
- **Empty calendar** — "Officers schedule raids from Discord or here. The next one will show
  up the moment it is posted." + "Schedule a raid" for officers, no button for members.
- **Empty applications inbox** — "Nothing pending. New applications land here and ping
  #officers."
- **No availability submitted by anyone** — the heatmap shows the grid at `--heat-0` with a
  centred overlay, not a blank page.
- **Window finder with no results** — inline in the panel, not a page state:
  "Nothing in the week holds those numbers for the full length. Lower a minimum or shorten
  the raid."
