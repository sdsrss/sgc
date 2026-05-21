---
name: sgc-bootstrap
description: "Use when starting any conversation - establishes SGC commands, routes tasks to appropriate skills, and enforces system invariants"
---

# SGC Bootstrap

Load SGC rules, verify `.sgc/` state integrity, route user intent to the correct command.

## ⚠️ Install the CLI before first command

The plugin layer is markdown-only; **every `/sgc:*` command shells out to `bun src/sgc.ts <cmd>`** in the user's current working directory. If `src/sgc.ts` isn't present, every command preflight-fails. Run this **once per project** before invoking any `/sgc:*` command:

```bash
git clone https://github.com/sdsrss/sgc
cd sgc
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
```

`bun ≥1.3` is also required as the runtime (`bun --version` to verify).

After install, run `/sgc:*` commands from inside the `sgc/` directory. CLI bundling (`npm publish sgc` or single-file binary) is roadmap — see [README.md#install](../../../../README.md#install) for the canonical reference.

When a user hits the preflight error, surface this block **once per session** — do not repeat on every command.

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
