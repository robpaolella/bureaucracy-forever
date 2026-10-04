# Phone and desktop design check

Required before a PR for any change people see, including copy, states and shared
components. This complements the feature's behaviour checks; screenshots alone do
not prove saving, keyboard access or Discord login. Follow `SKILL.md` for safe local
launch, Doctor, browser isolation and Cleanup on **every** checkout used here.

## 1. Map the comparison

Read the issue (including comments), `DESIGN.md` and `PRODUCT.md`. DESIGN.md summarizes
the live site's design; the live site remains the authority, and PRODUCT.md records
Robert's approved product facts. Handover artboards are background, not a competing
baseline. Note undecided differences for Robert; don't “repair” them speculatively.
A new kind of UI element requires Robert's go-ahead before implementation. Neither
impeccable nor a reviewer can grant that approval.

In an evidence directory outside git, make a manifest with:

- Main and branch commit IDs; source files/components changed.
- Every affected route, audience (`out`, `member`, `member-unsubmitted`, `officer`),
  entry point and visible state. Shared components need their affected consumers,
  not only a component playground. Include changed dialogs, empty/error states and
  open menus; record unreachable states rather than silently omitting them.
- Expected change, relevant DESIGN.md/PRODUCT.md sections, and any approval link.
- Before/after screenshot paths for **each route × role × state × width**.

For example, the calendar list requires member and officer captures at both widths;
month view is desktop-only. Use the feature map to identify meaningful states.

## 2. Capture main, then the branch

Fetch main and record its SHA. Keep your working branch in place; use a separate,
fresh detached worktree at `origin/main` for the before run. Install dependencies
there, then follow Launch and Doctor from `SKILL.md`. Never reuse another worker's
server, database or browser. Main and branch each get their own fresh seeded database
and evidence subdirectory. No settings files are copied or inspected.

Navigate through `/dev/session?as=ROLE&back=/ROUTE` for local roles (`out` for public
pages). Select the new page explicitly, wait for content, fonts and images to settle,
and confirm the route/role/state in a snapshot. Keep seed data, selected dates,
viewer timezone and state comparable; record time-dependent differences. If main
cannot render a new route, capture its predecessor/entry point and mark the missing
baseline honestly. A failed baseline launch is a blocker, not a new-route exception.

For each manifest entry, on main and again on the branch:

```bash
npx -y chrome-devtools-axi resize 390 844
npx -y chrome-devtools-axi screenshot "$EVIDENCE/PHASE-ROUTE-ROLE-STATE-390.png" --full-page
npx -y chrome-devtools-axi resize 1440 900
npx -y chrome-devtools-axi screenshot "$EVIDENCE/PHASE-ROUTE-ROLE-STATE-1440.png" --full-page
```

Replace the uppercase filename placeholders. Use `resize`, never `emulate`. Open the
images with the image-capable read tool: file creation is not visual inspection.
Record actual dimensions and inspect the entire page for clipping, overflow, blank
content and incorrect roles. Capture additional viewport/detail images if full-page
scaling hides a defect; retain the full-page images. Clean up each run with Cleanup
PASS, keeping evidence. Leave a throwaway checkout in place if it contains work;
never discard someone else's changes or delete evidence to tidy up.

## 3. Critique the changed surface

Load `/git/maestro/vendor/impeccable/skills/impeccable/SKILL.md`, then its
`reference/critique.md`. Run its context launcher once per session with an **existing
source file** as `--target` (a route such as `/members/calendar` can be mistaken for
an absolute filesystem path). Confirm it loaded this checkout's DESIGN.md and
PRODUCT.md; if not, read them directly and disclose the missed context.

Follow critique's independent Assessment A (design) and Assessment B (detector/browser)
flow, then synthesize. Give both the manifest and project context, not each other's
findings. Keep detector output out of A's assessment. Use isolated browser sessions
and new tabs; Doctor still applies. Browser overlays are presentation-only, never a
way to alter application state. Keep screenshots and critique evidence outside git;
if the critique tool archives under `.impeccable/critique/`, do not commit its generated
report. Report skipped or failed assessment steps, not an invented clean result.

Fix in-scope findings in one batch and refresh the affected captures. Existing issues
outside this change go to `backlog.md` and the PR, not an unsolicited redesign.
Escalate anything requiring a new element or an undecided design choice to Robert.
The independent verdict below is a separate gate, not replaced by critique scores.

## 4. Independent verdict

Use a fresh, read-only run, with the checked-in instructions here. Resolve the model
**each time**; don't hard-code today's provider, model or thinking level:

```bash
node /git/maestro/routing/route.ts role design-check
node /git/maestro/scripts/read-only-run.ts "$PWD" review \
  "$PWD/.pi/skills/verify-guild/design-reviewer.md" \
  "Issue: #NUMBER. Read the issue and comments. Manifest: /absolute/path/manifest.md. Read every listed image. Context: $PWD/DESIGN.md and $PWD/PRODUCT.md. Review the branch against the recorded main SHA." \
  -- <model arguments from the route command's pi field>
```

Save the exact resolved command, output, exit code and model in the evidence directory.
Start the reviewer **only** through this launcher, never a bare Pi or helper-agent
substitute. It refuses missing/empty instructions before starting Pi. A missing
model, unreadable image, failed launcher or incomplete verdict blocks the design gate.
If the launcher reports CHANGED (exit 3), stop and tell Robert what changed; don't
quietly restore it. Its checks are guardrails, not a security sandbox.

The reviewer returns **PASS** or **FIXES** with numbered, evidenced items. Fix all
in-scope items as one batch, refresh affected screenshots and re-run once on the same
model, supplying the original verdict and numbered fixes. Ask it to re-check **only
those fixes**, retaining their original numbers. If any still fail, stop and report
to the conductor (Robert if working directly), rather than looping. Don't relabel
an in-scope failure as backlog to obtain a pass.

## 5. PR evidence

Include the route/role/state matrix, main/branch SHAs, design reference and widths,
critique summary, model and full verdict, any limitations and cleanup results.
Embed the **after** screenshots at both widths for every affected view; include the
before screenshots wherever the change is visual. Upload with `gh pr create --attach`
(or the installed `gh` attachment support), using the same local image paths in the
body's Markdown. Local `/tmp` links alone are not viewable evidence for Robert.
Check the rendered PR images; if upload fails, report the blocked evidence rather
than claiming attachments exist. Do not publish raw logs or private member data.

Use the per-PR Vercel Preview link per AGENTS.md. Public pages can be checked there;
local signed-in captures use session stubs and do not prove real Discord login.
Signed-in verification needing real OAuth or migrations follows the separate staging
rules. A design check alone does not authorize deploying to staging or merging.
