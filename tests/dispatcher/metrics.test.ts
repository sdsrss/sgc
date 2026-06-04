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
