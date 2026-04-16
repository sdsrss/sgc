// Eval scenario: L3 migration with human signature + adversarial review.
//
// User story: "add a database migration to rename column"
// Expected pipeline: classifier → {planner.eng, planner.ceo, researcher.history,
//                    planner.adversarial} → work → review → qa → ship(yes)
//                    → janitor(compound)
// Invariants exercised: §4 (L3 needs human signature, --auto refused),
//                       §6 (janitor logged), §10 (compound atomic), §12 (this)
//
// L3 rules:
//   - classifier returns L3 on migration keyword
//   - plan refuses without --signed-by
//   - plan asks for "yes" confirmation; "no" → throw, no intent.md written
//   - plan refuses --auto even with signature
//   - 4-way planner cluster (adversarial added)
//   - ship also requires "yes" confirmation; --auto refused
//   - janitor decides compound (L2_plus_success branch covers L3 too)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync } from "node:fs"
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
  readShip,
} from "../../src/dispatcher/state"
import {
  agentsInvoked,
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

const SIG = { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" }

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-L3-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("L3 migration scenario (eval §12)", () => {
  test("plan refuses without --signed-by (§4)", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        log: () => {},
      }),
    ).rejects.toThrow(/L3 plan requires human signature/)
  })

  test("plan refuses --auto even with signature (§4)", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        userSignature: SIG,
        autoConfirm: true,
        log: () => {},
      }),
    ).rejects.toThrow(/refuses --auto/)
  })

  test("plan with 'no' confirmation → throw + no intent.md", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        userSignature: SIG,
        readConfirmation: async () => "no",
        log: () => {},
      }),
    ).rejects.toThrow(/not confirmed/)
    // No intent.md written for the aborted task
    const { readdirSync } = await import("node:fs")
    const decisionsDir = resolve(tmp, "decisions")
    const taskDirs = existsSync(decisionsDir) ? readdirSync(decisionsDir) : []
    for (const d of taskDirs) {
      expect(existsSync(resolve(decisionsDir, d, "intent.md"))).toBe(false)
    }
  })

  test("end-to-end: plan(yes) → work → review → qa → ship(yes) → compound", async () => {
    const plan = await runPlan(
      "add a database migration to rename column in orders table",
      {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        userSignature: SIG,
        readConfirmation: async () => "yes",
        log: () => {},
      },
    )
    expect(plan.level).toBe("L3")

    // 4-way cluster: eng + ceo + researcher + adversarial
    const agents = agentsInvoked(tmp)
    expect(agents).toContain("planner.eng")
    expect(agents).toContain("planner.ceo")
    expect(agents).toContain("researcher.history")
    expect(agents).toContain("planner.adversarial")

    // L3 intent carries user_signature
    const intent = readIntent(plan.taskId, tmp)
    expect(intent.user_signature?.signer_id).toBe("alice")

    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["migrate"], log: () => {} })

    // ship: --auto refused at L3
    await expect(
      runShip({ stateRoot: tmp, autoConfirm: true, log: () => {} }),
    ).rejects.toThrow(/refuses --auto/)

    // ship: "no" confirmation → throw + no ship.md
    await expect(
      runShip({
        stateRoot: tmp,
        readConfirmation: async () => "no",
        log: () => {},
      }),
    ).rejects.toThrow(/not confirmed/)
    expect(existsSync(resolve(tmp, "decisions", plan.taskId, "ship.md"))).toBe(false)

    // ship: "yes" → success
    const ship = await runShip({
      stateRoot: tmp,
      readConfirmation: async () => "yes",
      log: () => {},
    })
    expect(ship.shipPath).not.toBeNull()
    expect(readShip(plan.taskId, tmp).ship.outcome).toBe("success")

    // Janitor: L2_plus_success covers L3 too
    expect(ship.janitorDecision?.decision).toBe("compound")
    expect(ship.janitorDecision?.reason_code).toBe("L2_plus_success")
    expect(readJanitorDecision(plan.taskId, tmp)).not.toBeNull()

    // Compound cluster wrote a solution entry
    expect(ship.compoundAction).toBe("compound")
    expect(listSolutions(tmp).length).toBe(1)
  })
})
