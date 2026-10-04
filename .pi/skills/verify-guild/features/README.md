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
- [Officer raid planning](officer-raids.md): templates, weekly series and calendar read-back.
- [Officer loot tables](officer-loot.md): tier list plus empty and populated template pages. Load approved local test data with [Loot data for local verification](loot-data.md) when the populated path is needed.
- [Officer availability](officer-availability.md): heatmap, window finder and not-submitted list.
- [Officer applications](officer-applications.md): inbox, standalone detail, notes and decisions.
- [Officer class needs](officer-needs.md): per-spec status and featured high-need spec.
- [Officer roster](officer-roster.md): member search and main-character editing.

## Shared officer proof

Each officer map starts with `/dev/session?as=officer&back=<page>` after Doctor PASS.
Use `snapshot --full` for large pages and fresh handles after every action, including
`fill`: a previous generation's handle is stale. Wait for the saved result before
navigating away; then use `open` on the full page URL for persistence read-back.
A router refresh, selected control or success toast alone is insufficient.

For access control, switch once with
`open "$BASE/dev/session?as=member&back=/officers/raids"`, then open all six officer
URLs: expect `That page does not exist` (404), not officer content. Include loot and
application detail URLs recorded during the officer run. Restore the officer session
before continuing. This proves the local member restriction, not real Discord roles.

Record actions, expected/observed results, full-reload snapshots and skipped paths
in `$EVIDENCE/notes.md`. Keep one end-state screenshot per feature at both 1440 × 900
and 390 × 844 outside git; attach them to the PR with Cleanup PASS. The baseline
flows were driven with seeded data; additional paths are named explicitly, not
silently counted as verified. Never nudge Discord. For a populated loot-table proof,
follow [Loot data for local verification](loot-data.md); it approves the public import
only into this worktree's throwaway local database.

## Not covered

Discord bot behaviour and the signed bot API (`/api/bot/*`) are not covered. Real
Discord OAuth and Discord-role syncing need staging; local session stubs do not
prove either, nor bot delivery.
