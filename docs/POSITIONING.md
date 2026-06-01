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
| Completion verification | `sgc work --done` close-gate — `verify_command` required to mark a feature done, absorb (`sp:verification-before-completion` v1.19.0) |
| Post-publish chain (sgc-self) | `sgc land` — chains `watch-ci-failure` + `canary`, zero gh-CLI dep |
| Pre-ship security review | `sgc cso` — infra-first audit, daily/comprehensive modes, absorb (GS-5 v1.17.0) |
| Intent framing / brainstorm | `sgc discover --template` — framing selector, absorb (GS-6 v1.16.0) |
| Multi-perspective plan decision | `sgc plan` fused decision — deterministic planner-cluster fusion, absorb (GS-3 v1.18.0) |
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
sgc-native — **for the GS-N dispatcher commands listed below, no gstack
source is copied, no gstack binary is called, and no gstack dependency is
introduced** (this scope is the *absorb arc*; it does NOT cover the
separately-vendored `browse` tool — see "Vendored components" below). The
gs delegate stays the recommended path when
gs is installed (see delegate table); the sgc-native version is the
zero-dep fallback. Shipped: **GS-1 `sgc canary`** (post-publish health
check, v1.11.0 → v1.11.1 PATH-shadow fix) + **GS-1.1 `sgc compound
--from-canary`** (canary → solutions promote, v1.12.0) + **GS-1.2**
dispatcher dedup robustness against malformed corpus (v1.12.1) +
**GS-2 `sgc handoff --auto`** (heuristic `.sgc/` scan → `tasks/<slug>-paused.md`
for §11 SESSION post-compaction recovery, v1.13.0) + **GS-7 `sgc land`**
(zero-dep post-publish chain orchestrator: `watch-ci-failure` + `canary`
fail-fast, v1.14.0) + **GS-4 `sgc debug`** (4-phase systematic-debugging
walker, v1.15.0) + **GS-6 `sgc discover --template`** (framing-selector for
intent drafting — `clarifier.discover` extension, v1.16.0) + **GS-5 `sgc
cso`** (infrastructure-first pre-ship security review, daily/comprehensive
modes, v1.17.0) + **GS-3 `sgc plan` fused decision** (deterministic
multi-perspective fusion of `planner.{ceo,eng,adversarial}` → single
`fused_verdict` + ranked concerns at L2/L3, v1.18.0 — model-A: no LLM, no
cross-evaluator back-channel, Invariant §1 untouched; advisory at the L3
human gate). **GS-N absorb arc complete (7/7).**

### Vendored components (distinct from the absorb arc)

`plugins/sgc/browse/` is a **vendored** gstack-derived headless-browser CLI —
the compiled binary (`bun run build:browse`) that backs `sgc qa`'s browser
checks (`qa.browser`). Unlike the GS-N absorb arc above (sgc-native heuristic
re-implementations), this is upstream gstack browser source carried in-tree as
a build input, not a heuristic absorption and not a runtime gs dependency.

- Its `test/` directory is **upstream gstack's own suite**. sgc vendored the
  tool but not every fixture that suite expects, so a subset of those tests
  cannot pass here. They are **not part of sgc's CI gate** — both
  `.github/workflows/{test,publish}.yml` run only
  `bun test tests/dispatcher [tests/eval]`, and `bunfig.toml` scopes a bare
  `bun test` to `tests/` so the vendored suite is not swept by default.
- The `gs:/browse` delegate (see delegate table) remains the richer path when
  gstack is installed; the vendored binary is the zero-dep fallback for
  `sgc qa`.

### Non-goals

- sgc is NOT a replacement for sp or gs
- sgc does NOT implement full CI/deploy — that stays in gs
- sgc does NOT manage IDE integration or agent orchestration UIs

## User mental model

> "`sgc` decides the level, enforces the protocol, and records the knowledge.
> `sp` does the thinking and implementation work. `gs` ships it and monitors prod."
