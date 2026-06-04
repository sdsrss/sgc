# Four-化 Metrics Scorecard — Design Spec (Phase 3)

**Date:** 2026-06-04
**Phase:** 3 (four-化 metrics — `docs/ROADMAP.md`)
**Status:** approved (brainstorming), self-reviewed (8-agent adversarial pass 2026-06-04), pending implementation plan

## Goal

ROADMAP Phase 3 asks the four 化 (规范化 / 智能化 / 自动化 / 高效化) to become
**measurable with baselines, surfaced honestly** (no baseless adjectives, per
§10 / E-E-A-T). Today they exist only as prose in
`docs/CAPABILITY-ABSORPTION-AUDIT.md §5` — hand-computed, partly stale (高效化
still reads "2 步 · bun≥1.3", written 2026-05-29, **before** Phase 0 v1.24.0
replaced bun with a node bundle and collapsed install to one channel).

This phase adds **`sgc metrics`**: a product self-scorecard that computes each
化 from **git-tracked product artifacts**, emits a tracked **baseline**, and is
guarded against drift by `sgc doctor` + CI — the same anti-drift shape sgc
already uses for the bundle (build:cli parity) and the invariant-source parity
(doctor G/I).

The deliverable is the ROADMAP Phase 3 line: *"a metrics surface (extend
`sgc reflect`, or a `sgc metrics` view) + honest README numbers with baselines."*

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| 受众 / 目的 | **sgc 产品自评记分卡** — measure how far *the sgc product* achieves the four 化. NOT user-project effect metrics; NOT a two-layer (product + per-project) view. |
| 落点 | **New `sgc metrics` command.** NOT extend `doctor` (pass/fail guard semantics ≠ numeric scorecard) or `reflect` (per-decision prior-art audit, furthest semantics). |
| 数据基础 | **Pure git-tracked product attributes.** NOT runtime `.sgc/` aggregation (per-machine, git-ignored → cannot baseline) and NOT a `--local` runtime annex. This guarantees README numbers are stable, reproducible, and CI-verifiable. |
| 雄心 | **B: scorecard + CI anti-drift guard.** NOT A (minimal, hand-synced README) or C (B + trend history). |

## Non-goals (explicit not-doing)

- **NOT** trend history (C rejected — 四化 change slowly, only per-release; a
  tracked history file bloats and adds little signal → YAGNI).
- **NOT** user-project effect metrics ("did sgc reduce your bugs") — cannot
  honestly attribute, and is not the product self-scorecard the user chose.
- **NOT** runtime `.sgc/` aggregation (capture→promote closure rate, prior-art
  surface rate). These are genuinely more "operational" but their values are
  per-machine and git-ignored, so they cannot back a stable README baseline.
  Recorded here as deliberately deferred, not overlooked.
- **NOT** new instrumentation / 埋点 — every 化 is read from an artifact that
  already exists under version control.
- **NOT** a single 0–10 composite score. That is `gs:/health`'s shape (weighted
  composite over lint/type/test). This scorecard reports **four independent
  headline numbers, each with its own baseline and 口径**, because the four 化
  are not commensurable.

## The four metrics (all from git-tracked artifacts)

Each 化 has **one headline figure** plus a baseline/denominator so the number is
never bare (§10 Specificity). Exact integer counts are **computed by the command
at runtime from the artifact**; the values below are verified-as-of-spec
(8-agent adversarial pass, 2026-06-04) and are frozen into the baseline file
during TDD.

### 规范化 (standardization) — `machine_enforced / total invariants`

- **Source:** `contracts/invariant-enforcement.yaml`.
- **Computation:** parse the YAML; numerator = invariant entries with
  `machine_enforced: true`, denominator = total invariant entries (§1–§13).
- **口径 trap (must encode):** a naive `grep -c machine_enforced` returns **15**,
  not 13, because **two header comment lines** carry the literal — line 9
  (`machine_enforced_count / 13`) and line 16 (`` `machine_enforced: true`
  invariant the `tests`… ``). The structural truth is 13 entries (12
  `machine_enforced: true` + §12's lone `false`); `grep -c 'machine_enforced:
  true'` happens to return 13 only by coincidence (12 keys + 1 comment). The
  metric **MUST parse the YAML structure**, not grep. `sgc doctor` check G
  already parses correctly (`doctor.ts:321` `yamlLoad`, loops §1..§13, counts
  `e["machine_enforced"] === true`) and reports **12/13** (§12 is procedural,
  the sole `false`).
- **Baseline:** **12 / 13**.

### 智能化 (intelligence) — `LLM-invokable subagents / total manifested`

- **Source:** `contracts/sgc-capabilities.yaml` (the `subagents` map).
- **Computation:** numerator = subagents whose entry has a **truthy
  `prompt_path`** (a real on-disk prompt file). This is the *only* honest
  LLM-backed signal: `src/dispatcher/spawn.ts:426-437` routes to a real LLM
  backend (anthropic-sdk / openrouter) **only** when `prompt_path` is truthy;
  any `prompt_path: null` entry always falls to the inline-stub heuristic, so it
  is **not** LLM-backed regardless of its `status`. Denominator = total
  manifested subagents.
- **Verified current values:** **11 LLM-invokable / 23 manifested.** The 11:
  `clarifier.discover`, `classifier.level`, `planner.{ceo,eng,adversarial,decompose}`,
  `researcher.history`, `reviewer.correctness`, `compound.{context,solution,prevention}`.
  The other 12 are NOT LLM-invokable: 6 synthesized-prompt heuristic-stub
  reviewers (`reviewer.{security,performance,tests,maintainability,migration,infra}`
  — `status: implemented` but `prompt_path: null`, run as keyword matchers per
  `reviewer-specialists.ts:57-71`), 2 `status: slot-only`
  (`reviewer.adversarial`, `reviewer.spec`), 1 `status: manual-only`
  (`janitor.archive`), and 3 heuristic workers with no prompt
  (`qa.browser`, `compound.related`, `janitor.compound`).
- **口径 (must encode):** key the numerator on **`prompt_path` truthiness, not
  `status`** — this sidesteps the status-token spelling entirely. The manifest's
  real `status` enum is `implemented` (or absent = implemented) / **`slot-only`**
  / **`manual-only`** (`src/dispatcher/types.ts:240`; **not** bare `slot`/`manual`).
  If any future logic *does* test status, use prefix matching
  (`status.startsWith("slot")`) so a `slot` vs `slot-only` drift can't silently
  miscount.
- **Honesty note (§10 / E-E-A-T):** this is a **capacity** proxy — *how many
  agents can actually invoke an LLM* — **not a quality measurement**. The 6
  heuristic-stub reviewers are deliberately excluded from the numerator (they do
  not field LLM reasoning yet). Genuine quality metrics (plan-fusion verdict
  quality, classifier accuracy on an eval set) need an eval harness and depend on
  runtime/eval data, which the pure-tracked constraint excludes; the scorecard
  states this as future work so the number is not read as a quality claim. The
  audit's "10 LLM agents" (`CAPABILITY-ABSORPTION-AUDIT.md:157`) is stale by
  one — the real-LLM count is now **11** (the v2b `planner.decompose` addition);
  the v1.27.0 reviewer trio did **not** add LLM-invokable agents (they ship as
  heuristic stubs). Correct the audit line to 11 when this lands.
- **Baseline:** **11 / 23** (frozen during TDD; numerator recomputed from the
  live manifest, not hardcoded).

### 自动化 (automation) — `automated steps / total steps in the loop`

- **Source:** `src/dispatcher/loop.ts` — the exported `STEPS` array and the
  `MANUAL_GATES` set.
- **Computation:** denominator = `STEPS.length` (the exported
  `STEPS = [plan, work, review, qa, ship, compound]`, **6**); numerator = steps
  **not** in `MANUAL_GATES` (`{work, ship}`, **2**) = **4**. Headline **4 / 6**.
- **Required code edit (wiring):** `STEPS` is exported but `MANUAL_GATES`
  (`loop.ts:56`) is a **plain unexported `const`** — so "enumerate from loop.ts,
  do not hardcode" is unsatisfiable as-is. The implementation MUST **export
  `MANUAL_GATES`** (or add `export const AUTOMATED_STEPS = STEPS.filter(s =>
  !MANUAL_GATES.has(s))`) from `loop.ts`, and `metrics.ts` imports both. This is
  a real source edit, listed in the Wiring checklist + Acceptance criteria below.
- **口径 (must encode):** the 2 manual gates (`paused_work` — operator
  implements the work; `paused_ship` — §4 L3 human sign-off) are **intentionally
  retained** (a spec requirement, not a deficiency); the headline annotates
  "2 intentional manual gates (work, ship) — by design, not a gap" so the number
  isn't read as "drive to zero". The denominator is the **static `STEPS.length`
  (6)**, NOT a per-run executed count — the L0 carve-out (`loop.ts:387-395`
  skips review/qa/ship/compound for L0 plans) is a runtime-level optimization,
  not a change to the loop's defined step set (§9 parallel-path acknowledgement).
- **Baseline:** **4 / 6** (2 manual gates).

### 高效化 (efficiency) — `install steps · runtime dep · bundle size`

- **Source:** `package.json` (`engines`), the built bundle
  `plugins/sgc/bin/sgc.mjs` (byte size, recorded at build time), the install path.
- **Computation:**
  - `engines.node` read via the **bundled `import packageJson from
    "../package.json"`** (bun inlines the object into the bundle — `sgc.ts:21`
    precedent), NOT a fresh on-disk read (which fails in the plugin-install
    layout where only `plugins/sgc/` is present).
  - **bundle byte-size** is recorded into the baseline at `--write-baseline`
    time (source checkout, after `build:cli`) via `statSync(resolve(root,
    "plugins/sgc/bin/sgc.mjs")).size`; runtime `sgc metrics` reports the
    **recorded** value (rendered rounded, e.g. "~886 KB"). It is **display-only,
    excluded from the doctor drift diff** (`diffMetrics` ignores
    `efficiency.bundle_bytes`) — bundle size changes on every `src/` edit, so
    drift-gating it would turn the baseline into a per-commit tripwire and
    contradict "四化 change slowly". Only the slow-changing structural fields
    (`install_steps`, `runtime_node` + the other three 化) are drift-gated.
  - install-step count = **1** (drift-gated).
- **口径 (must encode):** **1 install step** (`/plugin install sgc` ships the
  self-contained node bundle and every `/sgc:*` command runs via plain `node` —
  no `npm i -g`, no bun; a one-time `/plugin marketplace add` registers the
  source, counted as registry setup, not a per-install step). This is the honest
  current state (verified: `node plugins/sgc/bin/sgc.mjs --version` → 1.27.0,
  exit 0; resolver in all `plugins/sgc/commands/*.md` leads with
  `$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs`). The `docs/融合.txt` "two-step install"
  passage describes the **pre-Phase-0** state and is obsolete.
- **Corrects stale audit value:** audit §5 still reads "2 步 · bun≥1.3"
  (`CAPABILITY-ABSORPTION-AUDIT.md:144,166`); verified current state is
  **1 step · node ≥ 18 (bun dropped) · ~886 KB** (`907,657` bytes at spec time).
  The scorecard supersedes the stale prose; correct the audit line when this lands.
- **TTHW:** an *optional, one-shot, measured* note (install → first successful
  command), recorded as a documented figure, **not** an auto-computed metric —
  it requires a clean-environment timing run, which is not a tracked artifact.
- **Baseline:** install steps = 1, runtime = node ≥ 18, bundle bytes (exact at
  build), frozen during TDD.

## Command shape

- `sgc metrics` — human-readable scorecard rendered from the **shipped**
  `metrics/metrics-baseline.yaml` (a frozen product snapshot — stable and
  layout-independent; this is what makes the README numbers reproducible).
- `sgc metrics --json` — the same snapshot as a stable machine form (README
  injection).
- `sgc metrics --write-baseline` — **live-compute** the four 化 from the source
  artifacts and (re)write `metrics/metrics-baseline.yaml`. The deliberate refresh
  step, run in a source checkout after `build:cli`.
- **Read-only** otherwise: no LLM, no agent spawn, no events. `--write-baseline`
  is the sole writing path. Runtime `sgc metrics` only *reads* the snapshot — it
  does **not** recompute (a product scorecard is a frozen snapshot; the live
  compute + drift gate live in dev/CI, see Anti-drift). Same read-only nature as
  `reflect`.

### Files (new + edited units)

| Unit | File | Responsibility |
|---|---|---|
| CLI glue | `src/commands/metrics.ts` (new) | Flag parsing (`--json` / `--write-baseline`), stdout/stderr shaping. **Mirrors `src/commands/reflect.ts` in CLI/format shape only** (see read-path note — reflect reads on-disk; metrics reads input contracts via the embedded resolver). |
| Pure compute | `src/dispatcher/metrics.ts` (new) | Compute the four 化, format human + JSON, read/write the baseline, diff for the doctor check. |
| Command registration | `src/sgc.ts` (edit) | `defineCommand` block + entry in the `subCommands: {}` map (`sgc.ts:895-915`). |
| Automation source | `src/dispatcher/loop.ts` (edit) | **Export `MANUAL_GATES`** (or `AUTOMATED_STEPS`) so 自动化 can derive without hardcoding. |
| Slash parity | `plugins/sgc/commands/metrics.md` (new) | doctor check H slash↔CLI parity (`reflect.md` is the mirror). |
| Drift gate | `src/commands/doctor.ts` (edit) | New `!hasSource`-gated metrics-parity check (see Anti-drift). |
| Baseline | `metrics/metrics-baseline.yaml` (new, tracked) | The frozen snapshot — runtime data source for `sgc metrics`. Generated banner; `metrics/` added to npm `files`. |
| Ship allowlist | `package.json` (edit) | Add `"metrics/"` to `files` so the baseline ships. |

### Read-path / source-of-truth note (per channel)

Two read paths by design — keep them separate (conflating them was the first
draft's bug):

- **`sgc metrics` / `--json` at user runtime (any channel):** read **only the
  shipped `metrics/metrics-baseline.yaml`** and render it (`readBaseline(root)`).
  No live source reads, no `readContract`, no cross-layout `statSync`. The
  baseline is a frozen product self-description; rendering it is stable and
  identical across plugin-install / npm / source layouts.
- **`sgc metrics --write-baseline` + the `sgc doctor` drift check (dev/CI-only):**
  `computeMetricsLive(root)` reads the **on-disk** sources fresh —
  `readFileSync(resolve(root, "contracts/invariant-enforcement.yaml"))` +
  `yamlLoad`; `loadSpec(readFileSync(resolve(root, "contracts/sgc-capabilities.yaml")))`
  (the same preprocessor `getCapabilities` uses, so `<<: *reviewer_base` merges
  resolve identically); the imported `STEPS` / `MANUAL_GATES` symbols;
  `readFileSync(resolve(root, "package.json"))`; `statSync` of the built bundle.
  Fresh on-disk reads (not the embedded/frozen `readContract`) are what let the
  drift check catch "source edited without baseline regen", and what make the
  TDD fixtures work (a test mutates a fixture under a temp `root` and the
  recompute sees it). The doctor check is `!hasSource`-gated (skips in a shipped
  bundle), identical to checks D–I (`doctor.ts:179,201,253,311,380,431`).

So: runtime renders the shipped snapshot (stable); dev/CI live-computes from
on-disk sources and diffs against that snapshot (the drift gate). The baseline
**ships** (`metrics/` added to `package.json` `files`) precisely because it is
the runtime data source.

## Anti-drift mechanism (B 档 core — corrected)

- **Tracked baseline snapshot:** `metrics/metrics-baseline.yaml` — a **new
  top-level tracked dir**, NOT `contracts/` (verified: all 5 existing
  `contracts/*` are hand-authored inputs with no generated banner; doctor F/G/I
  parse them as authored truth — dropping a regenerated snapshot there pollutes
  that semantic). The file carries the four 化 values + a header banner
  ("GENERATED by `sgc metrics --write-baseline`; do not hand-edit"), and **ships**
  (`metrics/` is added to `package.json` `files`) because it is the runtime data
  source for `sgc metrics`.
- **doctor check (dev/CI-only, `!hasSource`-gated):** `computeMetricsLive(root)`
  from **on-disk** sources vs the committed baseline; mismatch → `fail`. The diff
  (`diffMetrics`) covers the slow-changing structural fields — 规范化, 智能化,
  自动化, and 高效化's `install_steps` + `runtime_node` — and **excludes
  `efficiency.bundle_bytes`** (high-churn, display-only). Mirrors doctor's
  existing parity checks (G invariant→test, I invariant-source, bundle-parity)
  and their `!hasSource` skip. Because the gated 化 are **deterministic functions
  of on-disk tracked sources at check time**, the only way live-compute diverges
  from the committed baseline is a source edit without a baseline regen — the
  exact drift the gate must catch (identical coupling to build:cli ⇄
  bundle-parity).
- **README:** the four-化 numbers reference the baseline (类 ARCH-2 README
  de-hardcode) — no hand-written numbers that can rot.
- **Refresh ritual:** when a drift-gated 化 legitimately changes (e.g. §12
  becomes machine-enforced → 13/13; a new prompt-backed agent → 12/23), run
  `sgc metrics --write-baseline`, commit the updated snapshot; the doctor gate
  forces this to stay in sync (the way build:cli forces a bundle rebuild). A pure
  bundle-size change does NOT require a regen (it is not drift-gated), though
  `--write-baseline` refreshes the displayed `bundle_bytes` opportunistically.

## CE-loop closure + invariants (honest accounting)

- **CE closure — intentional exception, stated honestly.** ROADMAP says every
  Phase-2/3 capability should "close through the CE loop … or it's just bundled
  commands." `sgc metrics` is a **measurement surface, not a knowledge-generating
  capability** — it does not capture or promote `solutions/`, and there is
  nothing to compound about a scorecard. Its invariant-style enforcement is the
  **doctor anti-drift gate**; its product role is the **honesty / E-E-A-T**
  constraint (§10) — making the four-化 claims falsifiable and CI-guarded. This
  exception is documented rather than papered over with a fabricated CE hook.
  Precedent: `reflect` is itself an accepted read-only audit surface that doesn't
  close the loop (`reflect.ts:8` — "no LLM call, no agent spawn, no events").
- **Invariants:** metrics is read-only over tracked sources + emits only
  `metrics/metrics-baseline.yaml` under `--write-baseline`. It holds **no**
  `read:solutions` / `write:solutions` scope (no capabilities `permissions`
  entry needed — verified: `/reflect /loop /doctor` have none, only spawn/write
  commands do), spawns nothing, emits no events → §1 / §3 / §6 / §8 are not
  engaged (the baseline is a regenerated tracked artifact like the bundle, **not**
  an append-only ledger, so §6 append-only does not apply).

## Wiring checklist (new command = 6 points + 1 code edit)

The project's recurring "adding X is N wiring points, not 3" gotchas
(`feedback_sgc_command_surface_parity`, `feedback_new_prompt_needs_input_yaml_placeholder`)
warrant an explicit list:

1. **`src/sgc.ts`** — `defineCommand` + `subCommands` map entry (`sgc.ts:895-915`,
   19 entries today → 20). Sync any subcommand-count assertion.
2. **`src/commands/metrics.ts`** — CLI glue (new).
3. **`src/dispatcher/metrics.ts`** — compute logic (new).
4. **`plugins/sgc/commands/metrics.md`** — slash parity (doctor H; 16 slash
   files today → 17). No `SLASH_EXEMPT` entry needed because the `.md` exists.
5. **`src/commands/doctor.ts`** — register the metrics-parity check inline
   (checks are inline in `runDoctor`, no registration array).
6. **`metrics/metrics-baseline.yaml`** + **`package.json` `files`** — new tracked
   artifact; add `"metrics/"` to the `files` allowlist so the baseline ships (it
   is the runtime data source).
7. **(code edit) `src/dispatcher/loop.ts`** — export `MANUAL_GATES` /
   `AUTOMATED_STEPS` for 自动化.

**NOT needed (verified, so deliberately omitted):** capabilities `permissions`
entry (read-only, mirrors reflect); `SLASH_EXEMPT`; `plugin.json` /
`marketplace.json` per-command array (slash commands auto-discovered); prompt
`## Input` + `<input_yaml/>` (metrics spawns no subagent); **no
`embedded-data.ts` entry for the baseline** (the doctor check is `!hasSource`
dev/CI-only, reads on-disk — adding an embed would bloat the bundle and risk the
self-referential read).

## Testing strategy

- **`metrics.test.ts` (dispatcher lane)** — per-化 computation over fixture
  artifacts:
  - 规范化: a fixture `invariant-enforcement.yaml` whose **comments** contain the
    literal `machine_enforced` (reproducing the grep overcount) → assert the YAML
    parser returns **12/13**, **never the grep value** (do not pin a specific
    wrong number).
  - 智能化: a fixture manifest mixing `prompt_path` present / `prompt_path: null`
    + `status: implemented` / `status: slot-only` / `status: manual-only` /
    absent → assert the numerator counts **`prompt_path`-truthy only** (so the 6
    null-prompt reviewers are excluded) and the denominator counts all manifested.
  - 自动化: assert `automated / total = (STEPS.length − MANUAL_GATES.size) /
    STEPS.length = 4/6` derived from the **imported** symbols (regression-guards
    the `MANUAL_GATES` export).
  - 高效化: assert engines read + recorded-bundle-size + install-step.
  - `--json` shape is stable (snapshot of the JSON contract).
- **doctor parity test (dev/CI):** in sync → `ok`; then **mutate an on-disk
  source** (flip a §N `machine_enforced` in `contracts/invariant-enforcement.yaml`
  under a temp `root`) **without** regenerating the baseline → assert the check
  `fail`s. This proves the gate reads the on-disk live path, not the frozen
  baseline (anti-tautology). Negative case: change only `efficiency.bundle_bytes`
  (live vs baseline) → assert the check stays `ok` (bundle size is not
  drift-gated).
- **slash↔CLI parity** (`feedback_sgc_command_surface_parity`): `commands/metrics.md`
  exists → doctor H green; CLI subcommand count synced.
- **TDD:** RED-first per 化 computation before implementation.
- **Test-lane divergence** (`feedback_sgc_test_lane_divergence`): run
  `bun test tests/dispatcher tests/eval`; grep both dirs for `runMetrics(` and
  any baseline-parity assertion before ship.

## Acceptance criteria

1. `sgc metrics` prints four 化 (headline + baseline + 口径); `sgc metrics
   --json` emits a stable machine form.
2. Each 化 computed from a git-tracked artifact (no `.sgc/` runtime read);
   规范化 **parses YAML** and reports 12/13, never the grep overcount (a naive
   grep sees 15 lines, 2 of them comments).
3. 智能化 numerator keys on **`prompt_path` truthiness** (LLM-invokable = 11/23),
   excluding the 6 `prompt_path: null` heuristic-stub reviewers; framed as
   roster **capacity**, not quality.
4. 自动化 imports `STEPS` + the newly-**exported** `MANUAL_GATES` from `loop.ts`
   (no hardcoding); reports 4/6 with the static `STEPS.length` denominator.
5. `metrics/metrics-baseline.yaml` committed (added to npm `files`, generated
   banner); the doctor drift check is `!hasSource` dev/CI-only, green in sync,
   `fail`s on an **on-disk source mutation** of a drift-gated 化 without baseline
   regen, and does **not** fire on a bundle-size-only change; `--write-baseline`
   regenerates it.
6. `commands/metrics.md` added (doctor H slash-parity green); `sgc.ts`
   `subCommands` + subcommand-count synced (19→20).
7. README four-化 numbers reference the baseline (no hand-written stale numbers);
   the stale audit values are corrected (§5 高效化 "2 步·bun≥1.3" → "1 步·node≥18";
   §5 智能化 "10 LLM agents" → 11).
8. §10 / E-E-A-T honesty holds: 智能化 = LLM-invokable **capacity** (not quality,
   6 stubs excluded); metrics' **non-CE-closure** stated explicitly; no baseless
   adjectives in the scorecard output.
9. `sgc doctor` + both CI lanes (dispatcher + eval) green; subagent count
   unchanged; bundle rebuilt (`npm run build:cli`) + committed `100755`.

## Release reminders (per ROADMAP)

- main-direct, no PR; bump `package.json` + `plugins/sgc/.claude-plugin/plugin.json`
  in lockstep.
- `src/` changed → `npm run build:cli` + commit `plugins/sgc/bin/sgc.mjs` with
  mode `100755` (`git add --chmod=+x`); CLI entry stays bare `runMain(main)` — do
  NOT add an `import.meta.main` guard (breaks the bundle, see
  `feedback_import_meta_main_breaks_bun_bundle`).
- Verify the rebuilt bundle runs under node (`node plugins/sgc/bin/sgc.mjs
  metrics --json`) — doctor SHA-parity is a false green for runtime crashes.
- After landing, regenerate the baseline (`sgc metrics --write-baseline`) so the
  committed snapshot reflects the shipped numbers.
- `npm publish --provenance` E403 double-PUT false-negative — verify via
  `npm view @sdsrs/sgc@<ver> dist.shasum`, don't blindly re-run.
```
