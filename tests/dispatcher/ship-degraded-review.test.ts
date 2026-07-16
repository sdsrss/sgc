// B1 / audit v1.37.0 F1: `sgc ship` blocks a degraded (heuristic-only) L2+ review.
//
// The L2+ review gate blocked only on verdict=fail, which a heuristic reviewer
// structurally cannot emit — so the no-LLM path satisfied the gate by producing
// a report that merely existed, not one that reviewed the code. B1 makes the
// gate read the engine stamp (A3): if NO code review is LLM-backed, ship is
// blocked unless a signed acceptance (--accepted-by + reason>=40) is recorded.

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
  readShip,
  reviewPath,
  serializeFrontmatter,
} from "../../src/dispatcher/state"
import type { ReviewReport } from "../../src/dispatcher/types"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."
const ACCEPT_REASON = "no LLM available in this env; reviewed by hand and accepting the degraded gate"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-degraded-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

// An L2 task shipped-ready with heuristic (inline) reviews + qa (the default
// no-LLM path). Returns the plan result.
async function l2HeuristicReady() {
  const p = await runPlan("add a new field to the public API response", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    log: () => {},
  })
  await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "verified", waiveRed: "test-fixture", log: () => {} })
  await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
  await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
  return p
}

function llmBackedReview(taskId: string): ReviewReport {
  return {
    report_id: "rep-llm",
    task_id: taskId as ReviewReport["task_id"],
    stage: "code",
    reviewer_id: "reviewer.correctness",
    reviewer_version: "0.1",
    verdict: "pass",
    severity: "none",
    findings: [],
    created_at: "2026-07-16T00:00:00Z",
    engine: "claude-cli",
  }
}

describe("ship degraded-review gate (B1/F1)", () => {
  test("L2 with heuristic-only reviews is blocked", async () => {
    await l2HeuristicReady()
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(
      /degraded|heuristic/i,
    )
  })

  test("a signed acceptance (by + reason>=40) unblocks it and is recorded in ship.md", async () => {
    const p = await l2HeuristicReady()
    const logs: string[] = []
    const r = await runShip({
      stateRoot: tmp,
      acceptedBy: "alice",
      acceptDegradedReview: ACCEPT_REASON,
      log: (m) => logs.push(m),
    })
    expect(r.shipPath).not.toBeNull()
    const { ship } = readShip(p.taskId, tmp)
    expect(ship.degraded_review_acceptance?.by).toBe("alice")
    expect(ship.degraded_review_acceptance?.reason).toBe(ACCEPT_REASON)
    expect(logs.join("\n")).toMatch(/alice/)
  })

  test("a malformed acceptance (empty by) is rejected, not silently bypassed", async () => {
    await l2HeuristicReady()
    await expect(
      runShip({ stateRoot: tmp, acceptedBy: "  ", acceptDegradedReview: ACCEPT_REASON, log: () => {} }),
    ).rejects.toThrow(/by|signer|accept/i)
  })

  test("a malformed acceptance (reason < 40) is rejected", async () => {
    await l2HeuristicReady()
    await expect(
      runShip({ stateRoot: tmp, acceptedBy: "alice", acceptDegradedReview: "too short", log: () => {} }),
    ).rejects.toThrow(/40|reason|accept/i)
  })

  test("at least one LLM-backed code review satisfies the gate without acceptance", async () => {
    const p = await l2HeuristicReady()
    // Append a second code review stamped with a real (non-inline) engine.
    appendReview(llmBackedReview(p.taskId), "", tmp, "llm")
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.shipPath).not.toBeNull()
  })

  test("L1 with a heuristic review is unaffected (no L2+ gate)", async () => {
    await runPlan("add a markdown table to the README", { stateRoot: tmp, motivation: LONG_MOTIVATION, log: () => {} })
    await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "verified", waiveRed: "test-fixture", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.shipPath).not.toBeNull()
  })

  test("a pre-A3 review with no engine field is treated as degraded (blocked)", async () => {
    const p = await l2HeuristicReady()
    // Overwrite the correctness review with a pre-A3 shape (no `engine`).
    const preA3: ReviewReport = { ...llmBackedReview(p.taskId), engine: undefined }
    delete (preA3 as { engine?: unknown }).engine
    writeFileSync(
      reviewPath(p.taskId, "code", "reviewer.correctness", tmp),
      serializeFrontmatter(preA3 as unknown as Record<string, unknown>, ""),
    )
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/degraded|heuristic/i)
  })
})
