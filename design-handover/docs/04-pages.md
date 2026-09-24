# 04 — Pages

Pages marked **[artboard]** are drawn — open the reference file and match it. Pages marked
**[spec only]** were not drawn; this document is the whole design for them, and they reuse
the primitives in `docs/02` without introducing anything new.

All desktop layouts are 1440 wide with a 96px gutter. All mobile layouts are 390 wide with
a 16px gutter. Between those, the content column fluid-caps at `max-w-content` (1200).

---

## Home — `/` **[artboard: Home.html]**

Top to bottom: a 40px announcement bar (teal wash) carrying the launch line; header; hero;
pedigree strip; progression and schedule side by side; recruitment teaser; closing CTA;
footer.

The hero is the page's one distinctive moment: a Newsreader headline at 84px over a
topographic contour pattern (inline SVG, teal at 13% and sand at 10%) with the column mark
at 5.5% opacity bleeding off the right edge. Keep the contours as inline SVG — don't
substitute a raster or a CSS gradient.

The pedigree strip is three equal cells divided by 1px verticals, each a 40px Newsreader
line in sand plus a sentence. It holds the guild's three real claims and nothing else.

Progression rows are a label, a track, and a count. Cleared rows are `ok`, the current tier
is `sand` and gets an `ink-800` row fill, unreleased tiers are `fg-3` with an empty track
and the word "Locked".

**Mobile:** announcement bar wraps to two lines; hero headline drops to 40px and the mark
watermark is removed; the pedigree strip stacks to three rows with horizontal dividers;
progression and schedule stack; the recruitment teaser becomes a 2-column grid of the four
class cards.

---

## About — `/about` **[artboard: About.html]**

Two-column intro (prose left, a bordered "How we run a night" card right), then three
accolade cards for the Classic achievements, then the history list, then officer cards.

The history list is a `<ol>` of rows, each a 200px era label beside a title and paragraph,
separated by top borders. Era labels are words, not dates, except the last one — the real
4 November 2026 launch.

Officer cards are roster rows with a sentence attached. The fourth card in the artboard is a
dashed placeholder; delete it once real officers are in.

**Mobile:** everything stacks; history rows put the era label above the title; officer cards
go two-up.

---

## Raid schedule — `/schedule` **[artboard: Schedule.html]**

Page head, then the timezone bar, then the week strip, then "How a night runs" beside three
aside cards.

The timezone bar is the canonical dual-time component: server label in sand, detected local
label in teal, a "Detected" pill, and a button to override. Build this once and reuse it at
the top of the availability pages.

The week strip is seven equal cells. Raid nights get an `ink-800` fill and a `sand-dim`
border; off nights are plain cards reading "Off". Each raid cell shows the server range
large, the word "server" small, and the local range in teal.

**Mobile:** the week strip becomes a vertical list of seven rows — off days collapse to a
single 44px row with just the day and "Off". The run-of-night table becomes a stacked list
with server and local times side by side above each description.

---

## Recruitment — `/recruitment` **[artboard: Recruitment.html]**

Page head with an aside, the needs table, the expectations grid, then the application form
beside a "what happens next" column.

The needs table is class / spec / role / status, class names in class color, status as a
`StatusPill`. It is the single source of truth — editing a row here updates the home page
teaser and the Discord bot's `/recruiting` reply.

The form picks a path first: two large radio cards, Raider and Social. Raider shows
character, Discord handle (read-only, from the session), class, spec, logs URL, the
availability radio row, and the wipe question. Social shows character and one open field.
The availability row carries a teal line underneath translating the server times into the
visitor's local time.

**Mobile:** the needs table becomes one card per row — class name and status on the first
line, spec and role on the second. Form fields go full width, path cards stack.

---

## Loot rules — `/loot` **[artboard: Loot.html]**

Three columns: a sticky table of contents, a 760px prose column, and a narrow aside. The
summary card at the top is accolade-bordered and carries four bullets. The weighting list is
a bordered block of four numbered rows with alternating fills. The FAQ is `<details>`
elements — the first one open — with `list-style: none` on the summary.

Prose is 16/1.75 at `fg-2` with `fg` for emphasised runs. This is a page people read, so
resist adding cards.

**Mobile:** TOC becomes a horizontal scrolling chip row pinned under the header; aside moves
to the bottom.

---

## My availability — `/members/availability` **[artboard: Availability-Member.html]**

See `docs/05`.

## Roster availability — `/officers/availability` **[artboard: Availability-Officer.html]**

See `docs/05`.

---

## Roster — `/members/roster` **[spec only]**

A page head, a filter bar, and a `DataTable` built to hold 40+ rows.

**Filter bar** — one row, `ink-850` card, 44px controls: a search input (character name),
a class multi-select, a role multi-select, a rank select, and a count on the right reading
"38 of 41 shown". A "Clear filters" ghost button appears only when a filter is active.

**Columns** — Character (class color, 600 weight), Class, Spec, Role, Rank (`RankBadge`),
Attendance (right-aligned, tabular, percentage), Joined (right-aligned, relative). Sort on
Character, Rank, Attendance and Joined; default sort is Rank descending then Character
ascending. Clicking a row opens nothing — this is a reference table, not a drill-down.

**Group-by option** — a segmented control above the table: "Flat" / "By role" / "By class".
Grouped views insert a 32px `ink-850` header row carrying the group name and a count.
Flat is the default.

**Density** — comfortable (44px) by default, compact (36px) via a toggle in the filter bar,
persisted in localStorage.

**Mobile** — the table becomes a list of 2-line cards: character name in class color and
`RankBadge` on line one; class · spec · role on line two, `fg-3`. Filters collapse behind a
44px "Filters" button that opens a sheet; the active-filter count rides on the button as a
`CountBadge`.

**Empty** — `EmptyState`, copy in `docs/03`.

---

## Raid calendar — `/members/calendar` **[spec only]**

A list, not a month grid. A month grid wastes space for three raids a week and breaks badly
on mobile; the list is the primary view and a month view can come later.

**Head** — "Raid calendar" with a segmented "Upcoming" / "Past" control and, for officers, a
primary "Schedule a raid" button.

**Rows** — one card per raid, 20px padding, `ink-850`:

- Left: a 56px date block — three-letter month in `fg-3` label type, day number in
  Newsreader 28px. Then the raid name (17px, 600) and, beneath, the dual time line.
- Middle: role counts as four small stacks — "T 2 · H 8 · M 11 · R 14" with tabular figures,
  the label in `fg-3` and the number in `fg`. A count below the raid's requirement turns
  `warn`; zero turns `stop`.
- Right: the member's own response as a three-way segmented control — Accept / Tentative /
  Absent — 44px, with the selected one filled (`ok-wash`/`warn-wash`/`stop-wash` with the
  matching border and text). Responding here writes immediately; no save button.

Tonight's raid, if there is one, pins to the top with a `sand-dim` border and a sand
"Tonight" eyebrow.

**Mobile** — the same card, stacked: date and name, then the dual time, then role counts on
one wrapping line, then the segmented control full-width at the bottom.

**Empty** — `EmptyState`, copy in `docs/03`.

---

## Raid detail — `/members/calendar/[raidId]` **[spec only]**

Two columns: sign-ups left (fluid), summary right (380px).

**Head** — raid name in Newsreader 44px, the dual time line beneath, and the member's own
Accept / Tentative / Absent control at the right, same component as the list row.

**Summary card (right)** — total accepted against the requirement as a large tabular
figure, then a role breakdown: four rows, each with the role label, a count, a requirement,
and a 6px track filled `ok` when met and `warn` when short. Below that, a line reading
"12 via web · 9 via Discord" so officers can see the split at a glance. Below that, the raid
notes an officer wrote, as prose.

**Sign-up list (left)** — three sections in order, Accepted / Tentative / Absent, each with
a `label`-token heading and a count. Rows are 44px: a 24px class-colored initial avatar,
character name in class color, class · spec · role in `fg-3`, then a `SourceBadge` and a
relative timestamp right-aligned. Absent rows drop to 60% opacity and show the member's
reason if they gave one.

Officers additionally get, at the top of the left column, an "Officer actions" row —
Edit raid, Post to Discord, Cancel raid (danger) — and the ability to set a member's
response on their behalf, which records `setBy` and shows "set by Ledgerline" in place of
the source badge.

**Mobile** — summary first, then the sign-up sections; officer actions collapse into a
single "Officer actions" button opening a sheet.

---

## Sign-up confirmation **[spec only]**

Not a page — a toast plus an optimistic row update.

On responding, the segmented control updates immediately, the role counts animate to their
new value over 120ms, and a toast appears bottom-centre for 4s: `ink-800`, `line-strong`,
radius `card`, `shadow-pop`, with an `ok` dot, the line "You're in for Wednesday — Blackwing
Lair", a `small`/`fg-3` second line "8:00 PM server · 6:00 PM your time", and an "Undo"
link. If the write fails, the toast turns `stop`, the row reverts, and the copy reads
"Couldn't save that — try again."

The same toast pattern covers availability saves and officer accept/decline actions. Build
one `Toast` component with `tone="ok" | "stop"`.

---

## Applications inbox — `/officers/applications` **[spec only]**

A two-pane layout: a 380px list on the left, the selected application on the right. On a
fresh load the first pending application is selected.

**Filter bar** above the list, 44px: segmented Raider / Social / All, then a status select
(Pending / Accepted / Declined / All), then a search box. Default is Raider + Pending.

**List rows** — 72px, separated by `line-faint`: character name in class color with the
class · spec beneath in `fg-3`, a path tag (Raider or Social) and a relative timestamp on
the right. Unread applications carry a 6px sand dot at the left edge. The selected row is
`teal-wash` with a 2px teal left edge — this is the one place a left accent border is
allowed, because it marks selection rather than decoration.

**Empty** — `EmptyState`, copy in `docs/03`.

**Mobile** — list only, tapping a row navigates to the detail route.

---

## Application detail — `/officers/applications/[id]` **[spec only]**

Right pane of the inbox, or its own page on mobile.

**Head** — character name at 30px in class color, then a meta row: class · spec · role,
the path tag, the submitted timestamp, and a `StatusPill` for the current decision.

**Answers** — one block per question: the question in `label` token / `fg-3`, the answer in
`body` / `fg` beneath, separated by top borders. The logs URL renders as a link with the
host visible. The availability answer renders with both server and local times.

**Officer notes** — a bordered `ink-800` block below the answers. Existing notes are rows of
author initial avatar, author name in class color, the note, and a relative timestamp. A
44px composer sits at the bottom. Notes are private and the block says so in `fg-3`:
"Only officers see this. Applicants never do."

**Actions** — pinned to the bottom of the pane on a `ink-900` bar with a top border, so they
stay reachable on a long application: "Accept" (primary), "Decline" (danger), and a ghost
"Move to social". Both Accept and Decline open a `Modal` confirming, naming what the
applicant will be told, and noting that officer notes stay private. After the action, the
pill updates, the row moves out of the Pending filter, and a toast confirms.

---

## Application submitted — `/recruitment/submitted` **[spec only]**

A short, centred page, not a modal — applicants may land here from a fresh tab.

Centred column, 520px wide, 120px from the top: the column mark at 48px and 40% opacity, an
`ok` eyebrow reading "Received", a Newsreader 44px heading "Your application is in", and a
paragraph: "An officer picks it up within a day and you'll get a Discord DM either way. If
you're not in the server yet, join now — that's where we'll reach you."

Below it, a bordered summary card repeating what they submitted — character, class, spec,
path — so they can see it went through. Then two buttons: "Join Discord" (primary) and
"Back to the site" (secondary). Then a `small`/`fg-3` line: "Applied by mistake or need to
change something? Post in #recruitment."

**Mobile** — same, full width, mark at 40px.
