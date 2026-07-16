// B4 / audit v1.37.0 F5: the heuristic classifier under-classifies a genuinely
// architectural task phrased WITHOUT an L2/L3 trigger word. In the default
// no-LLM path such a task floors at L1 and skips the review cluster, qa gate,
// and (if L3) signature gate — the floor protects against an LLM under-
// classifying, but not against the heuristic's own keyword blind spot.
//
// The audit's example — "rework how the dispatcher hands results between
// stages" — has no API/schema/migration/refactor keyword. B4 adds a
// conservative structural set that escalates restructuring / cross-cutting
// language to L2 (the review+qa cluster), NOT L3: over-classifying is the safe
// error here (the module's own stance), and L2 avoids the L3 signature ceremony
// for a fuzzy verb match.

import { describe, expect, it } from "bun:test"
import { classifierLevelHeuristic } from "../../src/dispatcher/agents/classifier-level"

const lvl = (s: string) => classifierLevelHeuristic({ user_request: s }).level

describe("classifierLevelHeuristic — structural signals (B4/F5)", () => {
  it("escalates keyword-free architectural rework to at least L2", () => {
    expect(lvl("rework how the dispatcher hands results between stages")).toBe("L2")
    expect(lvl("restructure the plan-fusion flow")).toBe("L2")
    expect(lvl("redesign how state moves across the modules")).toBe("L2")
    expect(lvl("overhaul the control-flow of the spawn pipeline")).toBe("L2")
  })

  it("does NOT escalate ordinary single-unit work", () => {
    // No restructuring/cross-cutting language → stays the conservative L1.
    expect(lvl("add a small helper function to format dates")).toBe("L1")
    expect(lvl("fix the off-by-one in the pagination cursor")).toBe("L1")
  })

  it("strong-L0 short-circuit still wins over a structural verb", () => {
    // A trivial edit phrased with an incidental structural word stays L0.
    expect(lvl("fix a typo in the redesign notes")).toBe("L0")
  })

  it("does not downgrade an L3 architectural task", () => {
    expect(lvl("rework the module architecture")).toBe("L3")
  })
})
