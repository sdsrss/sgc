import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { plannerCeo } from "../../src/dispatcher/agents/planner-ceo"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"

describe("plannerCeo stub", () => {
  test("approves with no concerns when intent is long + has audience keyword", () => {
    const r = plannerCeo({
      intent_draft:
        "Improve dashboard latency so users see a snappier load; expected adoption lift and retention effect for the analytics team.",
    })
    expect(r.verdict).toBe("approve")
    expect(r.concerns).toEqual([])
    expect(r.rewrite_hints).toEqual([])
  })
  test("flags short intents", () => {
    const r = plannerCeo({ intent_draft: "do the thing" })
    expect(r.verdict).toBe("approve")
    expect(r.concerns.length).toBe(1)
    expect(r.concerns[0]).toMatch(/short/)
    expect(r.rewrite_hints.some((h) => /motivation/.test(h))).toBe(true)
  })
  test("flags missing audience keyword even on long drafts", () => {
    const r = plannerCeo({
      intent_draft:
        "Refactor the caching module by extracting the LRU implementation into its own file and renaming the getters for clarity across modules.",
    })
    expect(r.verdict).toBe("approve")
    expect(r.rewrite_hints.some((h) => /audience/.test(h))).toBe(true)
  })
})

describe("runPlan — planner cluster by level (D-2.1)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-plan-ceo-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  const LONG_MOTIVATION =
    "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

  test("L0 skips both planners (no intent.md written)", async () => {
    const r = await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    expect(r.level).toBe("L0")
    expect(existsSync(resolve(tmp, "decisions", r.taskId, "intent.md"))).toBe(false)
  })

  test("L1 runs eng only — intent body has no CEO section", async () => {
    const r = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L1")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.body ?? "").toContain("Planner.eng verdict")
    expect(intent.body ?? "").not.toContain("Planner.ceo verdict")
  })

  test("L2 runs eng + ceo in parallel — intent body has both verdicts", async () => {
    const logs: string[] = []
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: (m) => logs.push(m),
    })
    expect(r.level).toBe("L2")
    const logText = logs.join("\n")
    expect(logText).toContain("planner.eng verdict")
    expect(logText).toContain("planner.ceo verdict")
    const intent = readIntent(r.taskId, tmp)
    const body = intent.body ?? ""
    expect(body).toContain("Planner.eng verdict")
    expect(body).toContain("Planner.ceo verdict")
  })

  test("L3 runs eng + ceo + signature required", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      log: () => {},
    })
    expect(r.level).toBe("L3")
    const intent = readIntent(r.taskId, tmp)
    const body = intent.body ?? ""
    expect(body).toContain("Planner.eng verdict")
    expect(body).toContain("Planner.ceo verdict")
    expect(intent.user_signature?.signer_id).toBe("alice")
  })

  test("L2 audit trail has both planner prompt/result files", async () => {
    const r = await runPlan("add a new API endpoint for the users table", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
    // agent-prompts/ should have 3 files: classifier, planner.eng, planner.ceo
    const { readdirSync } = await import("node:fs")
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    const classifierCount = prompts.filter((f) => f.includes("classifier.level")).length
    const engCount = prompts.filter((f) => f.includes("planner.eng")).length
    const ceoCount = prompts.filter((f) => f.includes("planner.ceo")).length
    expect(classifierCount).toBe(1)
    expect(engCount).toBe(1)
    expect(ceoCount).toBe(1)
  })
})
