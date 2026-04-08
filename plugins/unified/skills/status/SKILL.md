---
name: status
description: "Use to check current task state, view decision history, browse knowledge base statistics, or resume from a checkpoint"
---

# Status

Check the current state of the unified agent system: active task, decision history, knowledge base stats, and checkpoint resume.

**Core principle:** Know where you are before deciding where to go.

## When to Use

- User runs `/status` to check current state
- Starting a new session and need to understand what's in progress
- After a crash or interruption to resume work
- Browsing the knowledge base for past solutions

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | R |
| reviews | R |

Read-only across all directories. `/status` never modifies state.

## Process

### Step 1: Current Task

Read `progress/current-task.md`. If it exists, display:

```markdown
## Current Task
- Task ID: {id}
- Level: L{n}
- Status: {planning | in-progress | review | qa | shipping | complete}
- Progress: {n}/{total} checklist items done
- Last Activity: {timestamp or "unknown"}
```

If `progress/current-task.md` does not exist, report: "No active task."

### Step 2: Feature List Progress

Read `progress/feature-list.md`. If it exists, display the checklist with completion status:

```markdown
## Feature List
- [x] Step 1 — done
- [x] Step 2 — done
- [ ] Step 3 — pending
- [ ] Step 4 — pending

Progress: 2/4 (50%)
```

### Step 3: Recent Decisions

Scan `decisions/` for the 5 most recent task directories (sorted by intent.md modification time). For each:

```markdown
## Recent Decisions
| Task ID | Level | Intent | Ship Status |
|---------|-------|--------|-------------|
| {id}    | L{n}  | {title from intent.md} | SHIPPED / BLOCKED / pending |
```

### Step 4: Review State

If there are reviews for the current task, summarize:

```markdown
## Reviews ({task_id})
| Reviewer | Verdict | Critical | High | Medium |
|----------|---------|----------|------|--------|
| correctness | PASS | 0 | 0 | 1 |
| security | PASS | 0 | 0 | 0 |
| tests | FAIL | 1 | 0 | 0 |

QA: PASS | FAIL | not run
Janitor: COMPOUNDED | SKIPPED | pending
```

### Step 5: Knowledge Base Statistics

Scan `solutions/` and report:

```markdown
## Knowledge Base
| Category | Solutions | Last Updated |
|----------|-----------|-------------|
| debugging | 12 | 2026-04-07 |
| architecture | 5 | 2026-03-28 |
| performance | 3 | 2026-04-01 |
| security | 7 | 2026-04-05 |
| testing | 4 | 2026-03-15 |
| infrastructure | 2 | 2026-02-20 |
| integration | 6 | 2026-04-03 |

Total: 39 solutions
```

If `solutions/` does not exist or is empty, report: "Knowledge base empty."

### Step 6: Checkpoint Resume

If the user asks to resume and there is an active task:

1. Read the current task state.
2. Identify where work stopped (last checked item in feature list).
3. Read the intent to re-establish context.
4. Report:

```markdown
## Resume Point
Task: {id} — {title}
Last completed: Step {n} — {description}
Next step: Step {n+1} — {description}
Remaining: {count} items

Ready to resume? Run `/work` to continue from step {n+1}.
```

If there is a `progress/handoff.md`, read it for additional context left by the previous session:

```markdown
## Handoff Notes
{contents of handoff.md}
```

### Step 7: Write Handoff (on exit)

When the user ends a session with work in progress, write `progress/handoff.md`:

```markdown
# Handoff
Task: {task_id}
Session End: {timestamp}

## State
- Completed: [list of done items]
- In Progress: [item being worked on, if any]
- Remaining: [list of pending items]

## Notes
[Any context the next session needs — blockers, decisions made, gotchas]
```

This enables clean session resumption.

## Output Format

Present the full status in a single, readable summary. Omit sections that have no data (e.g., skip "Reviews" if no reviews exist, skip "Knowledge Base" if empty).

Example minimal output:
```
## Status
No active task.
No recent decisions.
Knowledge base: empty.

Run `/plan <task>` to start a new task, or `/discover` to clarify requirements first.
```

Example active task output:
```
## Status

### Current Task
Task: fix-auth-token-expiry (L2)
Progress: 3/5 items done
Status: in-progress

### Feature List
- [x] Add token expiry check
- [x] Write failing test for expired tokens
- [x] Implement refresh logic
- [ ] Handle refresh failure gracefully
- [ ] Update API docs

### Next Step
Run `/work` to continue from "Handle refresh failure gracefully."
```

## Important Rules

- **Read-only.** `/status` never writes to `decisions/`, `solutions/`, or `reviews/`. The only write is `progress/handoff.md` on session exit.
- **No sensitive data.** Do not display secrets, tokens, or credentials found in state files.
- **Graceful degradation.** If a directory or file is missing, skip that section. Do not error.
- **Handoff on exit.** If work is in progress when the session ends, always write `handoff.md`.
