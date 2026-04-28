import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { researcherHistory } from "../../src/dispatcher/agents/researcher-history"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

function seedSolution(
  stateRoot: string,
  category: string,
  slug: string,
  content: string,
): void {
  const dir = resolve(stateRoot, "solutions", category)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${slug}.md`), content, "utf8")
}

describe("researcherHistory — unit", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-research-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("empty solutions dir → no prior art, no warnings (no solutions yet)", () => {
    const r = researcherHistory(
      { intent_draft: "add markdown table support" },
      { stateRoot: tmp },
    )
    expect(r.prior_art).toEqual([])
    expect(r.warnings).toEqual([])  // dir doesn't exist → no "found nothing" warning
  })

  test("very short intent → keyword extraction warning", () => {
    const r = researcherHistory({ intent_draft: "do it" }, { stateRoot: tmp })
    expect(r.prior_art).toEqual([])
    expect(r.warnings.some((w) => /keywords/.test(w))).toBe(true)
  })

  test("finds a matching solution + scores by hit rate", () => {
    seedSolution(
      tmp,
      "runtime",
      "markdown-table-fix",
      "---\nid: x\n---\n\nFixed a bug where markdown tables failed to render.",
    )
    seedSolution(
      tmp,
      "runtime",
      "unrelated",
      "---\nid: y\n---\n\nUnrelated content about database migrations.",
    )
    const r = researcherHistory(
      { intent_draft: "add markdown table rendering to documentation page" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.length).toBe(1)
    expect(r.prior_art[0]?.solution_ref).toBe("runtime/markdown-table-fix")
    expect(r.prior_art[0]?.relevance_score).toBeGreaterThan(0)
    expect(r.prior_art[0]?.excerpt).toContain("markdown")
  })

  test("sorts by relevance + caps at 5", () => {
    for (let i = 0; i < 10; i++) {
      seedSolution(
        tmp,
        "perf",
        `entry-${i}`,
        `entry about markdown table rendering with varying degrees of detail ${"word ".repeat(i)}`,
      )
    }
    const r = researcherHistory(
      { intent_draft: "markdown table rendering improvements" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.length).toBeLessThanOrEqual(5)
    // Sorted descending by relevance_score
    for (let i = 0; i + 1 < r.prior_art.length; i++) {
      expect(r.prior_art[i]!.relevance_score).toBeGreaterThanOrEqual(
        r.prior_art[i + 1]!.relevance_score,
      )
    }
  })

  test("warns when solutions dir exists but no keyword match", () => {
    seedSolution(
      tmp,
      "auth",
      "jwt-rotation",
      "---\nid: z\n---\n\nRotated JWT keys for token refresh safety.",
    )
    const r = researcherHistory(
      { intent_draft: "add markdown rendering to docs" },
      { stateRoot: tmp },
    )
    expect(r.prior_art).toEqual([])
    expect(r.warnings.some((w) => /no relevant/.test(w))).toBe(true)
  })

  test("R1: Chinese intent produces non-empty token set (NFC + Intl.Segmenter)", () => {
    seedSolution(
      tmp,
      "runtime",
      "spawn-timeout-retry",
      "---\nintent: 给 dispatcher 加超时重试\n---\n\n修复 spawn() 在超时后不重试导致幽灵任务的问题。",
    )
    const r = researcherHistory(
      { intent_draft: "给 dispatcher 的 spawn() 增加重试超时的结构化日志" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.length).toBeGreaterThan(0)
    expect(r.prior_art[0]?.solution_ref).toBe("runtime/spawn-timeout-retry")
  })

  test("R2: extractKeywords returns non-empty for mixed CN/EN intent", () => {
    seedSolution(
      tmp,
      "infra",
      "proxy-bun-vs-npm",
      "---\nintent: HTTP_PROXY env handling\n---\n\nbun client bypasses HTTP_PROXY env even when set; npm respects it.",
    )
    const r = researcherHistory(
      { intent_draft: "fix HTTP_PROXY 环境变量在 bun 下被忽略" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.length).toBeGreaterThan(0)
    expect(r.prior_art[0]?.solution_ref).toBe("infra/proxy-bun-vs-npm")
  })

  test("R3: heuristic output omits relevance_reason field (LLM-only field)", () => {
    seedSolution(
      tmp,
      "runtime",
      "x",
      "---\nid: x\n---\n\nFixed markdown table rendering bug.",
    )
    const r = researcherHistory(
      { intent_draft: "add markdown table to docs page" },
      { stateRoot: tmp },
    )
    expect(r.prior_art.length).toBeGreaterThan(0)
    expect(r.prior_art[0]?.relevance_reason).toBeUndefined()
  })

  test("R4: researcherHistory alias === researcherHistoryHeuristic (G.2 pattern)", () => {
    const mod = require("../../src/dispatcher/agents/researcher-history")
    expect(mod.researcherHistory).toBe(mod.researcherHistoryHeuristic)
  })
})

describe("runPlan — researcher.history wiring (D-2.2)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-plan-research-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("L1 does NOT dispatch researcher.history", async () => {
    const r = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L1")
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    expect(prompts.some((f) => f.includes("researcher.history"))).toBe(false)
  })

  test("L2 dispatches researcher + adds Prior art section to intent body", async () => {
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    expect(prompts.some((f) => f.includes("researcher.history"))).toBe(true)
    const intent = readIntent(r.taskId, tmp)
    const body = intent.body ?? ""
    expect(body).toContain("Prior art (researcher.history)")
  })

  test("L2 audit trail has all 4 expected prompts (classifier + eng + ceo + research)", async () => {
    await runPlan("add a new API endpoint for the users table", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    expect(prompts.filter((f) => f.includes("classifier.level")).length).toBe(1)
    expect(prompts.filter((f) => f.includes("planner.eng")).length).toBe(1)
    expect(prompts.filter((f) => f.includes("planner.ceo")).length).toBe(1)
    expect(prompts.filter((f) => f.includes("researcher.history")).length).toBe(1)
    // 4 total
    expect(prompts.length).toBe(4)
  })

  test("L3 researcher runs + intent body has prior art (even if empty)", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      readConfirmation: async () => "yes",
      log: () => {},
    })
    expect(r.level).toBe("L3")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.body ?? "").toContain("Prior art (researcher.history)")
  })
})
