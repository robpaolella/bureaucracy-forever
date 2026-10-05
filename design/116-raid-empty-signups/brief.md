# Design: Raid detail with no sign-ups yet

> **[TEST maestro#68]** Disposable design record for the Maestro #68 dry run. The
> approvals below are simulated by the parent session playing Robert; they are not
> real approval, and this record is not to be merged.

- Design issue: #116
- Revision: 1
- Replaces: none
- Source plan: none (build issue #115 exists)

## Job and audience
A member opens a raid from the member calendar (`/members/calendar/<raid>`) soon after it
is posted. Nobody has answered yet. Today the page reads as a problem or a contradiction:
a large red "0 accepted of 40 needed", forty "No answer yet" rows, a forty-name
"Hasn't answered" paragraph, or, before the roster is filled in, "Nobody is on this roster
yet. The roster comes from rank…" beside "Everyone on the roster has answered." The member
should instead understand at once that nobody has answered yet and that they can answer
here or in Discord before sign-ups lock. Their own Accept / Tentative / Absent control
stays the primary action.

Product facts: roster rows come from rank and are added by the bot's tick shortly after a
raid is scheduled, each with no answer (SYNC-SPEC §6, `lib/tick.ts`); answers arrive from
the web or Discord (PRODUCT.md, Operating Context); times are labelled guild time with a
viewer-local equivalent.

## Covers
| Build issue (or planned slice) | Part of this feature | Out of scope |
| --- | --- | --- |
| #115 | Raid detail wording and arrangement when an open raid has zero answers, with and without roster rows; normal state unchanged | Calendar list/month, locked/cancelled/past wording, officer actions, bot, seed |

## Boundaries and visual authority
- `DESIGN.md` and the live site govern the look; PRODUCT.md supplies product facts.
- Host: raid detail page, member role. Components reused: summary card (`RaidSummary`),
  roster by role (`RosterByRole`), "Hasn't answered" card (`UnansweredCard`), and the
  existing `EmptyState` panel (dashed card with the guild mark, as on the empty calendar).
  No new kind of element is proposed.
- Must not change: the viewer's response control stays primary at the top right
  (top on phones); summary role counts and lock time (guild + local) remain; the normal
  state with some answers is identical to today; plain dry voice, no exclamation marks;
  dark theme only.
- Feature wording below is the real draft copy. Unrelated page copy is out of scope.

## States, themes and content
| State slug | Role / situation | Content range and exact wording | Actions / feedback |
| --- | --- | --- | --- |
| normal | Member; open raid with some answers | Seeded sample: 36 roster rows, 31 accepted of 40 needed, viewer answered Absent. Identical to today. | Unchanged. |
| empty | Member; open raid, roster rows present, nobody answered | 40 fictional roster rows (36 seeded sample names + Annex, Rubric, Folio, Clause), all "No answer yet". Heading **"No answers yet"**; body **"No one has answered this raid yet. Answer here or in Discord before sign-ups lock."** "Hasn't answered 40" shows **"Nobody has answered yet."** instead of the name list. | Viewer's response control unselected and primary. Version A puts the heading/body in the summary card in place of the big figure; version B shows it in the existing EmptyState panel at the top of the roster column and keeps "0 accepted of 40 needed". |
| empty-no-roster | Member; open raid before roster rows exist | Roster 0 with **"The roster appears here shortly after a raid is scheduled."** (replaces the "comes from rank" sentence); "Hasn't answered 0" shows **"Nobody has answered yet."**; same heading/body as `empty`. | As `empty`. |

Not designed, unchanged or not applicable (by decision 2):
- **Officer view:** inherits the same wording. "Answer for them", "Nudge in Discord"
  (visible only while rows exist and the raid is open) and officer actions are unchanged.
- **Locked, cancelled, past/finished raids:** keep today's wording. The empty treatment
  applies only to open raids.
- **Loading:** the route's existing loading skeleton is unchanged; this feature adds no
  new loading behaviour.
- **Error:** no new request; existing save-failure toasts are unchanged.
- **No permission / logged out:** the page is member-gated as today (not found without a
  session); nothing changes.
- **Partly answered:** that is `normal`; today's wording, including "Everyone on the roster
  has answered." when it is actually true.

Themes: `default` (dark, the only site theme). Widths 390×844 and 1440×900. Keyboard: the
prototype switcher bar uses labelled native selects; site controls keep their existing
focus styles. Status is never colour alone (zero counts carry numbers and words).

## Host snapshot and offline proof
- Verification skill: `.pi/skills/verify-guild/SKILL.md` (offline page snapshot recipe,
  unchanged). Source commit 81b4803. Evidence (outside git): `/tmp/verify-guild-9AmaNN`.
- Launch: `npx tsx .pi/skills/verify-guild/run.ts launch "$EVIDENCE"` → Doctor PASS
  (port 36325, fresh throwaway Docker database with seeded sample data). Doctor rerun PASS.
- Route/role/state: `/dev/session?as=member&back=/members/calendar`, clicked the first
  "Onyxia's Lair" (Tue Oct 6, 8:00–11:00 PM guild time, PDT) in Upcoming; member Redtape;
  open raid, viewer answered Absent, roster 36. Captures `host-390.png` (390×4758) and
  `host-1440.png` (1440×2979).
- Snapshot: single-file-cli@2.16.4 installed outside the repo; `capture.js` run through
  `chrome-devtools-axi run`; validation passed (doctype, no scripts). Styles, fonts (woff2
  data URIs) and images (data URIs) are inlined.
- Cleanup PASS (server group and labelled container removed) before offline proof.
- Offline proof: fresh session `guild-offline-verify-guild-9AmaNN`, network Offline,
  `offline-390.png` (390×4758) and `offline-1440.png` (1440×2979) match the running page
  visually apart from Next's developer badge (intentionally omitted); network log shows only
  `file:` and `data:` requests; 4 images decoded, fonts loaded. CLI 0.1.37 printed its known
  "did not report a saved screenshot path" warning; files exist and open.
- `host.html` (removed after approval, once `index.html` passed its own offline recheck; the
  original export stays in the evidence folder) = snapshot with local-server links, the raid ID, the Discord invite and
  `og:image`/`twitter:image` tags replaced/removed. Versions add the site's own
  `public/brand/mark.png` as a data URI for the EmptyState panel.

## Confirmed decisions
1. One empty message for an open raid with zero replies, regardless of whether roster rows
   exist; keep the roster list when it exists. (Round 1, accepted.)
2. Design the member view only; officer view inherits the wording with Nudge unchanged;
   other states are documented as unchanged/not applicable rather than designed. (Round 1.)
3. Response control stays primary; summary counts and lock times stay; normal state
   identical to today; plain voice; dark only; 390 and 1440. (Round 1, accepted.)
4. Build two arrangements: A "Summary says it" and B "Roster says it". (Round 2.)
5. Exact wording as in the States table. (Round 2.)
6. Three states: `normal`, `empty`, `empty-no-roster`; clearly fictional sample rows for
   the 40-row roster. (Round 2.) Answers confirm this brief (simulated Robert, round 2 reply).

## Real-site experiment
None.

## Open decisions
None. Version A chosen (see decisions.md).
