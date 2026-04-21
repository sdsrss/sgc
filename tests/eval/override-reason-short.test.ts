// Eval scenario: Invariant §5 — override.reason must be ≥40 chars.
//
// When a code review returns verdict=fail, ship requires a populated
// `override` with `reason.length ≥ 40`. Short or missing overrides
// cause runShip to throw before writing ship.md.
//
// Invariants exercised: §5 (override reason length gate), §12 (this)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
  seedFailingReview,
  seedPassingReview,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-override-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("Invariant §5: override.reason ≥40 chars", () => {
  test("ship rejects verdict=fail review with no override", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // Seed a failing review with no override
    seedFailingReview(tmp, plan.taskId)

    await expect(
      runShip({ stateRoot: tmp, runJanitor: false, log: () => {} }),
    ).rejects.toThrow(/override.*≥40 chars.*Invariant §5/i)
  })

  test("ship rejects verdict=fail review with short override (<40 chars)", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // Seed a failing review with a short override reason (< 40 chars)
    seedFailingReview(tmp, plan.taskId, {
      override: {
        by: "eval-user",
        at: new Date().toISOString(),
        reason: "too short",  // 9 chars, well under 40
      },
    })

    await expect(
      runShip({ stateRoot: tmp, runJanitor: false, log: () => {} }),
    ).rejects.toThrow(/override.*≥40 chars.*Invariant §5/i)
  })

  test("ship accepts verdict=fail review with override reason ≥40 chars", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // Seed a failing review with a valid override reason (≥ 40 chars)
    seedFailingReview(tmp, plan.taskId, {
      override: {
        by: "eval-user",
        at: new Date().toISOString(),
        reason:
          "This failure is a false positive caused by the stub reviewer returning a generic finding that does not apply to the actual change",
      },
    })

    const ship = await runShip({ stateRoot: tmp, runJanitor: false, log: () => {} })
    expect(ship.taskId).toBe(plan.taskId)
    expect(ship.shipPath).not.toBeNull()
  })

  test("ship proceeds when all reviews pass (no override needed)", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // Seed a passing review
    seedPassingReview(tmp, plan.taskId)

    const ship = await runShip({ stateRoot: tmp, runJanitor: false, log: () => {} })
    expect(ship.taskId).toBe(plan.taskId)
    expect(ship.shipPath).not.toBeNull()
  })
})
