# ADDON-SPEC — site, loot add-on and helper

The contract between this site, the officers' in-game loot add-on
(`bureaucracy-forever-addon`) and its desktop helper (`bureaucracy-forever-helper`).
It lives here only. `SYNC-SPEC.md` is the site–bot contract and is not part of it.
Change this file in the same PR as any code that changes a format, and bump
`formatVersion` when an old reader would misread the new one.

**Format version: 1.** Sections 1–8 (part A) cover identity, the reserve snapshot,
operations and the helper API. Sections 9–12 (part B) cover the raid chat line, officer
sync messages, boss attribution and copy-out text.

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
- **No snapshot:** awards made with none loaded are held as **no raid**. This is the one
  exception to "every record carries a raid id and environment": they sit in a separate
  `noRaid` list in the add-on's saved data, without `raid` or `env`, and are never
  uploaded or sent as chat. An officer attaches them to a raid, which adds that raid's
  `raid` and `env` (and moves them to the awards list) and keeps their keys.
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
  name = "Molten Core - sample", startsAt = 1792000000, generated = 1791990000,
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
same raid). The site applies these rules per key. Outcomes are the per-operation `status` words of
section 7.1, never separate HTTP codes:

| What arrives | Already held | Outcome |
| --- | --- | --- |
| `award` | nothing | Recorded (`recorded`). |
| `void` | its `award` | Award marked void (`voided`). |
| `void` | nothing | **Kept** as a pending void (`pending`), applied the moment the award arrives. |
| `award` | a pending void for its key | Recorded already void (`voided`). A void always wins over a later upload of the same award. |
| `award` | the same award (same id, same payload) | Nothing changes (`replayed`). |
| `award` | the same id with a **different payload** | Rejected (`rejected`, code `key-conflict`) and reported (section 7.4); nothing changes. |
| `void` | the same void again | `replayed`. |
| `void` | its award, already voided by another void | `voided`; the first void's reason and time stand. |
| `confirm` / `not-confirmed` | its award (any state) | State updated by the rule above; a voided award stays void. |
| `confirm` / `not-confirmed` | nothing | Kept pending, applied when the award arrives. |
| `replace` | its original | Original voided, new award recorded, in one transaction (`recorded`). |
| `replace` | nothing | Kept pending like a void (`pending`); the new award is recorded when the original arrives. |

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

A production site answers that operation `rejected` with code `practice-refused` and
records nothing.

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
`rejected` (with a `code`). HTTP is always `200` when the request itself was valid, even
if some operations were rejected or pending; the status words carry the outcome. Section 4.2 gives the per-record outcomes.

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

The add-on can post to raid chat only from an officer's click (proved in the beta), and
a line is limited to 255 characters. One line carries a **human part** for the raid and
a **machine part** for a helper. The raid sees the human part; the machine part is how
any officer's helper, with no earlier state, records the award from `WoWChatLog.txt`.

### 9.1 Shape

```
[Practice] <human part> <machine part>
```

- `[Practice] ` (with its trailing space) opens the line only for a practice record
  (section 2). A practice line's machine part starts `BF1P` instead of `BF1`; the two
  must agree, or the line is malformed.
- The **human part** is free text for people. No machine reads it, except that the item
  link in it must match the machine part (9.4). The wording below is proposed; the
  add-on's design (#9) decides the final words, and a wording change is not a format
  change.
- The **machine part** is the last thing on the line: `<` `BF1` fields separated by `;`
  `>`. Fields are escaped by 9.3. `BF1` is the line format's version.
- Chat sends the line as given. The game counts bytes, so the add-on counts **UTF-8
  bytes** (see 9.1a). A line carries no
  `|` outside item-link escapes, and no `<` or `>` outside the machine part.

### 9.1a Fitting 255

- **Ids the add-on makes are 11 characters**: a two-letter type (`aw`, `vd`, `rp`), `-`,
  and eight lower-case letters or digits. This is a narrower rule than section 4's
  8–128, which the site still accepts. A key longer than **24** characters (one the
  site made, or an older add-on's) cannot ride in a chat line: the add-on tells the
  officer to void it on the site or by the helper's upload instead.
- The **machine part is never shortened**. Its worst case is a replacement (ids of 11,
  24 and 11 characters, a 7-digit item, a 5-character boss code, a 15-character method,
  a roll and a winner of 12 + 1 + 12 two-byte letters): 149 bytes.
- The **human part gives way**. If the line is over 255 bytes the add-on drops parts in
  this order until it fits: ` not {oldwinner}`, then `({method}, roll {roll})`, then the
  winner's name, then the label (`Correction:`, `Undo:`), leaving the link and the
  machine part.
- The shortest line is the link and the machine part. With the worst machine part and an
  item name of 40 characters (a link of about 90 bytes) a replacement is 252 bytes, so
  **every valid award, Undo and replacement fits**; the `[Practice] ` prefix adds 11 bytes
  and the same drops apply. If a line still cannot fit (an item name over 40 characters
  on an extreme practice replacement), the add-on does not post it and says so; the
  award is still saved and uploads through the helper.

### 9.2 The three lines

Every line is complete on its own. Fields are in this order; an empty field means
"none".

| Line | Machine part | Human part (proposed) |
| --- | --- | --- |
| Award | `<BF1;A;raid;key;item;boss;method;roll;winner>` | `{link} goes to {winner} ({method}, roll {roll})` |
| Undo | `<BF1;V;raid;id;key>` | `Undo: {link} no longer goes to {winner}` |
| Replacement | `<BF1;R;raid;id;key;newkey;item;boss;method;roll;winner>` | `Correction: {link} goes to {winner} ({method}, roll {roll}), not {oldwinner}` |

- `raid` is the raid code (section 2). It also gives the environment (`P`/`S`).
- `key` is the award's key (section 4). In an award line it is the new award's key; in
  an Undo it is the award being voided; in a replacement it is the award being voided,
  and `newkey` is the new award's key. `id` is the Undo's or replacement's own
  operation id.
- `item` is the game item id, decimal. `boss` is the **boss code**: the last five
  characters of the `LootBoss` id (the same rule as the raid code, but lower-case as
  stored). If two of a raid's bosses share a code the add-on refuses the snapshot and
  says so.
- `method` is a `LootMethod` (section 4). `roll` is 1–100 or empty. `winner` is the
  character's "First Last", empty for `DISENCHANT_BANK`.
- An award line carries the whole of an `award` operation except what the line's
  context supplies: `note` and `user` are never in a line, `sender` is the line's chat
  sender and `at` is its log time (9.5).
- A **replacement line carries the new award in full** (item, boss, method, roll,
  winner), so a helper that never saw the original can record it, plus the key it
  voids. An Undo line names only the key; a helper with no award for it holds the void
  as pending (4.2).
- `confirm` and `not-confirmed` are never chat lines: the game events behind them are
  not in raid chat, so they travel by sync messages (10) and the helper's upload.

### 9.3 Escaping

In every machine field, each of these is written as `%` and two upper-case hex digits
of its UTF-8 byte: `%`, `;`, `<`, `>`, `|`, and bytes below 0x20 or 0x7F. Nothing else is
escaped; accented letters stay as they are. Section 10's operation text uses the same
rule. A reader decodes `%XX` only with two hex digits; any other `%` is malformed, and
so is decoded text that is not valid UTF-8.

### 9.4 Rejecting a malformed line

A reader ignores a line whose machine part does not match this section and records
nothing from it. It is malformed if any of these holds:

- no machine part, more than one, or text after it;
- a version token other than `BF1`/`BF1P` (a higher `BF` number is ignored with a
  notice that the helper needs updating; section 6);
- the type is not `A`, `V` or `R`, or the field count is wrong for it;
- `raid` is not `P` or `S` followed by five characters of `[A-Z0-9]`, or no raid the
  reader knows ends in that code;
- a `key`, `newkey` or `id` outside the rule of section 4 (letters, digits, `_`, `-`),
  or longer than 24 characters, or `newkey` equal to `key`;
- `item` not a positive integer of at most 7 digits, `roll` not 1–100 or empty,
  `method` not a `LootMethod`, `winner` empty where a character is required (or set for
  `DISENCHANT_BANK`);
- the human part has no item link, or its `|Hitem:` number differs from `item`;
- the `[Practice] ` prefix and the `BF1P` token disagree;
- the boss code matches none, or more than one, of the raid's bosses.

A malformed line is shown to the officer by the helper as a problem; it never stops
other lines. A line that is well formed but wrong in substance (an unknown item, a
non-officer sender) is handled by the site's rules (sections 4 and 5), not here.

### 9.5 What a helper does with a line

`WoWChatLog.txt` lines look like
`10/13 10:01:51.269  |Hchannel:RAID|h[Raid Leader]|h Zoé Brûlé: ...`. The helper accepts the
`RAID` and `RAID_LEADER` channels, takes the text after `: ` as the line, and the name
before it as `sender`. `at` is the log time read in the computer's own time zone, with
the year the date was most recently in (never in the future). The helper turns the
machine part into the section 4 operation, using the raid code to pick the raid and the
snapshot's bosses to turn the boss code into a boss `id`, then sends it like any other
operation. The same award reaching the site by chat line and by the add-on's upload has
the same key, so the second is `replayed` (4.2).

### 9.6 Who may post a line

A chat line counts only if its sender's "First Last" equals the name of a `Character`
whose `User` is an officer. The helper cannot check this (it has no roster), so it
passes the sender on as `sender` and the **site** decides (section 7.2:
`unknown-sender`). Chat names are not authenticated by the helper; the site's audit trail
and voids are the safeguard, as for any operation.

### 9.7 Worked examples

Staging raid `SA0001`, boss `lb_lucifron` (code `ifron`), the winner has an accented
name. The item link has the shape seen in the beta; only the number after `|Hitem:`
matters, and the name in brackets is for people. Counts are UTF-8 bytes.

An award (155 bytes, 149 characters):

```
|cffa335ee|Hitem:16805::::::::60:::::::|h[Felheart Gloves]|h|r goes to Zoé Brûlé (HR, roll 91) <BF1;A;SA0001;aw-9d2f6h1j;16805;ifron;HR;91;Zoé Brûlé>
```

The same award as a practice line (167 bytes, 161 characters):

```
[Practice] |cffa335ee|Hitem:16805::::::::60:::::::|h[Felheart Gloves]|h|r goes to Zoé Brûlé (HR, roll 91) <BF1P;A;SA0001;aw-9d2f6h1j;16805;ifron;HR;91;Zoé Brûlé>
```

An Undo (138 bytes, 135 characters):

```
Undo: |cffa335ee|Hitem:16805::::::::60:::::::|h[Felheart Gloves]|h|r no longer goes to Zoé Brûlé <BF1;V;SA0001;vd-2s9t4w7y;aw-9d2f6h1j>
```

A replacement, with the new award in full (201 bytes, 198 characters):

```
Correction: |cffa335ee|Hitem:16805::::::::60:::::::|h[Felheart Gloves]|h|r goes to Bo Marsh (SR, roll 77), not Zoé Brûlé <BF1;R;SA0001;rp-3n7b5x0c;aw-9d2f6h1j;aw-6k1m4v8z;16805;ifron;SR;77;Bo Marsh>
```

## 10. Officer sync messages

Officers' add-ons share what they record through hidden add-on messages, so all of them
hold one set of awards (and a second officer can take over). Hidden messages are
limited to 255 bytes; this section counts the prefix `BFLOOT1` and its separator
within that limit. They use the raid group's add-on channel, except where a whisper is
named. A message with a higher prefix number is ignored with a notice that the add-on
needs updating.

The add-on cannot check that a sender is an officer (the snapshot carries no roster).
It accepts messages only from members of the raid group; the site's sender check
(section 7.2) is the authority when the records are uploaded.

### 10.1 Operation text

An operation travels as one line of `;`-separated fields, escaped by 9.3. The first
field is the type. The same text is used for sync and for copy-out (12). An empty
field means "none"; `practice` is `1` or empty.

| Type | Operation | Fields after the type |
| --- | --- | --- |
| `A` | award | `id`, `boss` (the full boss id), `item`, `char`, `user`, `method`, `roll`, `note`, `sender`, `at`, `practice` |
| `K` | confirm | `id`, `key`, `at`, `practice` |
| `N` | not-confirmed | `id`, `key`, `at`, `practice` |
| `V` | void | `id`, `key`, `reason`, `at`, `practice` |
| `R` | replace | `id`, `key`, `at`, `practice`, then the new award's `id`, `boss`, `item`, `char`, `user`, `method`, `roll`, `note`, `sender`, `at` (it takes the replace's `practice`) |

Raid and environment are not in the text: they come from the envelope (10.2) or the
copy-out header (12).

### 10.2 Messages

Body (after the prefix and a tab), fields separated by `;`:

| Message | Body | Meaning |
| --- | --- | --- |
| `O` | `O;msgid;n/N;raid;author;piece` | Chunk `n` of `N` of one operation. |
| `Q` | `Q;msgid;1,3` | Please resend these chunks of `msgid` (whisper to the sender). |
| `H` | `H;raid;version;count;digest` | "Here is what I hold." Sent when an add-on loads the raid's snapshot, joins the group, or reloads. |
| `C` | `C;reqid;raid;n/N;piece` | Catch-up request: the ids the sender holds (comma-separated), chunked like `O`. |
| `D` | `D;reqid;count` | End of a reply to `C`: `count` operations were sent. |

- `msgid` and `reqid` are six lower-case letters or digits, chosen by the sender.
- `raid` is the raid code. A message for a raid the receiver has not loaded is ignored.
- `author` is the officer who made the operation: "First Last", the operation's
  `sender`. A direct message has the same name as the game's own sender of the message.
  A **forwarded** one (a reply to `C`) has the original author, and the game shows the
  forwarder as the sender. The add-on records the author as `sender`; it keeps the
  forwarder only in its own saved data, as `via`, and never uploads it.
- `digest` is eight lower-case hex digits: the sum, modulo 2³², of the CRC-32 of every
  operation id the add-on holds for the raid. `count` is how many.

### 10.3 Chunking

An operation is encoded (10.1) then cut into pieces of at most **160 bytes**, never
inside a UTF-8 character or a `%XX`. With the header (at most 80 bytes, prefix included,
for the longest names) a chunk is under 241. An operation that fits is one chunk, `1/1`. The receiver
keeps chunks by `msgid` and applies the operation only when all `N` have arrived. After
**10 seconds** with chunks missing it whispers a `Q` to the sender, up to three times,
then drops the partial message; a catch-up (below) covers what was dropped. Receiving
a chunk twice changes nothing.

### 10.4 Convergence

- When an add-on makes an operation it sends it as `O` messages to the group.
- Operations are idempotent and keyed by `id`, with the arrival rules of 4.2 applied by
  the add-on itself. A void is never lost to a late award; a repeated `id` with the same
  payload is ignored. The same `id` with a **different** payload keeps the first and is
  flagged to the officer (the site would reject it as `key-conflict`).
- On `H`: if the sender's raid matches and its `digest` differs from mine, I send a `C`
  with every operation id I hold. Either side can start; the digest matches once both
  hold the same set.
- On `C`: for every operation I hold whose id is not in the list, I whisper its `O`
  messages to the requester with `author` set to the original author, then a `D`. I never
  re-forward an operation I merely received unprompted, so a message cannot loop.
- Duplicates from several officers replying to one `C` are harmless (idempotent).

### 10.5 Worked example: a chunked message

Zoé Brûlé's add-on sends a replacement with a long note, then the receiver's add-on gets
both chunks. The operation text is 228 bytes, so it is two chunks. Each line is the
body after `BFLOOT1` and a tab; the second count is the bytes of the whole message.

```
O;k4m8q2;1/2;SA0001;Zoé Brûlé;R;rp-3n7b5x0c;aw-9d2f6h1j;1792001300;;aw-6k1m4v8z;cm9xr2lb30007k1x8q5t2n4pa;16805;Bo Marsh;cm9xr2u900042k1x8q5t2n4pa;SR;77;Traded after the roll%3B Zoé was awa
O;k4m8q2;2/2;SA0001;Zoé Brûlé;y from the keyboard and Bo was next in line.;Zoé Brûlé;1792001300
```

The first message is 201 bytes, the second 109. If only the first arrived, the receiver
whispers `Q;k4m8q2;2` after 10 seconds and the sender repeats chunk 2.

## 11. Boss attribution

The boss on an award comes from the raid's loot tables (the snapshot's `bosses`), not
timing alone. The add-on watches `ENCOUNTER_START` (a **pull**) and `ENCOUNTER_END`; only
an `ENCOUNTER_END` with success counts as a **kill**. A failed attempt is a pull and
nothing else.

**Candidates** for an item are the bosses whose `items` list contains it. Trash has a
row like any other boss.

**Corpse memory.** The first time a corpse is opened, the add-on notes its source GUID
(`GetLootSourceInfo`) and the time. That first-opened time is kept for the raid:
reopening the corpse never changes it, so a corpse keeps its first attribution whatever
happens later. The officer can change the boss in the pop-up before awarding; a change
applies to that award only.

| Case | Attribution |
| --- | --- |
| Item on **exactly one** boss's table | That boss, wherever it drops and whether or not it has been killed. |
| Item on **several** tables; one of them was killed, and the corpse was first opened after that kill and before the next pull | The most recently killed of those bosses. |
| Item on several tables; the corpse was first opened after the next pull began, or none of those bosses has been killed | None: the officer picks. The pop-up has no default boss. |
| Item on **no** table ("unlisted") | Trash (the raid's Trash row). The pop-up warns that the item is not in the loot table: the site answers `item-not-in-table` (section 4) until an officer adds it on the loot log. With no Trash row, the officer picks. |
| A corpse **reopened** | Its first-opened time stands, so an item on it gets the attribution it would have had the first time, even after a new kill or pull. |
| A **failed attempt** (`ENCOUNTER_END` without success) | No kill is recorded, so nothing is attributed to that boss. The attempt still counts as a pull: a several-table item on a corpse first opened after it is not given to an earlier kill; the officer picks. |

Worked: Lucifron dies at 10:00 and his corpse is opened at 10:01; an item on both
Lucifron's and Magmadar's tables drops. Lucifron is the most recently killed candidate,
the corpse was opened after the kill and before any pull, so the item is Lucifron's.
At 10:05 the raid pulls Magmadar and wipes, then a trash pack's corpse is first opened
at 10:15 holding the same item: a pull began after Lucifron's kill, and the wipe killed
nothing, so the officer picks.

## 12. Copy-out text

When the helper isn't used, an officer copies the add-on's award list and pastes it on
the site's import (built in a later task; it applies the same checks and the same
arrival rules as a helper upload, sections 4.2 and 5, as the importing officer).

```
BFOUT1;<raid id>;<raid code>;<env>
<operation text>        one per line, in the order they happened
E;<count>
```

- The header names the raid (the full id), its code and the environment. The import
  rejects the paste if these do not match the raid it is open on, or the site's
  environment (section 2).
- Each line is an operation text (10.1); `raid` and `env` come from the header. All five
  operations are carried, including `confirm` and `not-confirmed`, `void` and `replace`.
- `E;<count>` closes the text; `count` is the number of operation lines. A paste with
  no `E` line, or a different count, is rejected whole, so a cut-off paste is never
  half-applied. A malformed line rejects the whole text with its line number.
- **Practice records are never copied out**: a practice award and every operation that
  names one are left out, and the count excludes them.
- Pasting twice is harmless: results are `replayed` (4.2).

### Worked example

A raid with an award that was confirmed and then replaced, and a second award that was
undone (staging, from the snapshot of 3.3). Lines are shown wrapped for reading but are
single lines in the text.

```
BFOUT1;cm9xr2k4a0001;SA0001;staging
A;aw-7f3k2m9q;lb_lucifron;16805;Ana Vale;u_ana;HR;91;;Rae Quill;1792001200;
K;cf-1x8p4d2s;aw-7f3k2m9q;1792001204;
A;aw-8d3c5n2a;lb_trash;17011;Dee Holt;u_dee;OPEN_ROLL;64;;Rae Quill;1792001230;
V;vd-5b2n8c1w;aw-8d3c5n2a;wrong winner;1792001260;
R;rp-9c4v6t0e;aw-7f3k2m9q;1792001300;;aw-2h6j9z4b;lb_lucifron;16805;Bo Marsh;u_bo;SR;77;;Rae Quill;1792001300
E;5
```

Pasted, the site records Ana's award and its confirmation, records Dee's award void
(the Undo), then voids Ana's award and records Bo's in its place.
