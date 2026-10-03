# Guild verification map

Start with `../SKILL.md`: fresh local database, owned server, Doctor PASS and an
isolated chrome-devtools-axi session. Capture the action, persisted result and
screenshots outside git. Record skipped entry points; one path does not prove
another. Re-seeding destroys local changes, so use a fresh run for baseline data.

## Mapped

- [Member raid calendar and sign-up](member-calendar.md): list, month, detail,
  response changes, Undo and persistence. The initial proof may cover one path;
  use the full map for subsequent changes to this feature.

## Not mapped yet

- Public pages: home (`/`), about (`/about`), schedule (`/schedule`), recruitment (`/recruitment`).
- Applying to the guild (`/apply`).
- Member availability (`/members/availability`).
- Officers' raids (`/officers/raids`) and loot log (`/officers/loot`).

These are follow-up mapping work, not verified by the calendar proof. Discord bot
behaviour and the signed bot API (`/api/bot/*`) are not covered. Local session
stubs do not test OAuth, Discord roles or bot delivery.
