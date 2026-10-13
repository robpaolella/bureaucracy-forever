# ADDON-SPEC — site, loot add-on and helper

The contract between this site, the officers' in-game loot add-on
(`bureaucracy-forever-addon`) and its desktop helper (`bureaucracy-forever-helper`).
It lives here only. `SYNC-SPEC.md` is the site–bot contract and is not part of it.
Change this file in the same PR as any code that changes a format, and bump
`formatVersion` when an old reader would misread the new one.

**Format version: 1.** Part A (this file so far) covers identity, the reserve snapshot,
operations and the helper API. Part B (#281) fills in sections 9–12.

Words: **site** is this app; **add-on** runs inside the game; **helper** runs on an
officer's computer and moves data between the two; **officer** is a member whose Discord
roles give officer access (`lib/auth/roles.ts`). Times are UTC, written as Unix seconds
in the add-on's data and ISO 8601 (`...Z`) in the helper API. The site shows guild time.

## 1. How the pieces talk

The game lets an add-on do very little (proved in the beta): it can read text an officer
pastes into a box, show text to copy out, send hidden add-on messages to other add-ons,
send a chat line only from an officer's click, and save its data to a file
(`SavedVariables`) when the game saves. An outside program can write a Lua file in the
add-on's folder, which the game re-reads on `/reload`. So:

```
site ──snapshot──▶ officer pastes it into the add-on        (or)
site ──▶ helper ──inbox file──▶ add-on  (after /reload)

add-on ──SavedVariables file──▶ helper ──operations (HTTPS)──▶ site
add-on ──copy-out text──▶ officer pastes it on the site     (part B)
```

Everything crossing a boundary is **data**. Section 8 says how it is read.

## 2. Raid and site identity

Every award, operation, saved record and chat line carries the **raid id** (chat lines
carry the short **raid code** instead) and the **environment**: `production` or
`staging`. The site knows its own environment (`isStagingDeployment` in
`lib/deploy-env.ts`).

- A site rejects a record whose environment is not its own (`wrong-environment`) and a
  record for a raid it doesn't hold (`unknown-raid`). Staging and production data can't mix.
- The raid code is `P` or `S` (production or staging) followed by the last five characters
  of the raid id, upper-case: raid `cm9xr2k4a0001` on staging is `SA0001`. It only picks
  the raid out of what an add-on has loaded; the full id is always in the data.
- **The add-on's active raid** is the raid of the snapshot it has loaded. It changes only
  when an officer loads another snapshot, and the add-on asks first if the current raid
  has awards.
- **No snapshot:** awards made with none loaded are held as **no raid**. They are not
  uploaded until an officer attaches them to a raid; attaching rewrites their `raid` and
  `env` and keeps their keys.
- **The helper's raid list** (section 7) offers the raids an officer is likely to run
  and defaults to the soonest.

### Practice records

A record may carry `practice = true`. Practice is marked on the record, never on the
raid (there is no practice flag on Raid).

- **Production** refuses them (`practice-refused`).
- **Staging** accepts them for **every** raid, so a test raid (for example a Deadmines
  tier with its own loot table) is an ordinary staging raid.
- A record without the field is not practice. A staging site stores both kinds and keeps
  the mark with the record.

## 3. The reserve snapshot (site → add-on)

What the add-on needs to run one raid's loot without the site. It is one data tree
(section 3.1). It reaches the add-on as pasted text (3.2) or as the helper's inbox file
(section 7.3).

### 3.1 Contents

| Field | Meaning |
| --- | --- |
| `formatVersion` | `1` |
| `raid` | The raid id |
| `code` | The raid code (section 2) |
| `env` | `production` or `staging` |
| `name`, `startsAt` | Raid name; start in Unix seconds |
| `generated` | When the site built this snapshot, Unix seconds |
| `addon` | `{ version, url }`: the latest add-on version and where to download it |
| `bosses` | In table order: `{ id, name, trash, items }`. `id` is the `LootBoss` id; `trash` is true for the Trash row; `items` are game item ids (the `LootTableEntry` rows, in position order). An item on several bosses appears under each. |
| `reserves` | Per item id, every holder: `{ user, char, kind, trial, blocked }` |
| `awards` | The baseline: this raid's awards so far, voided ones included |

**Holders.** `user` is the site user id, `char` the character name ("First Last", the
same in game and on the site), `kind` is `HR` or `SR`, `trial` is true for a member on
trial (shown, never rolls, as `resolveDrop` treats it). `blocked` is optional and is a
**reason, not a removal**: history that keeps a holder from rolling (a win limit from
earlier raids) leaves the holder in the list with a reason code. Version 1 defines one:
`win-limit`. A reader that meets an unknown code treats the holder as blocked and shows
the code.

**Baseline awards.** `{ key, boss, item, char, user, method, roll, voided }`, the same
names as operations (section 4). `key` is the award's key. `voided` is true for a void
that already happened. Awards the site holds from before the add-on existed have a key
made by the site.

**Spending is the add-on's job.** The snapshot holds reserves as they stood at
`generated`. The add-on subtracts every non-voided award, baseline and its own, the way
`resolveDrop` does: a holder who has received an item on this raid no longer counts for
it, so the next copy goes to the remaining HR holders, then SR, then an open roll. An
Undo (a void) gives the reserve back, with nothing to reload.

### 3.2 Pasted text

The paste test proved about 7,400 characters in one box, so the text is cut into parts
of at most **7,000** characters (a margin). Each part is one line:

```
BFSNAP1:<part>/<parts>:<piece>
```

`<piece>` is the next slice of the snapshot's table text (section 8.2 gives its
grammar). Joined in order, the pieces are the whole table. The add-on accepts parts in
any order, reports which are missing, and loads nothing until all arrive. A snapshot
that fits is one part (`BFSNAP1:1/1:...`).

### 3.3 Worked example

A staging raid with two bosses and Trash (sample data; ids are invented). Shown with
line breaks for reading; the real text has none that matter.

```lua
{
  formatVersion = 1, raid = "cm9xr2k4a0001", code = "SA0001", env = "staging",
  name = "Molten Core — sample", startsAt = 1792000000, generated = 1791990000,
  addon = { version = "0.1.0",
    url = "https://github.com/robpaolella/bureaucracy-forever-addon/releases/latest" },
  bosses = {
    { id = "lb_lucifron", name = "Lucifron", trash = false, items = { 16800, 16805 } },
    { id = "lb_magmadar", name = "Magmadar", trash = false, items = { 16796, 16805 } },
    { id = "lb_trash", name = "Trash", trash = true, items = { 17011, 18861 } },
  },
  reserves = {
    [16805] = {
      { user = "u_ana", char = "Ana Vale", kind = "HR", trial = false },
      { user = "u_bo", char = "Bo Marsh", kind = "SR", trial = false },
      { user = "u_cy", char = "Cy Orchard", kind = "SR", trial = true },
    },
    [16796] = {
      { user = "u_bo", char = "Bo Marsh", kind = "HR", trial = false, blocked = "win-limit" },
    },
  },
  awards = {
    { key = "site-0001abcd", boss = "lb_trash", item = 18861, char = "Dee Holt",
      user = "u_dee", method = "OPEN_ROLL", roll = 64, voided = false },
  },
}
```

Reading it: for item 16805 the HR holder Ana rolls alone; if she wins it, the second copy
goes to Bo (SR) — Cy is on trial and never rolls. Bo's HR on 16796 stays listed but is
blocked by a win limit, so a 16796 drop is an open roll. Item 18861 (Trash) was already
given out before the snapshot was loaded.

## 4. Operations (add-on → site)

Five operations. Every operation has an **`id`**: a string of letters, digits, `_` or `-`,
8 to 128 long (the same rule as `parseRequestKey` in `lib/loot-rules.ts`), made by the
add-on, unique. Every operation also carries `formatVersion`, `raid`, `env` and, when it
applies, `practice`.

| Operation | Meaning | Fields beyond the common ones |
| --- | --- | --- |
| `award` | A hand-out was announced | `boss`, `item`, `char`, `user` (optional), `method`, `roll` (optional, 1–100), `note` (optional, ≤ 200 characters), `sender`, `at` |
| `confirm` | The game confirmed the hand-out | `key`, `at` |
| `not-confirmed` | The game did not confirm it | `key`, `at` |
| `void` | The award was undone | `key`, `reason` (optional, ≤ 200), `at` |
| `replace` | The award went to someone else | `key`, `award` (a full `award` operation with a new id), `at` |

- **An award's `id` is its key.** The key is how every later operation names the award,
  and it is stored as the award's `requestKey`, so a retry can't record it twice.
- `method` is a `LootMethod`: `HR`, `SR`, `MAIN_SPEC`, `OFF_SPEC`, `OPEN_ROLL`,
  `DISENCHANT_BANK` (which has no `char`). `boss` is the snapshot's boss `id`; `item` is a
  game item id that must be in the raid's loot table, otherwise `item-not-in-table`: an
  officer adds unlisted drops on the site's loot log, as today. `char` is looked up by
  name; `user` is optional and checked against it if given.
- `sender` is the officer character the add-on says made the hand-out. See section 7.2.
- A **replacement is a new award with a new key**, carried inside `replace`. The site
  treats `replace` as "void `key` and record `award`" in one step. A `replace` has its own
  `id`; the inner award's `id` is the new key.

### 4.1 Life cycle

```
announced ──▶ confirmed ──▶ voided
    │                 └───▶ replaced   (voided, with a new award in its place)
    ├──▶ not confirmed ──▶ voided / replaced
    └──▶ voided / replaced
```

- **Announced:** the add-on saw the officer click the raid chat line (part B). An `award`
  operation exists.
- **Confirmed** or **not confirmed:** the game confirmed the hand-out (`LOOT_SLOT_CLEARED`
  and "X receives loot: [item]") or did not. If both arrive, the one with the later `at`
  wins; on a tie, confirmed wins.
- **Voided** or **replaced:** an officer undid it. A void or replace is allowed from any
  state, and a voided award stays on the record. The site never deletes (`LootAward`
  voids rather than removes).

### 4.2 Arrival order

Records arrive late, twice and out of order (the helper retries, two officers upload the
same raid). The site applies these rules per key:

| What arrives | Already held | Outcome |
| --- | --- | --- |
| `award` | nothing | Recorded (`201`). |
| `void` | its `award` | Award marked void (`200`). |
| `void` | nothing | **Kept** as a pending void (`202`), applied the moment the award arrives. |
| `award` | a pending void for its key | Recorded already void (`201`). A void always wins over a later upload of the same award. |
| `award` | the same award (same id, same payload) | Nothing changes; `200`, `replayed: true`. |
| `award` | the same id with a **different payload** | Rejected (`409 key-conflict`) and reported (section 7.4); nothing changes. |
| `void` | the same void again | `200`, `replayed: true`. |
| `void` | its award, already voided by another void | `200`; the first void's reason and time stand. |
| `confirm` / `not-confirmed` | its award (any state) | State updated by the rule above; a voided award stays void. |
| `confirm` / `not-confirmed` | nothing | Kept pending, applied when the award arrives. |
| `replace` | its original | Original voided, new award recorded, in one transaction. |
| `replace` | nothing | Kept pending like a void; the new award is recorded when the original arrives. |

"The same payload" compares the operation's fields except `at`-style times that the
site only stores. Pending records are kept per raid; a pending record that never finds
its award shows in the raid's problems list (section 7.4) rather than disappearing.

### 4.3 Worked examples

All are JSON as sent to the helper API. The add-on stores the same fields as Lua.

**A full award, then its confirmation** (staging, from the snapshot above):

```json
{ "type": "award", "id": "aw-7f3k2m9q", "formatVersion": 1, "raid": "cm9xr2k4a0001",
  "env": "staging", "boss": "lb_lucifron", "item": 16805, "char": "Ana Vale",
  "user": "u_ana", "method": "HR", "roll": 91, "sender": "Rae Quill", "at": 1792001200 }
{ "type": "confirm", "id": "cf-1x8p4d2s", "formatVersion": 1, "raid": "cm9xr2k4a0001",
  "env": "staging", "key": "aw-7f3k2m9q", "at": 1792001204 }
```

Ana's HR on 16805 is now spent; Bo (SR) is next if a second copy drops.

**An Undo** (the officer clicked the wrong row): a `void` naming the award's key.

```json
{ "type": "void", "id": "vd-5b2n8c1w", "formatVersion": 1, "raid": "cm9xr2k4a0001",
  "env": "staging", "key": "aw-7f3k2m9q", "reason": "wrong winner", "at": 1792001260 }
```

Ana's reserve is back for the next copy.

**A replacement** (the item went to Bo after all):

```json
{ "type": "replace", "id": "rp-9c4v6t0e", "formatVersion": 1, "raid": "cm9xr2k4a0001",
  "env": "staging", "key": "aw-7f3k2m9q", "at": 1792001300,
  "award": { "type": "award", "id": "aw-2h6j9z4b", "formatVersion": 1,
    "raid": "cm9xr2k4a0001", "env": "staging", "boss": "lb_lucifron", "item": 16805,
    "char": "Bo Marsh", "user": "u_bo", "method": "SR", "roll": 77,
    "sender": "Rae Quill", "at": 1792001300 } }
```

`aw-7f3k2m9q` is void; `aw-2h6j9z4b` is the new award.

**A practice record** (identical to an award apart from the mark; staging only):

```json
{ "type": "award", "id": "aw-4t1y7g5k", "formatVersion": 1, "raid": "cm9xr2k4a0001",
  "env": "staging", "practice": true, "boss": "lb_trash", "item": 17011,
  "char": "Dee Holt", "method": "OPEN_ROLL", "roll": 12, "sender": "Rae Quill",
  "at": 1792001400 }
```

A production site answers `409 practice-refused` and records nothing.

## 5. What the site does with an operation

For each operation the site, in order: checks the key and that the sender is a current
officer (section 7); checks `formatVersion`, `env`, `raid` and `practice` (section 2);
checks the raid isn't cancelled (`raid-cancelled`, as the loot log does); applies the
arrival rules (4.2); and answers per operation, so one bad record never blocks the rest
of a batch. An award becomes a `LootAward` the way `POST /api/raids/[id]/loot` makes
one: the officer on the key is `recordedById`, names are copied, and the winner is not
re-checked against sign-ups or reserves — the officer in the game had the last word.

## 6. Versions

`formatVersion` is an integer. A reader that sees a higher number than it knows must
refuse the data and say the add-on or helper needs updating (the snapshot carries the
latest add-on version and link for this). The site accepts the versions it lists in
`GET /api/helper/me` (section 7.1) and answers `unsupported-version` otherwise.

## 7. The helper API

Routes under `/api/helper/`. JSON in and out, `Cache-Control: no-store`, errors as
`{ "error": "<plain sentence>", "code": "<machine code>" }` like the loot log.

### 7.1 Endpoints

| Route | Purpose |
| --- | --- |
| `GET /api/helper/me` | Checks the key. Answers `{ officer, env, formatVersions, addon: { version, url } }`. |
| `GET /api/helper/raids` | The raids list (7.5). |
| `GET /api/helper/raids/{raid}/snapshot` | The snapshot as a data tree in JSON (`{ "formatVersion": 1, ... }` with the fields of 3.1; `reserves` keyed by item id as strings). The helper writes the inbox file from it (7.3) and can also show the pasted-text form. |
| `POST /api/helper/operations` | Body `{ "operations": [ ... ] }`, each as in section 4. Answers `{ "results": [ { "id", "status", "code?" } ] }` in the same order. |
| `GET /api/helper/raids/{raid}/problems` | Records the site rejected or is holding for this raid (7.4). |

`status` per operation is one of `recorded`, `replayed`, `pending`, `voided`,
`rejected`; HTTP is `200` when the request itself was valid, even if some operations
were rejected. Section 4.2 gives the per-record outcomes.

### 7.2 Authentication and trust

- **Per-officer helper keys.** An officer creates a key on the site (a page for officers,
  built in a later task). It is shown once, is `bfh_` plus 32 random bytes in base64url,
  and the site stores only its SHA-256 hash with the officer's user id, a label, the
  creation time and the last use. An officer can have several and revoke any.
- Sent as `Authorization: Bearer bfh_...`. Unlike the bot's bearer secret (shared by one
  process), a key names a person. It is not reused from, or by, `app/api/bot`.
- **A current-officer check on every request.** The key maps to a user, and the site
  checks, now, that the user still has officer access (the same check `requireOfficer`
  makes). A key whose owner lost the role stops working at once; no key is trusted for
  what it was when created. Failure is `401` for an unknown or revoked key, `403` for a
  former officer.
- **Trust boundary.** Officer helpers are **trusted reporters**, not proven sources. The
  site can check that `sender` is a character belonging to a current officer (`unknown-sender`
  if not), but nothing proves the game said so: an officer could send false records. The
  recorded officer is the key's owner, always; `sender` is stored as a claim. The audit
  trail is the point, since awards are never deleted and any can be voided.
- A key works in one environment: the one that issued it.

### 7.3 The inbox file

The helper writes a Lua file into the add-on's folder, which the add-on loads on
`/reload`. Because the game runs it as code, **the helper writes data only**:

```lua
BureaucracyLootInbox = {
  ...one snapshot table (section 3.3)...
}
```

Rules for the serializer (the only code that writes this file):

1. Output is the one assignment above and a single table literal. Nothing else, no
   comments, no functions, no calls, no variables, no concatenation.
2. Values are only tables, strings, integers (decimal, within ±9,007,199,254,740,991),
   `true` and `false`. Floats and `nil` are never written.
3. Keys are either a fixed identifier from this spec or an integer in `[ ]`. A key is
   never built from site text.
4. Every string is written in double quotes with `\\` and `\"` escaped, and **every byte
   outside 0x20–0x7E escaped as three-digit decimal `\ddd`** (UTF-8 bytes one by one;
   a newline is `\010`). Three digits mean a following digit can't be misread, and no
   input can close the string or start a comment (`]]`, `--`, `\z` are all inert inside
   it).
5. Depth is at most 6, strings at most 200 bytes, and the file at most 200,000 bytes; a
   snapshot over a limit is refused with an error to the officer, not truncated.
6. The helper re-reads what it wrote with the parser of section 8 before replacing the
   old file, and writes to a temporary name then renames, so a half-written file is
   never loaded.

The add-on also validates what it loaded (types, version, the raid it names) and treats
any failure as "no snapshot".

### 7.4 Problems

`GET .../problems` lists, for the raid: operations rejected with their code (most often
`key-conflict`), pending voids/confirmations/replacements with no award yet, and awards
held for a different environment. The helper shows them; the site's officer log shows
the same. Reporting is the whole response: nothing is auto-resolved.

### 7.5 The raids list

`GET /api/helper/raids` returns every raid that

- starts within the next **12 hours** or is **under way** (`startsAt` ≤ now + 12 h and
  now < `startsAt` + `durationMin`), and
- is not cancelled (`cancelledAt` is null),

**soonest first** (`startsAt` ascending, so an under-way raid is first). The site has no
per-officer raids, so it is every such raid for any officer. Each entry is
`{ id, code, name, startsAt, durationMin, hasLootTable }`; the helper defaults to the
first and lets the officer pick another. A raid without a loot table is listed, flagged
`hasLootTable: false`; its snapshot has no bosses.

### 7.6 Limits (proposed — for Robert to confirm)

These numbers are the spec author's proposals, each with its reason.

| Limit | Value | Reason |
| --- | --- | --- |
| Operations per request | 100 | A long raid is a few dozen awards; a batch of 100 covers a catch-up upload without a huge body. |
| Request body | 64 KiB | 100 operations at about 400 bytes is 40 KB; leaves room for notes. |
| `note` / `reason` | 200 characters each | Longer than any real reason; keeps a record small. |
| Snapshot paste part | 7,000 characters | The add-on's paste test proved about 7,400. |
| Requests per key | 30 per minute | The helper polls and uploads every 30–60 s; this is an order of magnitude above that. Counted with `rateLimited` in `lib/rate-limit.ts`. |
| Failed authentications | 10 per minute per address | Slows key guessing. Address from `clientAddress`. |

Over a limit the site answers `413` (size) or `429` with `Retry-After` (rate), and the
helper backs off. `rateLimited` is per server instance and best effort: the real guard
against double recording is that every operation is idempotent (4.2).

## 8. Parsing

**Every format is parsed as data and never executed.** No reader may hand text to
`loadstring`, `load`, `dofile`, `eval`, `Function` or an HTML sink.

1. **The add-on reading pasted text** uses a hand-written parser for the grammar in 8.2.
   It never calls `loadstring`. Unknown fields are ignored, wrong types reject the whole
   text, and every limit in 7.3 (depth, string length, size) applies.
2. **Grammar (the whole language).** `value = table | string | integer | boolean`;
   `table = "{" [ entry { "," entry } [ "," ] ] "}"`; `entry = [ key "=" ] value`;
   `key = identifier | "[" integer "]"`; string and integer as in 7.3 rules 2 and 4.
   Whitespace between tokens is ignored; anything else is a parse error.
3. **The helper reading `SavedVariables`** (the add-on's saved data) uses the same
   parser, in the helper's language, over the file's single assignment. It does not run
   the file in a Lua interpreter.
4. **The site reading uploads** parses JSON, then validates every field's type, range and
   length (section 4) before use. Text from the add-on is never put into a database
   query, a path or markup unescaped.

## 9. Raid chat line

*Part B (#281).* Fills in: the announcement, correction and roll-call lines, the
`[Practice]` prefix, how the raid code and award key ride inside the 255-character limit
with the item link. The readable wording is decided in the add-on's design (#9).

## 10. Officer sync messages

*Part B (#281).* Fills in: hidden add-on messages between officers' add-ons, and how
they converge on one set of awards.

## 11. Boss attribution

*Part B (#281).* Fills in: how a drop is tied to a boss (including Trash).

## 12. Copy-out text

*Part B (#281).* Fills in: the text an officer copies from the add-on and pastes on the
site when the helper isn't used.
