// A3 / audit v1.37.0 F4: review + qa reports must record which engine produced
// them, so a heuristic (pattern-matcher) pass is distinguishable from an LLM
// pass — on disk, to `sgc ship`, and to a human reading the report.
//
// Before A3 the persisted ReviewReport carried no mode/engine field: spawn
// logged the mode to the §13 event stream but the artifact and the ship gate
// never consulted it. So `reviewer.correctness: pass` was ambiguous — semantic
// LLM review or a TODO-marker regex. This test pins (a) the stamp on the
// persisted report and (b) that ship surfaces the degradation at L2+ (the
// non-blocking notice; B1/L3 makes it blocking).

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import { readReview } from "../../src/dispatcher/state"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-engine-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("review engine provenance (A3/F4)", () => {
  test("a heuristic (inline) review stamps engine='inline' on the persisted report", async () => {
    const p = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    const rr = readReview(p.taskId, "code", "reviewer.correctness", tmp)
    expect(rr).not.toBeNull()
    expect(rr!.report.engine).toBe("inline")
  })

  test("qa report is stamped with its engine too", async () => {
    const p = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
    const rr = readReview(p.taskId, "qa", "qa.browser", tmp)
    expect(rr).not.toBeNull()
    expect(rr!.report.engine).toBe("inline")
  })

  test("the engine stamp drives the B1 gate: heuristic-only L2 ship is blocked", async () => {
    // A3 stamps engine=inline on the heuristic reviews; B1 (ship-degraded-review)
    // reads that stamp and BLOCKS. This pins that the stamp is actually consulted
    // by ship (superseding A3's earlier non-blocking notice).
    await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "verified", waiveRed: "test-fixture", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })

    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/degraded|heuristic/i)
  })
})
