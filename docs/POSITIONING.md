# SGC Positioning

## Role: self-contained engineering super-plugin + knowledge engine

sgc is a **self-contained engineering workflow + knowledge engine** for Claude Code. As of **v1.24.0** it installs in one command and runs **standalone** (Node ≥ 18, no `bun`) — it does **not require** `superpowers` (sp), `gstack` (gs), or any separate Compound-Engineering tooling. It owns the full plan → work → review → QA → ship → compound loop and has natively absorbed the best of all three: the **GS-N arc (7/7)** of gstack-style capabilities, **Tier-1 Superpowers** verification + systematic-debugging discipline, and the **Compound Engineering** capture → promote → reuse loop.

If sp/gs happen to be installed, sgc can *optionally* hand the deepest work to them as a richer path — but that is **interop, not a dependency**.

### sgc owns (authoritative)

- **L0-L3 classification** — `sgc plan` classifies every task
- **13 invariants** — scope isolation, immutability, dedup, generator-evaluator separation, two-tier event audit (§13)
- **State layer** — `.sgc/{decisions,progress,solutions,reviews,ship-failures,canaries}/` with schema validation
- **Knowledge compression** — dedup (Jaccard ≥0.85) + compound cluster + janitor decisions
- **Solutions base** — append-only, signed, dedup-enforced
- **Capture → promote loops** — `sgc watch-ci-failure` (CE-3 ship-failure capture) + `sgc canary` (GS-1 post-publish capture); `sgc compound --from-ship-failure` / `--from-canary` promote each capture into `solutions/` through the **same Invariant §3 write-gate** (real `compound.related` spawn → `DedupStamp` → `writeSolution`). Promoted preventions feed back into `planner.adversarial` via CE-1 on next L3 plan.
- **Root-cause debug** — `sgc debug` walks investigate → analyze → hypothesize → implement, enforcing Iron Law #3 at close (root_cause + fix_commit + verify_command all required).

### Optional interop (richer path if sp/gs are installed — never required)

sgc runs every capability below natively and standalone; nothing breaks when sp/gs are absent. When they are present, sgc surfaces the upstream tool as an *optional* richer path. As of v1.25.0 sgc has a native **TDD-ledger** — `sgc work --done` enforces a recorded prior-RED (or an explicit waive) and promotes the RED→GREEN pair into the knowledge corpus — but it *records* the loop rather than *running* it; the honest remaining native gaps are **deep plan authoring** and **running** the full TDD loop. If sp is installed it stays the richer path for those.

| Capability | Native in sgc | Optional richer path (if installed) |
|------------|---------------|-------------------------------------|
| Task classification + planner cluster | `sgc plan` (fused L2/L3 decision, GS-3) | — |
| Completion verification gate | `sgc work --done` close-gate (Tier-1 sp absorb, v1.19.0) | `sp:verification-before-completion` |
| Systematic debugging | `sgc debug` 4-phase walker (GS-4) | `sp:systematic-debugging` |
| Independent review | `sgc review` (reviewer cluster) | `gs:/review` |
| Browser QA | `sgc qa` (vendored `browse` binary) | `gs:/browse` |
| Security review | `sgc cso` (GS-5) | — |
| Ship + post-publish chain | `sgc ship` / `sgc land` / `sgc canary` (GS-1/7) | `gs:/ship` + `gs:/land-and-deploy` |
| Intent framing / brainstorm | `sgc discover --template` (GS-6) | `sp:brainstorming` |
| Deep plan authoring | light (planner cluster) | `sp:writing-plans` ← thinnest native gap |
| TDD discipline | native ledger (records prior-RED → GREEN, feeds CE); does not *run* tests | `sp:test-driven-development` runs the loop |
| Parallel subagents | — | `sp:dispatching-parallel-agents` |
| Design polish | — | `gs:/design-review` |

Every `sgc` command keeps a working inline implementation; the optional path is a recommendation surfaced in the command's output, not a hard dependency.

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

- sgc is **not a CI/CD platform** — it orchestrates ship, post-publish canary, and CI-failure capture, but it is not a build runner or deploy target
- sgc does **not** manage IDE integration or agent-orchestration UIs
- sgc does **not** require, bundle, or re-host sp/gs source — interop with them is optional (see above); the only vendored upstream code is the `browse` binary (see "Vendored components")

## User mental model

> "`sgc` is the engineering layer — it classifies the task, enforces the right process for its risk level, runs review / QA / security / ship, and compounds the knowledge, **standalone and from one install**. `sp` and `gs` are optional power-ups for the deepest planning / TDD / browser work, not prerequisites."
