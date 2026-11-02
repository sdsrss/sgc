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

- **Behavior**: [`src/commands/plan.ts`](https://github.com/sdsrss/sgc/blob/main/src/commands/plan.ts) (`runPlan`)
- **Classifier**: [`src/dispatcher/agents/classifier-level.ts`](https://github.com/sdsrss/sgc/blob/main/src/dispatcher/agents/classifier-level.ts)
- **Planner cluster**: `planner.eng` (L1+), `+planner.ceo +researcher.history` (L2+), `+planner.adversarial` (L3)
- **Manifests**: [`contracts/sgc-capabilities.yaml`](https://github.com/sdsrss/sgc/blob/main/contracts/sgc-capabilities.yaml)
- **Invariants**: §2 intent immutable · §4 L3 requires `--signed-by` + interactive `yes` · §11 classifier rationale specific
- **Levels, permissions, escalation**: [`plugins/sgc/CLAUDE.md`](https://github.com/sdsrss/sgc/blob/main/plugins/sgc/CLAUDE.md)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
command -v sgc.mjs >/dev/null 2>&1 || { IFS= read -r SGC_PLUGIN_BIN <<'SGC_PLUGIN_ROOT'
${CLAUDE_PLUGIN_ROOT}/bin
SGC_PLUGIN_ROOT
PATH=$SGC_PLUGIN_BIN:$PATH; }
command -v sgc.mjs >/dev/null 2>&1 || { echo "sgc CLI not found: the sgc plugin's bin/sgc.mjs could not be reached. In a terminal in this project, run claude plugin list. If sgc@sgc shows a Read from line, or Claude Code was started with --plugin-dir, restore bin/sgc.mjs in that directory. Otherwise reinstall it at the Scope shown there: claude plugin uninstall sgc@sgc --scope <scope>, then claude plugin install sgc@sgc --scope <scope>" >&2; exit 1; }

sgc.mjs plan "$ARGUMENTS"
```

For L3 tasks, the CLI will prompt for `--signed-by` and require interactive `yes`.
To override auto-classified level: `--level L0|L1|L2|L3` (upgrade-only).

## Delegation hint

sgc plan produces intent.md + feature-list.md. For deep **implementation** planning:
- `superpowers:writing-plans` (superpowers plugin, if installed) — task-by-task execution plan
- `superpowers:brainstorming` (superpowers plugin, if installed) — clarify ambiguous scope before planning

sgc owns classification + intent; sp owns the deep plan body.
