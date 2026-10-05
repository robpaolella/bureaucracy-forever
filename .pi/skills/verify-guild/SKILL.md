---
name: verify-guild
description: Verify the Bureaucracy guild site's web UI in a real local browser before shipping a feature or investigating a bug; launch an isolated database and server, check safety, drive member flows and retain evidence.
---

# Verify the guild site

Run from the checkout root. Read [the feature index](features/README.md) and the
chrome-devtools-axi skill first; its CLI help is the command reference. Linux with
`/proc`, `ss`, Docker, Node and installed npm dependencies is required. No settings
files are read by this skill or its helper. Never copy, inspect or print secrets.

## Launch

Use a fresh worktree with no existing local database or dev server. One run per
worktree: Next's development output and seeded data are shared within a folder.
The helper refuses an existing database rather than resetting someone else's data.
If a previous verification run is still recorded, run Cleanup against its evidence
directory first; don't delete an unrecognized container to get past the refusal.

```bash
export EVIDENCE=$(mktemp -d /tmp/verify-guild-XXXXXX)
export CHROME_DEVTOOLS_AXI_SESSION="guild-$(basename "$EVIDENCE")"
unset CHROME_DEVTOOLS_AXI_AUTO_CONNECT CHROME_DEVTOOLS_AXI_BROWSER_URL
unset CHROME_DEVTOOLS_AXI_USER_DATA_DIR CHROME_DEVTOOLS_AXI_MCP_SERVER_URL
unset CHROME_DEVTOOLS_AXI_PORT
npx tsx .pi/skills/verify-guild/run.ts launch "$EVIDENCE" | tee "$EVIDENCE/launch.txt"
export BASE=$(node -e 'const s=require(process.argv[1]);console.log(`http://localhost:${s.port}`)' "$EVIDENCE/run.json")
```

Require `Doctor PASS` (a pipe's success alone proves nothing). Launch runs
`npm run db:local` (migrations and fresh sample data in this folder's throwaway
container), then `npm run dev:local -- --hostname 127.0.0.1 --port <free-port>` in
an owned process group. It never assumes port 3000. A port race fails Doctor;
clean up and retry with a new evidence directory. Readiness requires the listener
and the development session route to answer correctly. `server.log` and
`run.json` live in `$EVIDENCE`; don't publish raw logs without checking for secrets.
On any failure, run Cleanup before trying again.

## Doctor

```bash
npx tsx .pi/skills/verify-guild/run.ts doctor "$EVIDENCE" | tee "$EVIDENCE/doctor.txt"
```

Require `Doctor PASS` **before driving** and whenever anything looks wrong. This
read-only check verifies the original process identity, the listening process's
working folder and process group, and its environment-derived database. It reuses
`isLocalDatabaseUrl`, matches both database URLs to the folder-labelled Docker
container's loopback port, and requires local/development mode. It neither prints
URLs with credentials nor opens settings files. It refuses remote databases,
wrong workers, replaced containers, unidentifiable listeners and production mode.
Its HTTP probe uses an invalid session value, so it doesn't set a login cookie.
Never drive staging or production with this skill; real Discord OAuth needs staging
and the separate approval/deploy rules in `AGENTS.md`.

## Drive

```bash
npx -y chrome-devtools-axi newpage "$BASE/dev/session?as=member&back=/members/calendar"
npx -y chrome-devtools-axi pages
```

Select the page ID with the local calendar URL using
`npx -y chrome-devtools-axi selectpage <id>` (newpage may not select it).
Then run `resize 1440 900` and `snapshot` through the same CLI.

Use `localhost` consistently in browser URLs: Next's session redirect uses that
host; mixing it with `127.0.0.1` loses the stub cookie and starts real OAuth.
Use fresh snapshot handles (`@<uid>`) identified by role, label and text; handles
change after navigation. `click @<uid>` is a real user action. Never change app
state via JavaScript, direct database writes or internal action calls.
The **only** test-only endpoint used is the existing login substitute:
`/dev/session?as=STATE&back=/members/calendar`. States are `out` (logged out),
`member` (seeded Redtape), `member-unsubmitted` (no database row, availability
prompt), and `officer` (seeded Ledgerline). Visit it with `open` to switch users;
it returns 404 in production. This does not prove Discord login or role syncing.
Follow [member calendar and sign-up](features/member-calendar.md) for the actual
feature interactions, not merely a visit to a page.

## Evidence

Capture actions **and** results: save snapshots before and after each mutation,
record the raid name/date, entry point, expected/observed response and artifact
paths in `$EVIDENCE/notes.md`. Reopen the detail page and list to prove the saved
response persisted; an optimistic button or success toast alone is insufficient.
Include `console` and `network` output when diagnosing failures; record skipped
paths honestly. No external Discord calls are part of this local proof.

```bash
npx -y chrome-devtools-axi snapshot > "$EVIDENCE/after.txt"
npx -y chrome-devtools-axi resize 1440 900
npx -y chrome-devtools-axi screenshot "$EVIDENCE/member-1440.png"
npx -y chrome-devtools-axi resize 390 844
npx -y chrome-devtools-axi screenshot "$EVIDENCE/member-390.png"
```

Use `resize`, **not** `emulate`. Evidence stays outside git and survives teardown.
Attach both screenshots and cleanup output to the PR; name the evidence directory.

## Design check

For any change people see, follow [Maestro's shared design check](/git/maestro/skills/design-check/SKILL.md)
with [this site's routes, roles and state recipes](design-check.md) and
[guild reviewer checklist](design-reviewer.md). The shared skill owns main/build and
approved-design comparisons, critique, independent verdict and PR evidence. This
supplements, not replaces, the behaviour proof above.

## Editable offline page snapshot

A snapshot is a **static starting point**, not an approved design or a working React
app. Capture only this run's sample data: no production/staging pages, real member
names, private data, cookies or settings. Do not export a browser profile. The saved
HTML must include its styles, fonts and images, need no running server or network,
and remain editable as ordinary HTML/CSS. App scripts are removed; interactions for
a future clickable design must be deliberately authored, not treated as working saves.

1. Follow Launch and Doctor unchanged, then the feature map and
   [state recipes](design-check.md). Record route, role, fixture name/date, generated
   ID, real user steps, timezone and state in `$EVIDENCE/notes.md`. For the raid-detail
   example, log in as `member`, open `/members/calendar`, click a seeded raid title
   and record its actual `/members/calendar/<id>` URL. Select that page explicitly.
   Reach menus/dialogs with clicks, never DOM edits. A state without a safe recipe
   blocks capture; ask the conductor rather than inventing test data or state.
2. Capture the running page at 390×844 and 1440×900, waiting for fonts/images after
   each resize. Keep both full-page screenshots and a snapshot. Use the same route,
   role and state at both widths. Return to 1440×900 for export. If resizing changes
   the app's DOM rather than only its CSS, compare carefully: this recipe does not
   promise that one frozen DOM can reproduce both variants.
3. Install the pinned export tool **outside the repo**, then inject its serializer
   into the selected local page. It reads rendered state; it does not call app
   actions or write the database. Keep responsive CSS, hidden elements and alternate
   fonts/images rather than optimizing for just the capture viewport.

```bash
export SNAPSHOT_TOOL=$(mktemp -d /tmp/guild-snapshot-tool-XXXXXX)
npm install --prefix "$SNAPSHOT_TOOL" --no-save --ignore-scripts single-file-cli@2.16.4
node --input-type=module > "$EVIDENCE/capture.js" <<'JS'
import { pathToFileURL } from 'node:url';
const { script } = await import(pathToFileURL(
  `${process.env.SNAPSHOT_TOOL}/node_modules/single-file-cli/lib/single-file-bundle.js`));
console.log(`await page.eval(${JSON.stringify(`() => { ${script}\n globalThis.singlefile = singlefile; }`)});`);
console.log(`console.log(await page.eval(async () => {
  await document.fonts.ready;
  await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  const result = await singlefile.getPageData({
    removeHiddenElements: false, removeUnusedStyles: false,
    removeUnusedFonts: false, removeAlternativeFonts: false,
    removeAlternativeMedias: false, removeAlternativeImages: false,
    blockScripts: true, compressHTML: false, insertMetaCSP: true,
    saveOriginalURLs: false, removeFrames: true,
    removedElementsSelector: 'nextjs-portal,script'
  });
  return result.content;
}));`);
JS
npx -y chrome-devtools-axi run < "$EVIDENCE/capture.js" > "$EVIDENCE/snapshot.html"
node - "$EVIDENCE/snapshot.html" <<'JS'
const fs = require('node:fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
if (!/^<!doctype html>/i.test(html) || !html.includes('</html>'))
  throw new Error('Export failed; inspect the output, do not save it as a design');
if (/<script\b/i.test(html))
  throw new Error('Unexpected script in static export; inspect before continuing');
JS
```

A failed font/image decode is not waived by the export: the visual/offline check
below must confirm the assets. Frames are omitted; if a required view uses one,
stop and report that limitation. Next's developer overlay is intentionally omitted.
Do not use this to capture videos, transient loading frames or an unsupported state
and claim a faithful result.

4. Review the exported HTML for sample-data-only content and no executable app
   scripts. Save it as `design/<issue>-<name>/index.html` **in the design task**, with
   `brief.md`, `decisions.md` and `screenshots/` per AGENTS.md. Do not overwrite an
   existing design: use an evidence copy and ask the conductor how to incorporate it.
   For recipe verification alone, keep the file in `$EVIDENCE`; do not commit a
   throwaway design. Keep source CSS classes and inline styles editable, not a
   screenshot masquerading as HTML. Exported navigation links still point at the
   temporary localhost server (or external sites); the design task must replace them
   with deliberate local prototype navigation before claiming a clickable flow.
5. Run Cleanup below (including the browser stop) and require Cleanup PASS. Then
   start a **fresh named browser session**, open the file from disk and explicitly
   select it. Set network Offline, reopen the file, and capture at both widths:

```bash
export CHROME_DEVTOOLS_AXI_SESSION="guild-offline-$(basename "$EVIDENCE")"
npx -y chrome-devtools-axi newpage "file://$EVIDENCE/snapshot.html"
npx -y chrome-devtools-axi pages
# Select the file's ID, not the initial blank tab:
npx -y chrome-devtools-axi selectpage <id>
npx -y chrome-devtools-axi emulate --network Offline
npx -y chrome-devtools-axi open "file://$EVIDENCE/snapshot.html"
npx -y chrome-devtools-axi resize 390 844
npx -y chrome-devtools-axi screenshot "$EVIDENCE/offline-390.png" --full-page
npx -y chrome-devtools-axi resize 1440 900
npx -y chrome-devtools-axi screenshot "$EVIDENCE/offline-1440.png" --full-page
npx -y chrome-devtools-axi network > "$EVIDENCE/offline-network.txt"
npx -y chrome-devtools-axi stop
```

Here `emulate` sets **network only**; use `resize` for viewport sizes. In CLI 0.1.37,
network emulation can make `screenshot` report a missing saved path even though it
wrote the image. Check that the requested file exists and opens; record this CLI
warning, never turn networking back on to make the proof pass. A missing/unreadable
file still blocks proof. `network` must explicitly report Offline (the browser's
`navigator.onLine` property alone does not describe CDP network throttling).
Wait for fonts
and image decoding before each screenshot, as on the running page. Open all four
images with an image-capable read tool and compare the entire pages, exact wording,
state, typography, images and responsive layout. Record dimensions and differences;
missing assets, changed layout or attempted external resource loads block the recipe
proof. Audit resource-bearing attributes/CSS as well as network output: a blocked
request is not an embedded asset. Ordinary navigation links are not offline flows;
do not click them during this read-only comparison. Keep the network log, stopped
server proof and screenshots with the evidence and attach both widths to the PR.
The offline browser must also be stopped on failure.

## Cleanup

Stop only this run's named browser session and recorded server/database:

```bash
npx -y chrome-devtools-axi stop
npx tsx .pi/skills/verify-guild/run.ts cleanup "$EVIDENCE" | tee "$EVIDENCE/cleanup.txt"
ls -l "$EVIDENCE"
```

Require `Cleanup PASS`: the recorded server group and container are gone. The
helper checks process identity before signalling and container ID/owner before
`npm run db:local:down`. If identity changed, stop and report it; never kill by
process name or remove a different database. Keep all evidence, including failed
attempts. Never rerun `db:local` against pre-existing data just to tidy up.

## Helpers

`run.ts` is executable (or invoke with `npx tsx` as above); it provides `launch`,
`doctor`, `cleanup`, each with the evidence directory argument. Run guard tests:
`npx vitest run .pi/skills/verify-guild/run.test.ts`.
Keep this map current with pstack's `maintain-verification-skill` when routes,
labels or flows change. Add new feature maps only when actually driven.
