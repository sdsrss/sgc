---
name: status
description: "Use to check current task state, view decision history, browse knowledge base statistics, or resume from a checkpoint"
---

# Status

Read-only summary of the current `.sgc/` state: active task, level, last activity.

**Core principle:** know where you are before deciding where to go.

## When to Use

- User runs `/status` to check current state
- Starting a new session; need to understand what's in progress
- After a crash or interruption, to resume

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | R |
| reviews | R |

Read-only across the board (the only write is `progress/handoff.md` on explicit session end).

## Routing

- **Behavior**: `sgc status` dispatched in [`src/sgc.ts`](https://github.com/sdsrss/sgc/blob/main/src/sgc.ts) → reads `progress/current-task.md` + `progress/feature-list.md` via [`src/dispatcher/state.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/state.ts)
- **Graceful degradation**: missing file = skipped section, never an error
- **Invariants**: n/a (read-only)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs status
```

For richer views (reviews per task, knowledge-base stats), read the files directly — `status` intentionally stays minimal and fast.

## Delegation hint

No delegation — read-only command. Use `/plan`, `/work`, `/review` etc. to take action.
