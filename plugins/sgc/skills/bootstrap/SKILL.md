---
name: sgc-bootstrap
description: "Use when starting a conversation in a project that uses sgc (has a .sgc/ directory) - establishes SGC commands, routes tasks to appropriate skills, and enforces system invariants"
---

# SGC Bootstrap

Load SGC rules, verify `.sgc/` state integrity, route user intent to the correct command.

## The CLI ships with the plugin

Every `/sgc:*` command runs the CLI bundled with this plugin (`bin/sgc.mjs`). It needs Node ≥ 22.19 on PATH, and no `bun`. Two options need more: `/sgc:ship --pr` needs the GitHub CLI (`gh`), and `--browse` (real-browser QA) needs Playwright and a browser, which the plugin does not ship: `/sgc:qa <url> --browse` then reports `concern` (browser unavailable). For real-browser QA use the npm install, which includes Playwright: run `npx playwright install chromium`, then `sgc qa <url> --browse` in a terminal, as the task's first qa run (qa reports are append-only). If the bundled CLI is missing, a command falls back to a global `sgc`, and then to `bun src/sgc.ts` inside a source checkout of sgc.

**Outside Claude Code** (CI, `npx`, a plain terminal):

```bash
npm install -g @sdsrs/sgc
sgc --version
```

See https://github.com/sdsrss/sgc#install for the canonical install reference.

If a command fails with "sgc CLI not found", show this block **once per session** — do not repeat it on every command.

## When to Use

At the start of a conversation in a project that uses sgc (one with a `.sgc/` directory). Runs before any other SGC skill.

## Initialization Sequence

1. **Check the `.sgc/` structure** (`decisions/`, `progress/`, `solutions/`, `reviews/`). The sgc CLI creates it on first use; nothing to do when part of it is missing.
2. **Check `.sgc/progress/current-task.md`** — if present, offer to resume or start fresh.
3. **Read `tasks/lessons.md`** (if present) — apply silently.

## Routing Table

| User intent | Command | Trigger phrases |
|-------------|---------|-----------------|
| Requirements unclear | `/sgc:discover` (⏸ stub) | "what should...", "clarify", "I'm not sure..." |
| Start / plan a task | `/sgc:plan <task>` | "plan", "implement", "build", "add", "fix" |
| Execute approved plan | `/sgc:work` | "work", "execute", "begin" |
| Review completed work | `/sgc:review` | "review", "check my code" |
| Browser test | `/sgc:qa <url>` | "qa", "test the UI", "browser test" |
| Release | `/sgc:ship` | "ship", "deploy", "release", "merge" |
| Capture knowledge | `/sgc:compound` | "compound", "save solution" |
| Check state | `/sgc:status` | "status", "where am I", "resume" |

Ambiguous intent → ask one clarifying question, don't guess.

## Invariant Reminders (7 of sgc's 13 invariants)

1. Reviewers + QA MUST NOT read `solutions/` (§1)
2. `intent.md` immutable after write (§2)
3. No `solutions/` write without `compound.related` dedup; threshold 0.85 (§3)
4. L3 refuses `--auto`; requires `--signed-by` + interactive `yes` (§4)
5. Reviewer-fail override needs ≥40-char reason (§5)
6. Every janitor decision logged, including skips (§6)
7. Schema validation on every `.sgc/` write (§7)

## Red Flags

Intercept / refuse: `rm -rf $VAR`, `DROP`/`DELETE` without WHERE, `git push --force` to `main`, disabling SSL verification, committing `.env` / credentials, plaintext secrets in logs/commits.

## After Bootstrap

Route to the appropriate command based on intent. If no clear command, show the routing table and ask.
