# ADDON-SPEC — site, loot add-on and helper

The contract between this site, the officers' in-game loot add-on
(`bureaucracy-forever-addon`) and its desktop helper (`bureaucracy-forever-helper`).
It lives here only. `SYNC-SPEC.md` is the site–bot contract and is not part of it.
Change this file in the same PR as any code that changes a format, and bump
`formatVersion` when an old reader would misread the new one.

The raid question's saved-data values (`activeBy`: `none`, `chosen`, `off`) and the `P`
and `S` messages (section 10) replace the earlier `auto`/`override` and add to an
add-on and helper that have not shipped, so no old reader exists and `formatVersion`
stays 1. Once either ships, a change like this bumps it.

**Format version: 1.** Sections 1–8 (part A) cover identity, the reserve snapshot,
operations and the helper API. Sections 9–12 (part B) cover the raid chat line, officer
sync messages, boss attribution and copy-out text.

Words: **site** is this app; **add-on** runs inside the game; **helper** runs on an
officer's computer and moves data between the two; **officer** is a member whose Discord
roles give officer access (`lib/auth/roles.ts`). Times are UTC, written as Unix seconds
in the add-on's data and in the helper API. The site shows guild time.

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
- **The add-on's active raid** is the one raid its awards go to. The add-on holds the
  snapshots of several raids (the inbox's, section 7.3, and any pasted, 3.2), and an
  officer chooses the active one by answering a question when a run starts (2.1). The
  choice is shared by every add-on in the group. A run that is *not a guild run* has no
  active raid and records nothing. The helper has no part in the choice. The add-on
  asks first before an officer moves off a raid that has awards.
- **No active raid:** awards made with none (before the question is answered, or after
  "Decide later") are held as **no raid**. This is the one exception to "every record
  carries a raid id and environment": they sit in a separate `noRaid` list in the
  add-on's saved data, without `raid` or `env`, and are never uploaded or sent as chat.
  An officer attaches them to a raid, which adds that raid's `raid` and `env` (and moves
  them to the awards list) and keeps their keys, or **discards** them after a
  confirmation. A discarded award is deleted from the add-on's saved data; it was never
  uploaded, so nothing reaches the site.
- **The helper's raid list** (section 7.5) is every upcoming raid, so the inbox can carry
  the snapshot of each. It is not a choice: the helper only shows the add-on's current
  pick (2.1).

### 2.1 Choosing the active raid

An officer confirms the raid at the start of each run; the add-on never picks it silently.
The question is built on the **instance number**, never on a name. Zone and dungeon names
are translated on other clients and spelled differently in game and on the site, so no
rule here compares a name.

- **The instance number.** A raid's `instance` (3.1) is an integer taken from its raid
  template: the instance id that `GetInstanceInfo()` returns in game (its 8th return
  value, the same in every client language). **Unverified on the WoW Forever client
  (Interface 16001):** the add-on's task checks it before relying on this section.
  A template with no instance number gives a raid with no `instance` field (the field is
  absent, 7.3 rule 2), and such a raid is never suggested.
- **A candidate** for an instance is a raid, from the inbox or pasted, that has that
  `instance`, is not cancelled, and is **under way** or **starts within 12 hours** (the
  same test as section 7.5, using `startsAt` and `durationMin`).
- **The suggestion.** With exactly one candidate, it is the suggestion. With several, a
  raid under way beats one that has not started; among raids that have not started the
  soonest start wins, so back-to-back raids for one instance hand over when the first
  ends. Two or more candidates **both under way** give no suggestion. Two or more candidates that have not started and
  share the soonest start time give none either; a tie at a later start does not matter
  (A and B both at 8pm, C at 9pm: none; A at 8pm, B and C both at 9pm: A). With no candidate
  there is none either. The suggestion only pre-selects a row in the question; it never
  becomes the active raid by itself.
- **The question.** When an officer's add-on, as the *chooser* (below), sees its
  player enter a raid instance (`GetInstanceInfo()` instance type `raid`) while in a
  raid group, it asks **"Is this a guild run?"** with three answers:
  - **No.** The group is **not a guild run**. Every add-on in the group goes quiet: no
    loot pop-up, no chat lines, nothing recorded, saved as an award or sent (not even as
    "no raid"). It lasts until the add-on leaves the group.
  - **Yes**, then **"Select the raid event"**, listing the loaded raids (inbox and
    pasted) with the suggestion pre-selected, or none pre-selected when there is no
    suggestion. With no candidate, the question shows the instance number and name
    from `GetInstanceInfo()` (the name is for people only, so an officer can type the
    number into a custom raid's template on the site) and lists the raids anyway.
  - **Decide later.** The active raid stays as it was (none at the start, so awards are
    held as no raid). The Sync tab says the raid is not chosen yet. The question comes
    again on the next entry into a raid instance, the same instance included.
  If master loot is off, the question says so.
- **The chooser.** Exactly one add-on in the group asks, so add-ons never disagree: the
  **loot master**, if master loot is on and they run the add-on; otherwise the **raid
  leader**, if they run the add-on; otherwise the add-on user who comes first by name
  order (the names as the game shows them, compared byte by byte). Anyone running the
  add-on counts as an officer: the snapshot carries no roster, so the add-on can't tell
  officers from other players. Each add-on knows who runs the add-on from the `P`
  messages of section 10, so all reach the same answer without a race; it waits **5
  seconds** after entering the instance or joining the group for them before it asks.
  If the chooser leaves the group or logs out with the question open, the rule is run
  again and the new chooser asks when their player is in the instance.
- **Shared with the group.** The answer (a raid, or "not a guild run", and who chose it)
  goes to every add-on in the group as an `S` message (section 10) and is applied by all
  of them. Add-ons that join or reload receive it (10.4). The Sync tab shows who chose
  it.
- **Changing it.** Any officer can change the raid, or choose "not a guild run" or a
  raid after one, in the Sync tab. It is shared the same way. When two changes cross, the
  later wins: the later sender's time `at`, ties broken by name (10.4). Choosing a raid
  makes it the active raid whatever the instance or time; pasting a snapshot (3.2) counts
  as choosing that raid.
- **Asked again** only on entering a raid instance **different** from the selected raid's
  `instance`, for example Molten Core, then Onyxia the same night; that instance's
  suggestion is pre-selected. Never after `/reload`, a corpse run or re-entering the same
  instance, and never when the selection is "not a guild run" or the selected raid has no
  `instance`. A new group asks fresh. Master loot being set later, or passing to another
  officer, keeps the selection; the new loot master is not asked.
- **Saved data.** The add-on writes the selection into its saved data so the helper can
  show it: `activeRaid` (a raid id, or `nil`), `activeBy` and `chosenBy` (the officer's
  name, or `nil`). `activeBy` is one of:
  - `none`: not chosen yet (after "Decide later", or before any answer). `activeRaid` is
    `nil`; awards are held as no raid.
  - `chosen`: an officer chose the raid, by the question, the Sync tab or a pasted
    snapshot. If the add-on has not loaded that raid yet, `activeRaid` stays `nil` and
    the Sync tab says the raid is not loaded; it applies when the snapshot loads.
  - `off`: not a guild run. `activeRaid` is `nil`.

  The selection survives `/reload` while the player is still in the same group, and is
  cleared at login if the player is not in a group, and when the player leaves a group.
  Where awards and operations are saved is in 4.4.
- **Leaving a raid that has awards.** A change of the selected raid by this officer, in
  the Sync tab or by the question, asks first (keep or switch) when the current raid has
  awards. Awards already made stay with their raid either way. An add-on that follows a
  change made by someone else does not ask.

| Case | Outcome |
| --- | --- |
| Outside any instance (`GetInstanceInfo()` reports instance type `none`) | No question and no change: the selection stays, so awards after leaving go to the same raid. At login with none selected, no raid. |
| Inside a dungeon or other non-raid instance, or in a party that is not a raid group | No question. A selection already made stays. |
| No raids in the inbox (and none pasted) | The question can only be "No" or "Decide later"; "Yes" says there is no raid to choose and the officer can choose later when a snapshot arrives. An empty inbox clears the inbox's raids; pasted ones remain. |
| The instance has no raid, or only a raid with a different `instance` | No suggestion: the question shows the instance number and lists the loaded raids anyway. |
| A raid whose template has no instance number | Never suggested; it can still be chosen from the list or by pasting. |
| A raid cancelled after the inbox was written | Still in the file until the helper writes it again, which it does when the raids list changes; the next `/reload` drops it. Until then uploads for it are rejected `raid-cancelled` (section 5) and show in its problems list (7.4). |
| The selected raid is no longer in the inbox (and not pasted) | The selection is cleared with a notice (`activeBy` becomes `none`) and the question is asked again on the next raid instance entry. The raid's saved awards stay in their list and still upload. The raid is gone, so there is nothing to ask about. |
| Two raids for one instance, neither started, with the same soonest start | No suggestion, as for two under way. Nothing is pre-selected; the officer picks from the list. |
| Back-to-back raids for one instance | The suggestion is the one under way, then the next once the first has ended. The question is not asked again for the same instance; an officer changes the raid in the Sync tab. |
| A pasted snapshot | It loads one raid and selects it for the group (an `S` message, `activeBy` `chosen`). If the inbox holds the same raid, the snapshot with the later `generated` is the one used. It stays loaded until the officer removes it in the Sync tab. |
| The answer is "No" and an officer later enters another raid instance | Still not a guild run; no question. Any officer can choose a raid in the Sync tab. |
| An add-on that has not yet received `S` | It holds the state it had; it takes `S` on arrival, so awards made in between go as no raid or to the old raid, and can be attached later. |

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
(section 3.1). It reaches the add-on as pasted text (3.2) or in the helper's inbox file
(section 7.3), which carries one for each raid in the raids list. The raid's awards as
the site holds them now come separately, as the catch-up (3.4).

### 3.1 Contents

| Field | Meaning |
| --- | --- |
| `formatVersion` | `1` |
| `raid` | The raid id |
| `code` | The raid code (section 2) |
| `env` | `production` or `staging` |
| `name`, `startsAt` | Raid name; start in Unix seconds |
| `durationMin` | Planned length in minutes, an integer; with `startsAt` it says when the raid is under way (2.1) |
| `instance` | The raid's in-game instance number, an integer: the raid template's instance id as `GetInstanceInfo()` returns it (2.1). **Absent** when the template has none (for example a custom raid whose officer hasn't filled it in); never `nil`. A raid without it is never suggested for the raid question (2.1). |
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
made by the site. The catch-up (3.4) carries the same fields, fresher.

**Spending is the add-on's job.** The snapshot holds reserves as they stood at
`generated`. The add-on subtracts every non-voided award, baseline and its own, the way
`resolveDrop` does: a holder who has received an item on this raid no longer counts for
it, so the next copy goes to the remaining HR holders, then SR, then an open roll. An
Undo (a void) gives the reserve back, with nothing to reload.

### 3.2 Pasted text

A pasted snapshot loads one raid and selects it for the group (2.1); it has no catch-up. The
paste test proved about 7,400 characters in one box, so the text is cut into parts
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
  name = "Molten Core - sample", startsAt = 1792000000, durationMin = 240,
  instance = 409, generated = 1791990000,
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

### 3.4 The catch-up

A raid's awards and voids **as the site holds them now**, including awards and voids an
officer made by hand in the site's loot log. It is how an add-on that logs in late or
reloads learns what happened while it was away, even when no other officer is online.
It is defined here once: `GET /api/helper/raids/{raid}/catchup` (7.1) answers it as JSON,
and the inbox carries the same tree for each raid (7.3).

| Field | Meaning |
| --- | --- |
| `formatVersion`, `raid`, `env` | As in 3.1 |
| `generated` | When the site built it, Unix seconds |
| `awards` | Every award on the raid, voided ones included |
| `voids` | Voids held **pending**: a void whose award the site does not hold (4.2). Often empty. |

An award is the baseline award of 3.1 (`{ key, boss, item, char, user, method, roll,
voided }`, with `user` and `roll` absent when none) plus:

| Added field | Meaning |
| --- | --- |
| `state` | `announced`, `confirmed` or `not-confirmed` (section 4.1), or `manual` for an award made by hand on the site, where no game ever confirmed it. A voided award keeps the state it had. |
| `at` | When the state last changed, Unix seconds, for 4.1's later-wins rule: the game time of the confirmation, else of the hand-out; for a `manual` award, when it was recorded on the site |
| `practice` | `true` on a practice record (staging only); absent otherwise |

A pending void is `{ key, reason, at }` (`reason` absent when none); a replace held for an
original the site lacks is listed as a void of that original. The catch-up has no
`replace`: a replacement is the voided original and the new award, as the site stores it.
Practice awards are in it, marked, so the add-on's spending matches the site's.

**Refreshed on its own.** The helper fetches a raid's catch-up on its own schedule, so a
raid's catch-up can be newer than its snapshot (`generated` is each one's own).

**How the add-on merges it**, at login or `/reload`, with each award by key and the arrival
rules of 4.2 (a void always wins):

- A key the add-on does not hold is added, in its `state`; a `manual` award counts for
  spending like any other. Unvoided ones spend reserves (3.1), voided ones do not.
- A key it holds: if either side is voided, it is voided. Otherwise `confirmed` and
  `not-confirmed` follow 4.1 (the later `at` wins, a tie goes to confirmed); `announced` and
  `manual` never replace either.
- The same key with a different `boss`, `item`, `char` or `method`: the add-on keeps its
  own and flags it to the officer, as for a conflicting sync message (10.4).
- A pending void applies to the award it names; with no such award it is kept pending
  until the award arrives (4.2).
- The merge only adds or advances. It deletes nothing, is not re-sent to other officers,
  and what the site lacks still uploads as operations. A catch-up for another
  environment or raid than the one named is ignored and flagged.

**Not the sync catch-up.** Section 10's `C` and `D` messages are officers' add-ons
trading operations with each other in game. This catch-up comes from the site through the
helper and is a different thing.

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
section 7.1, never separate HTTP codes. Any award in the table, including the new award
inside a `replace`, may instead be `rejected` by section 5's checks (such as
`unknown-sender`):

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

### 4.4 The add-on's saved data

The add-on keeps its awards and operations in `BureaucracyForeverDB`, in five places. The
helper reads them (section 7.3) and copy-out (section 12) is built from them. A list that
is absent is the same as an empty one.

| Saved as | Holds |
| --- | --- |
| `awards[raidId]` | The raid's award records, in their final state. Voided awards stay in the list; nothing is removed. |
| `ops[raidId]` | The raid's operations in the shape of section 4, in the order they were made or received. Copy-out and the helper's upload read this list because they need the order, not only the final state. |
| `noRaid` | The award records held as "no raid" (section 2): no `raid` or `env`. |
| `noRaidOps` | Their operations, in the same order and shape as `ops`. |
| `siteVoids` | The site's pending voids: voids from the catch-up (3.4) for awards the add-on does not hold yet. An object keyed by award key; each entry is described below. |

When an officer attaches the "no raid" awards to a raid, both lists move to that raid's
`awards` and `ops`, each record gaining `raid` and `env` and keeping its key; discarding
them deletes both lists (section 2).

**Pending site voids.** Each `siteVoids` entry, under the key of the award it voids, is
`{ raid, env, reason, at }`:

| Field | Meaning |
| --- | --- |
| `raid`, `env` | The raid and environment the catch-up named, so a stored void is checked against the active raid and environment as 3.4 does. |
| `reason` | The void's reason; absent when none, as in 3.4. |
| `at` | When the site voided the award, as in 3.4's pending void. |

The field exists so a pending void survives a `/reload` or a new session; without it the
add-on would lose the void before the award arrived. An entry is removed once its award
arrives and the void applies (3.4, 4.2), and is dropped when its raid is discarded. Pending
voids are never in `ops` or `noRaidOps` and are never uploaded or sent to other officers
(section 10): the site already holds them and sends them again in its own catch-up. A
missing `siteVoids` means no pending voids, as in saved data from before the field. The
helper **ignores** the field (see 8.3).

An **award record** holds the award's fields (`raid`, `env`, `practice`, `boss`, `item`,
`char`, `user`, `method`, `roll`, `note`, `sender`, `at`, as in section 4) and:

| Field | Meaning |
| --- | --- |
| `key` | The award's operation id (section 4). |
| `state` | `announced`, `confirmed` or `not-confirmed` (4.1). |
| `stateAt` | The `at` of the operation that set `state`; the award's own `at` while `announced`. |
| `replaces` | On a replacement, the `key` of the award it replaced. |
| `replacedBy` | On a replaced award, the `key` of its replacement. |
| `voided` | `true` once voided or replaced. |
| `voidReason`, `voidedAt` | The reason (optional) and `at` of the first void; later voids do not change them (4.2). |

An operation that names an award not held yet stays in `ops` and takes effect when the
award arrives (4.2). Each operation carries `formatVersion` (currently 1; section 6).

## 5. What the site does with an operation

For each operation the site, in order: checks the key belongs to a current officer
(section 7.2); checks `formatVersion`, `env`, `raid` and `practice` (section 2);
checks the raid isn't cancelled (`raid-cancelled`, as the loot log does); applies the
arrival rules (4.2); and answers per operation, so one bad record never blocks the rest
of a batch. An award becomes a `LootAward` the way `POST /api/raids/[id]/loot` makes
one: the officer on the key is `recordedById`, names are copied, and the winner is not
re-checked against sign-ups or reserves — the officer in the game had the last word.

A rejected operation changes nothing and is kept for the problems list (7.4). Besides
`unsupported-version` (section 6), its `code` is one of:

| Code | Why |
| --- | --- |
| `wrong-environment` | The record is for the other site (section 2). |
| `unknown-raid` | The site doesn't hold the raid, or the record names a raid the batch isn't for. |
| `practice-refused` | A practice record sent to production (section 2). |
| `key-conflict` | The id or key is already used with another payload, or on another raid (4.2). |
| `raid-cancelled` | An award for a cancelled raid. |
| `item-not-in-table` | The award's `item` is not in the raid's loot table (section 4). |
| `unknown-boss` | The award's `boss` is not a boss of the raid's loot table. |
| `unknown-character` | No character has the award's `char` name. |
| `user-mismatch` | The award's `user` is given but doesn't own `char`. |
| `unknown-sender` | The award's `sender` is not the exact name of a character whose account has officer access now (7.2). |

The last six check an award, including the new award inside a `replace`, in the order
listed, so an award failing two of them gets the earlier code. A `replace` is
checked when it arrives, even if it would otherwise be kept `pending`, and is rejected
whole with its new award's code, so a held replacement never fails later. A pending void
or confirmation carries no award and is kept as 4.2 says. A recorded award sent again is
`replayed` without being checked again.

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
| `GET /api/helper/me` | Checks the key. Answers `{ officer, env, formatVersions, addon: { version, url } }`. `officer` is the key owner's Discord name, a string, for the helper's "Connected as <name>"; `env` is this site's environment (section 2). |
| `GET /api/helper/raids` | The raids list (7.5). |
| `GET /api/helper/raids/{raid}/snapshot` | The snapshot as a data tree in JSON (`{ "formatVersion": 1, ... }` with the fields of 3.1; `reserves` keyed by item id as strings). The helper writes the inbox file from it and its siblings (7.3) and can also show the pasted-text form. A raid the site doesn't hold is `404` `unknown-raid`; a cancelled one `409` `raid-cancelled`. |
| `GET /api/helper/raids/{raid}/catchup` | The raid's catch-up (3.4) as JSON, with the same fields. The helper writes it into the inbox beside the snapshot (7.3). |
| `POST /api/helper/operations` | Body `{ "operations": [ ... ] }`, each as in section 4. Answers `{ "results": [ { "id", "status", "code?" } ] }` in the same order. |
| `GET /api/helper/raids/{raid}/problems` | Records the site rejected or is holding for this raid (7.4). |

`status` per operation is one of `recorded`, `replayed`, `pending`, `voided`,
`rejected` (with a `code`). HTTP is always `200` when the request itself was valid, even
if some operations were rejected or pending; the status words carry the outcome. Section 4.2 gives the per-record outcomes.

The upload in detail:

- One request may carry records for several raids. The site applies each raid's records
  in the order sent, so a void listed before its award is held and then applied (4.2).
- A record the site can't read (section 8.4) is answered alone: `rejected` with code
  `bad-record`, or `unsupported-version` (section 6), and `id` as sent, or `null` when it
  has no string id. It is not kept for the problems list, since the site can't tell which
  raid it is for.
- A body that isn't `{ "operations": [ ... ] }` is `400` `bad-request`; more than 100
  records is `413` `too-large` (7.6). Neither records anything.
- A failure on the site's side is `500` `server-error`. Records answered before it may
  already be stored; the helper sends the same upload again, and those come back `replayed`.

The API sits behind the site's `ADDON_HELPER_ENABLED` switch: on for staging, off in
production until the chain test passes. While it is off every route answers `503` with
`{ "error": "The helper connection isn't switched on for this site yet.", "code": "helper-off" }`,
checked before the key, so a request with no key or a bad key gets the same answer.
Every request then passes the same checks, in this order: an address over
the failed-authentication limit (`429`), the body size (`413` `too-large`), the key
(7.2: `401` `bad-key`, `403` `not-officer`) and the key's request rate (`429`
`rate-limited`). The limits are in 7.6.

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
  site checks that `sender` is the exact name of a character whose account has officer
  access when the record arrives, and answers `unknown-sender` if not (section 5): an
  alt not yet on the site, an old name after a rename and a former officer's queued
  records are all refused, whoever delivers them. Nothing proves the game said so: an
  officer could send false records. The recorded officer is the key's owner, always;
  `sender` is stored as a claim. The audit trail is the point, since awards are never
  deleted and any can be voided.
- A key works in one environment: the one that issued it.
- **The other site.** Keys and raid ids exist only in the database of the site that made
  them, so the API needs no separate environment refusal: a key from the other site is
  `401` `bad-key`, and a raid id the site doesn't hold, including one from the other site,
  is `404` `unknown-raid`, each with the usual error body. Inside an upload, a record
  whose `env` is not the site's is the per-operation `wrong-environment` (section 2, 4.2).
- **The switch comes first.** While the site's helper switch is off (7.1), every
  route answers `503` `helper-off` before the key is checked, so no key, a bad key and a
  good key all get the same answer.

### 7.3 The inbox file

The helper writes a Lua file into the add-on's folder, which the add-on loads on
`/reload`. Because the game runs it as code, **the helper writes data only**:

```lua
BureaucracyLootInbox = {
  formatVersion = 1, written = 1791990100,
  raids = {
    { snapshot = { ...a snapshot table (section 3.3)... },
      catchup = { ...its catch-up (section 3.4)... } },
    { snapshot = { ... }, catchup = { ... } },
  },
}
```

`raids` holds every raid in the raids list (7.5: starting within 12 hours or under way,
not cancelled), in that order, each with its snapshot and, once the helper has fetched
it, its catch-up (`catchup` is absent until then). The helper rewrites the file when the
list or any snapshot or catch-up changes; the add-on reads it on `/reload`. With no
raids, `raids = {}` is written, so old ones are cleared. The inbox's layout has not
shipped, so it stays `formatVersion` 1.

Rules for the serializer (the only code that writes this file):

1. Output is the one assignment above and a single table literal. Nothing else, no
   comments, no functions, no calls, no variables, no concatenation.
2. Values are only tables, strings, integers (decimal, within ±9,007,199,254,740,991),
   `true` and `false`. Floats and `nil` are never written.
3. Keys are either a fixed identifier from this spec (the inbox's `formatVersion`, `written`,
   `raids`, `snapshot` and `catchup` included) or an integer in `[ ]`. A key is
   never built from site text.
4. Every string is written in double quotes with `\\` and `\"` escaped, and **every byte
   outside 0x20–0x7E escaped as three-digit decimal `\ddd`** (UTF-8 bytes one by one;
   a newline is `\010`). Three digits mean a following digit can't be misread, and no
   input can close the string or start a comment (`]]`, `--`, `\z` are all inert inside
   it).
5. These limits are the inbox's only; the add-on's saved file has its own (8.3). Depth is at most 8 (a holder inside the inbox is 7 deep), strings at most 200 bytes, one
   raid's entry (snapshot and catch-up) at most 200,000 bytes and the file at most
   700,000 (three raids at the entry limit, plus the wrapper). Over a limit, the helper refuses to write, keeps
   the old file and shows the officer an error naming the raid or the size; it never
   truncates or leaves a raid out.
6. The helper re-reads what it wrote with the parser of section 8 before replacing the
   old file, and writes to a temporary name then renames, so a half-written file is
   never loaded.

The add-on also validates what it loaded (types, version, the raid it names). A raid entry
that fails is skipped and reported, and the others load; a file that fails as a whole
loads no inbox raids.

### 7.4 Problems

`GET .../problems` lists, for the raid, what the site rejected or is holding. The helper
shows it; the site's officer log shows the same. Reporting is the whole response: nothing is
auto-resolved. The answer is JSON, not cached (section 7):

```
{ formatVersion, raid, generated, rejected: [ ... ], pending: [ ... ] }
```

| Field | Meaning |
| --- | --- |
| `raid`, `generated` | The raid id; when the site built the answer, Unix seconds |
| `rejected[]` | Operations the site refused for this raid, oldest first: `{ id, code, type?, key?, at }`. `code` is a section 4 code (most often `key-conflict`); a `wrong-environment` record for a raid this site holds is listed with the rest. `type` and `key` are the record's own, left out when it gave none. `at` is when the site received it, Unix seconds |
| `pending[]` | Operations kept waiting for an award the site doesn't hold, oldest first: `{ id, type, key, at }`. `type` is `award`, `confirm`, `not-confirmed`, `void` or `replace`; `key` is the award it names; `at` is the operation's own game time (section 4) |

Both lists are empty for a raid with no problems. A cancelled raid still answers, since its
refused uploads (`raid-cancelled`) are listed here; a raid the site doesn't hold is the usual
404 `unknown-raid`.

### 7.5 The raids list

`GET /api/helper/raids` returns every raid that

- starts within the next **12 hours** or is **under way** (`startsAt` ≤ now + 12 h and
  now < `startsAt` + `durationMin`), and
- is not cancelled (`cancelledAt` is null),

**soonest first** (`startsAt` ascending, so an under-way raid is first). The site has no
per-officer raids, so it is every such raid for any officer. Each entry is
`{ id, code, name, startsAt, durationMin, instance, hasLootTable }`, where `startsAt` is
Unix seconds as in the snapshot and `instance` is the integer of 3.1 (absent when the raid
template has none). The helper writes a snapshot
and catch-up into the inbox for every entry; which raid is active is the add-on's
choice (2.1). A raid without a loot table is listed, flagged
`hasLootTable: false`; its snapshot has no bosses.

### 7.6 Limits

Robert accepted these numbers (addon#3 change log, 2026-10-13).

| Limit | Value | Reason |
| --- | --- | --- |
| Operations per request | 100 | A long raid is a few dozen awards; a batch of 100 covers a catch-up upload without a huge body. |
| Request body | 64 KiB | 100 operations at about 400 bytes is 40 KB; leaves room for notes. |
| `note` / `reason` | 200 characters each | Longer than any real reason; keeps a record small. |
| Snapshot paste part | 7,000 characters | The add-on's paste test proved about 7,400. |
| Requests per key | 30 per minute | The helper polls and uploads every 30–60 s; this is an order of magnitude above that. Counted with `rateLimited` in `lib/rate-limit.ts`. |
| Failed authentications | 10 per minute per address | Slows key guessing. Address from `clientAddress`. |

Over a limit the site answers `413` (size) or `429` with `Retry-After` (rate), and the
helper backs off. After 10 failed authentications in a minute, every request from that
address gets `429` until the minute is up, valid keys included, so a guess can't be
confirmed. `rateLimited` is per server instance and best effort: the real guard
against double recording is that every operation is idempotent (4.2).

## 8. Parsing

**Every format is parsed as data and never executed.** No reader may hand text to
`loadstring`, `load`, `dofile`, `eval`, `Function` or an HTML sink.

1. **The add-on reading pasted text** uses a hand-written parser for the grammar in 8.2.
   It never calls `loadstring`. Unknown fields are ignored, wrong types reject the whole
   text, and every limit in 7.3 (depth, string length, size) applies; a pasted snapshot is one
   snapshot table, so the depth it needs is far under the limit.
2. **Grammar (the whole language).** `value = table | string | integer | boolean`;
   `table = "{" [ entry { "," entry } [ "," ] ] "}"`; `entry = [ key "=" ] value`;
   `key = identifier | "[" integer "]"`; string and integer as in 7.3 rules 2 and 4.
   Whitespace between tokens is ignored; anything else is a parse error.
3. **The helper reading `SavedVariables`** (the add-on's saved data) uses a parser of the
   same kind, in the helper's language, over the file's single assignment, with the
   grammar extension and limits of 8.3 (not 8.2's and 7.3's). It does not run the file in
   a Lua interpreter.
4. **The site reading uploads** parses JSON, then validates every field's type, range and
   length (section 4) before use. Text from the add-on is never put into a database
   query, a path or markup unescaped.

### 8.3 The add-on's saved file

The file the game writes (section 4.4) is not the inbox, so 8.2's grammar and 7.3 rule 5's
limits do not apply to it; this section does. The helper's reader is `savedvars.rs` and
`savedvars/lua.rs`.

**Grammar beyond 8.2.** The game writes the file in its own layout, so the reader also
accepts:

- keys `["string"]` as well as `[integer]` and identifiers (a number key that is not an
  integer is read as text);
- `--` line comments (the game adds `-- [1]` after list items), anywhere whitespace is
  allowed;
- decimal floats such as `-12.5` or `1e3`, and hexadecimal integers;
- `nil` values (the entry is left out), `;` as well as `,` between entries, and single-quoted
  strings.

A table whose keys are 1, 2, 3… in order is read as a list, any other as an object. Still
refused: a function call, an operator, a reference to a variable, a repeated key in one
table, and anything after the one assignment (`BureaucracyForeverDB = { … }`) but whitespace
and comments.

**Limits.**

| Limit | Value |
| --- | --- |
| File size | 8 MiB (8,388,608 bytes) |
| String length | 1,000 bytes |
| Nesting depth | 8 (the file's outer table is depth 1) |

Strings are longer than the inbox's 200 because a `note` of 200 characters can take up to
800 bytes. The size limit is checked before the file is read.

**Over a limit or outside the grammar.** The helper refuses the file **whole**: nothing in it
is used, and the officer sees a plain-English reason (with the line, for a syntax problem).
A file over the size limit is refused unread. Code in the file, a syntax error, a repeated
key, a limit and a file that is valid but not the layout of 4.4 are each refused whole in
the same way. An operation that has no valid `id` is the exception: it is skipped and the rest go on.

**`siteVoids` is a known field.** A file that holds the add-on's `siteVoids` (4.4) is the
layout of 4.4 and is accepted: the reader skips the field and uses nothing from it. The
helper uploads from `ops`, and pending voids come from the site's own catch-up, so there is
nothing to send. Its entries stay within the limits above like the rest of the file.

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
  a roll and a winner of 12 + 1 + 12 two-byte letters): at most 150 bytes.
- The **human part gives way**. If the line is over 255 bytes the add-on drops parts in
  this order until it fits: ` not {oldwinner}`, then `({method}, roll {roll})`, then the
  winner's name, then the label (`Correction:`, `Undo:`), leaving the link and the
  machine part.
- The shortest line is `[Practice] ` (practice only, 11 bytes), the link, a space and the
  machine part. With the worst machine part (at most 150 bytes) and an item link of up
  to **100 bytes** (an item name of about 50 characters), a non-practice line is at
  most 251 bytes and a practice line at most 262: so a non-practice line fits for every
  such link. A practice line can exceed 255 when a long link meets a long machine part.
  A line that still cannot fit is **not posted** and the add-on
  says so; the award is still saved and uploads through the helper. Chat is the
  convenience path, not the only one.

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
whose `User` is an officer when the record reaches the site. The helper cannot check
this (it has no roster), so it passes the sender on as `sender` and the **site** decides (section 7.2:
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
| `P` | `P;reply` | "I run the add-on." Needs no loaded raid. `reply` is `1` (broadcast, please answer) or `0` (an answer). |
| `S` | `S;choice;at;by` | The group's raid selection (2.1). Needs no loaded raid. |

- `msgid` and `reqid` are six lower-case letters or digits, chosen by the sender.
- `raid` is the raid code. A message for a raid the receiver has not loaded is ignored,
  except `P` and `S`, which carry no raid id of their own and work without any raid
  loaded (10.4).
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
- (The `C` here is officer to officer. It is not the site's catch-up of 3.4, which
  arrives through the inbox.)
- On `C`: for every operation I hold whose id is not in the list, I whisper its `O`
  messages to the requester with `author` set to the original author, then a `D`. I never
  re-forward an operation I merely received unprompted, so a message cannot loop.
- Duplicates from several officers replying to one `C` are harmless (idempotent).
- **Who runs the add-on (`P`).** `H` is per raid and ignored for a raid the receiver has
  not loaded, so it cannot say who runs the add-on. An add-on broadcasts `P;1` to the
  group when it joins the group, reloads or logs in while in a group, and the roster is
  the senders it has seen. On receiving `P;1` from a name it has not seen, an add-on
  whispers `P;0` back, and, if it holds a selection, an `S` (below). It never answers
  `P;0`, so nothing loops. A name leaves the roster when it leaves the group. The
  chooser rule (2.1) runs on this roster, the loot master and the raid leader as the
  game reports them. The `P` text carries no raid, so it works for an add-on with no
  snapshot loaded; an officer without one can still be chosen and is told to load one.
- **The selection (`S`).** `choice` is a raid code (9.1), or `-` for "not a guild run";
  `at` is the sender's time in seconds; `by` is the officer who chose, as "First Last"
  (escaped by 9.3). It is broadcast to the group when chosen, and whispered to a
  newcomer as above, with the original `at` and `by`. An add-on applies an `S` only if
  its `(at, by)` is later than the one it holds, comparing `at` and then `by` byte by
  byte, so two changes that cross end up the same everywhere and a repeat changes
  nothing. `S` is accepted only from group members. It always fits 255 bytes: at most
  8 (prefix) + 2 + 6 + 1 + 10 + 1 and a name of up to 3 × 24 bytes once escaped,
  about 100.
- **Raid code with no snapshot.** An add-on that gets an `S` for a code it has not
  loaded keeps it, shows "raid not loaded" in the Sync tab (2.1, `activeBy` `chosen` with
  `activeRaid` `nil`) and applies it when the snapshot loads. If the code names two
  loaded raids (a collision of the five characters) it uses neither and shows a notice.
- **Leaving the group** clears the roster and the selection; a new group asks fresh.

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
