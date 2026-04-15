// Eval scenario: L0 typo fix — the fast path.
//
// User story: "fix typo in README"
// Expected pipeline: classifier only → work (track) → ship (skip ship.md)
// Invariants exercised: §4 (no L0 signature), §6 (janitor), §11 (rationale)
//
// L0 special rules:
//   - skips intent.md (schema note line 29)
//   - skips ship.md (decisions/ entirely)
//   - no planner cluster (classifier's only output)
//   - janitor decides skip (reason: level_L0)
//   - no compound (skip)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  listSolutions,
  readJanitorDecision,
} from "../../src/dispatcher/state"
import {
  agentsInvoked,
  countAgentPrompts,
  createEvalWorkspace,
  destroyEvalWorkspace,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-L0-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("L0 typo scenario (eval §12)", () => {
  test("end-to-end: plan → work --done → ship", async () => {
    // STEP 1: plan — expect L0 classification, no intent.md
    const plan = await runPlan("fix typo in README", {
      stateRoot: tmp,
      log: () => {},
    })
    expect(plan.level).toBe("L0")
    expect(existsSync(resolve(tmp, "decisions", plan.taskId, "intent.md"))).toBe(false)

    // Only classifier prompt written — no planner/researcher cluster for L0
    expect(agentsInvoked(tmp)).toEqual(["classifier.level"])

    // STEP 2: work — mark single auto-feature done
    const work = await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    expect(work.allDone).toBe(true)

    // STEP 3: ship — L0 skips ship.md but runs janitor
    const ship = await runShip({ stateRoot: tmp, log: () => {} })
    expect(ship.shipPath).toBeNull()
    expect(existsSync(resolve(tmp, "decisions", plan.taskId, "ship.md"))).toBe(false)

    // Invariant §6: janitor decision logged even when it's 'skip'
    expect(ship.janitorDecision?.decision).toBe("skip")
    expect(ship.janitorDecision?.reason_code).toBe("level_L0")
    const logged = readJanitorDecision(plan.taskId, tmp)
    expect(logged).not.toBeNull()
    expect(logged?.decision).toBe("skip")
    expect(logged?.inputs_hash).toMatch(/^[a-f0-9]{64}$/)

    // No compound entry written
    expect(listSolutions(tmp).length).toBe(0)
  })

  test("agent count: classifier + janitor only", async () => {
    await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runShip({ stateRoot: tmp, log: () => {} })
    // Prompts written: 1 classifier + 1 janitor.compound = 2
    expect(countAgentPrompts(tmp)).toBe(2)
  })
})
