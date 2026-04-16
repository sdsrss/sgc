# SGC Positioning (as of v1.2.0)

## Role: 规范层 + 知识引擎

sgc coexists with the `superpowers` (sp) and `gstack` (gs) plugins. It does NOT replace them.

### sgc owns (authoritative)

- **L0-L3 classification** — `sgc plan` classifies every task
- **12 invariants** — scope isolation, immutability, dedup, generator-evaluator separation
- **State layer** — `.sgc/{decisions,progress,solutions,reviews}/` with schema validation
- **Knowledge compression** — dedup (Jaccard ≥0.85) + compound cluster + janitor decisions
- **Solutions base** — append-only, signed, dedup-enforced

### sgc delegates (when sp/gs are available)

| Need | Delegate to |
|------|-------------|
| Deep plan authoring | `sp:writing-plans` |
| TDD discipline | `sp:test-driven-development` |
| Root-cause debugging | `sp:systematic-debugging` |
| Parallel subagents | `sp:dispatching-parallel-agents` |
| Pre-ship comprehensive review | `gs:/review` |
| Git / PR / deploy | `gs:/ship` + `gs:/land-and-deploy` |
| Browser QA / dogfood | `gs:/browse` |
| Design polish | `gs:/design-review` |

### sgc falls back (when sp/gs absent)

Each `sgc` command keeps a working inline implementation. The delegate is a
recommendation surfaced in the command's output, not a hard dependency.

### Non-goals

- sgc is NOT a replacement for sp or gs
- sgc does NOT implement full CI/deploy — that stays in gs
- sgc does NOT manage IDE integration or agent orchestration UIs

## User mental model

> "`sgc` decides the level, enforces the protocol, and records the knowledge.
> `sp` does the thinking and implementation work. `gs` ships it and monitors prod."
