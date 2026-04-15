import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { janitorCompound } from "../../src/dispatcher/agents/janitor-compound"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import { listSolutions, readJanitorDecision } from "../../src/dispatcher/state"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

describe("janitorCompound — decision rules", () => {
  test("force → compound (bypasses all rules)", () => {
    const r = janitorCompound({
      task_id: "x",
      level: "L0",  // would normally skip
      outcome: "success",
      reviewer_flags: [],
      force: true,
    })
    expect(r.decision).toBe("compound")
    expect(r.reason_code).toBe("user_force")
  })
  test("L0 → skip", () => {
    const r = janitorCompound({
      task_id: "x", level: "L0", outcome: "success",
      reviewer_flags: [], force: false,
    })
    expect(r.decision).toBe("skip")
    expect(r.reason_code).toBe("level_L0")
  })
  test("reverted outcome → skip", () => {
    const r = janitorCompound({
      task_id: "x", level: "L2", outcome: "reverted",
      reviewer_flags: [], force: false,
    })
    expect(r.decision).toBe("skip")
    expect(r.reason_code).toBe("outcome_reverted")
  })
  test("severity >= medium → compound", () => {
    const r = janitorCompound({
      task_id: "x", level: "L1", outcome: "success",
      reviewer_flags: [{ severity: "medium" }], force: false,
    })
    expect(r.decision).toBe("compound")
    expect(r.reason_code).toBe("reviewer_severity_medium_plus")
  })
  test("L2 + success → compound", () => {
    const r = janitorCompound({
      task_id: "x", level: "L2", outcome: "success",
      reviewer_flags: [{ severity: "none" }], force: false,
    })
    expect(r.decision).toBe("compound")
    expect(r.reason_code).toBe("L2_plus_success")
  })
  test("L3 + success → compound", () => {
    const r = janitorCompound({
      task_id: "x", level: "L3", outcome: "success",
      reviewer_flags: [{ severity: "none" }], force: false,
    })
    expect(r.decision).toBe("compound")
    expect(r.reason_code).toBe("L2_plus_success")
  })
  test("reviewer novel flag → compound", () => {
    const r = janitorCompound({
      task_id: "x", level: "L1", outcome: "success",
      reviewer_flags: [{ severity: "low", novel: true }], force: false,
    })
    expect(r.decision).toBe("compound")
    expect(r.reason_code).toBe("reviewer_flagged_novel")
  })
  test("L1 clean success → skip (default conservative)", () => {
    const r = janitorCompound({
      task_id: "x", level: "L1", outcome: "success",
      reviewer_flags: [{ severity: "none" }], force: false,
    })
    expect(r.decision).toBe("skip")
    expect(r.reason_code).toBe("default_conservative")
  })
})

describe("ship → janitor → compound integration (Invariant §6)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-janitor-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  async function l1Ready() {
    await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
  }

  async function l2Ready() {
    await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
  }

  test("L1 ship → janitor writes 'skip' decision (§6: every decision logged)", async () => {
    await l1Ready()
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.janitorDecision?.decision).toBe("skip")
    expect(r.janitorDecision?.reason_code).toBe("default_conservative")
    expect(r.compoundAction).toBeUndefined()  // skip doesn't invoke compound
    const logged = readJanitorDecision(r.taskId, tmp)
    expect(logged).not.toBeNull()
    expect(logged?.decision).toBe("skip")
    expect(logged?.inputs_hash).toHaveLength(64)
    // No solution written on skip
    expect(listSolutions(tmp).length).toBe(0)
  })

  test("L2 ship → janitor decides 'compound' + runCompound writes entry", async () => {
    await l2Ready()
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.janitorDecision?.decision).toBe("compound")
    expect(r.janitorDecision?.reason_code).toBe("L2_plus_success")
    expect(r.compoundAction).toBe("compound")
    const logged = readJanitorDecision(r.taskId, tmp)
    expect(logged?.decision).toBe("compound")
    expect(listSolutions(tmp).length).toBe(1)
  })

  test("--janitor-skip-reason still logs a synthetic decision (Invariant §6, audit C3)", async () => {
    await l1Ready()
    const reason =
      "skip requested: follow-up ticket XYZ-42 is handling compound separately"
    const r = await runShip({
      stateRoot: tmp,
      janitorSkipReason: reason,
      log: () => {},
    })
    expect(r.janitorDecision?.decision).toBe("skip")
    expect(r.janitorDecision?.reason_code).toBe("user_opt_out")
    const logged = readJanitorDecision(r.taskId, tmp)
    expect(logged).not.toBeNull()
    expect(logged?.decision).toBe("skip")
    expect(logged?.reason_code).toBe("user_opt_out")
    expect(logged?.reason_human).toBe(reason)
    expect(listSolutions(tmp).length).toBe(0)
  })

  test("--janitor-skip-reason with <40 chars throws (Invariant §6)", async () => {
    await l1Ready()
    await expect(
      runShip({
        stateRoot: tmp,
        janitorSkipReason: "too short",
        log: () => {},
      }),
    ).rejects.toThrow(/≥40 chars/)
  })

  test("runJanitor=false (test-only harness path) suppresses without logging", async () => {
    // This path exists for harness code that knows it's bypassing §6.
    // Production CLI has no corresponding flag — users must provide a reason.
    await l1Ready()
    const r = await runShip({ stateRoot: tmp, runJanitor: false, log: () => {} })
    expect(r.janitorDecision).toBeUndefined()
    expect(readJanitorDecision(r.taskId, tmp)).toBeNull()
  })

  test("--force-compound → janitor compounds + runCompound writes entry even for L1 clean", async () => {
    await l1Ready()
    const r = await runShip({ stateRoot: tmp, forceCompound: true, log: () => {} })
    expect(r.janitorDecision?.decision).toBe("compound")
    expect(r.janitorDecision?.reason_code).toBe("user_force")
    expect(r.compoundAction).toBe("compound")
    expect(listSolutions(tmp).length).toBe(1)
  })

  test("janitor decision is append-only (ship twice would throw — but ship itself is immutable)", async () => {
    await l1Ready()
    await runShip({ stateRoot: tmp, log: () => {} })
    // Second ship fails on ShipImmutable before reaching janitor
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow()
  })

  test("janitor inputs_hash is deterministic (same task → same hash)", async () => {
    await l1Ready()
    const r1 = await runShip({ stateRoot: tmp, log: () => {} })
    const logged = readJanitorDecision(r1.taskId, tmp)
    expect(logged?.inputs_hash).toMatch(/^[a-f0-9]{64}$/)
  })
})
