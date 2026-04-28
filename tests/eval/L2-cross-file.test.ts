// Eval scenario: L2 cross-file — contract-Δ requiring full planning cluster.
//
// User story: "add a new field to the public API response"
// Expected pipeline: classifier → {planner.eng, planner.ceo, researcher.history}
//                    → work → review → qa → ship → janitor(compound) → compound
// Invariants exercised: §1 (reviewer isolation), §2 (intent immutable),
//                       §6 (janitor logged), §7 (schema validate), §8 (scope pin),
//                       §10 (compound transaction), §11 (rationale), §12 (this)
//
// L2 rules:
//   - intent.md required, motivation ≥20 words
//   - 3-way parallel planner cluster (no adversarial)
//   - code review + qa evidence both required before ship
//   - janitor decides compound (L2_plus_success reason)
//   - compound cluster writes a solution entry with dedup_stamp

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  listSolutions,
  readIntent,
  readJanitorDecision,
  readReview,
  readShip,
} from "../../src/dispatcher/state"
import {
  agentsInvoked,
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
  seedSolution,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-L2-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("L2 cross-file scenario (eval §12)", () => {
  test("end-to-end: plan (3-way cluster) → work → review → qa → ship → compound", async () => {
    // Seed into non-SOLUTION_CATEGORIES dir so listSolutions ignores it but
    // preFilterSolutions finds the keyword match — ensures T6 short-circuit
    // does not skip researcher.history spawn (line 61 assertion).
    seedSolution(
      tmp,
      "_seed",
      "api-field",
      "add new field to public API response payload endpoint.",
    )
    // STEP 1: plan — L2 classification + 3-way cluster
    const plan = await runPlan(
      "add a new field to the public API response payload",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    expect(plan.level).toBe("L2")
    expect(existsSync(resolve(tmp, "decisions", plan.taskId, "intent.md"))).toBe(true)

    const agents = agentsInvoked(tmp)
    expect(agents).toContain("classifier.level")
    expect(agents).toContain("planner.eng")
    expect(agents).toContain("planner.ceo")
    expect(agents).toContain("researcher.history")
    // L2 does NOT spawn adversarial
    expect(agents).not.toContain("planner.adversarial")

    // Invariant §11: intent body carries rationale reference
    const intent = readIntent(plan.taskId, tmp)
    expect(intent.body ?? "").toMatch(/Classifier rationale/)

    // STEP 2: work
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })

    // STEP 3: review (code)
    const review = await runReview({
      stateRoot: tmp,
      diffOverride: "diff --git a/api.ts b/api.ts\n+++ b/api.ts\n+  extraField: string\n",
      log: () => {},
    })
    expect(review.verdict).toBe("pass")
    const codeReview = readReview(plan.taskId, "code", "reviewer.correctness", tmp)
    expect(codeReview?.report.verdict).toBe("pass")

    // STEP 4: qa (L2+ gate)
    const qa = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: ["home", "api-extra-field"],
      log: () => {},
    })
    expect(qa.verdict).toBe("concern")

    // STEP 5: ship — expect janitor=compound + compoundAction
    const ship = await runShip({ stateRoot: tmp, log: () => {} })
    expect(ship.shipPath).not.toBeNull()
    const { ship: shipDoc } = readShip(plan.taskId, tmp)
    expect(shipDoc.outcome).toBe("success")
    expect(shipDoc.linked_reviews.length).toBeGreaterThanOrEqual(1)

    // Janitor: L2_plus_success triggers compound
    expect(ship.janitorDecision?.decision).toBe("compound")
    expect(ship.janitorDecision?.reason_code).toBe("L2_plus_success")
    expect(readJanitorDecision(plan.taskId, tmp)).not.toBeNull()

    // Compound ran and wrote a solution entry
    expect(ship.compoundAction).toBe("compound")
    const entries = listSolutions(tmp)
    expect(entries.length).toBe(1)
    expect(entries[0]?.entry.source_task_ids).toContain(plan.taskId)
  })

  test("L2 without qa evidence: ship refused (§6 gate)", async () => {
    await runPlan("add a new field to the public API response payload", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    // No runQa
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/qa evidence/)
  })

  test("Invariant §8: reviewer prompt does not grant read:solutions", async () => {
    const plan = await runPlan(
      "add a new field to the public API response payload",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    // reviewer.correctness now uses prompt_path (external template). The
    // template itself never mentions read:solutions, and computeSubagentTokens
    // strips it at the token-computation layer (tested in reviewer-isolation).
    const promptDir = resolve(tmp, "progress/agent-prompts")
    const { readdirSync } = await import("node:fs")
    const reviewPrompt = readdirSync(promptDir).find((f) =>
      f.includes("reviewer.correctness"),
    )
    expect(reviewPrompt).toBeDefined()
    const text = readFileSync(resolve(promptDir, reviewPrompt!), "utf8")
    // Whether synthesized or template-based, read:solutions must not appear
    expect(text).not.toContain("read:solutions")
    void plan
  })
})
