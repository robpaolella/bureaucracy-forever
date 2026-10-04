# Guild verification map

Start with `../SKILL.md`: fresh local database, owned server, Doctor PASS and an
isolated chrome-devtools-axi session. Capture the action, persisted result and
screenshots outside git. Record skipped entry points; one path does not prove
another. Re-seeding destroys local changes, so use a fresh run for baseline data.

## Mapped

- [Member raid calendar and sign-up](member-calendar.md): list, month, detail,
  response changes, Undo and persistence. The initial proof may cover one path;
  use the full map for subsequent changes to this feature.
- [Public pages](public-pages.md): home (`/`), about (`/about`), schedule
  (`/schedule`) and recruitment (`/recruitment`) content and entry points.
- [Applying to the guild](application.md): out-of-session gate, the local
  `member-unsubmitted` form path and submitted summary at `/apply`.
- [Member availability](member-availability.md): paint modes, desktop and phone
  paths, autosave/manual save and reload proof at `/members/availability`.
- [Public loot rules](public-loot.md): policy navigation, FAQ disclosure and
  application entry at `/loot`.

## Scheduled next

- Officer raid planning (`/officers/raids`), loot log (`/officers/loot`) and
  availability (`/officers/availability`) are tracked in #85. They are separate
  so this map stays within the agreed reviewable size limit.

## Not covered

Discord bot behaviour and the signed bot API (`/api/bot/*`) are not covered. Real
Discord OAuth and Discord-role syncing need staging; local session stubs do not
prove either, nor bot delivery.
