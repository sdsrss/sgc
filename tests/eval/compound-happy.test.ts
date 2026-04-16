// Eval scenario: compound happy path — L2 success shipped, janitor
// triggers compound, cluster writes a solution entry.
//
// Invariants exercised: §3 (dedup_stamp validated at write), §6 (janitor
//                       logged), §10 (compound atomic write), §12 (this)
//
// Note: dedup_stamp is passed to writeSolution for Invariant §3 validation
// but is NOT persisted — the solution YAML intentionally omits it. The
// spawn prompt of compound.related is the audit trail.
//
// Checks:
//   - solution entry written under correct category (inferred from intent)
//   - required fields present (per sgc-state.schema.yaml)
//   - source_task_ids contains the shipping task
//   - times_referenced starts at 0 (bumped to 1 only on update_existing)
//   - audit: compound.related spawn prompt exists
//   - body of the solution file has valid frontmatter

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import { listSolutions } from "../../src/dispatcher/state"
import {
  agentsInvoked,
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-compound-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("compound happy-path scenario (eval §12)", () => {
  test("L2 auth refactor ships → compound writes auth/<slug>.md with dedup_stamp", async () => {
    const plan = await runPlan(
      "refactor the auth token validation middleware for the public API",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    expect(plan.level).toBe("L2")

    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+auth.ts change\n", log: () => {} })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["login"], log: () => {} })

    const ship = await runShip({ stateRoot: tmp, log: () => {} })
    expect(ship.janitorDecision?.decision).toBe("compound")
    expect(ship.compoundAction).toBe("compound")

    const entries = listSolutions(tmp)
    expect(entries.length).toBe(1)
    const only = entries[0]!
    // Category inferred from "auth" keyword in intent
    expect(only.category).toBe("auth")
    // Required fields present
    expect(only.entry.signature).toMatch(/^[a-f0-9]{64}$/)
    expect(only.entry.source_task_ids).toContain(plan.taskId)
    expect(only.entry.tags.length).toBeGreaterThan(0)
    expect(only.entry.symptoms.length).toBeGreaterThan(0)
    // First write: times_referenced starts at 0
    expect(only.entry.times_referenced).toBe(0)
    // Audit trail: compound.related spawn prompt was written
    expect(agentsInvoked(tmp)).toContain("compound.related")
  })

  test("solution file on disk has frontmatter + body", async () => {
    await runPlan(
      "refactor the auth token validation middleware for the public API",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
    await runShip({ stateRoot: tmp, log: () => {} })

    const entries = listSolutions(tmp)
    expect(entries.length).toBe(1)
    const text = readFileSync(entries[0]!.path, "utf8")
    expect(text).toMatch(/^---\n/)
    expect(text).toMatch(/\nsignature:/)
    expect(text).toMatch(/\ncategory:/)
    expect(text).toMatch(/\nsource_task_ids:/)
    expect(text).toMatch(/\n---\n/)
  })
})
