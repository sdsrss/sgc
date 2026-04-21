// Eval scenario: qa.browser with injected subprocess runner.
//
// Exercises the L2+ QA gate: sgc qa spawns qa.browser agent, which in
// production shells out to `plugins/sgc/browse/dist/browse`. Eval uses
// the injectable browseRunner to avoid launching chromium — keeps CI
// hermetic (Invariant §12 authoritative).
//
// Invariants exercised: §1 (qa.browser no read:solutions), §6 (review
// append-only + janitor logged), §8 (scope pin), §12 (this)
//
// Paths covered:
//   (a) pass: valid target + flows → pass review, ship gate clears
//   (b) fail with evidence: mock runner returns screenshots + failed_flows
//       → fail review stored with high severity
//   (c) concern: empty flows → concern verdict
//   (d) second qa for same task → AppendOnly (Invariant §6)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { qaBrowser } from "../../src/dispatcher/agents/qa-browser"
import { hasQaEvidence, readReview } from "../../src/dispatcher/state"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-qa-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

async function seedL2() {
  return runPlan("add a new field to the public API response payload", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION_FIXTURE,
    log: () => {},
  })
}

describe("qa.browser eval (eval §12)", () => {
  test("stub path: runQa writes qa review with concern + hasQaEvidence becomes true", async () => {
    const plan = await seedL2()
    const r = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: ["home", "login"],
      log: () => {},
    })
    expect(r.verdict).toBe("concern")
    const stored = readReview(plan.taskId, "qa", "qa.browser", tmp)
    expect(stored?.report.stage).toBe("qa")
    expect(stored?.report.reviewer_id).toBe("qa.browser")
    expect(hasQaEvidence(plan.taskId, tmp)).toBe(true)
  })

  test("injected browseRunner with fail + evidence_refs propagates through", async () => {
    // Unit-level: qaBrowser respects injected browseRunner (the contract
    // runQa relies on). The production path wires through spawn's
    // inlineStub; this test asserts the injectable surface works as
    // documented without launching chromium.
    const r = await qaBrowser(
      { target_url: "http://localhost:3000", user_flows: ["submit-order"] },
      {
        browseRunner: async () => ({
          verdict: "fail",
          evidence_refs: ["/tmp/screens/s1.png", "/tmp/screens/s2.png"],
          failed_flows: [
            { flow: "submit-order", step: "click Pay", observed: "button not found" },
          ],
        }),
      },
    )
    expect(r.verdict).toBe("fail")
    expect(r.evidence_refs.length).toBe(2)
    expect(r.failed_flows[0]?.observed).toMatch(/button not found/)
  })

  test("missing target → fail review with high severity", async () => {
    const plan = await seedL2()
    const r = await runQa({
      stateRoot: tmp,
      target: "",
      flows: ["home"],
      log: () => {},
    })
    expect(r.verdict).toBe("fail")
    const stored = readReview(plan.taskId, "qa", "qa.browser", tmp)
    expect(stored?.report.severity).toBe("high")
  })

  test("empty flows → concern verdict", async () => {
    await seedL2()
    const r = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: [],
      log: () => {},
    })
    expect(r.verdict).toBe("concern")
  })

  test("Invariant §6: second qa for same task refused (append-only)", async () => {
    await seedL2()
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
    await expect(
      runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} }),
    ).rejects.toThrow(/append-only/)
  })
})
