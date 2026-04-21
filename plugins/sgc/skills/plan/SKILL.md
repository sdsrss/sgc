---
name: plan
description: "Use when starting any non-trivial task - classifies task level (L0-L3), runs appropriate planning agents, produces intent document and execution plan"
---

# Plan

Classify the task, dispatch planning agents, produce an immutable intent + feature list.

**Core principle:** every plan step names concrete files and changes — no placeholders.

## When to Use

- User runs `/plan <task>`
- Starting any new task that requires implementation
- After `/discover` confirms requirements

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R+W |
| progress | RW |
| solutions | R |
| reviews | R |

## Routing

This skill invokes the dispatcher; process is authoritative in code, not prose.

- **Behavior**: [`src/commands/plan.ts`](../../../../src/commands/plan.ts) (`runPlan`)
- **Classifier**: [`src/dispatcher/agents/classifier-level.ts`](../../../../src/dispatcher/agents/classifier-level.ts)
- **Planner cluster**: `planner.eng` (L1+), `+planner.ceo +researcher.history` (L2+), `+planner.adversarial` (L3)
- **Manifests**: [`contracts/sgc-capabilities.yaml`](../../../../contracts/sgc-capabilities.yaml)
- **Invariants**: §2 intent immutable · §4 L3 requires `--signed-by` + interactive `yes` · §11 classifier rationale specific
- **Levels, permissions, escalation**: [`plugins/sgc/CLAUDE.md`](../../CLAUDE.md)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
bun src/sgc.ts plan "$ARGUMENTS"
```

For L3 tasks, the CLI will prompt for `--signed-by` and require interactive `yes`.
To override auto-classified level: `--level L0|L1|L2|L3` (upgrade-only).

## Delegation hint

sgc plan produces intent.md + feature-list.md. For deep **implementation** planning:
- `sp:writing-plans` — task-by-task execution plan
- `sp:brainstorming` — clarify ambiguous scope before planning

sgc owns classification + intent; sp owns the deep plan body.
