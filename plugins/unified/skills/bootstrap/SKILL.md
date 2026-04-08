---
name: unified-bootstrap
description: "Use when starting any conversation - establishes unified agent commands, routes tasks to appropriate skills, and enforces system invariants"
---

# Unified Agent Bootstrap

Initialize the unified agent system, verify state integrity, and route user intent to the correct command.

## When to Use

At the start of every conversation. This skill runs before anything else.

## Initialization Sequence

1. **Read CLAUDE.md** to load system rules and invariants.
2. **Check `.unified/` directory** exists in the project root. If missing, create the structure:
   ```
   .unified/
     decisions/
     progress/
     solutions/
     reviews/
   ```
3. **Read `progress/current-task.md`** if it exists. If a task is in-progress, inform the user and offer to resume or start fresh.
4. **Read `tasks/lessons.md`** if it exists. Apply lessons silently.

## Master Routing Table

| User Intent | Route To | Trigger Phrases |
|-------------|----------|-----------------|
| Requirements unclear, need to explore | `/discover` | "what should...", "I'm not sure...", "clarify", "requirements" |
| Start a task, plan work | `/plan <task>` | "plan", "implement", "build", "add feature", "fix bug" |
| Execute approved plan | `/work` | "start working", "execute", "begin", "do it" |
| Review completed work | `/review` | "review", "check my code", "code review" |
| Test in browser | `/qa <target>` | "test", "QA", "browser test", "check UI" |
| Ready to release | `/ship` | "ship", "deploy", "release", "merge" |
| Capture knowledge | `/compound` | "compound", "save knowledge", "document solution" |
| Check state | `/status` | "status", "where am I", "what's current", "resume" |

When the user's intent is ambiguous, ask one clarifying question. Do not guess.

## Red Flags Table

Intercept and warn before executing:

| Pattern | Risk | Action |
|---------|------|--------|
| `rm -rf` with variables | Data loss | REFUSE without explicit confirmation |
| `DROP TABLE`, `DELETE FROM` without WHERE | Data loss | REFUSE |
| `git push --force` | History loss | REFUSE |
| `git reset --hard` | Work loss | Warn, suggest `git stash` |
| `git checkout .`, `git restore .` | Uncommitted work loss | Warn |
| Plaintext secrets in code/logs/commits | Security breach | STOP, use placeholder, suggest rotation |
| Disabling SSL verification | Security | REFUSE, no override |
| Unknown remote scripts | Security | REFUSE, no override |
| Committing `.env` or credentials | Security | REFUSE, no override |

## Invariant Reminders

These are non-negotiable. Verify compliance at every routing decision:

1. **Generator-Evaluator Separation**: `/review` and `/qa` MUST NOT read `solutions/`. No exceptions.
2. **Decisions Are Immutable**: Once `intent.md` is written, it cannot be edited. Changed intent = new task.
3. **Solutions Require Dedup**: No write to `solutions/` without `unified:compound:related` running dedup first. Similarity threshold 0.85.
4. **L3 Forbids --auto**: Any L3 command with `--auto` is refused. Human signature required.
5. **Reviewer Override Requires Human**: When a reviewer returns fail and ship proceeds, override must include human signature + reason (>=40 chars).
6. **Every Janitor Decision Is Logged**: Even skip decisions must be written to `reviews/{task_id}/janitor/`. Silent skips are forbidden.
7. **Schema Validation on Every Write**: All writes to `.unified/` are validated against schema before commit. No lenient mode.

## Permission Matrix

Before any command reads or writes `.unified/` state, verify it has permission per the matrix in CLAUDE.md. Violations are hard errors, not warnings.

## Automation Tiers

| Tier | Default | Override | Examples |
|------|---------|----------|----------|
| Mechanical | Auto, no interruption | None | State file I/O, reviewer spawn, L0 full flow |
| Decision | Confirm first | `--auto` skips | Level classification, compound trigger, L2 ship |
| Forced | Always human | **No override** | L3 ship, solutions deletion, reviewer fail override |

## After Bootstrap

Once initialized, route to the appropriate skill based on user intent. If the user provides no specific command, show the command table and ask what they want to do.
