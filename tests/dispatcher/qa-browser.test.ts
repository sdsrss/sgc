import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { qaBrowser } from "../../src/dispatcher/agents/qa-browser"
import { runQa, qaScreenshotDir } from "../../src/commands/qa"
import { runPlan } from "../../src/commands/plan"
import { hasQaEvidence, readReview } from "../../src/dispatcher/state"

describe("qaScreenshotDir — honors state root (not cwd)", () => {
  // Regression: real-browser screenshots were written to <cwd>/reviews/ via
  // `stateRoot ?? process.cwd()`, ignoring SGC_STATE_ROOT and splitting the PNG
  // from its qa.browser.md (which uses resolveStateRoot). They must co-locate.
  test("explicit stateRoot is used", () => {
    expect(qaScreenshotDir("/tmp/xyz", "T1")).toBe(join("/tmp/xyz", "reviews", "T1", "qa"))
  })
  test("undefined stateRoot resolves via SGC_STATE_ROOT env, never cwd", () => {
    const prior = process.env["SGC_STATE_ROOT"]
    process.env["SGC_STATE_ROOT"] = "/tmp/env-root"
    try {
      const dir = qaScreenshotDir(undefined, "T2")
      expect(dir).toBe(join("/tmp/env-root", "reviews", "T2", "qa"))
      expect(dir.startsWith(process.cwd())).toBe(false)
    } finally {
      if (prior === undefined) delete process.env["SGC_STATE_ROOT"]
      else process.env["SGC_STATE_ROOT"] = prior
    }
  })
})

describe("qaBrowser stub", () => {
  test("empty target_url → fail", async () => {
    const r = await qaBrowser({ target_url: "", user_flows: ["login"] })
    expect(r.verdict).toBe("fail")
    expect(r.failed_flows.length).toBe(1)
    expect(r.failed_flows[0]?.observed).toMatch(/empty/)
  })
  test("empty user_flows → concern", async () => {
    const r = await qaBrowser({ target_url: "http://localhost:3000", user_flows: [] })
    expect(r.verdict).toBe("concern")
    expect(r.failed_flows[0]?.observed).toMatch(/no user_flows/)
  })
  test("valid target + flows → concern (stub mode)", async () => {
    const r = await qaBrowser({
      target_url: "http://localhost:3000",
      user_flows: ["login", "dashboard"],
    })
    expect(r.verdict).toBe("concern")
    expect(r.failed_flows).toHaveLength(1)
    expect(r.failed_flows[0]?.observed).toMatch(/no browser runner/)
    expect(r.evidence_refs).toEqual([])
  })
  test("injected browseRunner overrides the stub", async () => {
    const r = await qaBrowser(
      { target_url: "http://x", user_flows: ["y"] },
      {
        browseRunner: async () => ({
          verdict: "fail",
          evidence_refs: ["/tmp/s1.png", "/tmp/s2.png"],
          failed_flows: [
            { flow: "login", step: "click submit", observed: "timeout 5s" },
          ],
        }),
      },
    )
    expect(r.verdict).toBe("fail")
    expect(r.evidence_refs.length).toBe(2)
    expect(r.failed_flows[0]?.step).toContain("click submit")
  })
})

describe("runQa — integration", () => {
  let tmp: string
  const LONG_MOTIVATION =
    "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-qa-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  async function freshTask() {
    return runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
  }

  test("no active task → throws", async () => {
    await expect(runQa({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/sgc plan/)
  })

  test("stub path: writes qa review with concern + hasQaEvidence=true", async () => {
    const plan = await freshTask()
    const r = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: ["login", "dashboard"],
      log: () => {},
    })
    expect(r.verdict).toBe("concern")
    expect(r.taskId).toBe(plan.taskId)
    const stored = readReview(plan.taskId, "qa", "qa.browser", tmp)
    expect(stored?.report.verdict).toBe("concern")
    expect(stored?.report.stage).toBe("qa")
    expect(stored?.report.reviewer_id).toBe("qa.browser")
    expect(hasQaEvidence(plan.taskId, tmp)).toBe(true)
  })

  test("concern path: empty flows", async () => {
    await freshTask()
    const r = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: [],
      log: () => {},
    })
    expect(r.verdict).toBe("concern")
  })

  test("fail path: missing target", async () => {
    const plan = await freshTask()
    const r = await runQa({
      stateRoot: tmp,
      target: "",
      flows: ["login"],
      log: () => {},
    })
    expect(r.verdict).toBe("fail")
    const stored = readReview(plan.taskId, "qa", "qa.browser", tmp)
    expect(stored?.report.severity).toBe("high")
  })

  test("second runQa for same task throws AppendOnly (Invariant §6)", async () => {
    await freshTask()
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
    await expect(
      runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} }),
    ).rejects.toThrow(/append-only/)
  })

  test("Invariant §1: qa.browser manifest forbids read:solutions", async () => {
    // qa.browser manifest only declares read:decisions, read:progress,
    // write:reviews, exec:browser — computeSubagentTokens would throw if
    // it declared read:solutions (covered by capabilities.test.ts).
    // Here we spot-check the prompt file the runQa wrote:
    const plan = await freshTask()
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
    const { readdirSync, readFileSync } = await import("node:fs")
    const prompts = readdirSync(join(tmp, "progress/agent-prompts"))
    const qaPrompt = prompts.find((f) => f.includes("qa.browser"))
    expect(qaPrompt).toBeDefined()
    const text = readFileSync(join(tmp, "progress/agent-prompts", qaPrompt!), "utf8")
    // Pinned tokens must not include read:solutions; forbidden list must.
    const pinnedBlock = text.match(/scope_tokens:\n((?:  - .+\n)+)/)?.[1] ?? ""
    expect(pinnedBlock).not.toContain("read:solutions")
    expect(text).toMatch(/FORBIDDEN from:.*read:solutions/)
  })

  test("opt-in via --browse uses an injected browseRunner (not the stub)", async () => {
    const plan = await freshTask()
    const r = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: ["/home"],
      browse: true,
      browseRunner: async () => ({
        verdict: "pass",
        evidence_refs: ["/tmp/qa-home.png"],
        failed_flows: [],
      }),
      log: () => {},
    })
    expect(r.verdict).toBe("pass")
    const stored = readReview(plan.taskId, "qa", "qa.browser", tmp)
    expect(stored?.report.verdict).toBe("pass")
    expect(stored?.report.evidence_refs).toEqual(["/tmp/qa-home.png"])
  })

  test("prose-label notes are not counted/recorded as failures (pass stays clean)", async () => {
    // Regression: the runner records prose flow labels as step:"note" entries in
    // failed_flows for surfacing. They are NOT failures — but the qa command used
    // failed_flows.length, so a clean pass printed "1 failed flow(s)" and wrote a
    // bogus "Step 'note' failed" finding into the persisted review.
    const plan = await freshTask()
    const logs: string[] = []
    const r = await runQa({
      stateRoot: tmp,
      target: "http://localhost:3000",
      flows: ["load", "checkout"],
      browse: true,
      browseRunner: async () => ({
        verdict: "pass",
        evidence_refs: ["/tmp/qa.png"],
        failed_flows: [
          { flow: "load", step: "note", observed: "recorded as label; not navigated" },
          { flow: "checkout", step: "note", observed: "recorded as label; not navigated" },
        ],
      }),
      log: (s) => logs.push(s),
    })
    expect(r.verdict).toBe("pass")
    expect(logs.some((l) => l.includes("0 failed flow(s)"))).toBe(true)
    const stored = readReview(plan.taskId, "qa", "qa.browser", tmp)
    expect(stored?.report.findings ?? []).toHaveLength(0)
  })
})

describe("hasQaEvidence", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-qa-evid-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })
  test("false when no QA review written", () => {
    expect(hasQaEvidence("01NONE", tmp)).toBe(false)
  })
  test("true after runQa writes a review", async () => {
    const plan = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation:
        "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract.",
      log: () => {},
    })
    await runQa({ stateRoot: tmp, target: "http://x", flows: ["a"], log: () => {} })
    expect(hasQaEvidence(plan.taskId, tmp)).toBe(true)
  })
})
