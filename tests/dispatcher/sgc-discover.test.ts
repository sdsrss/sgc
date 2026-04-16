import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { canSpawn, computeCommandTokens, computeSubagentTokens } from "../../src/dispatcher/capabilities"
import { runDiscover } from "../../src/commands/discover"
import { runPlan } from "../../src/commands/plan"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-discover-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("/discover command contract", () => {
  test("/discover holds spawn:clarifier.*", () => {
    const tokens = computeCommandTokens("/discover")
    expect(tokens).toContain("spawn:clarifier.*")
    expect(tokens).toContain("read:progress")
  })

  test("/discover does NOT grant write or read:solutions", () => {
    const tokens = computeCommandTokens("/discover")
    expect(tokens).not.toContain("write:progress")
    expect(tokens).not.toContain("read:solutions")
    expect(tokens).not.toContain("write:decisions")
  })

  test("/discover can spawn clarifier.discover", () => {
    expect(canSpawn("/discover", "clarifier.discover")).toBe(true)
  })

  test("/discover CANNOT spawn planner.*, reviewer.*, compound.*", () => {
    expect(canSpawn("/discover", "planner.eng")).toBe(false)
    expect(canSpawn("/discover", "reviewer.correctness")).toBe(false)
    expect(canSpawn("/discover", "compound.context")).toBe(false)
  })

  test("clarifier.discover subagent tokens (read:progress only)", () => {
    const tokens = computeSubagentTokens("clarifier.discover")
    expect(tokens).toEqual(["read:progress"])
  })
})

describe("runDiscover", () => {
  test("missing topic throws", async () => {
    await expect(runDiscover({ stateRoot: tmp, topic: "" })).rejects.toThrow(
      /topic required/,
    )
  })

  test("runs with no active task, prints questions + suggested next", async () => {
    const log: string[] = []
    const r = await runDiscover({
      stateRoot: tmp,
      topic: "add OAuth token refresh",
      log: (m) => log.push(m),
    })
    expect(r.topic).toBe("add OAuth token refresh")
    expect(r.goal_question.length).toBeGreaterThan(0)
    // Output is printed line-by-line
    const text = log.join("\n")
    expect(text).toMatch(/topic: add OAuth token refresh/)
    expect(text).toMatch(/Goal:/)
    expect(text).toMatch(/Constraints:/)
    expect(text).toMatch(/Scope:/)
    expect(text).toMatch(/Edge cases:/)
    expect(text).toMatch(/Acceptance:/)
    expect(text).toMatch(/Next:/)
    expect(text).toMatch(/sgc plan "add OAuth token refresh"/)
  })

  test("active task surfaces into suggested_next context hint", async () => {
    const plan = await runPlan("refactor the auth middleware", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    const r = await runDiscover({
      stateRoot: tmp,
      topic: "reshape the error responses",
      log: () => {},
    })
    expect(r.suggested_next).toContain(plan.taskId)
  })

  test("audit trail: spawn prompt + result written under .sgc/progress/", async () => {
    await runDiscover({ stateRoot: tmp, topic: "add search filters", log: () => {} })
    const promptDir = resolve(tmp, "progress/agent-prompts")
    const resultDir = resolve(tmp, "progress/agent-results")
    expect(existsSync(promptDir)).toBe(true)
    expect(existsSync(resultDir)).toBe(true)
    const prompts = readdirSync(promptDir).filter((f) => f.includes("clarifier.discover"))
    const results = readdirSync(resultDir).filter((f) => f.includes("clarifier.discover"))
    expect(prompts.length).toBe(1)
    expect(results.length).toBe(1)
  })

  test("no state writes beyond the spawn audit trail", async () => {
    await runDiscover({ stateRoot: tmp, topic: "add search filters", log: () => {} })
    // decisions/ and solutions/ must NOT exist after discover — it holds
    // no write:decisions, no write:solutions.
    const decisionsDir = resolve(tmp, "decisions")
    const solutionsDir = resolve(tmp, "solutions")
    const decEmpty = !existsSync(decisionsDir) || readdirSync(decisionsDir).length === 0
    const solEmpty = !existsSync(solutionsDir) || readdirSync(solutionsDir).length === 0
    expect(decEmpty).toBe(true)
    expect(solEmpty).toBe(true)
  })
})
