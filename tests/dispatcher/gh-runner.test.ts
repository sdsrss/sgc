import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { extractPrUrl, type GhRunner } from "../../src/dispatcher/gh-runner"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { runShip } from "../../src/commands/ship"
import { runWork } from "../../src/commands/work"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-ship-pr-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("extractPrUrl", () => {
  test("extracts URL from single-line stdout", () => {
    expect(extractPrUrl("https://github.com/org/repo/pull/42")).toBe(
      "https://github.com/org/repo/pull/42",
    )
  })
  test("extracts URL from last line when preamble present", () => {
    const stdout = [
      "Creating pull request for feat/my-branch into main in org/repo",
      "",
      "https://github.com/org/repo/pull/42",
    ].join("\n")
    expect(extractPrUrl(stdout)).toBe("https://github.com/org/repo/pull/42")
  })
  test("returns null when no URL present", () => {
    expect(extractPrUrl("")).toBeNull()
    expect(extractPrUrl("some error text")).toBeNull()
  })
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

describe("runShip --pr integration", () => {
  test("calls ghRunner with computed title + body; returns prUrl", async () => {
    let captured: { title: string; body: string } | null = null
    const runner: GhRunner = {
      async createPr(input) {
        captured = { title: input.title, body: input.body }
        return { url: "https://github.com/mock/repo/pull/7" }
      },
    }
    await l1Ready()
    const r = await runShip({
      stateRoot: tmp,
      createPr: true,
      ghRunner: runner,
      log: () => {},
    })
    expect(r.prUrl).toBe("https://github.com/mock/repo/pull/7")
    expect(captured).not.toBeNull()
    expect(captured!.title).toMatch(/sgc ship:/)
    expect(captured!.body).toContain(r.taskId)
    expect(captured!.body).toContain("Level")
  })

  test("respects --pr-title and --pr-body overrides", async () => {
    let captured: { title: string; body: string } | null = null
    const runner: GhRunner = {
      async createPr(input) {
        captured = { title: input.title, body: input.body }
        return { url: "https://github.com/mock/repo/pull/8" }
      },
    }
    await l1Ready()
    await runShip({
      stateRoot: tmp,
      createPr: true,
      prTitle: "custom title",
      prBody: "custom body",
      ghRunner: runner,
      log: () => {},
    })
    expect(captured?.title).toBe("custom title")
    expect(captured?.body).toBe("custom body")
  })

  test("gh failure propagates + ship.md is already written (not rolled back)", async () => {
    const p = await l1Ready()
    const runner: GhRunner = {
      async createPr() {
        throw new Error("gh auth required")
      },
    }
    await expect(
      runShip({ stateRoot: tmp, createPr: true, ghRunner: runner, log: () => {} }),
    ).rejects.toThrow(/gh auth required/)
    // Ship.md exists (ship gate passed + write happened before gh attempt)
    const { existsSync } = await import("node:fs")
    const { resolve } = await import("node:path")
    expect(existsSync(resolve(tmp, "decisions", p.taskId, "ship.md"))).toBe(true)
  })

  test("L0 ship + --pr: skips PR creation (L0 doesn't merit a PR)", async () => {
    const runner: GhRunner = {
      async createPr() {
        throw new Error("should not be called for L0")
      },
    }
    await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    const r = await runShip({
      stateRoot: tmp,
      createPr: true,
      ghRunner: runner,
      log: () => {},
    })
    expect(r.prUrl).toBeUndefined()
    expect(r.shipPath).toBeNull()  // L0 still skips ship.md
  })

  test("--pr without createPr flag → no ghRunner invocation", async () => {
    let called = false
    const runner: GhRunner = {
      async createPr() {
        called = true
        return { url: "" }
      },
    }
    await l1Ready()
    const r = await runShip({
      stateRoot: tmp,
      createPr: false,
      ghRunner: runner,
      log: () => {},
    })
    expect(called).toBe(false)
    expect(r.prUrl).toBeUndefined()
  })
})
