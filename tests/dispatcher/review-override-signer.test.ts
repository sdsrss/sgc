// B3 / audit v1.37.0 F3: a verdict=fail review may only be overridden by a
// NAMED human. Before B3 both gate sites checked only `override.reason.length
// >= 40`; the `override.by` field — the actual signature — was never validated,
// so a headless loop could self-override a failed review with {by:"", reason:
// "<40+ filler chars>"} and ship. Unlike the L3 plan gate (a real
// user_signature), a fail override needed no attributable human.
//
// Fix: require a non-empty `by` when an override is present, at the write
// boundary (validateReview — symmetric with the reason>=40 rule, so no
// empty-by override can ever be persisted) AND at the ship gate (defense
// against a hand-edited review file).

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import {
  appendReview,
  reviewPath,
  serializeFrontmatter,
} from "../../src/dispatcher/state"
import type { ReviewReport } from "../../src/dispatcher/types"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."
const REASON = "reviewed by hand and accepted despite the finding, tracked in TICKET-123"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-override-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function failReport(taskId: string, by: string): ReviewReport {
  return {
    report_id: "rep-1",
    task_id: taskId as ReviewReport["task_id"],
    stage: "code",
    reviewer_id: "reviewer.correctness",
    reviewer_version: "0.1",
    verdict: "fail",
    severity: "high",
    findings: [{ description: "a real defect" }],
    created_at: "2026-07-16T00:00:00Z",
    override: { by, at: "2026-07-16T00:00:00Z", reason: REASON },
  }
}

describe("override signer (B3/F3)", () => {
  test("validateReview rejects an override with an empty `by` (write boundary)", () => {
    expect(() => appendReview(failReport("01TASK0000000000000000000A", ""), "", tmp)).toThrow(
      /by|signer|signature/i,
    )
  })

  test("validateReview accepts an override with a named `by` + reason>=40", () => {
    expect(() =>
      appendReview(failReport("01TASK0000000000000000000B", "alice"), "", tmp),
    ).not.toThrow()
  })

  test("ship gate (defense) rejects a fail review whose override.by is empty", async () => {
    // Drive a full shippable L2 state, then overwrite the code review file
    // DIRECTLY (bypassing validateReview) with a fail + empty-by override — the
    // hand-edited-file case the ship gate must still catch.
    const p = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "verified", waiveRed: "test-fixture", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })

    const path = reviewPath(p.taskId, "code", "reviewer.correctness", tmp)
    writeFileSync(path, serializeFrontmatter(failReport(p.taskId, "") as unknown as Record<string, unknown>, ""))

    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(
      /by|signer|signature|override/i,
    )
  })
})
