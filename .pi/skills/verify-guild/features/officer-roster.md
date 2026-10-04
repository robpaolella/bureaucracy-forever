# Officer roster management

Officers search guild members and add/edit a main character or their guild rank.

## Sub-features

- `roster-search`: Discord/character-name search and shown/total count.
- `roster-main`: add/edit character name, class, spec, raid role and rank.
- `roster-removal`: confirmed main removal; rank control for members without mains.

## How to get to it (user POV)

Open `Officers` → `Roster management` for `/officers/roster`. Named `Edit <main>`
buttons open character dialogs. Members without a main offer `Add main for <name>`.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared rules in [the index](README.md).

- **Enter.** `open "$BASE/dev/session?as=officer&back=/officers/roster"`; resize to
  `1440 900`, snapshot. Seed has a populated roster including `Addendum`.
- **Search.** Fill `Search members` with `Addendum`; expect only its row. An
  unmatched marker gives the no-results state; clear the search to restore rows.
  Search is not saved and should not be counted as a persistence mutation.
- **Edit.** Click `Edit Addendum`. Record `FIRST NAME`, `SECOND NAME`, `CLASS`,
  `SPEC`, `RAID ROLE`, `RANK` and `Remove from roster`. Fill `SECOND NAME` with
  `Verified`, leaving the other seeded values unchanged. Capture the dialog,
  click `Save`, and wait for it to close and the renamed row to appear.
- **Read back.** Fully reopen `/officers/roster`, expect `Addendum Verified` and
  `Edit Addendum Verified`. Reopen the dialog to verify `SECOND NAME` persists,
  cancel, and capture the list at desktop/phone widths with a saved snapshot.

## Gotchas

- Non-officers get 404 (index). The seed has mains; an accepted applicant from the
  applications proof can add a `No main yet` row. Do not mistake it for empty roster.
- Add-main, rank-only and removal are additional paths, not proved by renaming.
  After each save, fully reload the list and reopen the character dialog where
  applicable. Removal needs its confirmation and reload proof of `No main yet`;
  it does not delete the Discord account. Use only disposable local records.
- Raid role choices follow class/spec; a single permitted role is disabled. Officer
  rank is protected rather than offered as a freely editable promotion/demotion.
- Name fields accept 2–12 letters each, not arbitrary marker text. A duplicate or
  invalid name can fail; record the visible error rather than bypassing the form.
- No real Discord rank syncing or downstream raid-count update is proved here.
