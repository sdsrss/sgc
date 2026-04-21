// Eval scenario: Invariant §4 — L3 refuses --auto.
//
// L3 tasks (architecture / migration / breaking-schema / prod / infra) must
// never proceed unattended. Both `runPlan` and `runShip` throw when
// `autoConfirm: true` is combined with an L3-classified task.
//
// Invariants exercised: §4 (L3 auto-refusal at plan AND ship stages), §12 (this)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import { runQa } from "../../src/commands/qa"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

const SIG = { signed_at: "2026-04-15T10:00:00Z", signer_id: "eval-user" }

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-L3-auto-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("Invariant §4: L3 refuses --auto", () => {
  test("runPlan at L3 with autoConfirm=true throws", async () => {
    await expect(
      runPlan("migration to add 2FA column to 10M-row users table", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        userSignature: SIG,
        autoConfirm: true,
        log: () => {},
      }),
    ).rejects.toThrow(/refuses --auto/)
  })

  test("runShip at L3 with autoConfirm=true throws", async () => {
    // Build a complete L3 pipeline state so ship's pre-flight gates pass
    // before reaching the autoConfirm guard.
    await runPlan("migration to add 2FA column to 10M-row users table", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      userSignature: SIG,
      readConfirmation: async () => "yes",
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({
      stateRoot: tmp,
      diffOverride: "+  ALTER TABLE users ADD COLUMN totp_secret TEXT;\n",
      log: () => {},
    })
    await runQa({
      stateRoot: tmp,
      target: "http://localhost",
      flows: ["migrate"],
      log: () => {},
    })

    await expect(
      runShip({ stateRoot: tmp, autoConfirm: true, log: () => {} }),
    ).rejects.toThrow(/refuses --auto/)
  })
})
