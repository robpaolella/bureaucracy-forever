# Officer applications inbox

Officers read applications, leave private notes and make local decisions.

## Sub-features

- `applications-inbox`: path/status/search filters and unread state.
- `application-detail`: selected inbox pane (`?id=`) and standalone `[id]` page.
- `application-notes`: officer note composer and saved author/body.
- `application-decision`: accept/decline confirmation and move-to-social action.

## How to get to it (user POV)

Open `Officers` → `Applications`. Desktop rows select the right pane; `Open on
its own page` opens `/officers/applications/[id]` in another tab. Phone rows go to
that standalone page. `All applications` returns to the selected application.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared rules in [the index](README.md).
Only the isolated local database is allowed for these decisions.

- **Enter.** `open "$BASE/dev/session?as=officer&back=/officers/applications"`;
  resize to `1440 900`, snapshot. Seed has pending applications; the initial pane
  selects `footnote` / character `Footnote`. Record its ID from the standalone link.
- **Decision.** Open the recorded standalone URL. On that local pending application
  click `Accept`, inspect the `Accept footnote?` dialog, then `Accept the application`.
  Wait for `Accepted by ledgerline`, fully reload the standalone URL and confirm
  the pill and absence of decision buttons. This proves a local decision, not the DM.
- **Note.** On that accepted standalone page, fill `Add a note` with a unique local
  marker, click `Post` using a fresh handle, and **wait until the note appears**.
  Snapshot, then fully reopen the standalone URL. Expect the same note and officer
  author. Do not navigate away while posting: a click alone does not prove the
  request completed. Save the end-state snapshot and desktop/phone screenshots.
- **List read-back.** Reopen the inbox: the accepted applicant must leave `Pending`.
  Select `Accepted` in `Status` to find it again. Path radios (`Raider`, `Social`,
  `All`) and `Search applications` narrow the list without saving anything.

## Gotchas

- Non-officers get 404 (index), including standalone details. Opening an unread
  application marks it read after the response; reload the inbox to prove its
  unread dot cleared. The seed contains pending applications, so `Nothing pending`
  is not reached by the seed. A no-match filter is not proof of an empty database.
- Other mutation paths: `Decline` opens its own confirmation; `Move to social`
  changes a pending raider's path directly. If exercised, fully reload both detail
  and filtered inbox to prove status/path. They are not implied by the accept proof.
- Local launcher clears external credentials. Decisions/notes may enqueue bot work,
  but no Discord message, role change, thread closure or note syncing is proved.
  Do not open Discord thread or external logs links as part of this verification.
- Do not accept every seed application merely to obtain an empty list. Record
  validation errors/conflicts rather than repeating a decision against another site.
