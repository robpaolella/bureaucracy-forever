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
- Raid nights and times remain unconfirmed placeholders. Do not turn sample schedules, TBD values, or artboard examples into approved policy.
- Loot policy remains unconfirmed. `content/loot.ts` and the public loot page contain placeholder policy; do not repeat those rules as approved product facts.
- Recruitment needs are operational data, not permanent claims or design constants.
- Record Robert's approved facts rather than inferring approval from a live page. The site can still contain copy awaiting correction in a separate issue.

## Brand Commitments

- Preserve the Bureaucracy name and existing guild identity, including its wordmark and column mark (`public/brand/`). The design system's approved descriptive metaphor is **The Guild Standard**: a guild banner and the standards the guild holds.
- Voice is confident, plain, and slightly dry. Use short, concrete sentences, not grandiose or sentimental claims. No exclamation marks or emoji in new copy.
- Dark theme only; do not introduce a light-theme toggle.
- No official Blizzard or World of Warcraft logos, artwork, fonts, or screenshots. Class colors are reserved for names and role counts, never background fills.
- The documented loot exception permits Wowhead item icons, sanitized tooltips, and item-quality colors on loot surfaces. Quality colors are text-only and accompanied by the quality word for screen readers. See `lib/design/item-quality.ts`.

## Evidence on Hand

- Robert approved this achievement claim through the conductor for issue #76: **top 150 guilds in the region to fully clear Naxxramas in week one**. Approved card title: **Top 150 regionally**. This supersedes both the handover's top-500-worldwide claim and the old site's inaccurate top-100-world claim. A separate issue updates site copy; do not use the old text as evidence against this approval.
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
