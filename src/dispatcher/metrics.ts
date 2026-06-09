// src/dispatcher/metrics.ts
//
// Phase 3 four-化 product self-scorecard. Pure compute over git-tracked /
// compiled artifacts; no .sgc/ runtime read, no LLM, no events. See
// docs/superpowers/specs/2026-06-04-four-hua-metrics-design.md (Option C).

import { loadSpec } from "./preprocessor"
import { load as yamlLoad } from "js-yaml"
import { STEPS, MANUAL_GATES } from "./loop"
import { readFileSync, statSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { readContract } from "./embedded-data"
import packageJson from "../../package.json"

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

// 自动化 — human-gate count across the FULL plan→ship→compound→reuse lifecycle,
// NOT just the loop orchestrator's slots. The prior metric counted only the 6
// loop STEPS and so missed the CE knowledge-arc reality the audit flagged
// (P2-5, docs/COMPREHENSIVE-AUDIT-v1.29.1.md §4.2): capture is automatic, but
// PROMOTE is a deliberate human gate — the operator hand-fills prevention_seed
// (compound-promote.ts) — and reuse (recordApplied / recordSurfaced inside
// `sgc plan`) is automatic again. Human gates total 4: work (operator
// implements) + qa (operator supplies the target URL + runs the smoke; the
// orchestrator has none to pass) + ship (L3 human signature, Invariant §4) +
// promote. The loop's own `compound` step is the post-ship janitor decision
// (automatic) and is distinct from this failure-capture → manual-promote →
// reuse arc.
const CE_ARC_STAGES = ["capture", "promote", "reuse"] as const
const CE_ARC_HUMAN_GATES = new Set<(typeof CE_ARC_STAGES)[number]>(["promote"])

/** 自动化 — from compiled loop symbols + the CE knowledge arc (layout-independent). */
export function computeAutomation(): FourHuaMetrics["automation"] {
  const loopAuto = STEPS.filter((s) => !MANUAL_GATES.has(s)).length
  const ceAuto = CE_ARC_STAGES.filter((s) => !CE_ARC_HUMAN_GATES.has(s)).length
  return {
    automated_steps: loopAuto + ceAuto,
    total_steps: STEPS.length + CE_ARC_STAGES.length,
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
    const self = fileURLToPath(import.meta.url)
    // When running AS the bundle, import.meta.url IS sgc.mjs → measure it.
    // In source mode (`bun src/sgc.ts`), it points at this .ts file (~9 KB),
    // which would mis-report the bundle as the source-file size — resolve the
    // committed bundle relative to the repo root instead.
    if (self.endsWith("sgc.mjs")) {
      bundleBytes = statSync(self).size
    } else {
      // src/dispatcher/metrics.ts → ../.. → repo root
      const repoRoot = resolve(dirname(self), "..", "..")
      bundleBytes = statSync(resolve(repoRoot, "plugins/sgc/bin/sgc.mjs")).size
    }
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
    `  自动化 automation       ${m.automation.automated_steps}/${m.automation.total_steps} automated lifecycle stages (4 human gates: work, qa, ship, compound-promote)`,
    `  高效化 efficiency       ${m.efficiency.install_steps} install step · node ${m.efficiency.runtime_node} · ~${kb} KB bundle`,
  ].join("\n")
}
