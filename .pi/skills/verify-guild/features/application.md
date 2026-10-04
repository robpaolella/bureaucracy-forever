# Applying to the guild

A prospective member chooses the Raider or Social path, supplies the required details,
and sees a submitted summary after the application is stored.

## Sub-features

- `apply-gate`: `/apply?path=raider|social` shows the correct sign-in or join-server
  status for an out-of-session visitor.
- `application-form`: an in-server applicant selects a path and completes the matching
  required fields.
- `application-submitted`: a successful application reaches `/recruitment/submitted`
  with its character and path summary.

## How to get to it (user POV)

- Select `Apply to raid`, `Apply as a Raider`, `Apply as Social`, or `Open the form →`
  from a public page. They all lead to `/apply?path=raider|social`.
- A visitor who has not signed in sees `Sign in with Discord`; a signed-in person outside
  the guild sees the join-server state. An in-server member sees the form.
- After submitting, the visitor lands on `Your application is in` and can use `Back to
  the site`.

## Driving it with chrome-devtools-axi

Preconditions: Launch and Doctor PASS; set `BASE` and the isolated browser session as in
`../SKILL.md`. Use a new, distinctive character name in the fresh local database. Never
submit a real person's details.

- **Gate.** `open "$BASE/dev/session?as=out&back=/apply?path=raider"`, then `snapshot`.
  Expect `Sign in with Discord` and `Join Discord`, not the form. Do not follow the
  external Discord link.
- **Enter the form.** `open "$BASE/dev/session?as=member-unsubmitted&back=/apply?path=social"`,
  then `snapshot`. Expect the `Apply` form, `Social` selected, editable `FIRST NAME`
  and `SECOND NAME`, and the read-only `DISCORD HANDLE` from the stub session.
- **Choose and complete a path.** Keep `Social` for the shortest full path, or choose
  `Raider` and complete its class, spec, logs, availability, pitch and acknowledgement.
  Use `fill @<uid>` and `click @<uid>` only from a fresh snapshot. Save a before-submit
  snapshot. For Social, fill first name, second name and optionally `ANYTHING WE SHOULD
  KNOW?`; never fill the hidden Website field.
- **Submit and prove the result.** Click `Submit application`, wait for navigation, then
  snapshot. Expect `Your application is in`, the submitted character and the chosen path.
  The destination itself is the persisted-result read-back; record its URL, character and
  path. Do not submit a duplicate just to test an error state.
- **Proof.** Save before/after snapshots. Capture the submitted page at `resize 1440 900`
  and `resize 390 844`, and record the path, non-sensitive sample name and result in the
  evidence notes.

## Gotchas

- `member-unsubmitted` is the local stub needed to reach the form. It is not proof of
  Discord OAuth, guild membership lookup, role syncing or Discord delivery.
- The direct `/apply` route is the reliable proof path. A public-page Apply control may
  open the same form in a modal when JavaScript is active.
- Submission writes an application to the local database. Keep the proof name clearly
  synthetic and use the run's fresh database only.
