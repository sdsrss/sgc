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
