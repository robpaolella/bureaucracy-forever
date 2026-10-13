# Design: bottom of the Recruitment and Raiding pages

- Design issue: #254
- Revision: 1
- Replaces: none
- Base: `package/90-recruitment-raiding`

## Job and audience
Readers are experienced Classic raiders choosing a guild for WoW Forever, often arriving
from a link posted in Discord; second, people who want to join as social members
(PRODUCT.md, Page brief). They should leave believing Bureaucracy runs its raids with real
organisation and picks its raiders carefully, then apply as a raider, or else join the
Discord or apply as social.

- **Recruitment:** the reader has seen the needs and the expectations. The bottom must make
  applying the obvious next step, say plainly what happens after applying, offer the social
  path in one line, and point questions to an officer in our Discord. Robert found today's
  three stacked boxes "weird from a design perspective" (#90 Q5) and kept exactly three
  pieces of content (#90 Q31, "Yeah, I like these three").
- **Raiding (`/schedule`):** below the raid week slots, the reader learns what is expected
  (attendance), how sign-ups work, and the guild's one public loot statement (#90 Q7: "it
  belongs on the raiding page at the bottom somewhere").

## Covers
| Build issue | Part of this feature | Out of scope |
| --- | --- | --- |
| #255 | Recruitment "Right now" side box (keep, drop or change) and the Apply section (`#apply`) | Heading, intro, needs table, expectations, the Apply window and form (#259) |
| #256 | Raiding page bottom section: attendance, sign-ups, loot line; "Help us pick the days" removed | Headline, intro, time-zone bar, Day 1 / Day 2 / Optional Day slots, metadata (copy work in #256 itself) |

## Boundaries and visual authority
- PRODUCT.md: Voice rules 1–10, Approved lines, Evidence on Hand. Every line is approved or
  follows the rules and uses confirmed facts only.
- DESIGN.md and the live site govern the look: `Card`, `Button` (primary sand, secondary),
  `AccentLink`, Newsreader headings, Archivo body, `teal-wash` informational panels,
  `px-4 md:px-gutter` page gutters, `lg` (1024px) for side-by-side layouts.
- Host routes and components: `app/(site)/recruitment/page.tsx` (head aside, `#apply`
  section), `app/(site)/schedule/page.tsx` (bottom section), `content/recruitment.ts`
  (`RECRUITMENT_HEAD.aside`, `FORM`, `APPLY_LINKS`, `NEXT_STEPS`), `content/schedule.ts`
  (`SCHEDULE_ASIDES`), `components/recruitment/ApplyModal.tsx` (`ApplyButton`).
- Must not change: both Apply buttons open the Apply window on their path (raider, social);
  `/recruitment#apply` lands on the Apply section; `/recruitment#expectations` still works;
  the parts listed as out of scope above.
- No new kind of element is planned; versions recombine existing cards, buttons, links and
  lists. Any version that shows one is flagged when presented.

## States, themes and content
| State slug | Role / situation | Content and exact wording | Actions / feedback |
| --- | --- | --- | --- |
| recruitment | Any visitor (signed in or out: the sections are identical) | Side box (per version): "Right now" / "We read every application and respond within a few days." / "Jump to the form →". Apply: title "Apply"; raider line "Apply for a raid spot with your logs and availability."; social line "Not raiding? You can also apply as a social member."; "What happens next": "You'll hear back from us within a few days." / "Then we'll have a short chat in Discord." / "New raiders start with a two-week trial."; questions: "Questions first? Ask an officer in our Discord." + "Join Discord"; sign-in note "You'll sign in with Discord before the form opens, so join the server first." | "Apply as a Raider" / "Apply as Social" open the Apply window (prototype shows a labelled stand-in); "Jump to the form →" scrolls to `#apply`; "Join Discord" is the Discord invite (inert in the prototype) |
| raiding | Any visitor | Attendance: "Raiders attend both progression nights. If you can't make one, let us know in Discord ahead of time." Sign-ups: "Sign up for each raid as Accept, Tentative or Absent, on the calendar or with our bot in Discord." Loot: "Loot runs on hard reserve, then soft reserve, then open roll." | None: no link (the calendar link is dropped, decision 2) |

- The copy is fixed text, so there is no minimum/maximum content range; the needs table
  above uses the sample data's 16 rows.
- Not applicable: empty, loading and error (static copy, no data in these sections);
  locked and no-permission (public pages, identical for every role). The Apply window's own
  states belong to #259.
- Theme: the site's one dark theme (`default`). Widths 390×844 and 1440×900.
- Keyboard: reading order follows the visual order; buttons and links are real controls,
  44px minimum targets, the site's teal focus outline.

## Host snapshot and offline proof
- Source commit `c0156a9` (`origin/package/90-recruitment-raiding`), routes `/recruitment`
  and `/schedule`, signed out, local sample data, guild time zone America/Los_Angeles.
- Skill: `.pi/skills/verify-guild/SKILL.md` (Launch, Doctor PASS, `newpage
  /dev/session?as=out&back=/recruitment`, editable offline snapshot recipe with
  single-file-cli 2.16.4, Cleanup PASS). Evidence: `/tmp/verify-guild-1eeWFw` (live and
  offline captures at both widths, `offline-network.txt`, `cleanup.txt`).
- Offline proof: both hosts opened from disk with the site stopped and network Offline;
  fonts and images are inlined data URIs; captures at 390 and 1440 match the running pages
  (the Next.js dev badge is omitted by the recipe).
- Host parts used:
  - `hosts/recruitment.html`: head `section.lg:grid-cols-[minmax(0,1fr)_400px]` (its "Right
    now" `div.rounded-card`), `section#apply`.
  - `hosts/raiding.html`: last `section.lg:grid-cols-3` (the three boxes).
  Both share identical inlined `<style>` blocks.
- The two host snapshots (`hosts/`, about 1 MB each) were deleted before the design PR, once `index.html` passed its own offline recheck; the host offline proof stays in `/tmp/verify-guild-1eeWFw` and in this section.

## Confirmed decisions
Robert, 2026-10-13, in the design tab:
1. "Right now" side box: the versions try keep it, drop it, and turn it into the two Apply
   buttons. ("Fine with all three.")
2. Drop "Open the calendar →" from Sign-ups; keep the sentence. ("Agreed.")
3. The draft wording in the table above is the starting copy, including cutting the Apply
   intro "Pick a path…". ("Agreed.")

## Real-site experiment
None.

## Open decisions
None for the brief. Layout picks come after the versions.
