// Eval scenario: L1 bugfix — single-file change with review.
//
// User story: "fix the null pointer crash when the config file is missing"
// Expected pipeline: classifier → planner.eng → work → review → ship
// Invariants exercised: §1 (reviewer no-solutions), §2 (intent immutable),
//                       §5 (override reason length), §6 (janitor log),
//                       §7 (schema validate), §11 (rationale), §12 (this)
//
// L1 rules:
//   - intent.md written (required for L1+)
//   - only planner.eng (no CEO, no researcher, no adversarial)
//   - 1+ code reviews required before ship
//   - janitor decides skip (clean L1 with severity=none → default conservative)
//   - no qa evidence needed (L2+ only)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  listSolutions,
  readIntent,
  readJanitorDecision,
  readReview,
  readShip,
  StateError,
  writeIntent,
} from "../../src/dispatcher/state"
import {
  agentsInvoked,
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-L1-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("L1 bugfix scenario (eval §12)", () => {
  test("end-to-end: plan → work --done → review → ship", async () => {
    // STEP 1: plan — expect L1, intent.md written
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    expect(plan.level).toBe("L1")
    expect(existsSync(resolve(tmp, "decisions", plan.taskId, "intent.md"))).toBe(true)

    // Classifier + planner.eng only (no ceo, no researcher, no adversarial)
    const agents = agentsInvoked(tmp)
    expect(agents).toContain("classifier.level")
    expect(agents).toContain("planner.eng")
    expect(agents).not.toContain("planner.ceo")
    expect(agents).not.toContain("researcher.history")
    expect(agents).not.toContain("planner.adversarial")

    // Invariant §11 rationale specificity
    const intent = readIntent(plan.taskId, tmp)
    expect(intent.body ?? "").toMatch(/Classifier rationale/)

    // STEP 2: work
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // STEP 3: review
    const review = await runReview({
      stateRoot: tmp,
      diffOverride: "+  if (!fs.existsSync(configPath)) return DEFAULT_CONFIG\n",
      log: () => {},
    })
    expect(review.verdict).toBe("pass")
    const storedReview = readReview(plan.taskId, "code", "reviewer.correctness", tmp)
    expect(storedReview?.report.verdict).toBe("pass")

    // STEP 4: ship — expect success + janitor skip
    const ship = await runShip({ stateRoot: tmp, log: () => {} })
    expect(ship.shipPath).not.toBeNull()
    const { ship: shipDoc } = readShip(plan.taskId, tmp)
    expect(shipDoc.outcome).toBe("success")
    expect(shipDoc.linked_reviews).toContain(storedReview!.report.report_id)

    // Janitor: skip (clean L1 + default_conservative)
    expect(ship.janitorDecision?.decision).toBe("skip")
    expect(ship.janitorDecision?.reason_code).toBe("default_conservative")
    expect(ship.compoundAction).toBeUndefined()

    // No solution entry (janitor skipped compound)
    expect(listSolutions(tmp).length).toBe(0)
    expect(readJanitorDecision(plan.taskId, tmp)).not.toBeNull()
  })

  test("§2 intent immutability: direct writeIntent call rejected", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    // Try to overwrite the intent directly
    const original = readIntent(plan.taskId, tmp)
    expect(() =>
      writeIntent({ ...original, title: "MALICIOUS EDIT" }, tmp),
    ).toThrow(StateError)
  })

  test("§7 schema validate: intent has all required fields on disk", async () => {
    const plan = await runPlan(
      "fix the null pointer crash when the config file is missing on startup",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    const text = readFileSync(
      resolve(tmp, "decisions", plan.taskId, "intent.md"),
      "utf8",
    )
    // Required fields per schema: task_id, level, created_at, title,
    // motivation, affected_readers, scope_tokens
    expect(text).toContain("task_id:")
    expect(text).toContain("level: L1")
    expect(text).toContain("created_at:")
    expect(text).toContain("title:")
    expect(text).toContain("motivation:")
    expect(text).toContain("affected_readers:")
    expect(text).toContain("scope_tokens:")
  })
})
