import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runQa } from "../../src/commands/qa"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"
import { readCurrentTask, readShip } from "../../src/dispatcher/state"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-ship-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

async function l1Ready() {
  const p = await runPlan("add a markdown table to the README", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    log: () => {},
  })
  await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
  await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
  return p
}

async function l2Ready() {
  const p = await runPlan("add a new field to the public API response", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    log: () => {},
  })
  await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
  await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
  await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
  return p
}

async function l3Ready() {
  const p = await runPlan("add a database migration to rename column", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
    readConfirmation: async () => "yes",
    log: () => {},
  })
  await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
  await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
  await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
  return p
}

describe("runShip — gates (negative)", () => {
  test("no active task → throws", async () => {
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/sgc plan/)
  })

  test("features not all done → throws with count", async () => {
    await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(
      /not done/,
    )
  })

  test("L1+ without code review → throws", async () => {
    const p = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    // No runReview call
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(
      /no code reviews/,
    )
    void p
  })

  test("L2 without qa evidence → throws", async () => {
    await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await runReview({ stateRoot: tmp, diffOverride: "+ok\n", log: () => {} })
    // No runQa call
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow(
      /qa evidence/,
    )
  })

  test("L3 ship refuses --auto even with full evidence", async () => {
    await l3Ready()
    await expect(
      runShip({ stateRoot: tmp, autoConfirm: true, log: () => {} }),
    ).rejects.toThrow(/refuses --auto/)
  })

  test("L3 without 'yes' confirmation → throws + ship.md NOT written", async () => {
    const p = await l3Ready()
    await expect(
      runShip({
        stateRoot: tmp,
        readConfirmation: async () => "no",
        log: () => {},
      }),
    ).rejects.toThrow(/not confirmed/)
    expect(existsSync(resolve(tmp, "decisions", p.taskId, "ship.md"))).toBe(false)
  })
})

describe("runShip — happy paths", () => {
  test("L1 ship writes ship.md + updates current-task", async () => {
    const p = await l1Ready()
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.shipPath).not.toBeNull()
    expect(existsSync(r.shipPath!)).toBe(true)
    const { ship } = readShip(p.taskId, tmp)
    expect(ship.outcome).toBe("success")
    expect(ship.linked_reviews.length).toBeGreaterThanOrEqual(1)
    // current-task updated: active_feature cleared
    const ct = readCurrentTask(tmp)
    expect(ct?.task.active_feature).toBeUndefined()
  })

  test("L2 ship with qa evidence succeeds", async () => {
    const p = await l2Ready()
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.shipPath).not.toBeNull()
    const { ship } = readShip(p.taskId, tmp)
    expect(ship.outcome).toBe("success")
  })

  test("L3 ship with 'yes' confirmation succeeds", async () => {
    await l3Ready()
    const r = await runShip({
      stateRoot: tmp,
      readConfirmation: async () => "yes",
      log: () => {},
    })
    expect(r.shipPath).not.toBeNull()
  })

  test("L0 ship skips ship.md but updates current-task", async () => {
    const p = await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    expect(p.level).toBe("L0")
    // Seed a feature so feature-list isn't empty (L0 runPlan still writes it)
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    const r = await runShip({ stateRoot: tmp, log: () => {} })
    expect(r.shipPath).toBeNull()
    expect(existsSync(resolve(tmp, "decisions", p.taskId, "ship.md"))).toBe(false)
    const ct = readCurrentTask(tmp)
    expect(ct?.task.active_feature).toBeUndefined()
  })
})

describe("runShip — immutability + append-only chain", () => {
  test("second ship for same task throws ShipImmutable", async () => {
    await l1Ready()
    await runShip({ stateRoot: tmp, log: () => {} })
    await expect(runShip({ stateRoot: tmp, log: () => {} })).rejects.toThrow()
  })
})
