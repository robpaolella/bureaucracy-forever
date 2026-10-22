# Product

<!-- impeccable:product-schema 1 -->

The live site is the design source of truth; `design-handover/` is background, not authority over the implemented site.

## Platform

web

## Users

- Public pages serve prospective Bureaucracy raiders: understand the guild, assess fit, see recruitment needs, and apply. A separate application path serves prospective social members.
- Members have their own signed-in area for availability, the roster, and raid participation.
- Officers have their own area for recruitment and raid operations.

These are distinct audiences with distinct areas, not a ranking of public visitors above members or officers.

## Product Purpose

Bureaucracy's website connects recruitment with the practical work of running its WoW Forever raiding guild. Public visitors should understand whether to apply; members and officers should be able to complete their guild tasks in their own areas.

## Operating Context

- Discord is the sign-in provider and the guild's community channel. Member and officer areas are role-gated; public recruitment information is readable without signing in.
- Applications have Raider and Social paths. Current application entry points open a dialog, with `/apply` as the navigation fallback; submitting requires Discord sign-in and guild-server membership.
- Availability is a recurring weekly pattern. Members provide when they can play; officers use the roster's availability to plan raids.
- The website and Discord bot share raid participation workflows. Preserve the distinction between web and Discord sign-up sources.
- Guild time is anchored on `GUILD_TIMEZONE` in `lib/config.ts`, currently `America/Los_Angeles`. WoW Forever has no realm clock. Say **guild time**, never realm time or server time. Show each time in the viewer's own timezone with its zone label, and guild time on hover, tap or keyboard focus and in its accessible name; before the viewer's zone is known, or when it is guild time, show guild time labelled "guild time". Officer scheduling forms (raid form, series form, raid planner) show guild and local time side by side, each labelled. Never show an unlabelled time. Calculate offsets, including daylight-saving changes, rather than hard-coding them.

## Capabilities and Constraints

- Preserve separate public, member, and officer experiences and their access boundaries. A design change must not expose private officer information.
- The raiding week's structure is confirmed (see Evidence on Hand), and raid days and times are set for now: Tuesday and Thursday, 8:00 to 11:00 PM guild time (Robert, 2026-10-22); the optional night is not set. Do not invent others, and do not turn sample schedules, TBD values, or artboard examples into approved policy.
- The public loot rules page was removed (#241). Loot rules for members come in a later members copy project. The only public loot statement is the Raiding page's one-line summary. Do not repeat placeholder loot policy from old content or the handover as approved product facts.
- Recruitment needs are operational data, not permanent claims or design constants.
- Record Robert's approved facts rather than inferring approval from a live page. The site can still contain copy awaiting correction in a separate issue.

## Brand Commitments

- Preserve the Bureaucracy name and existing guild identity, including its wordmark and column mark (`public/brand/`). The design system's approved descriptive metaphor is **The Guild Standard**: a guild banner and the standards the guild holds.
- Voice, positioning and approved lines are in the Voice section below.
- Dark theme only; do not introduce a light-theme toggle.
- No official Blizzard or World of Warcraft logos, artwork, fonts, or screenshots. Class colors are reserved for names and role counts, never background fills.
- The documented loot exception permits Wowhead item icons, sanitized tooltips, and item-quality colors on loot surfaces. Quality colors are text-only and accompanied by the quality word for screen readers. See `lib/design/item-quality.ts`.

## Voice

Decided by Robert on 2026-10-12 in the planning for [issue #90](https://github.com/robpaolella/bureaucracy-forever/issues/90). His answers: [Q1–Q20](https://github.com/robpaolella/bureaucracy-forever/issues/90#issuecomment-6133885568), [Q21–Q25](https://github.com/robpaolella/bureaucracy-forever/issues/90#issuecomment-6137826295), [Q26–Q31](https://github.com/robpaolella/bureaucracy-forever/issues/90#issuecomment-6138060455), [Q32–Q36](https://github.com/robpaolella/bureaucracy-forever/issues/90#issuecomment-6139240224), [Q37–Q40](https://github.com/robpaolella/bureaucracy-forever/issues/90#issuecomment-6139513466). These rules govern all public copy and replace the handover's voice notes.

### Voice rules

1. No quips, wordplay or one-liners that carry no fact. Rejected examples: "Same raid team, new server.", "we'd rather not lose the habit", "Wipes cost more than flasks.", "Filed under nothing".
2. State claims as full sentences ("We were server first in Blackwing Lair and AQ40"), not fragments or stat lists. Headings, labels and table values may stay short.
3. Calls to action are short and persuasive: what the reader gets and what to do, without step-by-step instructions.
4. Functional text (errors, not-found, empty states) uses the familiar wording people expect: "Page not found. The link might be broken, or the page may have moved."
5. Robert's own home and About copy (Sept 27, 2026) is the reference for the voice (commits `6baa2cc` home, `456206d` About, `c13b3f8` Naxxramas claim fix).
6. Confident and plain. No exclamation marks or emoji.
7. Avoid patterns that read as AI-written: "not X, but Y" contrasts, dashes used for drama, lists of three for rhythm.
8. Nothing that goes stale with time ("forming now", "before launch", "first lockout"), except in spots built to be updated, such as the home page's announcement bar. One deliberate exception: the Recruitment page's open-recruitment call-out, which is time-bound and changed over time (Robert, 2026-10-15).
9. Public pages say what the reader gets, not how officers run things behind the scenes. For example, "Officers pick raid nights from members' availability" stays off public pages, and no page says an officer "claims" an application.
10. Explanations sound like a person talking to the reader ("will be set", "we'll post"; not "get set", "when they land"). On the recruitment page, expectations address the reader directly: "We expect every raider to …".

### Positioning

Bureaucracy is presented as a competitive guild. Public copy never mentions a relaxed pace, chasing records, or server or world firsts on WoW Forever (WoW Forever has no servers). Smolderweb's record stays as history.

### Page brief

Readers are experienced Classic raiders choosing a guild for WoW Forever, often arriving from a link posted in Discord; second, people who want to join as social members. They should leave believing Bureaucracy has a proven record, runs its raids with real organisation and picks its raiders carefully. They should apply as a raider; if not, join the Discord or apply as social.

### Approved lines

Examples of the voice, approved by Robert on 2026-10-12.

- Home closing: "Ready to compete?" / "We're recruiting skilled, prepared raiders for WoW Forever. We read every application and respond within a few days."
- Recruitment headline: "Join a raid team built to compete". Intro: "The table below shows the classes and specs we need most. If your spec is closed and you're an exceptional player, we still want to hear from you."
- Expectations: "Both progression nights. Raiders attend both progression nights. If you can't make one, let us know in Discord ahead of time." / "Come prepared. We expect every raider to show up prepared, with consumables, enchants and gear ready to go." / "In Discord for every raid. Every raid runs in Discord voice, and every raider is in it." / "Two-week trial. New raiders start with a two-week trial. Gear isn't awarded during the trial."
- Application received: "Your application is in" / "Thanks for applying. We'll get back to you on Discord within a few days. If you have a question in the meantime, ask an officer in our Discord."
- Raiding intro: "Raid times show in your own time zone, so you'll always know when raid starts where you are. Our optional night is still to be set."

## Evidence on Hand

- Robert approved this achievement claim through the conductor for issue #76: **top 150 guilds in the region to fully clear Naxxramas in week one**. Approved card title: **Top 150 regionally**. This supersedes both the handover's top-500-worldwide claim and the old site's inaccurate top-100-world claim. A separate issue updates site copy; do not use the old text as evidence against this approval.
- Confirmed by Robert on 2026-10-12 (answers linked under Voice):
  - Two progression nights a week, plus an optional night for farm and alt runs. Tuesday and Thursday, 8:00 to 11:00 PM guild time (set 2026-10-22, "for now"); the optional night isn't set yet.
  - Raiders are expected at both progression nights, and tell us in Discord ahead of time if they'll miss one. No attendance target is published.
  - Raiders are in Discord voice for every raid.
  - From Robert's About copy: strats are worked out together; logs are reviewed after every raid; everyone comes prepared with consumables, enchants and gear; once a raid is on farm, the focus moves to faster clears.
  - Applicants hear back within a few days. After applying, there is a short chat in Discord.
  - New raiders start with a two-week trial. Gear isn't awarded during the trial.
  - Exceptional players are welcome to apply even when their spec is closed.
  - `#recruitment` is private to officers. Applicants with questions ask an officer in the Discord, then wait to hear back.
  - "US · Alliance · PvP" is correct.
  - No guild player counts ("40-player", "a spot in the 40"). Raid sizes on the progression table (10-, 20-, 40-player) stay, because they describe the raids.
  - Social members: no list of perks; people can apply as social, and that's it.
  - Loot runs on hard reserve, then soft reserve, then open roll (as built).
  - **Not true, never state:** strategy is posted in Discord before raids; world buffs are expected; the guild bank pays for repairs; addons are required; a single caller during pulls; a published attendance target.
- Current public copy lives in `content/`; implemented routes and shared components are the evidence for existing workflows. Handover sample characters, progression counts, schedules, and loot policy are not verified facts.
- Existing guild assets are in `public/brand/`. Do not fabricate testimonials, rankings, raid results, or external endorsements to fill a layout.
- Decisions and the handover differences inventory are tracked in [issue #76](https://github.com/robpaolella/bureaucracy-forever/issues/76). The product interview and approvals were relayed by the conductor; visual values belong in `DESIGN.md`.

## Product Principles

1. Serve each audience in its own area; do not compromise private guild operations for public presentation.
2. Make raid coordination explicit: labelled times, clear participation states, and visible sign-up provenance.
3. Distinguish approved claims and current operational data from placeholders and unconfirmed policy.
4. Preserve the guild's identity and plain voice while making its tools straightforward to use.

## Accessibility & Inclusion

These are Robert's confirmed requirements, not a claim that every current screen has passed an accessibility audit:

- Minimum 44px hit targets for controls, except the availability grid's paint cells; retain an accessible alternative to painting.
- Text contrast of at least 4.5:1.
- Status is never color alone; include a word or other explicit non-color indication.
- Use real buttons, links, and labelled inputs rather than clickable generic containers. Preserve keyboard operation and visible focus.
- Always label times: viewer-local with its zone, guild time on hover, tap or focus and in the accessible name, so members in different timezones can act on the same information.
