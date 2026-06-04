# Four-化 Metrics Scorecard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `sgc metrics` — a product self-scorecard that computes the four 化 (规范化/智能化/自动化/高效化) from git-tracked + compiled artifacts, with a committed dev/CI baseline guarded against drift by `sgc doctor`.

**Architecture:** Option C (per `docs/superpowers/specs/2026-06-04-four-hua-metrics-design.md`). Runtime `sgc metrics` computes live from embedded contracts + compiled `STEPS`/`MANUAL_GATES` + the bundled `package.json` + the bundle's own size (`import.meta.url`). `metrics/metrics-baseline.yaml` is a dev/CI drift reference only (not embedded, not shipped, not read at runtime); `sgc metrics --write-baseline` writes it from on-disk sources and a new doctor check (J) compares a live on-disk recompute against it. Pure-compute core (`computeFromInputs`) is text-in/struct-out for trivial fixture testing.

**Tech Stack:** TypeScript (bun runtime + node bundle via `scripts/build-cli.mjs`), `citty` CLI, `js-yaml`, the sgc preprocessor (`loadSpec`). Tests: `bun test tests/dispatcher`.

**Conventions for every task:** TDD (RED → GREEN). Tests live in `tests/dispatcher/`. Run the dispatcher lane with `SGC_FORCE_INLINE=1 bun test tests/dispatcher/<file> -t '<name>'`. Commit after each task. Do NOT run `build:cli` until Task 8 (it re-inlines `src/` + `package.json`).

---

### Task 1: Export `MANUAL_GATES` from `loop.ts`

Enabling edit so 自动化 derives the manual-gate set instead of hardcoding it (spec §自动化).

**Files:**
- Modify: `src/dispatcher/loop.ts:56`
- Test: `tests/dispatcher/loop.test.ts` (append)

- [ ] **Step 1: Write the failing test**

`tests/dispatcher/loop.test.ts` already imports from `../../src/dispatcher/loop`
and uses **`it`** (its bun:test import is `{ describe, expect, it, beforeEach,
afterEach }` — note `it`, NOT `test`), and it does **not** yet import `STEPS` /
`MANUAL_GATES`. So: **add `STEPS` and `MANUAL_GATES` to the existing
`from "../../src/dispatcher/loop"` import line**, then append this `it` block
(do NOT add a second `import` for the same module, and do NOT use bare `test()`
— bun does not inject it as a global here):

```ts
it("MANUAL_GATES is exported and holds exactly work + ship", () => {
  expect(STEPS.length).toBe(6)
  expect(MANUAL_GATES.size).toBe(2)
  expect(MANUAL_GATES.has("work")).toBe(true)
  expect(MANUAL_GATES.has("ship")).toBe(true)
  expect(STEPS.filter((s) => !MANUAL_GATES.has(s)).length).toBe(4)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/loop.test.ts -t 'MANUAL_GATES is exported'`
Expected: FAIL — `MANUAL_GATES` is not exported (`undefined` / import error).

- [ ] **Step 3: Add `export` to the const**

In `src/dispatcher/loop.ts:56`, change:

```ts
const MANUAL_GATES = new Set<LoopStepName>(["work", "ship"])
```

to:

```ts
export const MANUAL_GATES = new Set<LoopStepName>(["work", "ship"])
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/loop.test.ts -t 'MANUAL_GATES is exported'`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/loop.ts tests/dispatcher/loop.test.ts
git commit -m "refactor(loop): export MANUAL_GATES for the four-化 自动化 metric"
```

---

### Task 2: Pure compute core — 规范化, 智能化, 自动化

The text-in/struct-out core. No I/O — fixtures are passed as strings, so the tricky cases (grep-trap comment, prompt_path:null reviewers) are trivial to reproduce.

**Files:**
- Create: `src/dispatcher/metrics.ts`
- Test: `tests/dispatcher/metrics.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/dispatcher/metrics.test.ts`:

```ts
import { test, expect } from "bun:test"
import {
  computeStandardization,
  computeIntelligence,
  computeAutomation,
  computeFromInputs,
} from "../../src/dispatcher/metrics"

// 规范化: comments containing the literal must NOT inflate the count.
const IE_FIXTURE = `# a comment mentioning machine_enforced_count / 13 in prose
# and another with \`machine_enforced: true\` literal in a sentence
invariants:
  "1": { machine_enforced: true }
  "2": { machine_enforced: true }
  "3": { machine_enforced: false }
`

test("computeStandardization parses YAML, ignores comment literals", () => {
  const r = computeStandardization(IE_FIXTURE)
  expect(r).toEqual({ machine_enforced: 2, total: 3 })
})

// 智能化: numerator keys on prompt_path truthiness, NOT status.
const CAPS_FIXTURE = `subagents:
  real.one: { prompt_path: prompts/a.md }
  real.two: { prompt_path: prompts/b.md, status: implemented }
  stub.impl: { prompt_path: null, status: implemented }
  slotonly: { prompt_path: null, status: slot-only }
  manualonly: { prompt_path: null, status: manual-only }
  heuristic: { prompt_path: null }
`

test("computeIntelligence counts prompt_path-truthy only", () => {
  const r = computeIntelligence(CAPS_FIXTURE)
  // 2 real prompt files / 6 manifested. The status:implemented stub is excluded.
  expect(r).toEqual({ llm_invokable: 2, total_subagents: 6 })
})

test("computeAutomation derives 4/6 from loop symbols", () => {
  expect(computeAutomation()).toEqual({ automated_steps: 4, total_steps: 6 })
})

test("computeFromInputs assembles all four 化", () => {
  const m = computeFromInputs({
    invariantYaml: IE_FIXTURE,
    capabilitiesYaml: CAPS_FIXTURE,
    runtimeNode: ">=18",
    bundleBytes: 12345,
  })
  expect(m.standardization).toEqual({ machine_enforced: 2, total: 3 })
  expect(m.intelligence).toEqual({ llm_invokable: 2, total_subagents: 6 })
  expect(m.automation).toEqual({ automated_steps: 4, total_steps: 6 })
  expect(m.efficiency).toEqual({ install_steps: 1, runtime_node: ">=18", bundle_bytes: 12345 })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts`
Expected: FAIL — `Cannot find module '../../src/dispatcher/metrics'`.

- [ ] **Step 3: Create `metrics.ts` with the pure core**

Create `src/dispatcher/metrics.ts`:

```ts
// src/dispatcher/metrics.ts
//
// Phase 3 four-化 product self-scorecard. Pure compute over git-tracked /
// compiled artifacts; no .sgc/ runtime read, no LLM, no events. See
// docs/superpowers/specs/2026-06-04-four-hua-metrics-design.md (Option C).

import { loadSpec } from "./preprocessor"
import { load as yamlLoad } from "js-yaml"
import { STEPS, MANUAL_GATES } from "./loop"

export interface FourHuaMetrics {
  standardization: { machine_enforced: number; total: number }
  intelligence: { llm_invokable: number; total_subagents: number }
  automation: { automated_steps: number; total_steps: number }
  efficiency: { install_steps: number; runtime_node: string; bundle_bytes: number }
}

interface InvariantDoc {
  invariants?: Record<string, { machine_enforced?: boolean } | null>
}
interface CapsDoc {
  subagents?: Record<string, { prompt_path?: string | null }>
}

/** 规范化 — parse the YAML (NOT grep: comments carry the literal). */
export function computeStandardization(invariantYaml: string): FourHuaMetrics["standardization"] {
  const doc = yamlLoad(invariantYaml) as InvariantDoc | undefined
  const entries = Object.values(doc?.invariants ?? {})
  return {
    machine_enforced: entries.filter((e) => e != null && e.machine_enforced === true).length,
    total: entries.length,
  }
}

/** 智能化 — LLM-invokable = truthy prompt_path (spawn.ts routes only those to
 *  a real LLM). Uses loadSpec so `<<: *reviewer_base` merges resolve as in prod. */
export function computeIntelligence(capabilitiesYaml: string): FourHuaMetrics["intelligence"] {
  const spec = loadSpec<CapsDoc>(capabilitiesYaml)
  const subs = Object.values(spec.subagents ?? {})
  return {
    llm_invokable: subs.filter((m) => typeof m.prompt_path === "string" && m.prompt_path.length > 0).length,
    total_subagents: subs.length,
  }
}

/** 自动化 — from the compiled loop symbols (layout-independent). */
export function computeAutomation(): FourHuaMetrics["automation"] {
  return {
    automated_steps: STEPS.filter((s) => !MANUAL_GATES.has(s)).length,
    total_steps: STEPS.length,
  }
}

/** Pure core: assemble the four 化 from already-read inputs. */
export function computeFromInputs(inputs: {
  invariantYaml: string
  capabilitiesYaml: string
  runtimeNode: string
  bundleBytes: number
}): FourHuaMetrics {
  return {
    standardization: computeStandardization(inputs.invariantYaml),
    intelligence: computeIntelligence(inputs.capabilitiesYaml),
    automation: computeAutomation(),
    efficiency: { install_steps: 1, runtime_node: inputs.runtimeNode, bundle_bytes: inputs.bundleBytes },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/metrics.ts tests/dispatcher/metrics.test.ts
git commit -m "feat(metrics): pure four-化 compute core (规范化/智能化/自动化)"
```

---

### Task 3: I/O computes — `computeMetricsLive` + `computeRuntimeMetrics`

Wire the pure core to on-disk sources (dev/CI) and to embedded/compiled sources (runtime).

**Files:**
- Modify: `src/dispatcher/metrics.ts` (add functions + imports)
- Test: `tests/dispatcher/metrics.test.ts` (append)

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/metrics.test.ts`:

```ts
import { computeMetricsLive, computeRuntimeMetrics } from "../../src/dispatcher/metrics"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { resolve } from "node:path"

function makeRoot(): string {
  const root = mkdtempSync(resolve(tmpdir(), "sgc-metrics-"))
  mkdirSync(resolve(root, "contracts"), { recursive: true })
  mkdirSync(resolve(root, "plugins/sgc/bin"), { recursive: true })
  writeFileSync(resolve(root, "contracts/invariant-enforcement.yaml"), IE_FIXTURE)
  writeFileSync(resolve(root, "contracts/sgc-capabilities.yaml"), CAPS_FIXTURE)
  writeFileSync(resolve(root, "package.json"), JSON.stringify({ engines: { node: ">=18" } }))
  writeFileSync(resolve(root, "plugins/sgc/bin/sgc.mjs"), "// stub bundle\n")
  return root
}

test("computeMetricsLive reads on-disk sources under a root", () => {
  const root = makeRoot()
  try {
    const m = computeMetricsLive(root)
    expect(m.standardization).toEqual({ machine_enforced: 2, total: 3 })
    expect(m.intelligence).toEqual({ llm_invokable: 2, total_subagents: 6 })
    expect(m.automation).toEqual({ automated_steps: 4, total_steps: 6 })
    expect(m.efficiency.install_steps).toBe(1)
    expect(m.efficiency.runtime_node).toBe(">=18")
    expect(m.efficiency.bundle_bytes).toBeGreaterThan(0)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("computeRuntimeMetrics computes the real product four 化 (structural)", () => {
  const m = computeRuntimeMetrics()
  // Exact product numbers (12/13, 11/23) are enforced by the baseline + doctor
  // (Task 6). Here assert only structural invariants that survive roster growth,
  // so adding an agent/invariant later does not break this unit test.
  expect(m.standardization.total).toBeGreaterThanOrEqual(13)
  expect(m.standardization.machine_enforced).toBeLessThanOrEqual(m.standardization.total)
  expect(m.standardization.machine_enforced).toBeGreaterThanOrEqual(12)
  expect(m.intelligence.total_subagents).toBeGreaterThanOrEqual(m.intelligence.llm_invokable)
  expect(m.intelligence.llm_invokable).toBeGreaterThanOrEqual(11)
  expect(m.automation).toEqual({ automated_steps: 4, total_steps: 6 })
  expect(m.efficiency.runtime_node).toBe(">=18")
  expect(typeof m.efficiency.bundle_bytes).toBe("number")
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts -t 'computeMetricsLive'`
Expected: FAIL — `computeMetricsLive` is not exported.

- [ ] **Step 3: Add the I/O computes to `metrics.ts`**

Add to the imports at the top of `src/dispatcher/metrics.ts`:

```ts
import { readFileSync, statSync } from "node:fs"
import { resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { readContract } from "./embedded-data"
import packageJson from "../../package.json"
```

Append these functions to `src/dispatcher/metrics.ts`:

```ts
/** Dev/CI: read on-disk sources fresh under `root` (for --write-baseline + the
 *  doctor drift check). Fresh reads — not the embedded/frozen readContract — so
 *  a test/edit to the on-disk file is seen. */
export function computeMetricsLive(root: string): FourHuaMetrics {
  const pkg = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8")) as {
    engines?: { node?: string }
  }
  let bundleBytes = 0
  try {
    bundleBytes = statSync(resolve(root, "plugins/sgc/bin/sgc.mjs")).size
  } catch {
    bundleBytes = 0
  }
  return computeFromInputs({
    invariantYaml: readFileSync(resolve(root, "contracts/invariant-enforcement.yaml"), "utf8"),
    capabilitiesYaml: readFileSync(resolve(root, "contracts/sgc-capabilities.yaml"), "utf8"),
    runtimeNode: pkg.engines?.node ?? "unknown",
    bundleBytes,
  })
}

/** Runtime: compute from embedded contracts + compiled symbols + the bundle's
 *  own size. Cross-layout (data travels inside the bundle); no baseline needed. */
export function computeRuntimeMetrics(): FourHuaMetrics {
  let bundleBytes = 0
  try {
    bundleBytes = statSync(fileURLToPath(import.meta.url)).size
  } catch {
    bundleBytes = 0
  }
  const engines = (packageJson as { engines?: { node?: string } }).engines
  return computeFromInputs({
    invariantYaml: readContract("invariant-enforcement.yaml"),
    capabilitiesYaml: readContract("sgc-capabilities.yaml"),
    runtimeNode: engines?.node ?? "unknown",
    bundleBytes,
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts`
Expected: PASS (6 tests). If `computeRuntimeMetrics` returns 12/13 + 11/23, the real contracts parse correctly.

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/metrics.ts tests/dispatcher/metrics.test.ts
git commit -m "feat(metrics): on-disk (live) + embedded (runtime) four-化 computes"
```

---

### Task 4: Baseline serialize/parse, drift diff, scorecard format

**Files:**
- Modify: `src/dispatcher/metrics.ts`
- Test: `tests/dispatcher/metrics.test.ts` (append)

- [ ] **Step 1: Write the failing tests**

Append to `tests/dispatcher/metrics.test.ts`:

```ts
import {
  serializeBaseline,
  parseBaseline,
  diffMetrics,
  formatScorecard,
  type FourHuaMetrics,
} from "../../src/dispatcher/metrics"

const SAMPLE: FourHuaMetrics = {
  standardization: { machine_enforced: 12, total: 13 },
  intelligence: { llm_invokable: 11, total_subagents: 23 },
  automation: { automated_steps: 4, total_steps: 6 },
  efficiency: { install_steps: 1, runtime_node: ">=18", bundle_bytes: 907657 },
}

test("serializeBaseline → parseBaseline round-trips the metrics", () => {
  const parsed = parseBaseline(serializeBaseline(SAMPLE))
  expect(parsed).toEqual(SAMPLE)
})

test("serializeBaseline carries the do-not-hand-edit banner", () => {
  expect(serializeBaseline(SAMPLE)).toContain("GENERATED by")
  expect(serializeBaseline(SAMPLE)).toContain("do not hand-edit")
})

test("diffMetrics is empty when equal", () => {
  expect(diffMetrics(SAMPLE, SAMPLE)).toEqual([])
})

test("diffMetrics flags a drift-gated change", () => {
  const live = { ...SAMPLE, standardization: { machine_enforced: 13, total: 13 } }
  expect(diffMetrics(live, SAMPLE).length).toBeGreaterThan(0)
})

test("diffMetrics ignores bundle_bytes (display-only)", () => {
  const live = { ...SAMPLE, efficiency: { ...SAMPLE.efficiency, bundle_bytes: 999999 } }
  expect(diffMetrics(live, SAMPLE)).toEqual([])
})

test("formatScorecard renders all four 化 with rounded KB", () => {
  const s = formatScorecard(SAMPLE)
  expect(s).toContain("12/13")
  expect(s).toContain("11/23")
  expect(s).toContain("4/6")
  expect(s).toContain("~886 KB") // Math.round(907657/1024) = 886
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts -t 'baseline'`
Expected: FAIL — `serializeBaseline` not exported.

- [ ] **Step 3: Add serialize/parse/diff/format to `metrics.ts`**

Append to `src/dispatcher/metrics.ts`:

```ts
const BASELINE_BANNER = `# metrics/metrics-baseline.yaml
# GENERATED by \`sgc metrics --write-baseline\` — do not hand-edit.
# Dev/CI drift reference for the Phase-3 four-化 scorecard + README source.
# Regenerate after a drift-gated 化 changes (规范化 / 智能化 / 自动化 /
# 高效化 install_steps|runtime_node). efficiency.bundle_bytes is display-only.
`

export function serializeBaseline(m: FourHuaMetrics): string {
  const s = m.standardization
  const i = m.intelligence
  const a = m.automation
  const e = m.efficiency
  return (
    BASELINE_BANNER +
    `schema_version: "1"\n` +
    `standardization: { machine_enforced: ${s.machine_enforced}, total: ${s.total} }\n` +
    `intelligence: { llm_invokable: ${i.llm_invokable}, total_subagents: ${i.total_subagents} }\n` +
    `automation: { automated_steps: ${a.automated_steps}, total_steps: ${a.total_steps} }\n` +
    `efficiency: { install_steps: ${e.install_steps}, runtime_node: "${e.runtime_node}", bundle_bytes: ${e.bundle_bytes} }\n`
  )
}

export function parseBaseline(text: string): FourHuaMetrics {
  const d = yamlLoad(text) as FourHuaMetrics & { schema_version?: string }
  // Reconstruct only the four 化 fields so a round-trip is value-equal to a
  // FourHuaMetrics (drop the schema_version envelope key — bun's toEqual rejects
  // extra keys).
  return {
    standardization: d.standardization,
    intelligence: d.intelligence,
    automation: d.automation,
    efficiency: d.efficiency,
  }
}

/** Drift diff — covers the slow-changing fields; EXCLUDES efficiency.bundle_bytes
 *  (high-churn, display-only). Returns one string per mismatch. */
export function diffMetrics(live: FourHuaMetrics, baseline: FourHuaMetrics): string[] {
  const out: string[] = []
  const cmp = (label: string, x: number | string, y: number | string): void => {
    if (x !== y) out.push(`${label}: live=${x} baseline=${y}`)
  }
  cmp("standardization.machine_enforced", live.standardization.machine_enforced, baseline.standardization.machine_enforced)
  cmp("standardization.total", live.standardization.total, baseline.standardization.total)
  cmp("intelligence.llm_invokable", live.intelligence.llm_invokable, baseline.intelligence.llm_invokable)
  cmp("intelligence.total_subagents", live.intelligence.total_subagents, baseline.intelligence.total_subagents)
  cmp("automation.automated_steps", live.automation.automated_steps, baseline.automation.automated_steps)
  cmp("automation.total_steps", live.automation.total_steps, baseline.automation.total_steps)
  cmp("efficiency.install_steps", live.efficiency.install_steps, baseline.efficiency.install_steps)
  cmp("efficiency.runtime_node", live.efficiency.runtime_node, baseline.efficiency.runtime_node)
  // efficiency.bundle_bytes intentionally NOT compared.
  return out
}

export function formatScorecard(m: FourHuaMetrics): string {
  const kb = Math.round(m.efficiency.bundle_bytes / 1024)
  return [
    "sgc four-化 scorecard",
    "",
    `  规范化 standardization  ${m.standardization.machine_enforced}/${m.standardization.total} machine-enforced invariants`,
    `  智能化 intelligence     ${m.intelligence.llm_invokable}/${m.intelligence.total_subagents} LLM-invokable subagents (capacity, not quality)`,
    `  自动化 automation       ${m.automation.automated_steps}/${m.automation.total_steps} automated loop steps (2 intentional manual gates: work, ship)`,
    `  高效化 efficiency       ${m.efficiency.install_steps} install step · node ${m.efficiency.runtime_node} · ~${kb} KB bundle`,
  ].join("\n")
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts`
Expected: PASS (12 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/metrics.ts tests/dispatcher/metrics.test.ts
git commit -m "feat(metrics): baseline serialize/parse, drift diff (excl bundle_bytes), scorecard"
```

---

### Task 5: CLI glue + `sgc metrics` registration

**Files:**
- Create: `src/commands/metrics.ts`
- Modify: `src/sgc.ts` (defineCommand block + subCommands entry + header count)
- Test: `tests/dispatcher/metrics.test.ts` (append a CLI smoke test)

- [ ] **Step 1: Write the failing test**

Append to `tests/dispatcher/metrics.test.ts`:

```ts
import { runMetrics } from "../../src/commands/metrics"

test("runMetrics --json prints the four 化 from a repoRoot", async () => {
  const root = makeRoot()
  const lines: string[] = []
  const orig = console.log
  console.log = (m?: unknown) => lines.push(String(m))
  try {
    await runMetrics({ json: true, repoRoot: root })
  } finally {
    console.log = orig
    rmSync(root, { recursive: true, force: true })
  }
  const parsed = JSON.parse(lines.join("\n"))
  expect(parsed.standardization).toEqual({ machine_enforced: 2, total: 3 })
  expect(parsed.automation).toEqual({ automated_steps: 4, total_steps: 6 })
})

test("runMetrics --write-baseline writes a parseable baseline", async () => {
  const root = makeRoot()
  const origErr = console.error
  console.error = () => {}
  try {
    await runMetrics({ writeBaseline: true, repoRoot: root })
    const text = readFileSync(resolve(root, "metrics/metrics-baseline.yaml"), "utf8")
    expect(text).toContain("do not hand-edit")
    const parsed = parseBaseline(text)
    expect(parsed.intelligence).toEqual({ llm_invokable: 2, total_subagents: 6 })
  } finally {
    console.error = origErr
    rmSync(root, { recursive: true, force: true })
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts -t 'runMetrics'`
Expected: FAIL — `Cannot find module '../../src/commands/metrics'`.

- [ ] **Step 3: Create the CLI glue**

Create `src/commands/metrics.ts`:

```ts
// `sgc metrics` — four-化 product self-scorecard (Phase 3).
//
// Read-only; no LLM, no agent spawn, no events (same nature as reflect). The
// dispatcher logic lives at src/dispatcher/metrics.ts; this file is CLI glue.
// Spec: docs/superpowers/specs/2026-06-04-four-hua-metrics-design.md.

import { mkdirSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import {
  computeMetricsLive,
  computeRuntimeMetrics,
  formatScorecard,
  serializeBaseline,
} from "../dispatcher/metrics"

export interface MetricsCliOptions {
  json?: boolean
  writeBaseline?: boolean
  /** Override repo root (tests + --write-baseline). Default: derived from import.meta. */
  repoRoot?: string
}

const moduleDir = dirname(fileURLToPath(import.meta.url))
const defaultRoot = resolve(moduleDir, "..", "..")

export async function runMetrics(opts: MetricsCliOptions = {}): Promise<void> {
  const root = opts.repoRoot ?? defaultRoot
  if (opts.writeBaseline) {
    const live = computeMetricsLive(root)
    const path = resolve(root, "metrics", "metrics-baseline.yaml")
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, serializeBaseline(live), "utf8")
    console.error(`wrote: ${path}`)
    return
  }
  // With an explicit repoRoot (tests / dev), compute live from on-disk sources;
  // otherwise compute from the embedded/compiled product (real runtime).
  const m = opts.repoRoot ? computeMetricsLive(root) : computeRuntimeMetrics()
  console.log(opts.json ? JSON.stringify(m, null, 2) : formatScorecard(m))
}
```

- [ ] **Step 4: Register the command in `src/sgc.ts`**

Insert this block after the `reflect` defineCommand block (after `src/sgc.ts:617`):

```ts
// ── metrics (Phase 3 four-化) ──────────────────────────────────────────────

const metrics = defineCommand({
  meta: {
    name: "metrics",
    description: "Four-化 product self-scorecard (规范化/智能化/自动化/高效化), git-tracked, read-only",
  },
  args: {
    json: {
      type: "boolean",
      required: false,
      description: "Emit JSON FourHuaMetrics (default: human-readable scorecard)",
    },
    "write-baseline": {
      type: "boolean",
      required: false,
      description: "Recompute from sources and rewrite metrics/metrics-baseline.yaml (dev)",
    },
  },
  async run({ args }) {
    const { runMetrics } = await import("./commands/metrics")
    await runMetrics({
      json: args.json as boolean | undefined,
      writeBaseline: args["write-baseline"] as boolean | undefined,
    })
  },
})
```

Add to the `subCommands` map (`src/sgc.ts:914`, immediately before `doctor: () => doctor,`):

```ts
    metrics: () => metrics,
```

Update the header comment `src/sgc.ts:10-13`: change `19 subcommands` → `20 subcommands` and `16 mirrored as /sgc:* slash commands` → `17 mirrored as /sgc:* slash commands`.

> **Expected transient state:** between this task and Task 7, a live `sgc doctor`
> would report an (H) slash↔CLI parity FAIL (the CLI `metrics` subcommand has no
> `plugins/sgc/commands/metrics.md` yet — that lands in Task 7). This is expected
> and resolved by Task 7. This plan does not run `doctor` in that window (Task 5
> Step 5 runs only `metrics.test.ts`), so no false alarm.

- [ ] **Step 5: Run tests + smoke the real command**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts`
Expected: PASS (14 tests).

Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts metrics --json`
Expected: JSON with `"standardization":{"machine_enforced":12,"total":13}`, `"intelligence":{"llm_invokable":11,"total_subagents":23}`, `"automation":{"automated_steps":4,"total_steps":6}`.

- [ ] **Step 6: Commit**

```bash
git add src/commands/metrics.ts src/sgc.ts tests/dispatcher/metrics.test.ts
git commit -m "feat(metrics): sgc metrics command + CLI registration (19→20 subcommands)"
```

---

### Task 6: Generate the baseline + doctor drift check (K)

**Files:**
- Create: `metrics/metrics-baseline.yaml` (generated)
- Modify: `src/commands/doctor.ts` (add check J before the tally at `doctor.ts:476`)
- Test: `tests/dispatcher/metrics.test.ts` (append doctor-wiring test)

- [ ] **Step 1: Generate the real baseline**

Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts metrics --write-baseline`
Expected: `wrote: <repo>/metrics/metrics-baseline.yaml`. Inspect it — it must read
`standardization: { machine_enforced: 12, total: 13 }`, `intelligence: { llm_invokable: 11, total_subagents: 23 }`, `automation: { automated_steps: 4, total_steps: 6 }`, `efficiency: { install_steps: 1, runtime_node: ">=18", bundle_bytes: <N> }`.

- [ ] **Step 2: Write the failing doctor test**

Append to `tests/dispatcher/metrics.test.ts`:

```ts
import { runDoctor } from "../../src/commands/doctor"
import { computeMetricsLive as _live, serializeBaseline as _ser } from "../../src/dispatcher/metrics"

function makeRootWithBaseline(): string {
  const root = makeRoot()
  mkdirSync(resolve(root, "src"), { recursive: true })
  writeFileSync(resolve(root, "src/sgc.ts"), "// stub entry so hasSource is true\n")
  mkdirSync(resolve(root, "metrics"), { recursive: true })
  writeFileSync(resolve(root, "metrics/metrics-baseline.yaml"), _ser(_live(root)))
  return root
}

test("doctor metrics check passes when baseline is in sync", async () => {
  const root = makeRootWithBaseline()
  try {
    const report = await runDoctor({ repoRoot: root, log: () => {} })
    expect(report.rows.some((r) => r.msg.includes("metrics baseline in sync") && r.severity === "ok")).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("doctor metrics check fails on on-disk source drift", async () => {
  const root = makeRootWithBaseline()
  try {
    // Mutate a drift-gated source WITHOUT regenerating the baseline.
    writeFileSync(
      resolve(root, "contracts/invariant-enforcement.yaml"),
      `invariants:\n  "1": { machine_enforced: true }\n  "2": { machine_enforced: true }\n  "3": { machine_enforced: true }\n`,
    )
    const report = await runDoctor({ repoRoot: root, log: () => {} })
    expect(report.rows.some((r) => r.msg.includes("metrics drift") && r.severity === "fail")).toBe(true)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test("doctor metrics check tolerates a bundle_bytes-only difference", async () => {
  const root = makeRootWithBaseline()
  try {
    // Rewrite the bundle stub larger; bundle_bytes is NOT drift-gated.
    writeFileSync(resolve(root, "plugins/sgc/bin/sgc.mjs"), "// stub bundle\n".repeat(500))
    const report = await runDoctor({ repoRoot: root, log: () => {} })
    expect(report.rows.some((r) => r.msg.includes("metrics drift") && r.severity === "fail")).toBe(false)
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
```

- [ ] **Step 3: Run the doctor test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts -t 'doctor metrics'`
Expected: FAIL — no `metrics baseline in sync` row exists yet.

- [ ] **Step 4: Add check (K) to `doctor.ts`**

`doctor.ts` already uses `(J)` for bundle-hash parity (`doctor.ts:471`), so the
new metrics check is `(K)`. Add the static import near the other dispatcher
imports (`src/commands/doctor.ts:30`):

```ts
import { computeMetricsLive, parseBaseline, diffMetrics } from "../dispatcher/metrics"
```

Insert this block in `runDoctor` **immediately after `emit(await bundleParityCheck(root))`
(`doctor.ts:474`), before the tally `const ok = rows.filter(...)` (`doctor.ts:476`)**:

```ts
  // ── (K) metrics baseline drift ──────────────────────────────────────────
  log("")
  log("=== metrics baseline drift ===")
  const baselinePath = resolve(root, "metrics", "metrics-baseline.yaml")
  if (!hasSource) {
    emit({ severity: "ok", msg: "  ⓘ metrics baseline skipped (no source checkout — dev/CI-only check)" })
  } else if (!existsSync(baselinePath)) {
    emit({ severity: "fail", msg: "  ✗ metrics/metrics-baseline.yaml missing — run `sgc metrics --write-baseline`" })
  } else {
    try {
      const live = computeMetricsLive(root)
      const baseline = parseBaseline(readFileSync(baselinePath, "utf8"))
      const drifts = diffMetrics(live, baseline)
      if (drifts.length === 0) {
        emit({ severity: "ok", msg: "  ✓ metrics baseline in sync (live == baseline; bundle_bytes excluded)" })
      } else {
        for (const d of drifts) emit({ severity: "fail", msg: `  ✗ metrics drift — ${d}` })
        emit({ severity: "fail", msg: "  ✗ regenerate: `sgc metrics --write-baseline`" })
      }
    } catch (e) {
      emit({ severity: "fail", msg: `  ✗ metrics baseline check error: ${(e as Error).message.slice(0, 80)}` })
    }
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/metrics.test.ts`
Expected: PASS (17 tests).

Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor 2>&1 | grep -A2 'metrics baseline drift'`
Expected: `✓ metrics baseline in sync`.

- [ ] **Step 6: Commit**

```bash
git add metrics/metrics-baseline.yaml src/commands/doctor.ts tests/dispatcher/metrics.test.ts
git commit -m "feat(metrics): committed baseline + doctor (J) drift gate"
```

---

### Task 7: Slash command + README + audit corrections

**Files:**
- Create: `plugins/sgc/commands/metrics.md`
- Modify: `README.md` (add four-化 numbers referencing the baseline + the command table row)
- Modify: `docs/CAPABILITY-ABSORPTION-AUDIT.md:144,157,166` (correct stale values)
- Modify: `plugins/sgc/CLAUDE.md` (add `/metrics` to the command table)

- [ ] **Step 1: Create the slash command**

Create `plugins/sgc/commands/metrics.md` (mirror `reflect.md`'s resolver block):

```markdown
---
name: metrics
description: "Four-化 product self-scorecard: 规范化/智能化/自动化/高效化, computed from git-tracked artifacts. Read-only."
---

# /sgc:metrics

Reports sgc's four-化 scorecard — 规范化 (machine-enforced invariants), 智能化 (LLM-invokable subagents, a capacity proxy not a quality score), 自动化 (automated loop steps), 高效化 (install steps · runtime · bundle). Computed live from embedded contracts + compiled loop symbols; read-only, zero LLM, zero writes.

## Invocation

```bash
if   [ -f "$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs" ]; then SGC="node $CLAUDE_PLUGIN_ROOT/bin/sgc.mjs"
elif command -v sgc >/dev/null 2>&1;          then SGC=sgc
elif test -f src/sgc.ts;                      then SGC="bun src/sgc.ts"
else echo "sgc CLI not found — /plugin install sgc, or npm i -g @sdsrs/sgc, or https://github.com/sdsrss/sgc#install" >&2; exit 1
fi

$SGC metrics                  # human-readable scorecard
$SGC metrics --json           # machine form (FourHuaMetrics)
$SGC metrics --write-baseline # dev: recompute + rewrite metrics/metrics-baseline.yaml
```

## What you should do

1. Run the CLI verbatim; stream the scorecard.
2. 智能化 is a CAPACITY proxy (how many agents can invoke an LLM), NOT a quality score — say so if asked.
3. `--write-baseline` is a dev-only refresh; `sgc doctor` fails if `metrics/metrics-baseline.yaml` drifts from a live recompute.

## Notes

- Read-only. The baseline is a dev/CI drift reference + README source; it is not read at user runtime (the scorecard is computed from the embedded product).
```

- [ ] **Step 2: Verify slash↔CLI parity (doctor H)**

Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor 2>&1 | grep -iE 'metrics|parity|slash'`
Expected: no `metrics` parity failure (the `.md` now matches the CLI subcommand).

- [ ] **Step 3: Correct the stale audit values**

In `docs/CAPABILITY-ABSORPTION-AUDIT.md`:
- Line 144 (`高效化 | 安装步数 ｜ 运行时依赖 | **2 步** ... bun ≥1.3`): change to `**1 步**（`/plugin install` 自带 bundle）｜ `node ≥18`（bun 已移除）`.
- Line 157 (`智能化 —— 10 LLM agents`): change `10` → `11`（`planner.decompose` Phase 2b 新增；6 个 reviewer stub `prompt_path:null` 不计入 LLM-invokable）.
- Line 166 (`**安装 2 步** ... 运行时依赖 `bun ≥1.3``): change to `安装 1 步 ... 运行时依赖 `node ≥18``.

- [ ] **Step 4: Add the four-化 numbers + command row to README**

In `README.md`, add a "Four-化 scorecard" line that cites the baseline (run `sgc metrics` to reproduce): `规范化 12/13 · 智能化 11/23 LLM-invokable · 自动化 4/6 · 高效化 1 step·node≥18`. Add `/metrics` to the command table (read-only scorecard). Note "numbers are produced by `sgc metrics`; see `metrics/metrics-baseline.yaml`" so they are not hand-maintained (anti-drift, 类 ARCH-2).

In `plugins/sgc/CLAUDE.md`, add a `/metrics` row to the Commands table: `Four-化 product self-scorecard (read-only)`.

- [ ] **Step 5: Commit**

```bash
git add plugins/sgc/commands/metrics.md README.md docs/CAPABILITY-ABSORPTION-AUDIT.md plugins/sgc/CLAUDE.md
git commit -m "docs(metrics): /metrics slash + README four-化 + audit §5 corrections"
```

---

### Task 8: Rebuild bundle, full verification, regenerate baseline

The bundle inlines `src/` + `package.json`; rebuild now that all source is final.

**Files:**
- Modify: `plugins/sgc/bin/sgc.mjs` (rebuilt)
- Modify: `metrics/metrics-baseline.yaml` (regenerated post-build for an accurate `bundle_bytes`)

- [ ] **Step 1: Rebuild the bundle**

Run: `npm run build:cli`
Expected: rebuilds `plugins/sgc/bin/sgc.mjs` with `metrics` compiled in.

- [ ] **Step 2: Verify the bundle runs under node (not just bun)**

Run: `node plugins/sgc/bin/sgc.mjs metrics --json`
Expected: JSON with `12/13`, `11/23`, `4/6` — proves the bundle is not a false-green SHA-parity (per `feedback_import_meta_main_breaks_bun_bundle`).

- [ ] **Step 3: Regenerate the baseline for the rebuilt bundle size**

Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts metrics --write-baseline`
Expected: `metrics/metrics-baseline.yaml` updated (`bundle_bytes` now matches the freshly built bundle). The drift-gated fields are unchanged.

- [ ] **Step 4: Run the full dispatcher + eval lanes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher tests/eval`
Expected: all green (per `feedback_sgc_test_lane_divergence` — both lanes must pass before ship). Note the prior dispatcher baseline count and confirm it grew by the new `metrics.test.ts` cases.

- [ ] **Step 5: Run doctor + typecheck**

Run: `SGC_FORCE_INLINE=1 bun src/sgc.ts doctor` and `npm run typecheck`
Expected: doctor all-green including `✓ metrics baseline in sync` and `✓ committed bundle matches source rebuild` and slash↔CLI parity (now 20 CLI / 17 slash); `tsc --noEmit` clean.

- [ ] **Step 6: Commit (bundle mode 100755)**

```bash
git add --chmod=+x plugins/sgc/bin/sgc.mjs
git add metrics/metrics-baseline.yaml
git commit -m "build(metrics): rebuild bundle + regenerate baseline for shipped numbers"
```

---

## Self-Review (run after writing the plan)

**Spec coverage:** every spec section maps to a task — 规范化/智能化/自动化 (T2), live+runtime computes incl. 高效化 (T3), baseline I/O + drift diff (T4), command + registration (T5), baseline gen + doctor J (T6), slash + README + audit (T7), build + verify + regen (T8); `MANUAL_GATES` export (T1). Acceptance #1–#9 all covered (scorecard+json T5; parse-YAML 规范化 T2; prompt_path 智能化 T2; STEPS/MANUAL_GATES T1/T2; baseline+doctor+negative-case T6; slash+count T5/T7; README+audit T7; honesty in formatScorecard label T4 + audit T7; build+lanes+doctor T8).

**Placeholder scan:** none — every code step shows full code; every run step shows the exact command + expected output.

**Type consistency:** `FourHuaMetrics` defined in T2, used identically in T3–T6. Function names stable: `computeStandardization` / `computeIntelligence` / `computeAutomation` / `computeFromInputs` (T2), `computeMetricsLive` / `computeRuntimeMetrics` (T3), `serializeBaseline` / `parseBaseline` / `diffMetrics` / `formatScorecard` (T4), `runMetrics` (T5). `IE_FIXTURE` / `CAPS_FIXTURE` / `makeRoot` defined once in the test file and reused by later appended tests.

## Risks / watch-items

- **`loadSpec` on a minimal capabilities fixture** (T2): if the preprocessor requires keys beyond `subagents`, the fixture may need a minimal envelope. If `computeIntelligence(CAPS_FIXTURE)` throws, wrap the fixture with whatever top-level keys `loadSpec` demands (check `src/dispatcher/preprocessor.ts`), keeping the `subagents` shape.
- **`import packageJson from "../../package.json"`** (T3): matches `src/sgc.ts:21`'s bare JSON import; bun inlines it into the bundle. If `tsc` complains, the repo already imports package.json this way in `sgc.ts`, so `resolveJsonModule` is on.
- **Bundle re-inlines `package.json`** (T8): the build must run AFTER any `package.json` change. This plan does not edit `package.json` (Option C ships nothing new), so only `src/` changes drive the rebuild.
