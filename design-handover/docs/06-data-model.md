# 06 — Data model and Discord sync

A proposal, not a constraint — it exists so the UI spec has something concrete underneath.
Change it freely; if you do, the thing to preserve is **local-time storage for availability**
and **bidirectional sign-up sync with a source field**.

---

## Prisma sketch

```prisma
model User {
  id            String   @id @default(cuid())
  discordId     String   @unique
  discordName   String
  avatarUrl     String?
  role          Role     @default(SOCIAL)   // access level
  timezone      String?                     // IANA, overrides detection
  characters    Character[]
  availability  Availability?
  signups       Signup[]
  notes         OfficerNote[]  @relation("noteAuthor")
  createdAt     DateTime @default(now())
}

enum Role { SOCIAL MEMBER OFFICER }

model Character {
  id        String   @id @default(cuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  name      String
  class     WowClass
  spec      String
  raidRole  RaidRole
  rank      Rank     @default(TRIAL)   // display rank, distinct from User.role
  isMain    Boolean  @default(true)
  attendance Float?                    // 0–1, computed from Signup history
  joinedAt  DateTime @default(now())

  @@unique([name])
}

enum WowClass { WARRIOR PALADIN HUNTER ROGUE PRIEST SHAMAN MAGE WARLOCK DRUID }
enum RaidRole { TANK HEALER MELEE RANGED }
enum Rank     { OFFICER RAIDER TRIAL SOCIAL }

/// One row per member. `slots` is the painted week, keys "day:slot",
/// day 0 = Monday, slot 0 = 00:00, 47 = 23:30 — in `timezone`, NOT server time.
model Availability {
  userId    String   @id
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  timezone  String
  slots     Json     // Record<`${0..6}:${0..47}`, "available" | "if-needed">
  updatedAt DateTime @updatedAt
}

model Raid {
  id          String   @id @default(cuid())
  name        String                    // "Blackwing Lair"
  startsAt    DateTime                  // absolute instant; render per viewer
  durationMin Int      @default(180)
  notes       String?
  discordEventId String?               // links to the bot's event
  cancelledAt DateTime?
  requirements Json                     // { tank: 2, healer: 8, melee: 11, ranged: 14 }
  signups     Signup[]
}

model Signup {
  id        String     @id @default(cuid())
  raidId    String
  raid      Raid       @relation(fields: [raidId], references: [id], onDelete: Cascade)
  userId    String
  user      User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  response  Response
  source    Source                      // shown on every sign-up row
  reason    String?                     // optional, for ABSENT
  setByUserId String?                   // an officer answering on someone's behalf
  updatedAt DateTime   @updatedAt

  @@unique([raidId, userId])
}

enum Response { ACCEPT TENTATIVE ABSENT }
enum Source   { WEB DISCORD }

model Application {
  id        String    @id @default(cuid())
  path      AppPath
  status    AppStatus @default(PENDING)
  discordId String
  discordName String
  character String
  class     WowClass?
  spec      String?
  logsUrl   String?
  answers   Json                        // { questionKey: answer }
  readAt    DateTime?                   // drives the unread dot
  decidedAt DateTime?
  decidedByUserId String?
  notes     OfficerNote[]
  createdAt DateTime  @default(now())
}

enum AppPath   { RAIDER SOCIAL }
enum AppStatus { PENDING ACCEPTED DECLINED }

/// Private to officers. Never exposed on any applicant-facing surface.
model OfficerNote {
  id            String   @id @default(cuid())
  applicationId String
  application   Application @relation(fields: [applicationId], references: [id], onDelete: Cascade)
  authorId      String
  author        User     @relation("noteAuthor", fields: [authorId], references: [id])
  body          String
  createdAt     DateTime @default(now())
}

/// One row per class+spec. Drives the recruitment table, the home teaser
/// and the bot's /recruiting reply — all three read this, none of them duplicate it.
model ClassNeed {
  id     String   @id @default(cuid())
  class  WowClass
  spec   String
  role   RaidRole
  status NeedStatus @default(CLOSED)
  updatedAt DateTime @updatedAt

  @@unique([class, spec])
}

enum NeedStatus { HIGH MEDIUM CLOSED }
```

---

## API routes

| Route | Method | Access | Notes |
|---|---|---|---|
| `/api/availability` | GET, PUT | member | PUT replaces the whole week; debounce 2s client-side |
| `/api/availability/heatmap` | GET | officer | Returns per-slot totals and role splits, already converted to the requesting officer's timezone. Don't ship 41 raw weeks to the client. |
| `/api/raids` | GET, POST | member / officer | |
| `/api/raids/[id]/signup` | PUT | member | Body `{ response, reason? }`, sets `source: WEB` |
| `/api/applications` | GET, POST | officer / public | POST is the public form; rate-limit it |
| `/api/applications/[id]` | PATCH | officer | Status changes, marks read |
| `/api/applications/[id]/notes` | POST | officer | |
| `/api/class-needs` | GET, PUT | public / officer | |
| `/api/bot/*` | — | bot token | See below |

The heatmap endpoint is the one with a real performance shape: aggregate server-side, cache
for a minute, invalidate on any availability write.

---

## Discord bot sync

The bot already exists and is self-hosted. The contract:

**Bot → site.** The bot posts to `/api/bot/signup` with a shared secret when someone reacts
or uses a slash command on a raid post. The site upserts the `Signup` with
`source: DISCORD`. Idempotent on `(raidId, discordId)`.

**Site → bot.** When a sign-up is written on the web, the site fires a webhook the bot
listens on so it can edit the raid post's counts. Same for a raid being created, edited or
cancelled.

**Conflict rule:** last write wins, on `updatedAt`. An officer's `setByUserId` write beats a
member's own only if it is later — no special-casing.

**Why `source` is visible in the UI:** when the two sides disagree, officers need to see
which surface a response came from without opening logs. It is not decoration; don't drop it
to save a column.

**Other bot surfaces worth wiring:** `/recruiting` reads `ClassNeed`; `/availability` DMs a
member the link to their grid; the "Nudge the rest" button on the officer page DMs everyone
without an `Availability` row.

---

## Timezone handling, concretely

- `RAID_REALM_TZ` is a single constant, e.g. `America/Chicago`. Never derive it per-page.
- `Raid.startsAt` is an absolute instant; render it twice, once in `RAID_REALM_TZ` and once
  in the viewer's zone.
- `Availability.slots` are local to `Availability.timezone`. To compare two members, convert
  each week to UTC slot indices on read, using the actual offset for the upcoming week so
  DST is handled.
- If a member's detected timezone differs from their stored one, show a one-line prompt on
  the availability page — "Looks like you're in Europe/Berlin now. Update your timezone?" —
  and never change it silently.
