import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  plannerCeo,
  plannerCeoHeuristic,
} from "../../src/dispatcher/agents/planner-ceo"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"

describe("plannerCeoHeuristic stub", () => {
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

  test("U4: plannerCeo alias === plannerCeoHeuristic (G.2.a pattern)", () => {
    expect(plannerCeo).toBe(plannerCeoHeuristic)
  })
})

describe("prompts/planner-ceo.md — template structure (P2#7a)", () => {
  const promptPath = resolve(process.cwd(), "prompts/planner-ceo.md")
  const tmpl = readFileSync(promptPath, "utf8")

  test("U1: required structural markers (Input heading, input_yaml, Anti-patterns)", () => {
    // splitPrompt regex from anthropic-sdk-agent.ts:79 — must match
    expect(tmpl).toMatch(/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/)
    expect(tmpl).toContain("<input_yaml/>")
    expect(tmpl).toContain("## Anti-patterns")
    // Delegate boundary — CEO must not bleed into eng / brainstorming
    expect(tmpl).toMatch(/NOT.*planner\.eng|NOT.*architect|product gate/i)
  })

  test("U2: banned-vocab list synced with planner-eng (15 terms; 'may break' exempt per lesson #18)", () => {
    // English (10 terms)
    for (const term of [
      "could potentially",
      "might affect",
      "various concerns",
      "several issues",
      "generally",
      "overall",
      "seems to",
      "production-ready",
      "comprehensive",
      "robust",
    ]) {
      expect(tmpl).toContain(term)
    }
    // 中文 (5 terms)
    for (const term of ["显著", "大幅", "基本上", "大部分情况", "相当不错"]) {
      expect(tmpl).toContain(term)
    }
    // "may break" must NOT be in the banned list — lesson #18: concrete-
    // conditional "may break IF X" is legitimate risk phrasing.
    expect(tmpl).not.toMatch(/banned.*may break|may break.*banned/i)
  })

  test("U3: bad / good contrast section present", () => {
    expect(tmpl).toMatch(/(bad|Bad).*(good|Good)/s)
    // Concrete failure modes (audience / criterion / success metric) named
    expect(tmpl).toMatch(/audience|metric|why-now|success/i)
  })
})

describe("planner.ceo manifest (P2#7a)", () => {
  test("M1: prompt_path declares prompts/planner-ceo.md", () => {
    const m = getSubagentManifest("planner.ceo")
    expect(m).toBeDefined()
    expect(m!.prompt_path).toBe("prompts/planner-ceo.md")
  })

  test("M2: inputs include intent_draft; outputs unchanged (verdict + concerns + rewrite_hints)", () => {
    const m = getSubagentManifest("planner.ceo")
    expect(m).toBeDefined()
    const inputs = m!.inputs as Record<string, string>
    expect(inputs.intent_draft).toBe("markdown")
    const outputs = m!.outputs as Record<string, string>
    expect(outputs.verdict).toMatch(/^enum\[/)
    expect(outputs.concerns).toBe("array[string]")
    expect(outputs.rewrite_hints).toBe("array[string]")
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
      readConfirmation: async () => "yes",
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
