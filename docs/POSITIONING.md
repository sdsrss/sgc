# SGC Positioning

## Role: 规范层 + 知识引擎

sgc coexists with the `superpowers` (sp) and `gstack` (gs) plugins. It does NOT replace them.

### sgc owns (authoritative)

- **L0-L3 classification** — `sgc plan` classifies every task
- **13 invariants** — scope isolation, immutability, dedup, generator-evaluator separation, two-tier event audit (§13)
- **State layer** — `.sgc/{decisions,progress,solutions,reviews,ship-failures,canaries}/` with schema validation
- **Knowledge compression** — dedup (Jaccard ≥0.85) + compound cluster + janitor decisions
- **Solutions base** — append-only, signed, dedup-enforced
- **Capture → promote loops** — `sgc watch-ci-failure` (CE-3 ship-failure capture) + `sgc canary` (GS-1 post-publish capture); `sgc compound --from-ship-failure` / `--from-canary` promote each capture into `solutions/` through the **same Invariant §3 write-gate** (real `compound.related` spawn → `DedupStamp` → `writeSolution`). Promoted preventions feed back into `planner.adversarial` via CE-1 on next L3 plan.
- **Root-cause debug** — `sgc debug` walks investigate → analyze → hypothesize → implement, enforcing Iron Law #3 at close (root_cause + fix_commit + verify_command all required).

### sgc delegates (when sp/gs are available)

| Need | Delegate to |
|------|-------------|
| Deep plan authoring | `sp:writing-plans` |
| TDD discipline | `sp:test-driven-development` |
| Root-cause debugging | `sp:systematic-debugging` |
| Parallel subagents | `sp:dispatching-parallel-agents` |
| Pre-ship comprehensive review | `gs:/review` |
| Git / PR / deploy | `gs:/ship` + `gs:/land-and-deploy` |
| Systematic-debug execution | `sgc debug` — 4-phase walker, absorb (GS-4 v1.15.0) |
| Post-publish chain (sgc-self) | `sgc land` — chains `watch-ci-failure` + `canary`, zero gh-CLI dep |
| Browser QA / dogfood | `gs:/browse` |
| Design polish | `gs:/design-review` |

### sgc falls back (when sp/gs absent)

Each `sgc` command keeps a working inline implementation. The delegate is a
recommendation surfaced in the command's output, not a hard dependency.

### GS-N absorb arc (sgc-native heuristic absorptions)

Selected gstack-style capabilities are re-implemented in sgc as small,
heuristic, dependency-free dispatcher commands when (a) the capability is a
natural fit for sgc's capture → promote → CE-1 loop, and (b) the gstack
implementation isn't a forced dependency for sgc users. Absorptions are
sgc-native — **no gstack source copied, no gstack binary called, no gstack
dependency introduced**. The gs delegate stays the recommended path when
gs is installed (see delegate table); the sgc-native version is the
zero-dep fallback. Shipped: **GS-1 `sgc canary`** (post-publish health
check, v1.11.0 → v1.11.1 PATH-shadow fix) + **GS-1.1 `sgc compound
--from-canary`** (canary → solutions promote, v1.12.0) + **GS-1.2**
dispatcher dedup robustness against malformed corpus (v1.12.1) +
**GS-2 `sgc handoff --auto`** (heuristic `.sgc/` scan → `tasks/<slug>-paused.md`
for §11 SESSION post-compaction recovery, v1.13.0) + **GS-7 `sgc land`**
(zero-dep post-publish chain orchestrator: `watch-ci-failure` + `canary`
fail-fast, v1.14.0) + **GS-4 `sgc debug`** (4-phase systematic-debugging
walker, v1.15.0).

### Non-goals

- sgc is NOT a replacement for sp or gs
- sgc does NOT implement full CI/deploy — that stays in gs
- sgc does NOT manage IDE integration or agent orchestration UIs

## User mental model

> "`sgc` decides the level, enforces the protocol, and records the knowledge.
> `sp` does the thinking and implementation work. `gs` ships it and monitors prod."
