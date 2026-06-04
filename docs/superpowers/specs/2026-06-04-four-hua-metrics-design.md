# Four-化 Metrics Scorecard — Design Spec (Phase 3)

**Date:** 2026-06-04
**Phase:** 3 (four-化 metrics — `docs/ROADMAP.md`)
**Status:** approved (brainstorming), self-reviewed (8-agent adversarial pass 2026-06-04), architecture finalized (Option C), pending implementation plan

## Goal

ROADMAP Phase 3 asks the four 化 (规范化 / 智能化 / 自动化 / 高效化) to become
**measurable with baselines, surfaced honestly** (no baseless adjectives, per
§10 / E-E-A-T). Today they exist only as prose in
`docs/CAPABILITY-ABSORPTION-AUDIT.md §5` — hand-computed, partly stale (高效化
still reads "2 步 · bun≥1.3", written 2026-05-29, **before** Phase 0 v1.24.0
replaced bun with a node bundle and collapsed install to one channel).

This phase adds **`sgc metrics`**: a product self-scorecard that computes each
化 from **git-tracked product artifacts**, plus a committed **baseline** guarded
against drift by `sgc doctor` + CI — the same anti-drift shape sgc already uses
for the bundle (build:cli parity) and the invariant-source parity (doctor G/I).

The deliverable is the ROADMAP Phase 3 line: *"a metrics surface (extend
`sgc reflect`, or a `sgc metrics` view) + honest README numbers with baselines."*

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| 受众 / 目的 | **sgc 产品自评记分卡** — measure how far *the sgc product* achieves the four 化. NOT user-project effect metrics; NOT a two-layer (product + per-project) view. |
| 落点 | **New `sgc metrics` command.** NOT extend `doctor` (pass/fail guard semantics ≠ numeric scorecard) or `reflect` (per-decision prior-art audit, furthest semantics). |
| 数据基础 | **Pure git-tracked product attributes.** NOT runtime `.sgc/` aggregation (per-machine, git-ignored → cannot baseline) and NOT a `--local` runtime annex. Guarantees stable, reproducible, CI-verifiable numbers. |
| 雄心 | **B: scorecard + CI anti-drift guard.** NOT A (minimal, hand-synced README) or C-trend (B + trend history). |

## Architecture (Option C — runtime computes from embedded sources)

Two code paths, deliberately separate:

- **Runtime `sgc metrics` (any channel)** computes the four 化 live from data
  already inside the bundle — the **embedded** contracts (`readContract` /
  `getCapabilities`), the **compiled** `STEPS` / `MANUAL_GATES` symbols, the
  **bundled** `package.json` import, and the running bundle's **own** size via
  `statSync(fileURLToPath(import.meta.url))`. This describes the actual shipped
  product, is identical across plugin-install / npm / source layouts (the data
  travels inside the bundle), and needs **no baseline file at runtime**.
- **`sgc metrics --write-baseline` + the `sgc doctor` drift check (dev/CI only)**
  call `computeMetricsLive(root)`, which reads the **on-disk** sources fresh, and
  write / compare against the committed `metrics/metrics-baseline.yaml`.

The baseline is therefore a **dev/CI drift reference only** — not embedded, not
shipped, not read at runtime. This avoids the self-reference / cross-layout /
bundle-size-fixpoint traps that shipping-or-embedding the baseline would create
(an earlier draft hit all three).

## Non-goals (explicit not-doing)

- **NOT** trend history (rejected — 四化 change slowly, only per-release; a
  tracked history file bloats and adds little signal → YAGNI).
- **NOT** user-project effect metrics ("did sgc reduce your bugs") — cannot
  honestly attribute, and is not the product self-scorecard the user chose.
- **NOT** runtime `.sgc/` aggregation (capture→promote closure rate, prior-art
  surface rate) — per-machine, git-ignored, cannot back a stable baseline.
  Deliberately deferred, not overlooked.
- **NOT** new instrumentation / 埋点 — every 化 is read from an artifact that
  already exists under version control (or compiled into the bundle).
- **NOT** a single 0–10 composite score. That is `gs:/health`'s shape. This
  scorecard reports **four independent headline numbers, each with its own
  baseline and 口径**, because the four 化 are not commensurable.
- **NOT** embedding or shipping the baseline (`embedded-data.ts` and
  `package.json` `files` are unchanged) — the baseline is dev/CI-only.

## The four metrics (all from git-tracked / compiled artifacts)

Each 化 has **one headline figure** plus a baseline/denominator so the number is
never bare (§10 Specificity). Values below are verified-as-of-spec (8-agent
adversarial pass, 2026-06-04); the command computes them at runtime — they are
not hardcoded.

### 规范化 (standardization) — `machine_enforced / total invariants`

- **Source:** `contracts/invariant-enforcement.yaml` (`invariants` map).
- **Computation:** parse the YAML; numerator = entries with
  `machine_enforced: true`, denominator = total entries (§1–§13).
- **口径 trap (must encode):** a naive `grep -c machine_enforced` returns **15**,
  not 13, because **two header comment lines** carry the literal — line 9
  (`machine_enforced_count / 13`) and line 16 (`` `machine_enforced: true`
  invariant the `tests`… ``). The structural truth is 13 entries (12 `true` +
  §12's lone `false`). The metric **MUST parse the YAML**, not grep. `sgc doctor`
  check G already parses correctly (`doctor.ts:321` `yamlLoad`, loops §1..§13,
  counts `e["machine_enforced"] === true`, `doctor.ts:367`) → **12/13** (§12 is
  procedural, the sole `false`).
- **Baseline:** **12 / 13**.

### 智能化 (intelligence) — `LLM-invokable subagents / total manifested`

- **Source:** `contracts/sgc-capabilities.yaml` (`subagents` map).
- **Computation:** numerator = subagents whose entry has a **truthy
  `prompt_path`** (a real on-disk prompt file). This is the only honest
  LLM-backed signal: `src/dispatcher/spawn.ts:426-437` routes to a real LLM
  backend (anthropic-sdk / openrouter) **only** when `prompt_path` is truthy; any
  `prompt_path: null` entry always falls to the inline-stub heuristic, so it is
  **not** LLM-backed regardless of `status`. Denominator = total manifested.
- **Verified current values:** **11 LLM-invokable / 23 manifested.** The 11:
  `clarifier.discover`, `classifier.level`, `planner.{ceo,eng,adversarial,decompose}`,
  `researcher.history`, `reviewer.correctness`, `compound.{context,solution,prevention}`.
  The other 12 are NOT LLM-invokable: 6 synthesized-prompt heuristic-stub
  reviewers (`reviewer.{security,performance,tests,maintainability,migration,infra}`
  — `status: implemented` but `prompt_path: null`, keyword matchers per
  `reviewer-specialists.ts:57-71`), 2 `status: slot-only`
  (`reviewer.adversarial`, `reviewer.spec`), 1 `status: manual-only`
  (`janitor.archive`), 3 heuristic workers with no prompt (`qa.browser`,
  `compound.related`, `janitor.compound`).
- **口径 (must encode):** key the numerator on **`prompt_path` truthiness, not
  `status`** — sidesteps the status-token spelling entirely. The manifest's real
  `status` enum is `implemented` (or absent = implemented) / **`slot-only`** /
  **`manual-only`** (`types.ts:240`; **not** bare `slot`/`manual`).
- **Honesty note (§10 / E-E-A-T):** this is a **capacity** proxy — *how many
  agents can actually invoke an LLM* — **not a quality measurement**. The 6
  heuristic-stub reviewers are excluded (they do not field LLM reasoning yet).
  Quality metrics (plan-fusion verdict quality, classifier accuracy) need an eval
  harness excluded by the pure-tracked constraint; the scorecard states this as
  future work so the number is not read as a quality claim. The audit's "10 LLM
  agents" (`CAPABILITY-ABSORPTION-AUDIT.md:157`) is stale by one → **11**
  (`planner.decompose`, Phase 2b); the v1.27.0 reviewer trio did NOT add
  LLM-invokable agents. Correct the audit line when this lands.
- **Baseline:** **11 / 23** (recomputed from the live manifest, not hardcoded).

### 自动化 (automation) — `automated steps / total steps in the loop`

- **Source:** `src/dispatcher/loop.ts` — the exported `STEPS` array and the
  `MANUAL_GATES` set.
- **Computation:** denominator = `STEPS.length` (`STEPS = [plan, work, review,
  qa, ship, compound]`, **6**); numerator = steps **not** in `MANUAL_GATES`
  (`{work, ship}`, **2**) = **4**. Headline **4 / 6**.
- **Required code edit (wiring):** `STEPS` is exported but `MANUAL_GATES`
  (`loop.ts:56`) is a **plain unexported `const`** — so "enumerate from loop.ts,
  do not hardcode" is unsatisfiable as-is. The implementation MUST **export
  `MANUAL_GATES`** from `loop.ts`, and `metrics.ts` imports `STEPS` +
  `MANUAL_GATES`. Listed in the Wiring checklist + Acceptance below.
- **口径 (must encode):** the 2 manual gates (`work` — operator implements the
  work; `ship` — §4 L3 human sign-off) are **intentionally retained** (a spec
  requirement, not a deficiency); the headline annotates "2 intentional manual
  gates (work, ship) — by design, not a gap." The denominator is the **static
  `STEPS.length` (6)**, NOT a per-run executed count — the L0 carve-out
  (`loop.ts:387-395` skips review/qa/ship/compound for L0) is a runtime-level
  optimization, not a change to the loop's defined step set (§9 parallel-path).
- **Baseline:** **4 / 6** (2 manual gates).

### 高效化 (efficiency) — `install steps · runtime dep · bundle size`

- **Source:** `package.json` (`engines`), the running bundle's own size, the
  install path.
- **Computation:**
  - `engines.node` via the **bundled** `package.json` (bun inlines it; in dev,
    `computeMetricsLive` reads `resolve(root, "package.json")` fresh) — NOT a
    cross-layout on-disk guess.
  - **bundle byte-size:** at runtime, the running bundle stats **itself** —
    `statSync(fileURLToPath(import.meta.url)).size` resolves to `sgc.mjs` in
    every channel (`$CLAUDE_PLUGIN_ROOT/bin/` · `<pkg>/plugins/sgc/bin/` ·
    source). In `computeMetricsLive(root)` (dev/CI) it is
    `statSync(resolve(root, "plugins/sgc/bin/sgc.mjs")).size`. **Display-only,
    rendered rounded ("~886 KB"), and excluded from the doctor drift diff**
    (`diffMetrics` ignores `efficiency.bundle_bytes`) — bundle size changes on
    every `src/` edit, so drift-gating it would turn the baseline into a
    per-commit tripwire and contradict "四化 change slowly". Only the
    slow-changing fields (`install_steps`, `runtime_node`, + the other three 化)
    are drift-gated.
  - install-step count = **1** (drift-gated).
- **口径 (must encode):** **1 install step** (`/plugin install sgc` ships the
  self-contained node bundle and every `/sgc:*` command runs via plain `node` —
  no `npm i -g`, no bun; a one-time `/plugin marketplace add` registers the
  source, counted as registry setup, not a per-install step). Verified:
  `node plugins/sgc/bin/sgc.mjs --version` → 1.27.0, exit 0; all
  `plugins/sgc/commands/*.md` lead with `$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs`. The
  `docs/融合.txt` "two-step install" passage describes the pre-Phase-0 state.
- **Corrects stale audit value:** audit §5 still reads "2 步 · bun≥1.3"
  (`CAPABILITY-ABSORPTION-AUDIT.md:144,166`); verified current state is
  **1 step · node ≥ 18 (bun dropped) · ~886 KB** (`907,657` bytes at spec time).
  Correct the audit line when this lands.
- **TTHW:** an optional, one-shot, measured note (install → first successful
  command), documented but **not** an auto-computed metric (needs a
  clean-environment timing run, not a tracked artifact).
- **Baseline:** install_steps = 1, runtime_node = ">=18", bundle_bytes (recorded,
  display-only).

## Command shape

- `sgc metrics` — human-readable scorecard: four 化, each headline + baseline +
  one-line 口径. Computed live from embedded/compiled sources (`computeRuntimeMetrics()`).
- `sgc metrics --json` — stable machine form (README injection) of the same.
- `sgc metrics --write-baseline` — `computeMetricsLive(root)` from on-disk sources
  → write `metrics/metrics-baseline.yaml`. Deliberate refresh, run in a source
  checkout after `build:cli`.
- **Read-only** otherwise: no LLM, no agent spawn, no events emitted — same
  nature as `reflect`. `--write-baseline` is the sole writing path.

### Files (new + edited units)

| Unit | File | Responsibility |
|---|---|---|
| Pure compute | `src/dispatcher/metrics.ts` (new) | `FourHuaMetrics` type; `computeFromInputs` (pure core); `computeRuntimeMetrics` (embedded/self); `computeMetricsLive(root)` (on-disk); `serializeBaseline` / `parseBaseline`; `diffMetrics` (excludes `bundle_bytes`); `formatScorecard`. |
| CLI glue | `src/commands/metrics.ts` (new) | Flag parsing (`--json` / `--write-baseline`), stdout shaping. Mirrors `src/commands/reflect.ts` in shape. |
| Command registration | `src/sgc.ts` (edit) | `defineCommand` block (mirror the `reflect` block, `sgc.ts:581-617`) + `subCommands` entry (`sgc.ts:895-915`, 19→20). |
| Automation source | `src/dispatcher/loop.ts` (edit) | **Export `MANUAL_GATES`** (`loop.ts:56`) so 自动化 can derive without hardcoding. |
| Slash parity | `plugins/sgc/commands/metrics.md` (new) | doctor check H slash↔CLI parity (mirror `reflect.md`). |
| Drift gate | `src/commands/doctor.ts` (edit) | New `!hasSource`-gated metrics-parity check **(K)** — `(J)` is the existing bundle-parity check; insert after `emit(await bundleParityCheck(root))` (`doctor.ts:474`), before the tally (`doctor.ts:476`). |
| Baseline | `metrics/metrics-baseline.yaml` (new, tracked) | Dev/CI drift reference + README source. Generated banner. **Not** embedded, **not** in npm `files`, **not** read at runtime. |

## Anti-drift mechanism (B 档 core)

- **Committed baseline:** `metrics/metrics-baseline.yaml` — a new top-level
  tracked dir, NOT `contracts/` (verified: all 5 existing `contracts/*` are
  hand-authored inputs with no generated banner; doctor F/G/I parse them as
  authored truth). Header banner: "GENERATED by `sgc metrics --write-baseline`;
  do not hand-edit." It is a **dev/CI drift reference + README number source** —
  not embedded, not in npm `files`, not read at runtime.
- **doctor check (dev/CI-only, `!hasSource`-gated):** `computeMetricsLive(root)`
  from on-disk sources vs the committed baseline; mismatch → `fail`. The diff
  (`diffMetrics`) covers 规范化, 智能化, 自动化, and 高效化's `install_steps` +
  `runtime_node`, and **excludes `efficiency.bundle_bytes`** (high-churn,
  display-only). Mirrors doctor's parity checks (G / I / bundle-parity) and their
  `!hasSource` skip. Because the gated 化 are deterministic functions of on-disk
  sources, the only way live-compute diverges from the baseline is a source edit
  without a regen — the exact drift the gate catches (identical coupling to
  build:cli ⇄ bundle-parity).
- **README:** the four-化 numbers reference the baseline (类 ARCH-2 README
  de-hardcode) — no hand-written numbers that rot.
- **Refresh ritual:** when a drift-gated 化 legitimately changes (e.g. §12
  becomes machine-enforced → 13/13; a new prompt-backed agent → 12/23), run
  `sgc metrics --write-baseline`, commit the snapshot; the doctor gate forces it
  to stay in sync. A pure bundle-size change does NOT require a regen (not
  drift-gated).

## CE-loop closure + invariants (honest accounting)

- **CE closure — intentional exception, stated honestly.** ROADMAP says every
  Phase-2/3 capability should "close through the CE loop … or it's just bundled
  commands." `sgc metrics` is a **measurement surface, not a knowledge-generating
  capability** — it does not capture/promote `solutions/`, and there is nothing
  to compound about a scorecard. Its invariant-style enforcement is the doctor
  anti-drift gate; its product role is the **honesty / E-E-A-T** constraint
  (§10). Documented rather than papered over with a fabricated CE hook.
  Precedent: `reflect` is an accepted read-only audit surface that doesn't close
  the loop (`reflect.ts:8`).
- **Invariants:** metrics is read-only over tracked/compiled sources + emits only
  `metrics/metrics-baseline.yaml` under `--write-baseline`. No `read:solutions` /
  `write:solutions` scope (no capabilities `permissions` entry needed — `/reflect
  /loop /doctor` have none; only spawn/write commands do), spawns nothing, emits
  no events → §1 / §3 / §6 / §8 not engaged (the baseline is a regenerated
  tracked artifact, not an append-only ledger, so §6 does not apply).

## Wiring checklist (new command = 6 points + 1 code edit)

The project's recurring "adding X is N wiring points" gotchas
(`feedback_sgc_command_surface_parity`, `feedback_new_prompt_needs_input_yaml_placeholder`)
warrant an explicit list:

1. **`src/sgc.ts`** — `defineCommand` + `subCommands` entry (`sgc.ts:895-915`,
   19→20). Sync any subcommand-count assertion.
2. **`src/commands/metrics.ts`** — CLI glue (new).
3. **`src/dispatcher/metrics.ts`** — compute logic (new).
4. **`plugins/sgc/commands/metrics.md`** — slash parity (doctor H; 16→17). No
   `SLASH_EXEMPT` entry needed (the `.md` exists).
5. **`src/commands/doctor.ts`** — register the metrics-parity check inline as
   **(K)** (after the existing `(J)` bundle-parity check).
6. **`metrics/metrics-baseline.yaml`** — new tracked artifact (dev/CI reference).
7. **(code edit) `src/dispatcher/loop.ts`** — export `MANUAL_GATES` for 自动化.

**NOT needed (verified, deliberately omitted):** capabilities `permissions` entry
(read-only, mirrors reflect); `SLASH_EXEMPT`; `plugin.json` / `marketplace.json`
per-command array (slash commands auto-discovered); prompt `## Input` +
`<input_yaml/>` (metrics spawns no subagent); **no `embedded-data.ts` entry** and
**no `package.json` `files` change** (baseline is dev/CI-only, not shipped, not
embedded — runtime computes from already-embedded contracts + self-statSync).

## Testing strategy

- **`metrics.test.ts` (dispatcher lane)** — per-化 over fixtures:
  - 规范化: `computeFromInputs` with an `invariantYaml` whose **comments** carry
    the literal `machine_enforced` → assert **12/13**, never the grep overcount.
  - 智能化: `capabilitiesYaml` fixture mixing `prompt_path` present /
    `prompt_path: null` + `status: implemented` / `slot-only` / `manual-only` /
    absent → assert numerator counts **`prompt_path`-truthy only** (the
    null-prompt reviewers excluded), denominator = all manifested.
  - 自动化: assert `(STEPS.length − MANUAL_GATES.size) / STEPS.length = 4/6` from
    the **imported** symbols (regression-guards the `MANUAL_GATES` export).
  - 高效化: assert engines read + install_steps; `bundle_bytes` present (value
    not asserted exactly).
  - `--json` shape stable (snapshot of the JSON contract).
- **doctor parity test (dev/CI):** baseline in sync → `ok`; then **mutate an
  on-disk source** (flip a §N `machine_enforced` under a temp `root`) **without**
  regenerating the baseline → assert the check `fail`s (proves it reads the live
  on-disk path, not the frozen baseline — anti-tautology). Negative case: change
  only `efficiency.bundle_bytes` (live vs baseline) → assert the check stays `ok`
  (not drift-gated).
- **slash↔CLI parity** (`feedback_sgc_command_surface_parity`): `commands/metrics.md`
  exists → doctor H green; CLI subcommand count synced.
- **TDD:** RED-first per 化 computation before implementation.
- **Test-lane divergence** (`feedback_sgc_test_lane_divergence`): run
  `bun test tests/dispatcher tests/eval`; grep both for `runMetrics(` /
  `computeMetricsLive(` before ship.

## Acceptance criteria

1. `sgc metrics` prints four 化 (headline + baseline + 口径); `--json` stable.
2. Each 化 computed from a git-tracked/compiled artifact (no `.sgc/` read);
   规范化 **parses YAML** → 12/13, never the grep overcount (naive grep = 15).
3. 智能化 numerator keys on **`prompt_path` truthiness** (LLM-invokable = 11/23),
   excluding the 6 `prompt_path: null` heuristic-stub reviewers; framed as
   roster **capacity**, not quality.
4. 自动化 imports `STEPS` + the newly-**exported** `MANUAL_GATES` (no hardcoding);
   reports 4/6 with the static `STEPS.length` denominator.
5. `metrics/metrics-baseline.yaml` committed (dev/CI reference, generated banner,
   NOT embedded / NOT shipped); the doctor drift check is `!hasSource` dev/CI-only,
   green in sync, `fail`s on an on-disk source mutation of a drift-gated 化 without
   regen, and does **not** fire on a bundle-size-only change; `--write-baseline`
   regenerates it.
6. `commands/metrics.md` added (doctor H slash-parity green); `sgc.ts`
   `subCommands` + subcommand-count synced (19→20).
7. README four-化 numbers reference the baseline (no hand-written stale numbers);
   stale audit values corrected (§5 高效化 "2 步·bun≥1.3" → "1 步·node≥18"; §5
   智能化 "10 LLM agents" → 11).
8. §10 / E-E-A-T honesty: 智能化 = LLM-invokable **capacity** (not quality, 6
   stubs excluded); metrics' **non-CE-closure** stated; no baseless adjectives in
   output.
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
  committed snapshot reflects the shipped numbers; commit it.
- `npm publish --provenance` E403 double-PUT false-negative — verify via
  `npm view @sdsrs/sgc@<ver> dist.shasum`, don't blindly re-run.
