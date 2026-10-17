# Discord ↔ web sync — specification

This file is the contract between the site (`bureaucracy-forever`, Next.js on Vercel, Neon
Postgres) and the bot (Bureaucrat, discord.py, Docker on the Debian server). Put an
identical copy in both repositories. When the two sides disagree, this file wins, and the
fix is a PR to this file first.

Decisions here were made by Robert and are not open for re-litigation by the implementer:
web-only intake, rank-based rosters, outbox polling, every officer thread message becomes a
note, auto-assign Guild Member on accept, no native Discord Events, any member may bench.
The one exception to "every officer thread message becomes a note" is the officer–applicant
relay (§13): relay messages are never notes, and bot webhook posts in a thread are ignored.

---

## 1. Principles

1. **The Neon database is the only source of truth.** Discord displays it and accepts input
   for it. The bot never renders from its own state; it re-renders from the site's API.
2. **All business rules live in the site.** Who may accept, what accept does, when a raid
   locks, who is on a roster. The bot calls endpoints; it does not decide.
3. **Nothing inbound to the Debian server.** The bot polls the site over HTTPS. There is no
   webhook from the site to the bot. Remove `BOT_WEBHOOK_URL` and anything built on it.
4. **The bot is the clock.** Vercel's free cron is once per day, so the bot calls
   `POST /api/bot/tick` every 60 seconds and the site does whatever is due.
5. **Every synced object stores its Discord IDs** (thread, starter message, one per mirrored
   note). Changes are edits to existing messages, never re-posts.
6. **Every bot write is idempotent.** `Idempotency-Key` header on every POST/PATCH/DELETE,
   set to the Discord interaction ID or message ID that caused it. The site stores keys and
   replays the original response on a repeat. The first request claims its key before it
   runs, so a key only ever executes once; a repeat that arrives while it is still running
   waits up to 10 s for its reply, then gets `409 { reason: "in_progress", error }`, which
   the bot retries with backoff under the **same** key (the reply is replayed once ready).
   A 5xx or crash is not stored, so a retry with the same key runs again.
7. **Fail loudly, retry quietly.** A job that fails is retried with backoff up to 5 times,
   then marked FAILED and posted to `#officers` by the bot. Nothing is silently dropped.

Guild time zone is one constant, `GUILD_TZ = America/Los_Angeles`, on both sides.

---

## 2. Authentication

- Site → nothing. The site never calls the bot.
- Bot → site: `Authorization: Bearer <BOT_SHARED_SECRET>` on every request to `/api/bot/*`.
  Any other route rejects that header. Compare with a constant-time function.
- `BOT_SHARED_SECRET` is generated once (`openssl rand -base64 33`), set on Vercel and in the
  bot's env file on the server. Never printed, never committed.

---

## 3. Schema changes (site, Prisma)

Additive migrations only. Nothing existing is renamed.

```prisma
enum Standing   { ROSTER BENCH }
enum RaidStatus { SCHEDULED LOCKED DONE CANCELLED }
enum JobStatus  { PENDING RUNNING DONE FAILED }

model Application {
  // existing fields unchanged, plus:
  source            Source    @default(WEB)   // intake is web-only; field kept for symmetry
  discordThreadId   String?   @unique          // forum post (thread) id
  discordMessageId  String?                    // starter message id
  reopenedAt        DateTime?
  nudgedAt          DateTime?                  // old once-only 24h nudge; kept, unused by the §6 step 14 rules
  // Pending-application reminders (§6 step 14). All additive and nullable (count defaults 0).
  reminderKey         String?                  // the outstanding reminder's key; null when none
  reminderTriedOn     String?                  // Pacific date "YYYY-MM-DD" a reminder was last tried
  reminderCount       Int       @default(0)    // reminders sent for reminderActivityAt
  reminderActivityAt  DateTime?                // the activity time reminderCount belongs to
  reminderLastOn      String?                  // Pacific date "YYYY-MM-DD" of the last reminder sent
  reminderChannelId   String?                  // the live reminder's channel (thread or #officers)
  reminderMessageId   String?                  // the live reminder's message
  relayPingAt         DateTime?                // the last relay ping (§13); null until one is sent
  interviews        Interview[]
  messages          ApplicantMessage[]
}

model OfficerNote {
  // existing fields unchanged, plus:
  source            Source    @default(WEB)
  discordMessageId  String?   @unique          // the thread message this note IS (Discord-origin)
                                               // or the mirror the bot posted (web-origin)
  editedAt          DateTime?
  deletedAt         DateTime?                  // soft delete; hidden on web, deleted in Discord
}

enum MessageDirection { TO_APPLICANT FROM_APPLICANT }
enum MessageStatus    { QUEUED SENT NOT_DELIVERED NOT_SENT }   // TO_APPLICANT only

/// The officer–applicant relay (§13). Separate from OfficerNote, which stays officers-only.
model ApplicantMessage {
  id              String   @id @default(cuid())
  applicationId   String
  application     Application @relation(fields: [applicationId], references: [id])
  direction       MessageDirection
  authorUserId    String?                          // the officer; TO_APPLICANT only
  body            String                           // may be "" for FROM_APPLICANT with attachments
  createdAt       DateTime @default(now())         // FROM_APPLICANT: the DM's Discord send time
  status          MessageStatus?                   // TO_APPLICANT only; null for FROM_APPLICANT
  dmChannelId     String?                          // the DM (set when sent / received)
  dmMessageId     String?  @unique
  copyChannelId   String?                          // the thread (or #officers) copy
  copyMessageId   String?
  attachments     Json     @default("[]")          // [{ id, filename, size, spoiler }]
  editedAt        DateTime?
  deletedAt       DateTime?                        // FROM_APPLICANT: the text is kept, the copy says deleted
  @@index([applicationId, createdAt])
}

model RaidTemplate {
  id            String  @id @default(cuid())
  name          String  @unique               // "Molten Core"
  short         String                        // "MC" — for calendar chips and post titles
  size          Int                           // 40, 20
  durationMin   Int     @default(180)
  requirements  Json                          // { tank, healer, melee, ranged } — sums to size
  active        Boolean @default(true)
  series        RaidSeries[]
  raids         Raid[]
}

model RaidSeries {
  id                String   @id @default(cuid())
  templateId        String
  template          RaidTemplate @relation(fields: [templateId], references: [id])
  weekday           Int                        // 0 = Sunday … 6 = Saturday, in GUILD_TZ
  startTime         String                     // "20:00", wall clock in GUILD_TZ. NOT UTC.
  durationMin       Int
  notes             String?
  postAheadDays     Int      @default(14)
  lockMinutesBefore Int      @default(120)
  horizonWeeks      Int      @default(4)
  active            Boolean  @default(true)
  createdById       String
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  raids             Raid[]
}

model Raid {
  // existing fields unchanged (startsAt stays an absolute instant), plus:
  templateId        String?
  template          RaidTemplate? @relation(fields: [templateId], references: [id])
  seriesId          String?
  series            RaidSeries?   @relation(fields: [seriesId], references: [id], onDelete: SetNull)
  detached          Boolean   @default(false)  // edited individually; series edits skip it
  status            RaidStatus @default(SCHEDULED)
  locksAt           DateTime
  lockedAt          DateTime?
  discordThreadId   String?   @unique
  discordMessageId  String?
  postedAt          DateTime?
  remind72At        DateTime?                  // set when sent
  remind24At        DateTime?
  updatedAt         DateTime  @updatedAt       // optimistic concurrency for officer edits
  // discordEventId stays, nullable, unused. Do not build on it.
}

model Signup {
  // existing fields, with these changes:
  response   Response?                          // NOW NULLABLE: on the roster, not answered yet
  standing   Standing  @default(ROSTER)
  attended   Boolean?                           // set by officers after the raid
  // @@unique([raidId, userId]) stays
}

enum InterviewStatus    { AWAITING_TIMES TIMES_RECEIVED PROPOSED BOOKED DONE CANCELLED NO_TIME CLOSED }
enum InterviewEndReason { DECLINED EXPIRED PROPOSAL_LAPSED }   // only with NO_TIME

/// One row per interview attempt (§12).
model Interview {
  id                String   @id @default(cuid())
  applicationId     String
  application       Application @relation(fields: [applicationId], references: [id])
  attempt           Int                              // 1, 2, … per application
  status            InterviewStatus @default(AWAITING_TIMES)
  endReason         InterviewEndReason?
  activeKey         String?  @unique                 // = applicationId while active, null once ended
  requestedById     String                           // officer
  requestedAt       DateTime @default(now())
  windowStart       DateTime                         // earliest pick: requestedAt + 2 h, rounded up to the half hour
  windowEnd         DateTime                         // latest pick: requestedAt + 7 d, rounded down
  timeZone          String?                          // applicant's IANA zone, display only
  slots             DateTime[]                       // absolute instants, half-hour starts
  timesRevision     Int      @default(0)             // +1 on every submit that changes slots
  timesSubmittedAt  DateTime?
  timesUpdatedAt    DateTime?
  proposedStart     DateTime?
  proposedById      String?
  proposedAt        DateTime?
  bookedStart       DateTime?
  bookedById        String?                          // for an accepted proposal, the proposer
  bookedAt          DateTime?
  endedAt           DateTime?
  endedById         String?                          // null when the system ended it
  remindedAt        DateTime?                        // 5-minute reminder enqueued
  joinedNotifiedAt  DateTime?                        // voice-join notice enqueued
  headsUpAt         DateTime?                        // 3-day heads-up enqueued
  requestDmId       String?                          // DM message holding the link button
  timesMessageId    String?                          // thread: the times message (embed + controls)
  proposalMessageId String?                          // thread: the "proposed" line
  proposalDmId      String?                          // DM message holding Accept / Decline
  bookedMessageId   String?                          // thread: the booking confirmation
  @@unique([applicationId, attempt])
}

/// Work for the bot. The site writes; the bot polls, runs, acks.
model OutboxJob {
  id          String    @id @default(cuid())
  type        String                            // see §5
  payload     Json
  status      JobStatus @default(PENDING)
  attempts    Int       @default(0)
  runAfter    DateTime  @default(now())         // backoff
  lockedAt    DateTime?
  lastError   String?
  result      Json?                             // what the bot reported on ack
  createdAt   DateTime  @default(now())
  @@index([status, runAfter])
}

/// Replay protection for bot writes.
model BotRequest {
  key        String   @id
  statusCode Int
  body       Json
  createdAt  DateTime @default(now())
}
```

Seed `RaidTemplate` with the raid templates configured in production:
Barrow Deeps 10 (2/2/3/3), Hyjal Summit 20 (2/3/7/8), Onyxia's Lair 40 (3/12/11/14).
Order is tank/healer/melee/ranged.

Roster derivation (amended 2026-09-27, Robert's decision): Discord is the source for who is
in the guild. `User.inGuild` is true for anyone holding Guild Member or Officer; only they
appear on the web roster, with or without a main character. `User.rank` is the roster rank
and goes **both ways**: the Discord roles Officer > Trial > Raider set it (anyone else is
`SOCIAL`), and a rank set on the web roster editor pushes the matching roles back through
`member.roles.sync` (Raider for raiders and officers, Raider + Trial for trials, Social for
socials; Officer is never touched). Whichever side wrote last wins; a snapshot arriving while
a web-set rank still has an open `member.roles.sync` job leaves that rank alone. The main
character's `rank` column mirrors `User.rank`. A user is on the roster of every generated raid
if `inGuild` and `rank` is `RAIDER`, `TRIAL` or `OFFICER`; a main is not required.

The bot sends `POST /members/sync` with every guild member's id, display name, avatar and
role ids every `SNAPSHOT_SECONDS` (`full: true`, only from a complete member cache) and for one
member, in order, on every roster-relevant role change, join or leave. Members missing from a full
snapshot have left and get `inGuild = false`. Role changes the bot makes itself go out as one
`member.edit`, so Discord reports one state, not two halves.

Trials: accepting a raider application sets `rank = TRIAL`, `trialStartedAt = now`, and the
decide job adds Guild Member, Raider and Trial and removes Guest and Social. Anyone who gets
the Trial role another way (the #new-users triage, an officer by hand) starts the same clock
through the snapshot. The check-in is due at `User.trialCheckInAt`, or fourteen days after
`trialStartedAt` while that is unset; tick then enqueues one `trial.checkin` and sets
`trialNudgedAt`. The bot posts it to `#officers`, mentioning the Officer role, with **Promote to
Raider** and an **Extend trial** menu (1 to 7 days), both answered through
`POST /members/:discordId/trial`. Promote sets rank RAIDER the way the roster editor does (the
Trial role comes off through `member.roles.sync`); extend sets `trialCheckInAt = now + days` and
clears `trialNudgedAt`, so the check-in comes back then. Leaving Trial by any route clears
`trialStartedAt`, `trialNudgedAt` and `trialCheckInAt`. This is the only trial reminder;
officers may still end a trial on the roster editor. The trial DM text is a placeholder until
Robert writes the real one.

---

## 4. Site API for the bot

All under `/api/bot/`. JSON in, JSON out (204 has no body). 401 on bad secret. 409 on a state
conflict with a `reason` string the bot shows verbatim to the user who clicked, except the
character routes below: their `reason` is a stable code and `error` is the message to show.
Any route that takes `Idempotency-Key` may also answer `409 { reason: "in_progress", error }`
(§1.6): retry with backoff under the same key rather than showing it.

| Method | Route | Purpose |
|---|---|---|
| GET | `/outbox?limit=20` | Next pending jobs whose `runAfter` has passed. Marks them RUNNING with `lockedAt`. Jobs locked > 5 min are returned again. |
| POST | `/outbox/:id/ack` | `{ ok: true, result? }` → DONE, store result, apply it (see §5). `{ ok: false, error }` → attempts+1, PENDING with `runAfter = now + 2^attempts min`, FAILED after 5. |
| POST | `/tick` | Runs everything due (§6). Idempotent. Returns counts of what it did. |
| GET | `/applications/:id` | Full application + notes, for rendering, plus `interview`: the latest attempt in the `GET /interviews/:id` shape without `slots`, or `null` if there is none, and `reminder`: `{ pending, live }` (§6 step 14, Fresh check). |
| POST | `/applications/:id/decision` | `{ status: ACCEPTED\|DECLINED, byDiscordId, reason? }`. 409 if not PENDING. |
| POST | `/applications/:id/reopen` | `{ byDiscordId }`. 409 if PENDING. |
| POST | `/applications/:id/notes` | `{ discordMessageId, authorDiscordId, body, createdAt }`. Author must resolve to an OFFICER; otherwise 403 and the bot ignores the message. |
| PATCH | `/notes/by-message/:discordMessageId` | `{ body }` |
| DELETE | `/notes/by-message/:discordMessageId` | soft delete |
| GET | `/raids/:id` | Raid + template + counts + `viewer` block when `?discordId=` is given: `{ standing, response, character, characters?, lootTable, reservesLocked, reservesComplete, reservesUrl }`, or `null` when that member has no sign-up (so cannot reserve). `lootTable` is true when loot is on, the raid's template has at least one loot-table item and the member can reserve; it is false for a member on the Trial rank, who can't set reserves, so the bot shows them no reserve prompt; `reservesLocked` is true from `startsAt − 120 min` (the reserve lock, not the sign-up lock); `reservesComplete` is true only when the member has both a hard and a soft reserve on the raid, as for `raid.reserves.remind`; `reservesUrl` is `<site>/members/calendar/<raidId>?reserves=1`, which opens that member's own reserves window after sign-in when they are Accept or Tentative with a character, the raid is not cancelled and reserves aren't locked, and otherwise just shows the raid page. `character` is the brought character `{ id, name, wowClass, spec, raidRole }` (saved choice, otherwise main), or `null`; `wowClass` and `raidRole` are lowercase. `characters` is the member's list in the `/members/:discordId` format, main first then alts by name, sent only when the member has alts. `POST /raids/:id/respond` answers with the same `viewer` block. The bot must tolerate a missing `character` on older sites and show no character menu without `characters`. Character names are private to this viewer block, never added to the embed (§8). |
| POST | `/raids/:id/respond` | `{ discordId, response: ACCEPT\|TENTATIVE\|ABSENT, reason?, characterId? }`. Optional `characterId` must belong to the member; invalid/not theirs, or any character with ABSENT, returns 400. Omitted: preserve the saved choice, or use the main for a new sign-up. A new sign-up can choose an alt directly. For an existing choice that differs, write the answer then switch character in the same transaction using the shared reserve rule; a switch refusal rolls back the entire answer and returns its status and `{ reason }`. Success includes `removedReserves: [{ kind, itemName, reason }]` (no item ids; `[]` when none or no switch), so the bot can explain reserves the new character cannot take. Uses `Idempotency-Key`, replaying the complete reply. Rules in §7, including the sign-up lock, are unchanged. `/bench` does not accept character choice. |
| POST | `/raids/:id/bench` | `{ discordId }` — opt onto the bench. 409 if already on roster. |
| POST | `/raids/:id/attendance` | `{ byDiscordId, attended: [discordId], absent: [discordId] }`. Officers only, after `startsAt + durationMin`. |
| PUT | `/raids/:id/character` | `{ discordId, characterId }` changes the character on an Accept/Tentative sign-up using the shared switch/reserve rule. 200 `{ character: { id, name, wowClass, spec, raidRole }, removedReserves: [{ kind, itemName, reason }] }`; class and role are lowercase, removed reserves omit item ids. Choosing the character already brought returns 200 with `removedReserves: []`, even after the sign-up lock. Otherwise `locksAt` governs (not the reserve lock); no officer override. 400 `{ reason: "invalid", error }` for a malformed body or a character not owned by the member; 409 `{ reason: "no_signup"\|"cancelled"\|"done"\|"locked", error }` for no Accept/Tentative sign-up or a closed raid; 403 `{ reason: "forbidden", error }` for a social member. `error` is the site's refusal message, including the sign-up lock message for `locked`. Unknown member or raid: 404 `{ error }`; oversized body: 413 `{ error }`. Uses `Idempotency-Key`, replaying the complete original status and body (including removed reserves). |
| GET | `/members/:discordId` | role, rank, guild membership, main character (existing fields unchanged), plus `characters: [{ id, name, wowClass, spec, raidRole, isMain }]`, main first then alts by name. `wowClass` and `raidRole` are lowercase. 404 if unknown. |
| POST | `/members/:discordId/characters` | `{ name, wowClass, spec, raidRole }` adds an alt using the site's character rules; `raidRole` maps to the rules' `role`. 201 `{ character: { id, name, wowClass, spec, raidRole, isMain } }`; same-name alt for this member returns 200 with the existing character, without changing it. 404 unknown member; 400 `{ reason: "invalid", error }`; 413 `{ error }` for an oversized body; 409 `{ reason: "name_taken"\|"limit"\|"no_main"\|"busy", error }` (`busy` means retries lost a race; retry with a new interaction/key, since the same key replays the same failure). Maximum eight characters including main. Uses `Idempotency-Key`; a replay preserves the original status and body. Does not change Discord class tags. |
| DELETE | `/members/:discordId/characters/:characterId` | Removes an alt, never a main (including a lone main). 204 with no body when removed or already gone, including a concurrent removal. 404 unknown member or another member's character; 409 `{ reason: "main"\|"busy", error }` if main or retries exhausted (`busy` requires a new interaction/key to retry; the same key replays the failure). Uses `Idempotency-Key`, including bodyless 204 replay. Does not change Discord class tags. |
| PUT | `/members/:discordId/main` | `{ firstName, secondName, wowClass, spec, raidRole }` from the "Set my main" flow (§9.7). Creates or replaces the member's main on the roster; rank untouched. 404 unknown member, 409 name taken. |
| GET | `/classes` | Classes, specs and the raid roles each spec fills, for the bot's menus. |
| POST | `/members/:discordId/trial` | `{ action: promote\|extend, days?, byDiscordId }` from the trial check-in (§3). `byDiscordId` must be an OFFICER, else 403. `days` is 1–7 for extend. 404 unknown member; 409 with `reason` when they are not a trial any more. Answers `{ action, rank, checkInAt? }`. |
| GET | `/needs` | Recruitment needs for `/recruitment` (§9.8): `{ statuses: [high, medium, closed], classes: [{ key, label, specs: [{ name, status }] }] }`, every spec listed, closed unless an officer set it. A spec that fills two raid roles is listed once per role, each with its own status: Feral is `Feral Tank` and `Feral Melee DPS`. |
| PUT | `/needs` | `{ wowClass, spec, status, byDiscordId }` from `/recruitment`; `spec` is a name from `GET /needs`. `byDiscordId` must be an OFFICER, else 403; 400 for an unknown class, spec or status. The same write as the web needs editor, so the recruitment page, the home teaser and the officer editor show it within a minute. Anything but high also takes the spec's home-page star away. Answers `{ wowClass, spec, status }`. |
| POST | `/members/sync` | `{ members: [{ discordId, name, avatarUrl, roles }], full }`. Upserts every member's name, avatar, site role, `inGuild` and rank from their Discord roles (§3). With `full`, anyone not listed gets `inGuild = false`. Idempotent; no Idempotency-Key needed. |
| POST | `/applications/:id/messages` | Officer → applicant relay (§13). `{ byDiscordId, body }`, key = the popup's interaction id. 201 `{ message }` with status `QUEUED`; enqueues `application.message.send`. |
| POST | `/applicant-messages` | An applicant's DM to the bot (§13). `{ discordId, dmChannelId, dmMessageId, body, createdAt, attachments }`, key = the DM message id. `{ stored: true, applicationId, messageId }` and enqueues `application.message.copy`, or `{ stored: false }`. |
| PATCH | `/applicant-messages/:dmMessageId` | `{ body }`. Edit of a stored DM (§13). `{ changed, … }`. |
| DELETE | `/applicant-messages/:dmMessageId` | Delete of a stored DM (§13): marks it deleted, keeps the text. `{ changed, … }`. |
| GET | `/applicant-messages/open` | For the bot's catch-up (§13): one entry per `PENDING` application. |
| GET | `/messages/:id` | One relay message for rendering (§13), with `ping`. |
| POST | `/applications/:id/interview` | Start an interview (§12). `{ byDiscordId, confirmSecond? }`. 201 `{ interview }` (the read shape below). Enqueues `interview.request`. |
| GET | `/interviews/:id` | Read an interview for rendering (§12): `{ id, applicationId, attempt, status, endReason, applicant: { discordId, characterName }, threadId, timeZone, timesRevision, slots: [ISO], requestedAt, timesUpdatedAt, requestedBy, proposedStart, proposedBy, bookedStart, bookedBy, endedAt, pageUrl, requestDmId, timesMessageId, proposalMessageId, proposalDmId, bookedMessageId }`. `requestedBy`, `proposedBy` and `bookedBy` are `{ discordId, name }` or `null`; `pageUrl` is `<site>/apply/interview`. 404 `{ error }` if unknown. |
| POST | `/interviews/:id/book` | `{ startsAt, timesRevision, byDiscordId }`. 200 read shape. |
| POST | `/interviews/:id/propose` | `{ startsAt, byDiscordId }`. 200 read shape. |
| POST | `/interviews/:id/answer` | `{ discordId, answer: accept\|decline }`. 200 read shape. |
| POST | `/interviews/:id/cancel` | `{ byDiscordId }`. 200 read shape. |
| POST | `/interviews/voice-join` | `{ discordId, channelId }`. 200 `{ notified: boolean, interviewId? }`. |
| GET | `/health` | `{ ok: true, version }` |

Every write here that changes something Discord shows **also enqueues the matching
`*.update` job**. That is how a click in Discord ends up re-rendering the embed: the bot
posts the response, the site stores it and enqueues `raid.update`, the bot picks that up on
its next poll and re-renders from `GET /raids/:id`. The bot must not update the embed
directly from the click; it may reply ephemerally ("You're set to Accept") immediately.

---

## 5. Outbox job types

`payload` always includes the entity id. The bot handles each type; unknown types are acked
`ok: false` with `error: "unknown type"` so they surface as FAILED.

| Type | Bot does | Ack `result` | Site applies result |
|---|---|---|---|
| `application.post` | Create forum post in `APPLICATIONS_FORUM_ID`: title `Name — Class (Spec) — Path` (Social: `Name — Social`), tags `[path, Pending]`, starter = embed of all answers + buttons Accept / Decline / Open on web (link). | `{ threadId, messageId }` | store on Application |
| `application.message.send` | `{ applicationId, messageId }`. DM the applicant an officer's relay message (§13). | `{ dmChannelId, dmMessageId }`, `{ dmDelivered: false }` or `{ notSent: true }` | `SENT` and store the DM ids; `NOT_DELIVERED`; `NOT_SENT`. The site then enqueues `application.message.copy` |
| `application.message.copy` | `{ applicationId, messageId }`. Post the relay message's thread copy, or edit it in place (§13). | `{ channelId, messageId, pinged }`, or `{ skipped }` | store the copy ids; `pinged` sets `relayPingAt`. `skipped` stores nothing |
| `application.update` | Re-render starter embed and tags from `GET /applications/:id`. | — | — |
| `application.note.post` | Post `**Name** (web) · body` in the thread. | `{ messageId }` | store on OfficerNote |
| `application.note.edit` | Edit that message. | — | — |
| `application.note.delete` | Delete that message. | — | — |
| `application.decide` | Strip the buttons from the live reminder (`reminder.live`, §6 step 14), if any. Post decision embed (green Accepted / red Declined, by whom, via web or Discord). Retag. DM applicant from the template in `content/dm-templates` (site serves it in the job payload). On ACCEPTED: apply `payload.roles` (`{ add, remove }`, computed by the site: Guild Member, Raider and Trial in, Guest and Social out for the raider path; Guild Member and Social in, Guest out for social). Archive + lock the thread. With no reachable thread (none recorded, deleted, or no access), the bot still applies the roles and sends the DM, skips the thread steps and posts nothing in `#officers`; a transient Discord error still retries. | `{ dmDelivered: bool }` | — |
| `application.reopen` | Unarchive, unlock, retag Pending, post "Reopened by X". | — | — |
| `application.nudge` | `{ applicationId, key }`. A pending-application reminder (§6 step 14, §8 Reminders): re-read `GET /applications/:id`, compare keys, post one line with buttons in the application's thread. The site no longer queues the old once-only nudge (a job **without `key`**, §6 step 7); one still in the queue from before the switch is handled as before: message in `OFFICERS_CHANNEL_ID`, "Application from X has been pending 24h" + link. | `{ channelId, messageId }`, or `{ skipped: "<reason>" }` | applied only if `key` still equals `reminderKey`: store `reminderChannelId` / `reminderMessageId`, count it, set `reminderLastOn`, clear `reminderKey`. Skipped: clear `reminderKey`, count nothing |
| `raid.post` | Post one message in `RAID_SIGNUPS_CHANNEL_ID`: embed (§8) titled `🟢 Template — Ddd Mon D` (+ " · added late" when `payload.late`) + buttons Accept / Tentative / Decline / Join bench / View roster (link); open a thread on it named like the title minus the state marker. | `{ threadId, messageId }` | store on Raid |
| `raid.update` | Re-render the embed (title prefix and colour carry the state) from `GET /raids/:id`. | — | — |
| `raid.remind` | Thread message mentioning `payload.discordIds`. For anyone the mention can't reach (left server), skip. | — | — |
| `raid.reserves.remind` | Tell `payload.discordIds` they haven't picked both loot reserves; link to the raid page's Loot reserves section. Skip members the bot cannot reach. Payload: `{ raidId, discordIds: string[], reservesLockAt: ISO timestamp }`. Ordered with other jobs for this raid. | — | — |
| `raid.lock` | Re-render as 🔒 Locked, post "Sign-ups are locked. Officers can still change answers on the web." in the thread. | — | — |
| `raid.cancel` | Edit the message to the compact ❌ line with `payload.reason`, remove buttons, DM everyone who ACCEPTed, archive the thread. | — | — |
| `raid.close` | Edit the message to the compact ✅ line with the attended count, remove buttons, archive the thread. | — | — |
| `raid.delete` | `{ raidId, threadId, messageId }`: the raid row is already gone, so nothing is fetched. Delete the thread (archive it when the bot lacks Manage Threads), then the message. Quiet: no thread notice, no DMs. Missing objects count as done. | — | — |
| `member.roles.sync` | `{ discordId, add: [roleId], remove: [roleId] }`. Only ever touches Guild Member, Guest, Raider, Trial and Social. **Never Officer** — that role grants site access and is managed by humans. | — | — |
| `officers.notify` | Free-text message to `#officers`. Used for FAILED jobs and reconcile findings. | — | — |
| `trial.checkin` | `{ discordId, name, startedAt, extended }` (§3). Message in `#officers` mentioning the Officer role: whose trial is up and since when, with **Promote to Raider** (button) and **Extend trial** (menu, 1–7 days). Both call `POST /members/:discordId/trial` and survive restarts; the answer edits the message to the outcome and removes them. Entity `member:<discordId>`. | — | — |
| `interview.request` | `{ applicationId, interviewId }` (all interview jobs carry these two; §12 has the rules, copy and preconditions). DM the request with the **Share my availability** link button, then one thread message. | `{ dmDelivered, dmMessageId? }` | store `requestDmId` |
| `interview.times` | Post the times message pinging the Officer role and DM the thanks; on later revisions edit that message in place. | `{ messageId }` first time | store `timesMessageId` |
| `interview.booked` | `+ startsAt`. DM the booking, post the confirmation in the thread. | `{ messageId, dmDelivered }` | store `bookedMessageId` |
| `interview.proposed` | `+ startsAt`. DM the proposal with **Accept** / **Decline**, post the proposal line. | `{ messageId, dmMessageId?, dmDelivered }` | store `proposalMessageId`, `proposalDmId` |
| `interview.ended` | `+ outcome: declined\|expired\|lapsed\|cancelled\|closed`. DM the outcome (none for `closed`), post the thread notice, remove live controls. | `{ dmDelivered? }` | — |
| `interview.headsup` | One thread message: no times yet after 3 days. | — | — |
| `interview.remind` | `+ startsAt`. DM the applicant and ping the booking officer in the thread, 5 minutes before. | — | — |
| `interview.joined` | Thread notice with **Move to Raider Interviews**, pinging the booking officer. | — | — |

The `raid.post` / `raid.update` / `raid.lock` / `raid.cancel` / `raid.close` rows describe
the forum-era mechanism; since #raid-signups became a text channel (§8) the bot posts one
message plus a thread instead of a forum post, and state is the embed's title prefix and
colour instead of tags. The site-facing contract is identical: payloads, the ack result
`{ threadId, messageId }`, and what the site stores (`Raid.discordMessageId` is the channel
message, `Raid.discordThreadId` the thread).

The bot processes jobs **in order per entity** (same `applicationId`/`raidId` never in
parallel) and up to 4 entities concurrently.

---

## 6. What `tick` does

Runs every 60 s, called by the bot. Each step is idempotent and bounded.

1. **Generate instances.** For every active series, ensure a Raid exists for each occurrence
   from now to `horizonWeeks` ahead. Compute `startsAt` from weekday + `startTime` in
   `GUILD_TZ` for that date (this is what keeps 8 PM at 8 PM across DST). `locksAt =
   startsAt − lockMinutesBefore`. Create Signup rows (`standing ROSTER, response null`) for
   every roster-derived user. Skip dates that already have a raid for the series.
2. **Post.** Raids with `postedAt null` and `startsAt − now ≤ postAheadDays` → enqueue
   `raid.post`, set `postedAt`.
3. **Remind.** Raids posted, not locked, `startsAt − now ≤ 72h` and `remind72At null` →
   enqueue `raid.remind` with the ROSTER users whose response is null; set `remind72At`.
   Same at 24h.
4. **Lock.** `now ≥ locksAt` and status SCHEDULED → LOCKED, `lockedAt`, enqueue `raid.lock`.
5. **Close.** `now ≥ startsAt + durationMin + 60min` and status LOCKED → DONE, enqueue
   `raid.close`. Attendance can still be entered afterwards.
6. **Reserve reminder.** Only with `LOOT_ENABLED` on: posted SCHEDULED or LOCKED raids
   whose template has at least one loot-table item, in the two hours before reserves lock
   (`startsAt − 120 min`, independent of sign-up `locksAt`). Include the window's start,
   exclude its end; never catch up after reserves lock. With `remindReservesAt null`,
   conditionally set it and enqueue one `raid.reserves.remind` in the same transaction.
   Recipients are ACCEPT or TENTATIVE signups with a character, regardless of standing,
   missing HR or SR (officer-placed picks count for their holder). Compute ids at enqueue
   time. If nobody is owed, mark done without a job. Overlapping ticks cannot enqueue twice.
   Returned `reservesReminded` counts jobs enqueued, not empty evaluations.
7. **Nudge (retired).** The old once-only nudge (PENDING > 24h → `application.nudge` without
   `key`, set `nudgedAt`) is switched off; step 14 replaced it. Nothing reads or writes
   `nudgedAt` any more. The reminder rules are step 14 so they run after the interview steps.
8. **Reconcile (once per hour).** For every raid and application with a thread id and
   status that implies archived/locked, enqueue `*.update` (the bot's update handler also
   fixes archive/lock/tag state). Cheap insurance against drift.
9. **Interview reminder.** `BOOKED`, `bookedStart − 5 min ≤ now < bookedStart`, `remindedAt null` →
   conditionally set `remindedAt` and enqueue `interview.remind`. A bot back from a restart
   before the start still sends it; after the start, never.
10. **Interview expiry.** `AWAITING_TIMES` or `TIMES_RECEIVED` with `requestedAt + 7 d ≤ now` →
    `NO_TIME`/`EXPIRED`, enqueue `interview.ended` (`expired`).
11. **Interview heads-up.** Still `AWAITING_TIMES`, `requestedAt + 3 d ≤ now`, `headsUpAt null` →
    set `headsUpAt`, enqueue `interview.headsup`. Runs after step 10, so an expired one gets none.
12. **Proposal lapse.** `PROPOSED` with `proposedStart ≤ now` → `NO_TIME`/`PROPOSAL_LAPSED`, enqueue
    `interview.ended` (`lapsed`).
13. **Interview done.** `BOOKED` with `bookedStart + 60 min ≤ now` → `DONE`, no job.

Steps 9–13 are each a conditional update on status (and on the field that makes them due), so
overlapping ticks do one thing once; ending an interview also sets `endedAt` and clears
`activeKey`. The reply counts them as `interviewsReminded`, `interviewsExpired`,
`interviewsHeadsUp`, `interviewsLapsed`, `interviewsDone`.

14. **Application reminders.** Switched on, replacing step 7; reply count
    `remindersQueued` (the old `nudged` count is gone). Rules below.

### Application reminders (step 14)

An application that sits PENDING gets a reminder in its thread, at most once per Pacific day,
in the evening, with the buttons that fit where it stands. Raider and social alike. All dates
and times of day are in `America/Los_Angeles` ("Pacific"), by calendar day, so DST never
shifts a cadence. The reminder is the only thing that nudges; there is no digest.

**Activity time** of an application is the latest of: `createdAt`; `reopenedAt`; the
`createdAt` of every officer note, soft-deleted ones included (edits don't count); the
`createdAt` of every officer relay message (`TO_APPLICANT`, §13), whatever its status or the
application's status (applicant messages never count); and, from
its **latest** interview attempt (highest `attempt`), `requestedAt`, `timesUpdatedAt` (set when
times are submitted or really changed; an identical set changes nothing, §12), `proposedAt`,
`bookedAt` and `endedAt`. Messages the bot posts don't count. It never runs backwards. An
interview ended late after downtime only delays a reminder.

**Quiet.** While the latest attempt is `AWAITING_TIMES`, `PROPOSED` or `BOOKED`, nothing is
due: the interview flow owns the thread. `TIMES_RECEIVED` is not quiet (a booking is owed).

**Due.** In the evening window (5 PM to midnight Pacific), on Pacific day D, an application is
due when all of these hold:
- it is `PENDING` and not quiet;
- its activity time is at least 24 h before D's 5 PM (elapsed time, so a 23- or 25-hour day
  counts as it is);
- `reminderTriedOn` is not D (one try per application per Pacific day);
- the cadence allows. With `n` = `reminderCount` when `reminderActivityAt` equals the current
  activity time, else 0: `n = 0`; or `n < 3` and `reminderLastOn` ≤ D−1; or `n ≥ 3` and
  `reminderLastOn` ≤ D−3. A new activity time therefore restarts the count.

Applications pending when the schedule is switched on follow the same rules with every count at
0 (the new fields start empty). A day is never made up: a tick after midnight sees the next day.

**Tick.** For each due application, in one transaction and as a conditional update on
`reminderTriedOn`, set `reminderTriedOn = D`, set `reminderKey`, and enqueue
`application.nudge` `{ applicationId, key }`, so overlapping ticks do one thing. `key` is
`<activity time ISO>@<D>`; the bot treats it as opaque. Skipped, expired or failed tries don't
count toward the cadence (only `reminderTriedOn` records them), so the next day tries again.

**Line.** The site picks the line from the latest attempt and returns a code; the bot renders
the copy (§8 Reminders):

| Code | When | `at` |
|---|---|---|
| `booking_owed` | latest is `TIMES_RECEIVED` | `timesUpdatedAt` |
| `time_passed` | latest is `DONE` | `bookedStart` |
| `no_time` | latest is `NO_TIME` | `endedAt` |
| `cancelled` | latest is `CANCELLED` | `endedAt` |
| `waiting` | no interview, or latest is `CLOSED`, or latest ended before the latest `reopenedAt` | the activity time |

A `DONE`, `NO_TIME` or `CANCELLED` attempt that ended before `reopenedAt` is history, so a
reopened application gets `waiting`.

**Fresh check.** `GET /applications/:id` adds `reminder: { pending, live }`:
- `pending` is `{ key, line, at, interviewId }` (`line` a code above, `at` ISO, `interviewId`
  the latest attempt's id or `null`) only while the outstanding key is still valid: the
  application is `PENDING`, the activity time inside the key is unchanged, it is not quiet, and
  it is before midnight Pacific of the key's day. Otherwise `null`.
- `live` is `{ channelId, messageId }` of the last reminder sent, or `null`.

The ack of an `application.nudge` job with a `key` is applied only if that key still equals
`reminderKey`: store the ids, `reminderCount` +1 (reset to 1 and `reminderActivityAt` set to the
key's activity time when it differs), `reminderLastOn = D`, clear `reminderKey`. A stale ack is
ignored. `{ skipped: "<reason>" }` clears the key without counting.

**Worked examples** (October 2026, Pacific, PDT unless noted; "ticks" means the tick that
runs in the window):

| Case | Activity / events | Result |
|---|---|---|
| Before the cut-off | Created Mon Oct 12 4:00 PM | Due Tue Oct 13 (Tue's threshold is Mon 5 PM and 4 PM is before it). First reminder Tue from 5 PM |
| After the cut-off | Created Mon Oct 12 6:00 PM | Not due Tue (6 PM is after Mon 5 PM). First reminder Wed Oct 14 |
| Daily, then every third day | Created Mon Oct 12 4 PM, nobody acts | Reminders: Tue 13 (1st, D), Wed 14 (2nd), Thu 15 (3rd, D+2), Sun 18 (4th, D+5: last was D−3), Wed 21 (5th) |
| A note restarts the count | Reminders sent Tue 13 and Wed 14 (count 2); an officer adds a note Wed 9 PM | The activity time changed, so the count is 0. Not due Thu (threshold Wed 5 PM), due Fri Oct 16 (threshold Thu 5 PM). Fri's reminder is the 1st, so the daily cadence runs again |
| Downtime, caught up | Due Tue 13 5 PM; bot or site down 5 PM to 9 PM | The 9 PM tick tries Tue and the bot posts it. Next day the cadence continues normally |
| Downtime past midnight | Due Tue 13; down until 12:30 AM Wed | Tue is lost: a key issued at 11:55 PM is refused by the bot after midnight (fresh check `null`). Wed 14 is a new day with the same state, so it is due Wed 5 PM |
| Fall back | Activity Sat Oct 31 5:30 PM PDT; Sun Nov 1 is 25 h long | Sun 5 PM PST minus 24 h is Sat 6:00 PM PDT, so due Sun Nov 1. Activity Sat 6:30 PM is not due until Mon |
| Spring forward | Activity Sat Mar 13 2027 4:00 PM PST; Sun Mar 14 is 23 h long | Sun 5 PM PDT minus 24 h is Sat 4:00 PM PST, so due Sun. Activity 4:30 PM waits until Mon. A reminder Sat Mar 13 followed by Sun Mar 14 is "last on D−1", so Sun is allowed |
| Reopened, earlier interview `DONE` | Interview `DONE` Oct 6; decided Oct 7; reopened Mon Oct 12 2 PM | Activity time is `reopenedAt`, so not due until Tue Oct 13. The `DONE` attempt ended before `reopenedAt`, so the line is `waiting` ("Last activity"), not `time_passed` |

New roster members: when a user's `rank` becomes a roster rank while `inGuild`, `tick` step 1 also
adds them to every SCHEDULED future raid. Rank leaving the roster removes their unanswered
rows only; answered rows are kept.

---

## 7. Sign-up rules (site enforces, bot displays)

- Only `MEMBER` or `OFFICER` role may respond or bench. `SOCIAL` gets 403 and the bot replies
  "The calendar is view-only for social members."
- A ROSTER member may set ACCEPT / TENTATIVE / ABSENT any time before `locksAt`.
- A non-roster member pressing Accept/Tentative is placed on the BENCH with that response.
  Pressing Decline while not on the roster does nothing ("You're not on this roster").
- "Join bench" = BENCH + ACCEPT.
- After lock: members get 409 "Sign-ups are locked"; officers may still change anyone via the
  web (`setByUserId` recorded, shown as "set by X").
- Officers may move BENCH → ROSTER and back on the web at any time before DONE.
- Counts: composition bars count `ROSTER + ACCEPT` only. Tentative shows in counts but never
  in the bars.
- Every response records `source` (WEB or DISCORD). Shown on every row on the web.

---

## 8. Discord rendering

### `#applications` (forum, visible to Officer role + bot)
- Tags: `Raider`, `Social`, `Pending`, `Accepted`, `Declined`. Bot creates missing tags on
  startup and caches ids.
- Starter embed: title `Name · Class · Spec · Role`; one field per answer (long answers as
  full-width fields); footer "Submitted on the web". Buttons: **Accept** (green), **Decline**
  (red), **Open on web** (link). Buttons persist across restarts.
- Accept/Decline click → `POST /applications/:id/decision` → ephemeral confirmation. 409 →
  ephemeral with the reason. The visible changes come from the `application.decide` job.
- **Thread messages**: on `on_message` in an application thread, if the author is not the bot
  and the site says they're an officer, `POST /notes`. On edit/delete, PATCH/DELETE. Messages
  from non-officers are ignored (they can't see the channel anyway). Webhook posts
  (`webhook_id` set, §13) are ignored too. Requires the
  **Message Content** privileged intent — enable it on the bot in the developer portal.
- Web notes arrive as `application.note.post` and are posted by the bot as
  `**Robert** (web) · text`. The bot ignores its own messages when ingesting.

### Reminders (§6 step 14)
- **Copy** (approved by Robert on 2026-10-16). `@Officer` is a ping of the Officer role;
  `<character name>` is the applicant's character name (§12); `<t:unix:R>` is a Discord
  relative timestamp (shown here as "1 day ago") of the line's `at`. Plain, no exclamation marks.
  - `booking_owed`: "@Officer <name> sent interview times <t:R> and none is booked yet." Buttons: **Book a time**, **Propose another time**.
  - `time_passed`: "@Officer <name>'s interview time was <t:R> and there's no decision yet." Buttons: **Accept**, **Decline**.
  - `no_time`: "@Officer No interview time was found with <name> <t:R>. An officer still needs to reach out to arrange one." Buttons: **Set up an interview**, **Accept**, **Decline**.
  - `cancelled`: "@Officer <name>'s interview was cancelled <t:R>. An officer still needs to get in touch." Buttons: **Set up an interview**, **Accept**, **Decline**.
  - `waiting`: "@Officer <name>'s application is still waiting for a decision. Last activity: <t:R>." Buttons: **Accept**, **Decline**, **Set up an interview**.
- **Before posting**, the bot re-reads `GET /applications/:id`. It acks `{ skipped }` and
  posts nothing when: `reminder.pending` is `null` or its key differs from the job's `key`, or
  it is past midnight Pacific; or a human (not the bot, not a webhook post, §13) posted in the
  thread in the last 24 h.
  The site never sees messages sent while the bot was down, nor image-only ones, so this check
  is the bot's alone.
- **Post** in the application's thread; unarchive an archived pending thread first. Only the
  Officer role is pinged. Fall back to `#officers`, with the same line and buttons plus **Open
  on web** (link), only when the thread is missing or the bot can't post there (not found,
  forbidden); any other error fails the job so it retries (§4 backoff).
- **Strip** the previous live reminder's buttons (`reminder.live`) after the new one is posted.
  `application.decide` strips the live reminder's buttons too. Failing to strip is logged and
  never retried as a new ping. Ack `{ channelId, messageId }` of the new message.
- **Buttons** carry the application id, the line's interview id when it has one, and survive
  restarts. They call the same routes as the thread's own controls (decision, interview start
  with its `second_not_confirmed` flow, book, propose). A reminder that was missed and is old
  still works while its action applies; once it doesn't, the click gets the site's refusal
  `error` ephemerally and the bot strips the buttons from that message.
- A rare duplicate reminder after a lost ack is accepted, as in §12.

### `#raid-signups` (text channel, read-only for members, chat in threads)
- Permissions: Guild Member — deny Send Messages, allow Send Messages in Threads,
  allow Add Reactions off. Bot — Send Messages, Create Public Threads, Send Messages
  in Threads, Manage Messages, Manage Threads.
- One message per raid. tick enqueues `raid.post` in `startsAt` order, so the channel
  reads chronologically. A raid created inside the `postAheadDays` window is posted at
  the bottom and its embed title is suffixed " · added late" (the site marks it
  `late: true` in the `raid.post` payload).
- The bot opens a thread on each post named exactly like the embed title minus the
  state marker, e.g. "Molten Core — Thu Nov 19". Reminders go in the thread.
- State lives in the embed, not tags: title prefix 🟢 Open / 🔒 Locked / ✅ Done /
  ❌ Cancelled, and embed colour teal / sand / green / red. Store nothing about state
  in the message itself; always re-render from `GET /raids/:id`.
- Embed body is unchanged from the previous spec: `<t:>` timestamps, monospace
  composition bars, six inline fields (Accepted, Tentative, Declined, Not answered,
  Bench, Locks at), footer "Updated <t:R> · Full roster, bench and who hasn't
  answered are on the web". No names on the embed.
- Buttons unchanged: **Accept** / **Tentative** / **Decline** / **Join bench** / **View
  roster** (link). Decline opens a modal with one optional "Reason" field. Every click
  gets an ephemeral reply stating the user's new state.
- `raid.close` and `raid.cancel` edit the message to a single compact line
  ("✅ Molten Core — Thu Nov 19 · 38 attended" or "❌ … · cancelled: <reason>"),
  remove all buttons, and archive the thread. The message is not deleted.

### Interviews (§12)
- Forum tag `Interview` joins `TAG_NAMES` (it already exists in Discord). `tags_for` adds it
  while the application's latest attempt is `BOOKED` or `DONE` and the application is
  `PENDING`, so `application.update` keeps it. The site enqueues `application.update` in the
  same transaction whenever that condition can flip: an interview becoming `BOOKED`, a `BOOKED`
  one being cancelled, and a new attempt starting after a `DONE` one. Ending by `CLOSED` rides
  on the decision's own retag. Interview jobs never unarchive or unlock a
  decided thread: in an archived thread they skip thread posts and edits.
- **Times message** (`interview.times`): an embed with one field per day (in `GUILD_TZ`) of
  time blocks as `<t:unix:t>` ranges so each officer sees their own zone, kept inside Discord's
  field and embed limits with an overflow line ("and N more times, see the web"). Controls:
  **Book a time**, **Propose another time**.
- **Book a time:** a day menu, then a time menu of that day's applicant times (split into
  several menus of at most 25 when there are more), then a private confirm showing the time in
  the clicking officer's zone. The confirm sends `POST /interviews/:id/book` with the
  `timesRevision` read when the menu opened.
- **Propose another time:** a day menu over the next 7 days, then two time menus (9:00 AM to
  3:30 PM, 4:00 PM to 10:30 PM; a menu holds 25 choices), then a confirm. Menu labels are in
  Pacific: "Thu Oct 16 · 7:30 PM PT".
- The reminder and joined notice ping `bookedBy`, the officer who booked or proposed, not the
  Officer role. **Move to Raider Interviews** (on the joined notice) is answered by the bot
  alone: the clicker must be an officer (`GET /members/:discordId`), the applicant must still be in
  voice, then the bot moves them to `INTERVIEW_VOICE_CHANNEL_ID`.
- Buttons and menus in DMs and threads carry the interview id (custom ids `interview:<id>:…`)
  and survive restarts. A click on a stale control gets the 409 `error` ephemerally and the
  bot removes the controls from that message.

### Relay (§13)
Rendering rules for the officer–applicant relay (webhook, copies, files, `/message`, catch-up)
are in §13 Rendering, so the contract reads in one place.

### `#apply` message
- Replace the two component buttons with **link buttons**: `Apply as a Raider` →
  `SITE_PUBLIC_URL/apply?path=raider`, `Apply as Social` → `SITE_PUBLIC_URL/apply?path=social`.
  Remove the modal flow. Keep the message text; add "You'll sign in with Discord on the site,
  so join the server first."

---

## 9. Site UI changes

1. **`/apply`** — public route, form only. Requires Discord sign-in. On load, check guild
   membership via the existing bot-token lookup; not a member → card with the invite instead
   of the form. `?path=raider|social` preselects the path control. One pending application per
   Discord ID (existing rule). Success → existing `/recruitment/submitted`. The form on
   `/recruitment#apply` becomes two buttons that link to `/apply?path=…`.
2. **Officer application view** — notes become a conversation: compact rows, avatar, name,
   source badge (Discord / Web), time; composer at the bottom; "synced with #applications" in
   the card header; link to the thread. Accept/Decline confirmation modal lists what will
   happen (status, tag, thread closed, DM, role change, roster entry).
3. **Templates & series (officers)** — `/officers/raids`: template table (editable), series
   list, "New series" form (template, weekday, time in guild zone, length, notes). Editing a
   series asks "This raid only" (detaches the instance) or "This and future raids".
4. **Calendar** — month grid + list toggle (list is the mobile default). Chips show
   `short · time`, a sand edge when the viewer has answered. Upcoming list beside the grid,
   sorted with "needs your answer" first.
5. **Raid detail** — viewer's own response control first; composition bars; roster grouped
   by role with Answer and Via columns; Bench card with "Move to roster"; "Hasn't answered"
   card with **Nudge in Discord** (enqueues `raid.remind`); "Answer for them" per row
   (officers); "Mark attendance" after the raid ends; Cancel with reason (officers).
6. **Roster editor** — lists everyone in the guild on Discord; a rank change (on a main, or the
   rank select on a member without one) enqueues `member.roles.sync` for the Raider, Trial and
   Social roles. Officer rank is read-only, it comes from the Discord Officer role.
7. **Set my main (Discord)** — the panel's "Set my main" button asks class, then spec (from
   `/classes`), then the raid role only when the spec fills two (Feral: tank or melee), then a
   modal for the first and second name (WoW Forever names are two parts, 12 letters each), and
   writes the main to the web roster through `PUT /members/:discordId/main`. The Discord class
   roles are still granted as before; the web form takes the two names too.
   A member who already has a main gets a **Keep <Class>** button beside the class menu, so the
   same character can change spec, raid role or name. When the web main is that class, the spec
   and raid role it has are marked "your current pick" (marked, not pre-selected: Discord sends
   nothing when a pre-selected option is picked again) and the name modal opens filled in, from
   `GET /members/:discordId`. That look-up is best effort; without it the flow runs unmarked.
8. **/recruitment (Discord)** — officers run it in the recruitment channel
   (`RECRUITMENT_NEEDS_CHANNEL_ID`): class, then spec (each spec shows its current status), then
   High / Medium / Closed. The bot writes it through `PUT /needs`.

---

## 10. Environment

Site (Vercel): `BOT_SHARED_SECRET`, `GUILD_TZ=America/Los_Angeles`, `DISCORD_ROLE_RAIDER`,
`DISCORD_ROLE_TRIAL`, `DISCORD_ROLE_SOCIAL`, `DISCORD_ROLE_GUEST` (beside the existing
`DISCORD_ROLE_OFFICER` and `DISCORD_ROLE_MEMBER`). Remove `BOT_WEBHOOK_URL`.

Bot (server env file): `DISCORD_TOKEN`, `GUILD_ID` (required by the sync now), `SITE_API_URL=https://www.bureauguild.com`,
`SITE_PUBLIC_URL=https://www.bureauguild.com`, `BOT_SHARED_SECRET`, `APPLICATIONS_FORUM_ID`,
`RAID_SIGNUPS_CHANNEL_ID`, `OFFICERS_CHANNEL_ID`, `ROLE_GUILD_MEMBER_ID`, `ROLE_GUEST_ID`,
`ROLE_RAIDER_ID`, `ROLE_TRIAL_ID`, `ROLE_SOCIAL_ID`, `ROLE_OFFICER_ID` (read only, for the snapshot),
`RECRUITMENT_NEEDS_CHANNEL_ID` (where `/recruitment` runs; blank allows any channel),
`PUBLIC_LOUNGE_CHANNEL_ID` (production 1549095645153988698), `INTERVIEW_VOICE_CHANNEL_ID` (Raider
Interviews, production 1560469424115290162), `POLL_SECONDS=5`, `TICK_SECONDS=60`,
`SNAPSHOT_SECONDS=300`. The bot needs Move Members, Connect and View Channel on Raider
Interviews. Interview hours (9:00 to 22:30) and the other interview constants (§12) sit beside
`GUILD_TIMEZONE` in the site code, not in env.

---

## 11. Done means

- An application submitted on the web appears as a forum post within 10 s. A note typed in
  the thread shows on the web within 10 s, and a note typed on the web appears in the thread
  within 10 s, attributed correctly. Accept on either side produces identical results on both,
  including the role change and the DM. Reopen works from both.
- Creating a Thursday series produces four raids with the correct `startsAt` across the
  November DST change (8 PM stays 8 PM Pacific). The post appears 14 days out. Clicking Accept
  in Discord updates the web within 10 s and the embed counts within 10 s. Responding on the
  web updates the embed. Lock at T−2h, reminders at 72 h and 24 h, close after the night.
- The bot restarted mid-way loses nothing: jobs resume, buttons still work.
- Both repos' Checks (listed in each `AGENTS.md`) pass; every PR reviewed.

---

## 12. Interviews

An officer schedules a short interview with a pending applicant. The site owns every rule
here; the bot renders and relays. A web action by an officer or applicant runs the same
transition and enqueues the same job as the bot route that matches it (the bot's
`byDiscordId` becomes the signed-in user).

### Flow
1. An officer runs `/interview` in the applicant's #applications thread (the bot resolves the
   application as it does for notes) → `POST /applications/:id/interview`. The bot posts "I'll
   reach out to set up an interview time with <character name>." and DMs the applicant the
   **Share my availability** link button to `<site>/apply/interview`.
2. There, signed in with Discord (the page finds the signed-in user's active interview; no id
   in the URL), the applicant paints half-hour start times and submits them with their browser
   time zone. `AWAITING_TIMES` → `TIMES_RECEIVED`, `timesRevision` +1, `interview.times`.
3. The thread gets the times message pinging the Officer role. An officer **books a time** or
   **proposes another time** (one proposal only). The applicant accepts or declines in the DM
   or on the page.
4. A booking DMs the applicant to join the Public Lounge voice channel at that time, posts the
   confirmation in the thread, sends both a reminder 5 minutes before, and posts a thread
   notice with **Move to Raider Interviews** when the applicant joins Public Lounge.

### Lifecycle
`Interview.status`. Active: `AWAITING_TIMES`, `TIMES_RECEIVED`, `PROPOSED`, `BOOKED`. Ended:
`DONE`, `CANCELLED`, `NO_TIME` (with `endReason` `DECLINED`, `EXPIRED` or `PROPOSAL_LAPSED`),
`CLOSED`. Only `PENDING` applications can start one (raider and social paths alike).

| From | To | When |
|---|---|---|
| `AWAITING_TIMES` | `TIMES_RECEIVED` | applicant submits at least one time |
| `TIMES_RECEIVED` | `TIMES_RECEIVED` | applicant changes times; each real change bumps `timesRevision` (an identical set changes nothing) |
| `TIMES_RECEIVED` | `BOOKED` | officer books one of the current slots (`bookedBy` = that officer) |
| `TIMES_RECEIVED` | `PROPOSED` | officer proposes a time |
| `PROPOSED` | `BOOKED` | applicant accepts (`bookedBy` = the proposer) |
| `PROPOSED` | `NO_TIME`/`DECLINED` | applicant declines |
| `PROPOSED` | `NO_TIME`/`PROPOSAL_LAPSED` | tick step 12, the proposed start arrives unanswered |
| `AWAITING_TIMES`, `TIMES_RECEIVED` | `NO_TIME`/`EXPIRED` | tick step 10, `requestedAt + 7 d` |
| `BOOKED` | `DONE` | tick step 13, `bookedStart + 60 min`; no message |
| any active | `CANCELLED` | an officer cancels |
| any active | `CLOSED` | the application is decided, web or Discord, in the same transaction as the decision; reopening revives nothing |

Interview timestamps feed the reminders' activity time and quiet state (§6 step 14). Ending sets `endedAt`, `endedById` (null for the system) and clears `activeKey`, and enqueues
`interview.ended` except for `DONE`. Applicant times can only change in `AWAITING_TIMES` or
`TIMES_RECEIVED`; in every other state the page is read-only and says where things stand.

**One active attempt.** `activeKey` is set to the application id while active and is
unique, so the database refuses a second active attempt. `attempt` counts from 1.
`POST /applications/:id/interview` answers:
- 201 `{ interview }`: created (`AWAITING_TIMES`, window set, `interview.request` enqueued).
- 409 `{ reason: "not_pending", error }`.
- 409 `{ reason: "already_active", error, interview }`: the bot shows that status from
  `interview` with a **Cancel interview** button (`/interviews/:id/cancel`).
- 409 `{ reason: "second_not_confirmed", error, earlierDate }` when there is no active attempt
  but an earlier `DONE` one (`earlierDate` = its `bookedStart`, ISO). The bot asks "<name>
  already had an interview on <date>. Schedule a second one?"; on yes it sends the same body
  with `confirmSecond: true` under a **new** `Idempotency-Key` (the same key would replay the
  409). Earlier `CANCELLED`, `NO_TIME` and `CLOSED` attempts never need confirming.

### Time rules
- **Slots** are half-hour start times from 9:00 AM to 10:30 PM wall clock in `GUILD_TZ`, every
  day: 28 a day. A painted half-hour means "I can start an interview then". One shared slot
  rule on the site generates, validates and renders them; it is tested across both DST changes
  (the hours never touch the 2 AM change, so every day has 28 slots).
- **Applicant picks** lie within `[windowStart, windowEnd]` = `[requestedAt + 2 h, requestedAt
  + 7 d]` rounded inward to the half hour. **Proposals** are slots within `[now + 2 h, now + 7
  d]`. **Booking a time or accepting a proposal** needs the start to be at least 15 minutes
  away.
- A submitted set with a pick outside the window or off the half hour is refused 400
  `out_of_range`, like a proposal; an empty set is 400 `invalid`.
- **Minimum.** Sending or changing times needs at least 5 one-hour blocks on at least 2
  different guild days. A **block** is a guild-clock hour holding at least one picked half-hour
  start (the two starts of one hour count once; a window-edge block with one start still
  counts). A **guild day** is a date in `GUILD_TZ`, so an evening that crosses the viewer's
  midnight is one day. A set below it is refused 400 `{ reason: "too_few_times", error }`
  before anything is stored or enqueued; `error` says what is missing. Changing already-sent
  times is held to the same rule. One shared function counts it (`lib/interview-minimum.ts`).
- Slots are stored as absolute instants with the applicant's zone kept in `timeZone` for
  display only. These are dated one-off times, so absolute instants are correct here, unlike
  the weekly member availability (REVIEW.md), which is kept in member-local time.
- A proposal in its last 15 minutes: accepting is refused with `reason: "too_soon"`, declining
  still works, and the interview stays `PROPOSED` until step 12 lapses it at the proposed
  start. The DM, the page and the bot all show the refusal's `error`; they do not remove the
  Accept control early. The same `too_soon` refuses booking a slot less than 15 minutes away.

### Bot API rules
All routes are in §4, officer-checked like the others: `byDiscordId` must be an OFFICER, else
403 `{ reason: "forbidden", error }`; unknown interview or application 404 `{ error }`. Every
write takes `Idempotency-Key`, except voice-join (idempotent by `joinedNotifiedAt`, like
`/members/sync`). Refusals are `{ reason, error }`, with `reason` a stable code and `error` the
message to show. Every change of state is one conditional update on `status` (and `timesRevision`
where it applies), so competing clicks get one winner and 409 `wrong_status` for the rest;
its `error` names the current state ("Already booked for <time> by <officer>.").
- **Book** `{ startsAt, timesRevision, byDiscordId }`, only from `TIMES_RECEIVED`: 409
  `times_changed` ("<name> changed their times. Pick again.") when `timesRevision` differs, 409
  `not_a_slot` when `startsAt` is not one of the current slots, 409 `too_soon`. Two officers
  booking at once: one 200, the other 409 `wrong_status`. An applicant edit and a booking race
  the same way: the booking wins only if `timesRevision` still matches, and an edit arriving
  after the booking gets 409 on the page.
- **Propose** `{ startsAt, byDiscordId }`, only from `TIMES_RECEIVED`: 400 `out_of_range` when
  not a slot in `[now + 2 h, now + 7 d]`. Sets `proposedStart`, `proposedBy`, `proposedAt`.
- **Answer** `{ discordId, answer }`, only from `PROPOSED`; `discordId` must be the
  applicant's, else 403 `forbidden`. `accept` → `BOOKED` (or 409 `too_soon`), `decline` →
  `NO_TIME`/`DECLINED`.
- **Cancel** `{ byDiscordId }` from any active status, else 409 `not_active`.
- **Voice join** `{ discordId, channelId }`, sent by the bot when a member joins Public Lounge
  (the bot filters by `PUBLIC_LOUNGE_CHANNEL_ID`; the site does not check `channelId`). When that
  member has a `BOOKED` interview with `bookedStart` from 15 minutes ahead to 30 minutes ago
  and `joinedNotifiedAt` null, the site sets it and enqueues `interview.joined`; the reply is
  `{ notified: true, interviewId }`, otherwise `{ notified: false }`. Rejoining notifies nothing.

### Outbox jobs
Payload always has `applicationId` and `interviewId`. `entityKey` maps `interview.*` to
`application:<applicationId>`, so they run in order with that application's other jobs (today
an unknown type falls to `officers`). `claimJobs` may hand out a newer job before an older
one in backoff, so **every handler re-reads `GET /interviews/:id` and renders from it, never
from the payload alone, and checks its precondition**. When it fails, ack `{ ok: true, result:
{ skipped: "<reason>" } }` and show nothing. Each job sends at most one DM and one thread
message; a duplicate after a lost ack is accepted as rare, as for `application.decide`. A DM
Discord refuses (error 50007) counts as not delivered: the thread message says so and the ack
carries `dmDelivered: false`. Any other error fails the job so it retries.

| Job | Precondition | Does |
|---|---|---|
| `interview.request` | `AWAITING_TIMES` | DM the request (copy below) with the link button; then one thread message: the "I'll reach out" line, or if the DM was refused "I couldn't DM <name>, their DMs are closed. Send them this link another way: <page URL>" |
| `interview.times` | `TIMES_RECEIVED` | `timesMessageId` unset: post the times message pinging the Officer role and DM the thanks. Set: edit that message in place, marked "updated", mentions suppressed, no DM |
| `interview.booked` | `BOOKED` and `bookedStart` = `payload.startsAt` | DM the booking; thread confirmation with **Cancel interview**; strips controls from the times and proposal messages and the request DM |
| `interview.proposed` | `PROPOSED` and `proposedStart` = `payload.startsAt` | DM the proposal with **Accept** / **Decline**; thread line naming the time and the proposer; strips the times message controls and the request DM's button. A refused DM: the thread line also gives the page URL |
| `interview.ended` | status ended with the reason for `payload.outcome` (`declined`: `NO_TIME`/`DECLINED`; `expired`: `NO_TIME`/`EXPIRED`; `lapsed`: `NO_TIME`/`PROPOSAL_LAPSED`; `cancelled`: `CANCELLED`; `closed`: `CLOSED`) | DM the outcome copy and post a thread notice; every earlier interview message loses its controls. `closed` sends no DM (the decision DM goes anyway), posts nothing, and only strips controls |
| `interview.headsup` | `AWAITING_TIMES` and `headsUpAt` set | thread message: no times from <name> after 3 days, 4 days left |
| `interview.remind` | `BOOKED`, `bookedStart` = `payload.startsAt`, now before the start | DM the reminder; thread message pinging `bookedBy` |
| `interview.joined` | `BOOKED` and `joinedNotifiedAt` set | thread notice pinging `bookedBy`, "<name> has joined Public Lounge.", with **Move to Raider Interviews** |

Controls are removed or updated on the earlier messages so no live button outlasts its state.
The ack results stored on the row are in §5.

### Applicant DM copy
A reply the applicant DMs to the bot is the relay (§13), not part of the interview flow.
Approved by Robert on 2026-10-15; times render in the applicant's zone (`<t:>`). Officer thread
lines are plain, neutral in pronouns and have no exclamation marks.
- Request: "Hi <name>. I'm following up on your application with Bureaucracy. The officers are reviewing it and would like to set up a quick 15–20 minute interview with you. Please share your availability over the next week and I'll schedule your interview." Button: **Share my availability**.
- Thanks: "Thanks, <name>. I've passed your times to the officers. Keep an eye on your messages here; I'll let you know when your interview is booked."
- Booked: "You're all set. Your interview is <time> (<relative>). At that time, please join the Public Lounge voice channel and an officer will bring you in."
- Reminder: "Your Bureaucracy interview starts in 5 minutes. Please join Public Lounge now."
- Proposal: "The officers couldn't make any of your times. Could you do <time> instead?" Buttons: **Accept**, **Decline**.
- Declined: "Thanks for letting us know. Since we couldn't find a time, an officer will reach out to you directly to arrange one." Expired and lapsed: "Since we couldn't find a time, an officer will reach out to you directly to arrange one."
- Cancelled: "Your interview on <time> has been cancelled. An officer will be in touch." (<time> is the booked or proposed start; with neither, "Your interview has been cancelled. An officer will be in touch.")

---

## 13. Officer–applicant relay

Officers talk to a pending applicant through the bot, and the applicant answers by DMing the
bot. The site owns every rule below; the bot relays and renders. Decided with Robert on
robpaolella/bureaucracy-forever-discord-bot#98; not open for re-litigation. A relay message is an
`ApplicantMessage` (§3), a separate table from `OfficerNote`: notes stay officers-only, and
nothing in the relay is ever a note. "Thrall" below stands for the applicant's character name
(§12).

### Rules
- **Who and when.** Officers send; `byDiscordId` must resolve to an OFFICER, else 403
  `{ reason: "forbidden", error }`. The relay works only while the application is `PENDING`,
  both ways. Sending to a decided application is 409 `{ reason: "not_pending", error }` with
  `error` "This application has been decided, so I can't pass messages on. DM them yourself if
  you need to." Reopening turns the relay back on. Unknown application: 404 `{ error }`.
- **Lengths.** An officer message is 1–1,500 characters after trimming (else 400
  `{ reason: "invalid", error }`). An applicant DM is up to 4,000 characters (Discord Nitro; more
  is 400 `invalid`). An applicant DM with no text but at least one attachment is valid; with
  neither it is 400 `invalid`. Officers send text only.
- **Which application.** A DM belongs to the sender's most recent application (by `createdAt`).
  Someone with no application, or whose message the rule below refuses, is `{ stored: false }`.
- **When an applicant DM is stored.** Only if, at the DM's Discord send time (`createdAt` in
  the request), the sender's application was `PENDING`: the DM is later than the application's
  `createdAt` and latest `reopenedAt`, and the application is `PENDING` now or the DM is earlier
  than `decidedAt`. Otherwise `{ stored: false }` and the bot does nothing: no reply, no
  reaction. A stored message belongs to that application for good, whatever happens to it
  later.
- **Edits and deletes** find the message by its DM message id (never by the sender's current
  application) and apply only while that message's application is `PENDING` and the message is
  not deleted. A delete keeps the text and sets `deletedAt`; an edit after a delete is ignored.
  Changed attachments in an edit are ignored; only `body` changes (`editedAt` is set). An edit
  that changes nothing, an unknown id, or any refusal is `{ changed: false }` (200, nothing
  enqueued).
- **Reminder activity** (§6 step 14): every officer message's `createdAt` joins the activity
  time, whatever its status or the application's status. Applicant messages never do.

### Routes
All under §4's conventions; each write takes `Idempotency-Key`.

- `POST /applications/:id/messages` `{ byDiscordId, body }` (key = the popup's interaction id)
  → 201 `{ message }` (the `GET /messages/:id` message shape) with status `QUEUED`, and
  enqueues `application.message.send`. Refusals: 403 `forbidden`, 409 `not_pending`, 400
  `invalid` (above).
- `POST /applicant-messages` `{ discordId, dmChannelId, dmMessageId, body, createdAt,
  attachments }` (key = the DM message id; `attachments` is `[{ id, filename, size, spoiler }]`)
  → `{ stored: true, applicationId, messageId }` and enqueues `application.message.copy`, or
  `{ stored: false }`. A repeat of a stored `dmMessageId` (`dmMessageId` is unique) is a no-op
  success returning the same reply and enqueueing nothing.
- `PATCH /applicant-messages/:dmMessageId` `{ body }` (key = `<dmMessageId>:edit:<the edit's
  Discord timestamp>`) and `DELETE /applicant-messages/:dmMessageId` (key =
  `<dmMessageId>:delete`) → `{ changed: true, applicationId, messageId }`, updating or marking
  deleted and enqueueing `application.message.copy`, or `{ changed: false }` when the rules say
  no.
- `GET /applicant-messages/open` → `{ open: [{ applicationId, applicantDiscordId, since,
  afterDmMessageId }] }`, one per `PENDING` application. `since` is the latest of `createdAt`
  and `reopenedAt` (ISO); `afterDmMessageId` is the latest stored applicant DM id, or `null`.
  For the bot's catch-up.
- `GET /messages/:id` → `{ id, direction, status, body, createdAt, editedAt, deletedAt,
  attachments, dmChannelId, dmMessageId, copyChannelId, copyMessageId, author, applicant,
  application, pageUrl, ping }`. `author` is `{ discordId, name }` for `TO_APPLICANT` and `null`
  otherwise; `applicant` is `{ discordId, characterName }`; `application` is `{ id, status,
  threadId }`; `pageUrl` is the application's web page. `ping` is what the copy may mention:
  - `null` when the message is `TO_APPLICANT`, when a copy already exists (`copyMessageId` set,
    so edits and deletes never re-ping), or when `relayPingAt` is less than 10 minutes old;
  - otherwise the Discord id of the officer who most recently messaged this applicant through
    the relay, if they are still an OFFICER, else `"role"` (the Officer role). With no officer
    message yet it is `"role"`.
  404 `{ error }` if unknown.

### Jobs
Entity `application:<id>` (`entityKey` maps `application.message.*` there), so they run in
order with that application's other jobs. As in §12, **every handler re-reads
`GET /messages/:id` and renders from it, never from the payload alone**. Each job does one
Discord effect, so a failed copy never resends the DM.

- `application.message.send` `{ applicationId, messageId }`. Only when the message is
  `QUEUED` and the application is `PENDING`; a `QUEUED` message on an application that is no
  longer `PENDING` acks `{ notSent: true }` → `NOT_SENT`; a message that is not `QUEUED` at all
  (a stale delivery) acks `{ skipped: "<status>" }` and changes nothing. The DM is
  "**<officer name> (Bureaucracy officer):**", the text, then "-# Reply here and I'll pass your
  answer to the officers.", mentions suppressed. Ack `{ dmChannelId, dmMessageId }` → `SENT`,
  stored with those ids; `{ dmDelivered: false }` when Discord refuses (error 50007, or the
  person is not a member) → `NOT_DELIVERED`, never retried. Any other error fails the job so it
  retries (§1.7). The site applies each ack only to a message still `QUEUED`, and enqueues
  `application.message.copy` after any of the three.
- `application.message.copy` `{ applicationId, messageId }`. Posts the copy (rendering below),
  or edits it in place when `copyMessageId` is set. Ack `{ channelId, messageId, pinged }`: the
  site stores the copy ids, and `pinged: true` sets `relayPingAt` to now. `{ skipped:
  "<reason>" }` stores nothing. A `TO_APPLICANT` message still `QUEUED` is skipped.
- A rare duplicate DM or copy after a lost ack is accepted, as in §12: the retry finds the
  message still `QUEUED` (or the copy ids unset) and does the effect again.

### Rendering
- **Webhook.** One bot-owned webhook on `#applications` (e.g. "Bureaucrat relay"), found by
  name and owner, created if missing, recreated once if Discord says it is gone. Posts go into
  the application's thread under the person's name and Discord avatar: the officer's site name
  (`author.name`), or the applicant's character name. Missing Manage Webhooks fails the job
  loudly (it retries, then the FAILED alert, §1.7); `/rolecheck` reports it.
- **Applicant copy.** The text, then "-# 📨 Thrall's DM to the officers", with the `ping`
  mention on that line. A text over about 1,800 characters is cut and ends "… the rest is on
  the web", linking `pageUrl`. Deleted: the text stays and the line becomes "-# 📨 Thrall's DM
  to the officers · deleted by Thrall". Edits replace the text in place.
- **Officer copy.** `SENT`: the text, then "-# 📨 Sent to Thrall by DM", no pings.
  `NOT_DELIVERED`: a bot line "I couldn't DM Thrall, their DMs are closed or they've left the
  server. Your message wasn't sent." `NOT_SENT`: "Not sent: Thrall's application was decided
  before this went out.", posted only if the thread is still open (decided threads are never
  unarchived, as §12); otherwise the copy job acks `{ skipped }`.
- **Files.** Copied with the applicant's message: re-fetch the DM for fresh links, re-upload up
  to the server's upload limit and Discord's 10 files per message, spoilers kept. A file over
  the limit: "Thrall sent a file too big to copy here: logs.zip (40 MB). Ask them to send it
  another way." A file gone before copying is named as no longer available. Attachments are
  stored as metadata only (`attachments`), never the files.
- **Where.** The thread; an archived `PENDING` thread is unarchived first. If the thread is
  missing or the bot cannot post there (not found, forbidden), or the application is no longer
  `PENDING` when an applicant copy is made, post in `#officers` as the bot ("**Thrall** · DM to
  the officers" with the text, files and ping) with **Open on web** (link). Other errors retry
  (§1.7). The same fallback serves a `SENT` officer copy. An edit or delete changes the copy
  where it was first posted.
- **Mentions.** Allowed mentions are only the `ping` (a user id, or the Officer role for
  `"role"`); text typed by anyone never pings.
- **✅.** The bot reacts ✅ to the applicant's DM once its copy is first posted (thread or
  `#officers`); a failed reaction is ignored.
- **Webhook posts** (`webhook_id` set) never become notes (§8) and never count as a human for
  step 14's 24 h thread check.
- **Catch-up.** At startup and every 10 minutes, for each `GET /applicant-messages/open` entry,
  the bot reads that person's DM history after `afterDmMessageId` (else after `since`), oldest
  first, at most 50 per applicant per round, skipping its own messages, and sends each through
  `POST /applicant-messages` (a repeat is a no-op, so overlap is safe). The first failure stops
  that applicant until the next round. Edits and deletes made while the bot was offline are not
  recovered (accepted by Robert, Q22). Officer thread notes missed while offline are not caught
  up either.
- **`/message`.** Run in an applicant's `#applications` thread (the bot resolves the application
  as it does for notes), else "Run this in an applicant's thread." The popup is titled "Message
  Thrall" with one paragraph box labelled "Sent to Thrall as a DM from the bot", hint "Notes you
  type in the thread stay private. This goes to Thrall.", up to 1,500 characters. Names longer
  than Discord's 45-character title and label limits (and the hint's limit) are shortened to
  fit. Submit → `POST /applications/:id/messages` → "Sending to Thrall…" (private). Refusals
  show the site's `error`.

### Worked examples
Thrall's application was created Mon 3:30 PM. "Stored" means `POST /applicant-messages` answers
`{ stored: true }`.

| Case | Events | Result |
|---|---|---|
| DM before submitting | Thrall DMs the bot Mon 3:00 PM, before submitting | `{ stored: false }`; no reply, no ✅. Catch-up reads from `since` (3:30 PM), so it is never retried |
| Decided, reopened, then a DM | Decided Tue 9 AM. DM A Tue 10 AM. Reopened Tue 11 AM. DM B Tue 11:30 AM | A: not stored (not `PENDING`; a catch-up that read it would still refuse, since it is before `reopenedAt`). B: stored |
| DM from someone with no application | Discord id has none | `{ stored: false }`; the bot says nothing |
| Edit after the decision | Stored Mon; decided Tue; edited Wed | `{ changed: false }`; the copy keeps the old text |
| Delete, then edit | Stored; deleted; then edited while `PENDING` | Delete: text kept, `deletedAt` set, copy line "· deleted by Thrall". Edit: `{ changed: false }` |
| Three DMs in 10 minutes, then one | DMs at 12:00, 12:04, 12:09 and 12:11 | 12:00 pings; its copy ack sets `relayPingAt`. 12:04 and 12:09 have `ping: null`. 12:11 is over 10 minutes after the last ping, so it pings again |
| Last messaging officer is no longer an officer | An officer messaged Thrall, then lost the role; Thrall replies | `ping: "role"`; the Officer role is mentioned |
| 3,000-character DM | Nitro DM, no attachments | Stored whole (limit 4,000); the copy is cut near 1,800 characters and ends "… the rest is on the web" with the `pageUrl` link |
| 40 MB file | DM with `logs.zip` (40 MB) and a small screenshot | Screenshot copied; "Thrall sent a file too big to copy here: logs.zip (40 MB). Ask them to send it another way."; ✅ still added |
| Deleted thread | The copy job finds no thread (not found) | Posted in `#officers` as "**Thrall** · DM to the officers" with **Open on web**; ✅ added |
| Officer message queued when decided | Officer submits; the application is decided before the send job runs | Send job acks `{ notSent: true }` → `NOT_SENT`; "Not sent: …" posted only if the thread is still open, else skipped |
| Officer message to a decided application | Popup submitted after the decision | 409 `not_pending` with the "This application has been decided…" error; nothing queued |
| Lost ack, send job | DM sent, ack lost | The retry finds the message `QUEUED` and sends the DM again: one rare duplicate DM, accepted |
| Lost ack, copy job | Copy posted, ack lost | The retry posts a second copy and `relayPingAt` was not set: one rare duplicate, accepted |
| Lost reply, `POST /applicant-messages` | Site stored it, reply lost | The bot retries under the same key and gets the same reply; nothing is stored or enqueued twice. Same for PATCH and DELETE |
| Applicant DM with only a file | No text, one attachment | Valid; stored with `body: ""` and the file copied |
| Not an officer | Someone without the role runs `/message` | 403 `forbidden`; nothing queued |
