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

- **Behavior**: [`src/commands/compound.ts`](../../../../src/commands/compound.ts) (`runCompound`)
- **4-agent cluster**: [`src/dispatcher/agents/compound.ts`](../../../../src/dispatcher/agents/compound.ts)
- **Dedup**: [`src/dispatcher/dedup.ts`](../../../../src/dispatcher/dedup.ts) — SHA-256 signature + Jaccard on tags ∪ problem tokens; threshold 0.85
- **State**: `writeSolution` in [`src/dispatcher/state.ts`](../../../../src/dispatcher/state.ts) — refuses writes without a valid `dedup_stamp`
- **Invariants**: §3 dedup required · §10 cluster is a transaction (any throw = no write)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
bun src/sgc.ts compound $ARGUMENTS
```

Outcomes: `compound` (new entry) · `update_existing` (dedup hit; `source_task_ids` merged, `times_referenced` bumped) · `skip` (only via janitor's decision).

## Delegation hint

Automatic after ship via janitor. Manual for reruns when you need to re-extract knowledge from a completed task.
