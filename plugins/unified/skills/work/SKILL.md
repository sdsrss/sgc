---
name: work
description: "Use when executing an approved plan - implements with TDD discipline, systematic debugging, worktree isolation, and progress tracking"
---

# Work

Execute an approved plan with TDD discipline, systematic debugging, and progress tracking.

**Core principle:** No production code without a failing test first. No guessing when debugging. Evidence at every step.

## When to Use

- User runs `/work` after `/plan` has produced an approved intent and feature list
- Resuming work on an in-progress task

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | RW |
| solutions | R |
| reviews | -- |

## Pre-Work Checks

1. **Read `progress/feature-list.md`** — this is the task checklist. If it does not exist, refuse and route to `/plan`.
2. **Read `decisions/{task_id}/intent.md`** — understand the approved plan. If it does not exist, refuse and route to `/plan`.
3. **Check task level.** L2+ tasks should use worktree isolation.

## Worktree Setup (L2+)

For L2+ tasks, create an isolated git worktree:

```bash
git worktree add -b feat/<task_id> .worktrees/<task_id> HEAD
```

Work exclusively in the worktree. This prevents polluting the main branch with incomplete work.

## Execution Loop

For each item in `progress/feature-list.md`:

### 1. TDD Cycle: RED -> GREEN -> REFACTOR

**RED — Write Failing Test**

Write one minimal test that describes the expected behavior.

Requirements:
- One behavior per test
- Clear, descriptive name
- Real code, no mocks unless unavoidable

Run the test. Confirm it fails for the right reason (missing feature, not typo or error).

```bash
# Run the specific test
<project-test-command> path/to/test
```

If the test passes immediately, you are testing existing behavior. Fix the test.

**GREEN — Minimal Implementation**

Write the simplest code that makes the test pass. Nothing more.

Do not:
- Add features beyond what the test requires
- Refactor other code
- "Improve" things

Run the test. Confirm it passes. Confirm all other tests still pass.

**REFACTOR — Clean Up**

After green only:
- Remove duplication
- Improve names
- Extract helpers

Keep all tests green. Do not add behavior.

### 2. Mark Progress

After each completed item, update `progress/feature-list.md`:

```markdown
- [x] Step 1 description — DONE (test: path/to/test.ts)
```

### 3. Repeat

Move to the next checklist item.

## Systematic Debugging

When a test fails unexpectedly or a bug is encountered, follow this 4-phase methodology. Do not skip phases.

### Phase 1: Investigate Root Cause

- Read the full error message and stack trace.
- Identify the exact file, line, and function where the failure occurs.
- Check git blame — was this recently changed?

### Phase 2: Pattern Analysis

- Search `solutions/` for similar error signatures.
- Check if this matches a known pattern (off-by-one, race condition, null reference, etc.).
- Look for the same error in other parts of the codebase.

### Phase 3: Hypothesis

Form exactly one hypothesis. State it explicitly:

> "The failure occurs because [X]. If I change [Y], the test should pass because [Z]."

If you cannot form a hypothesis, you need more investigation (return to Phase 1).

### Phase 4: Fix and Verify

- Apply the fix.
- Run the failing test. Confirm it passes.
- Run the full test suite. Confirm no regressions.
- If the fix fails, return to Phase 1 with the new evidence. Do not guess again.

**3-Strike Rule**: Same error with no new hypothesis after 3 attempts → STOP. Stash changes, report the blocker, suggest re-planning.

## Parallel Agent Dispatch

When the feature list contains 2+ independent subtasks with no shared state or sequential dependencies, dispatch parallel agents:

- One agent per independent subtask.
- Each agent works in its own context.
- Use `unified:planner:eng` naming for dispatch: describe the task, the files, and the expected output.
- Collect results and verify each independently before marking progress.

Independent means: changing different files, different functions, different test suites. If two tasks touch the same file, they are NOT independent.

## Evidence Collection

Before marking the task complete, collect evidence:

- [ ] All tests pass (run full suite, capture output)
- [ ] Lint clean (run linter, capture output)
- [ ] Build succeeds (L2+, capture output)
- [ ] No console errors or warnings from the application
- [ ] Each checklist item has a corresponding test

Save evidence summary to `progress/current-task.md`:

```markdown
## Evidence
- Tests: 47/47 pass (0 fail, 0 skip)
- Lint: 0 errors, 0 warnings
- Build: exit 0
- Coverage: [if available]
```

## Completion

When all checklist items are done and evidence is collected:

1. Update `progress/feature-list.md` — all items checked.
2. Update `progress/current-task.md` with evidence summary.
3. Inform the user: "Implementation complete. Run `/review` for independent code review."

## Important Rules

- **No code without a failing test.** Wrote code first? Delete it. Start with the test.
- **No guessing when debugging.** Follow the 4 phases. Hypothesis before fix.
- **Mark progress incrementally.** Update the checklist after each item, not at the end.
- **Do not read `reviews/`.** The work phase has no access to review state.
- **Worktree for L2+.** Do not skip worktree isolation for multi-file changes.
- **Evidence before claims.** "It should work" is not evidence. Run the command, read the output, then claim.
