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

test("computeAutomation derives 6/9 from loop + CE-arc symbols", () => {
  // 4 auto loop steps (plan/review/qa/compound) + 2 auto CE-arc stages
  // (capture/reuse); 3 human gates: work, ship, compound-promote.
  expect(computeAutomation()).toEqual({ automated_steps: 6, total_steps: 9 })
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
  expect(m.automation).toEqual({ automated_steps: 6, total_steps: 9 })
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
    expect(m.automation).toEqual({ automated_steps: 6, total_steps: 9 })
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
  expect(m.automation).toEqual({ automated_steps: 6, total_steps: 9 })
  expect(m.efficiency.runtime_node).toBe(">=18")
  expect(typeof m.efficiency.bundle_bytes).toBe("number")
})

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
  expect(parsed.automation).toEqual({ automated_steps: 6, total_steps: 9 })
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
