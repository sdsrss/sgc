// GS-3 plan-fusion — unit tests.
// Spec: tasks/specs/gs-3-plan-fusion.md (r1).

import { describe, expect, test } from "bun:test"
import { worstPlanVerdict } from "../../src/dispatcher/fuse-plan"

describe("worstPlanVerdict", () => {
  test("reject beats revise beats approve", () => {
    expect(worstPlanVerdict("approve", "revise")).toBe("revise")
    expect(worstPlanVerdict("revise", "reject")).toBe("reject")
    expect(worstPlanVerdict("approve", "reject")).toBe("reject")
  })
  test("equal verdicts return the same", () => {
    expect(worstPlanVerdict("approve", "approve")).toBe("approve")
    expect(worstPlanVerdict("reject", "reject")).toBe("reject")
  })
  test("order-independent", () => {
    expect(worstPlanVerdict("reject", "approve")).toBe("reject")
    expect(worstPlanVerdict("revise", "approve")).toBe("revise")
  })
})
