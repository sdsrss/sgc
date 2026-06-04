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
