// P1-3 integration: the heuristic floor must be WIRED into runPlan, not merely
// available as a helper.
//
// The audit finding was specifically about the production path — plan.ts read
// `classRes.output.level` and trusted it verbatim. A unit test of the floor
// function alone cannot catch a regression that unwires it, because on the
// inline path the stub IS the heuristic and the floor is an unobservable no-op.
// `classifierOverride` stands in for an LLM verdict so the wiring is testable.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"
import type { ClassifierOutput } from "../../src/dispatcher/agents/classifier-level"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-plan-floor-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

const llmSaid = (level: ClassifierOutput["level"]): ClassifierOutput => ({
  level,
  // Must clear Invariant §11 (rationale concreteness) on its own — that gate
  // runs on the raw LLM verdict before the floor is applied.
  rationale: "llm rationale: reads like a trivial L0 typo-scale edit to plan.ts",
  affected_readers_candidates: ["dispatcher"],
})

describe("runPlan applies the classifier heuristic floor (P1-3)", () => {
  test("an LLM L0 on a migration task is planned as L3, not L0", async () => {
    const res = await runPlan("run the DB migration to drop the legacy sessions table", {
      stateRoot: tmp,
      motivation: MOTIVATION,
      classifierOverride: llmSaid("L0"),
      // Escalating to L3 arms the L3 gates — §4 confirmation + human signature.
      // Supplying them here is itself evidence the floor engaged: an unfloored
      // L0 plan would never ask for either.
      readConfirmation: async () => "yes",
      userSignature: { signed_at: new Date().toISOString(), signer_id: "audit-test" },
      log: () => {},
    })
    expect(res.level).toBe("L3")
  })

  test("the escalation is durable in intent.md, not just in stdout", async () => {
    const res = await runPlan("add rate limiting to the login endpoint", {
      stateRoot: tmp,
      motivation: MOTIVATION,
      classifierOverride: llmSaid("L0"),
      log: () => {},
    })
    expect(res.level).toBe("L2")
    // Invariant §2: intent is immutable — the level it records is the one every
    // downstream gate reads, so the floor must land there.
    const intent = readIntent(res.taskId, tmp)
    expect(intent.level).toBe("L2")
  })

  test("the raised level is explained in the recorded rationale (auditability)", async () => {
    const res = await runPlan("run the DB migration to drop the legacy sessions table", {
      stateRoot: tmp,
      motivation: MOTIVATION,
      classifierOverride: llmSaid("L0"),
      readConfirmation: async () => "yes",
      userSignature: { signed_at: new Date().toISOString(), signer_id: "audit-test" },
      log: () => {},
    })
    const intent = readIntent(res.taskId, tmp)
    expect(JSON.stringify(intent).toLowerCase()).toContain("heuristic")
  })

  test("an LLM verdict ABOVE the floor is respected (no downgrade)", async () => {
    const res = await runPlan("fix the readme typo", {
      stateRoot: tmp,
      motivation: MOTIVATION,
      classifierOverride: llmSaid("L2"), // heuristic floor here is L0
      log: () => {},
    })
    expect(res.level).toBe("L2")
  })

  test("no override → inline path unchanged (floor is a no-op)", async () => {
    const res = await runPlan("fix the readme typo", {
      stateRoot: tmp,
      motivation: MOTIVATION,
      log: () => {},
    })
    expect(res.level).toBe("L0")
  })
})
