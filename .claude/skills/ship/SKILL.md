---
name: ship
description: Finish a unit of work — verify it, review it, commit it, and open a pull request. Use when a task is complete and ready for review. Runs checks and the code-reviewer before anything is pushed.
---

# Ship

## Current state

- Branch: !`git rev-parse --abbrev-ref HEAD`
- Uncommitted: !`git status --short`
- Commits on this branch: !`git log --oneline main..HEAD 2>/dev/null | head -20`

## Steps

Do these in order. If a step fails, fix it and re-run that step — do not skip
ahead.

1. **Refuse to proceed on `main`.** If the branch above is `main` or `master`,
   stop. Create a branch, move the work onto it, and continue.

2. **Run the checks.** In order, stopping at the first failure:

   ```
   npm run lint
   npm run typecheck
   npm run test
   npm run build
   ```

   If a script does not exist in `package.json`, say so and skip that one — do
   not invent a substitute command.

3. **Verify it actually works.** For any UI change, render the affected routes
   in a browser and compare them against the matching artboard in
   `design-handover/reference/` at 1440 and 390 widths. Reading the code back is
   not verification. Report what you checked.

4. **Commit what is outstanding.** Group the remaining changes into logical
   commits using the Conventional Commit format in
   `.claude/rules/git-workflow.md`. Never one catch-all commit.

5. **Review.** Hand the branch diff to the `code-reviewer` subagent. Fix
   everything it marks Blocking. For Worth-fixing items, either fix them or list
   them in the PR body as deliberate follow-ups. Do not open the PR with
   unaddressed blocking findings.

6. **Push and open the PR:**

   ```
   git push -u origin HEAD
   gh pr create --title "<conventional commit subject>" --body "..."
   ```

   The body covers **What**, **Why**, **How to verify** (exact routes and
   widths), and **Risks / follow-ups**.

7. **Report back** with the PR URL, what the checks said, and anything you left
   for me to decide. Do not merge — that is mine.
