---
name: ship
description: "Use when ready to release - verifies all evidence, runs ship gate, handles deployment, triggers compound janitor"
---

# Ship

Verify all evidence, run the ship gate, handle deployment, and trigger the compound janitor.

**Core principle:** Shipping without evidence is shipping without confidence. Every claim must be backed by proof collected during `/work` and `/review`.

## When to Use

- User runs `/ship` after `/work` and `/review` are complete
- All implementation is done and reviewed

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R+W |
| progress | R |
| solutions | -- |
| reviews | RW |

## Process

### Step 1: Pre-Ship Checklist

Verify each item. Do not proceed if any required item fails.

```markdown
## Ship Gate Checklist

### Required (all must pass)
- [ ] `decisions/{task_id}/intent.md` exists and is valid
- [ ] `progress/feature-list.md` — all items checked
- [ ] `progress/current-task.md` — evidence section present
- [ ] Tests: full suite passes (re-run now, do not trust cached results)
- [ ] Lint: 0 errors (re-run now)
- [ ] Build: exit 0 (L2+, re-run now)

### Review Gate
- [ ] `reviews/{task_id}/review/` contains reviewer reports
- [ ] All reviewers: PASS (or override with human signature)
- [ ] No unaddressed critical findings

### QA Gate (if applicable)
- [ ] `reviews/{task_id}/qa/report.md` exists (if task involves UI)
- [ ] QA verdict: PASS (or known issues documented)
- [ ] No FATAL console errors
```

**Re-run verification commands fresh.** Do not trust results from earlier in the session. Run tests, lint, and build NOW and confirm the output.

### Step 2: Handle Failures

If any required check fails:

- **Missing evidence**: "Ship gate failed: {item} is missing. Run `/work` or `/review` to collect it."
- **Test failure**: "Ship gate failed: {n} tests failing. Fix and re-run `/work`."
- **Reviewer fail without override**: "Ship gate failed: reviewer {type} returned FAIL. Address findings or provide override (human signature + reason >= 40 chars)."

If the user provides an override for a reviewer failure:

1. Validate the reason is >= 40 characters.
2. Log the override to `reviews/{task_id}/review/override.md`:
   ```markdown
   # Reviewer Override
   Task: {task_id}
   Reviewer: {type}
   Override by: human
   Reason: {user's reason}
   Date: {timestamp}
   ```
3. Proceed with the ship.

### Step 3: L3 Human Signature

For L3 tasks, regardless of all checks passing:

> "This is an L3 task. Ship requires your explicit approval. Type 'ship approved' to proceed."

Do not accept `--auto` for L3. This is Invariant #4.

### Step 4: Write Ship Decision

Create `decisions/{task_id}/ship.md`:

```markdown
# Ship Decision
Task: {task_id}
Level: L{n}
Verdict: SHIPPED | BLOCKED
Date: {timestamp}

## Evidence Summary
- Tests: {pass}/{total} pass
- Lint: {errors} errors
- Build: exit {code}
- Reviewers: {pass}/{total} pass
- QA: PASS | FAIL | N/A
- Overrides: {list or "none"}

## Changes
[Summary of what shipped — files changed, features added]
```

### Step 5: Deploy

Execute deployment based on the project's deployment method:

1. If in a worktree, merge back to the working branch:
   ```bash
   git checkout <main-branch>
   git merge feat/<task_id>
   ```
2. Commit with a conventional commit message: `<type>(<scope>): <subject>`
3. Push if configured and permitted.

If deployment fails, report `[BLOCKED]` with the error and do not proceed to janitor.

### Step 6: Trigger Compound Janitor

After successful ship, automatically dispatch `sgc:janitor:compound` to decide whether to extract knowledge.

The janitor evaluates:

**Skip if:**
- Level is L0
- Diff < 20 lines AND no reviewer flagged "novel"
- Existing solution with similarity > 0.85 (routes to update-existing instead)
- Task failed with no new knowledge

**Compound if:**
- Any reviewer severity >= medium
- Level >= L2 AND shipped successfully
- Novel bug signature not in `solutions/` index
- User forced with `--force`

**Default**: Skip. Missing a compound is recoverable. Polluting `solutions/` is not.

The janitor's decision (including skips) MUST be logged to `reviews/{task_id}/janitor/compound-decision.md`. Silent skips are forbidden (Invariant #6).

### Step 7: Cleanup

After ship and janitor:

1. Remove worktree if used:
   ```bash
   git worktree remove .worktrees/<task_id>
   ```
2. Update `progress/current-task.md` to reflect completion.
3. Report final status to the user.

## Important Rules

- **Fresh verification.** Re-run all checks at ship time. Do not trust cached results from `/work`.
- **No silent overrides.** Every override is logged permanently with human signature and reason.
- **L3 always requires human.** No `--auto`, no shortcut. Human types "ship approved."
- **Janitor always logs.** Even "skip" decisions are written to disk. Silent skips violate Invariant #6.
- **Ship decision is immutable.** Once `ship.md` is written, it cannot be edited.
- **Deploy failure is not ship failure.** If deploy fails, the ship decision is BLOCKED, not SHIPPED. Fix and re-run `/ship`.
