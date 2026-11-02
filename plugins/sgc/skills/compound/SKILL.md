---
name: compound
description: "Use to capture knowledge from solved problems - extracts structured solution documents via 4 specialized agents with dedup enforcement"
---

# Compound

Run the 4-agent compound cluster (`context` / `solution` / `related` / `prevention`), dedup-check against existing solutions, write the result atomically.

**Core principle:** knowledge not captured is lost; polluted knowledge is worse. Dedup and quality are non-negotiable.

## When to Use

- Automatically triggered by `janitor.compound` after `/ship`
- User runs `/compound` manually to extract from the current task
- User runs `/compound --force` to bypass dedup hit

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | RW |
| reviews | R |

## Routing

- **Behavior**: [`src/commands/compound.ts`](https://github.com/sdsrss/sgc/blob/main/src/commands/compound.ts) (`runCompound`)
- **4-agent cluster**: [`src/dispatcher/agents/compound.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/agents/compound.ts)
- **Dedup**: [`src/dispatcher/dedup.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/dedup.ts) — SHA-256 signature + Jaccard on tags ∪ problem tokens; threshold 0.85
- **State**: `writeSolution` in [`src/dispatcher/state.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/state.ts) — refuses writes without a valid `dedup_stamp`
- **Invariants**: §3 dedup required · §10 cluster is a transaction (any throw = no write)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
if   command -v sgc.mjs >/dev/null 2>&1;         then sgc() { sgc.mjs "$@"; }
elif [ -f "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" ]; then sgc() { node "${CLAUDE_PLUGIN_ROOT}/bin/sgc.mjs" "$@"; }
elif command -v sgc >/dev/null 2>&1;             then :
elif [ -f src/sgc.ts ];                          then sgc() { bun src/sgc.ts "$@"; }
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

sgc compound $ARGUMENTS
```

Outcomes: `compound` (new entry) · `update_existing` (dedup hit; `source_task_ids` merged, `times_referenced` bumped) · `skip` (only via janitor's decision).

## Delegation hint

Automatic after ship via janitor. Manual for reruns when you need to re-extract knowledge from a completed task.
