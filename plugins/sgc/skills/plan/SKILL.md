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

## Invocation

```bash
sgc plan "<task description>" \
  [--motivation "<≥20 words>"] \
  [--signed-by <id>] \        # L3 only (refused otherwise = OK because classifier picks level)
  [--level L0|L1|L2|L3]        # upgrade-only; downgrades refused
```

L3 also prompts interactively for `yes` confirmation and refuses `--auto`.
