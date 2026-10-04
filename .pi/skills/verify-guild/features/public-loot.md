# Public loot rules

Visitors can read the guild's loot policy, jump to each section, expand common questions,
and start an application from the policy page.

## Sub-features

- `loot-policy`: policy summary and decision factors at `/loot`.
- `loot-toc`: `On this page` anchors for summary, council, decision factors, trials and
  questions.
- `loot-faq`: expandable answers under `Questions we get`.
- `loot-apply-link`: the policy-page application entry point.

## How to get to it (user POV)

- Select `Loot rules` in the site navigation or footer for `/loot`.
- Use the `On this page` links to jump through the policy, then select a question under
  `Questions we get` to reveal its answer.
- Select `Open the form →` to begin the Raider application path; that flow is mapped in
  [application](application.md).

## Driving it with chrome-devtools-axi

Preconditions: Launch and Doctor PASS; set `BASE` and the isolated browser session as in
`../SKILL.md`. This is public; no dev session is required.

- **Enter.** `open "$BASE/loot"`; resize to `1440 900`, then `snapshot`. Expect `Loot
  rules`, the `On this page` navigation, `In short`, `How we weigh a drop`, `Questions we
  get`, and `Open the form →`.
- **Navigate.** Click a table-of-contents link from the fresh snapshot, such as `How we
  weigh a drop`, and confirm that its named heading is visible. Return to the questions
  section using its TOC link or a new `open "$BASE/loot#faq"`.
- **Expand a result.** Click a closed disclosure, for example `What happens to
  bind-on-equip drops and patterns?`. Snapshot after the click and confirm its answer is
  now present and the disclosure is expanded.
- **Proof.** Save before/after snapshots. Capture the expanded result at `resize 1440 900`
  and `resize 390 844`; record the question, observed answer and any TOC destination in
  the evidence notes.

## Gotchas

- The first FAQ is open by default. Choose another closed question so the interaction
  visibly proves the disclosure changed.
- The policy text is public content, not a persisted mutation; reopening the page is not
  a persistence test.
- `Open the form →` may show a client-side form dialog if a signed-in session is active.
  Do not submit from this map; use the direct application path for its write/read-back
  proof.
