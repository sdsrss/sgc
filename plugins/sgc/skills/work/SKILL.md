---
name: work
description: "Use when executing an approved plan - implements with TDD discipline, systematic debugging, worktree isolation, and progress tracking"
---

# Work

Execute an approved plan; track completion in `progress/feature-list.md`.

**Core principle:** no production code without a failing test first. Evidence at every step.

## When to Use

- User runs `/work` after `/plan` produced an intent and feature list
- Resuming work on an in-progress task

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | RW |
| solutions | R |
| reviews | — |

`reviews/` is intentionally locked — work must not self-select based on pending review verdicts.

## Routing

- **Behavior**: [`src/commands/work.ts`](https://github.com/sdsrss/sgc/blob/main/src/commands/work.ts) (`runWork`)
- **State I/O**: feature-list + current-task files in [`src/dispatcher/state.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/state.ts)
- **System overview**: [`plugins/sgc/CLAUDE.md`](https://github.com/sdsrss/sgc/blob/main/plugins/sgc/CLAUDE.md)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs work $ARGUMENTS
```

`work` does NOT spawn review agents. Call `sgc review` (and `sgc qa` for L2+) when all features are done.

## Delegation hint

For TDD discipline during implementation:
- `superpowers:test-driven-development` (superpowers plugin, if installed) — write failing test first, then implement
