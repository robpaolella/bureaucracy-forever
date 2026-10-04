# Officer class needs

Officers set recruitment demand by class/spec and star one high-need spec for the home page.

## Sub-features

- `needs-status`: immediate High need / Medium / Closed changes per spec.
- `needs-featured`: single featured high-need spec; disabled stars on other statuses.

## How to get to it (user POV)

Open `Officers` → `Recruitment management` for `/officers/needs`. Each class section
lists its specs, status choices and a star button; there is no Save button.

## Driving it with chrome-devtools-axi

Preconditions: `../SKILL.md` Launch and Doctor PASS; shared rules in [the index](README.md).

- **Enter.** `open "$BASE/dev/session?as=officer&back=/officers/needs"`; resize to
  `1440 900`, snapshot. Find the Warrior section and Fury row; seed starts it Closed.
- **Status.** Click that row's `High need` radio (labels repeat across rows, so use
  the handle adjacent to Fury, not the first matching text). Wait for the saved
  toast, then fully reopen `/officers/needs`. Confirm Fury's `High need` is checked
  and `Feature Warrior Fury first on the home page` is enabled. If the first
  snapshot is still loading/stale, wait and take a fresh snapshot before judging it.
- **Feature.** Click the uniquely named Fury feature button. Wait for success,
  fully reopen the page and confirm its filled star. If the snapshot omits pressed
  state, use read-only `eval` to inspect that button's `aria-pressed` attribute:
  it must be `true`. Never set the attribute or call internal actions with JavaScript.
- **End state.** Save before/after/reload snapshots, the star read-back and desktop/
  phone screenshots. Public home/recruitment changes may take up to a minute; those
  pages are separate read-backs if testing public propagation, not this baseline.

## Gotchas

- Non-officers get 404 (index). Status and star changes save immediately; there is
  no draft or manual save. A toast or optimistic selected radio alone is not proof.
- Only one spec can be starred. Starring another replaces it; changing a starred
  spec away from High need clears its star. If testing these paths, fully reload
  and check both affected stars/statuses. The baseline above does not prove them.
- All classes/specs are rendered from the need rows; seed supplies the populated
  editor. This map does not manufacture missing rows or test Discord commands.
