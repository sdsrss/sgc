---
name: sgc-bootstrap
description: "Use when starting any conversation - establishes SGC commands, routes tasks to appropriate skills, and enforces system invariants"
---

# SGC Bootstrap

Load SGC rules, verify `.sgc/` state integrity, route user intent to the correct command.

## When to Use

At the start of every conversation. Runs before any other SGC skill.

## Initialization Sequence

1. **Read [`plugins/sgc/CLAUDE.md`](../../CLAUDE.md)** — authoritative command table, permission matrix, task levels, and the 7 invariants.
2. **Verify `.sgc/` structure** (`decisions/`, `progress/`, `solutions/`, `reviews/`). Auto-created by `ensureSgcStructure` in [`src/dispatcher/state.ts`](../../../../src/dispatcher/state.ts); no action needed unless missing in a non-dispatcher flow.
3. **Check `progress/current-task.md`** — if present, offer to resume or start fresh.
4. **Read `tasks/lessons.md`** (if present) — apply silently.

## Routing Table

| User intent | Command | Trigger phrases |
|-------------|---------|-----------------|
| Requirements unclear | `/discover` (⏸ stub) | "what should...", "clarify", "I'm not sure..." |
| Start / plan a task | `/plan <task>` | "plan", "implement", "build", "add", "fix" |
| Execute approved plan | `/work` | "work", "execute", "begin" |
| Review completed work | `/review` | "review", "check my code" |
| Browser test | `/qa <url>` | "qa", "test the UI", "browser test" |
| Release | `/ship` | "ship", "deploy", "release", "merge" |
| Capture knowledge | `/compound` | "compound", "save solution" |
| Check state | `/status` | "status", "where am I", "resume" |

Ambiguous intent → ask one clarifying question, don't guess.

## Invariant Reminders (authoritative: `plugins/sgc/CLAUDE.md`)

1. Reviewers + QA MUST NOT read `solutions/` (§1)
2. `intent.md` immutable after write (§2)
3. No `solutions/` write without `compound.related` dedup; threshold 0.85 (§3)
4. L3 refuses `--auto`; requires `--signed-by` + interactive `yes` (§4)
5. Reviewer-fail override needs ≥40-char reason (§5)
6. Every janitor decision logged, including skips (§6)
7. Schema validation on every `.sgc/` write (§7)

## Red Flags (shared with `~/.claude/CLAUDE.md` §8)

Intercept / refuse: `rm -rf $VAR`, `DROP`/`DELETE` without WHERE, `git push --force` to `main`, disabling SSL verification, committing `.env` / credentials, plaintext secrets in logs/commits. Full rules in the user's global spec — this skill does not duplicate them.

## Agent Namespacing

When the dispatcher writes a spawn prompt, the agent key in `contracts/sgc-capabilities.yaml` short form (e.g. `reviewer.correctness`) maps to the wire format `sgc:reviewer:correctness`. The dispatcher handles the translation; skills do not hand-assemble names.

## After Bootstrap

Route to the appropriate command based on intent. If no clear command, show the routing table and ask.
