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
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc work $ARGUMENTS
```

`work` does NOT spawn review agents. Call `sgc review` (and `sgc qa` for L2+) when all features are done.

## Delegation hint

For TDD discipline during implementation:
- `sp:test-driven-development` — write failing test first, then implement
