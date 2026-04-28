import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  researcherHistory,
  researcherHistoryHeuristic,
  preFilterSolutions,
  coerceLlmOutput,
  type PriorArtCandidate,
} from "../../src/dispatcher/agents/researcher-history"
import { OutputShapeMismatch } from "../../src/dispatcher/validation"
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

  test("R1: Chinese intent matches Chinese-only solution (NFC + Intl.Segmenter)", () => {
    seedSolution(
      tmp,
      "runtime",
      "调度器-超时-重试",
      "---\nintent: 调度器超时重试机制\n---\n\n修复调度器在超时后不重试导致幽灵任务的问题；增加退避算法。",
    )
    const r = researcherHistory(
      { intent_draft: "给调度器增加超时重试和结构化日志" },
      { stateRoot: tmp },
    )
    // Old extractKeywords: split(/[^a-z0-9]+/) on lowercased CJK input
    // produces only empty strings → keywords=[] → 0 hits → empty prior_art.
    // New tokenize: Intl.Segmenter yields CJK words → match → prior_art.
    expect(r.prior_art.length).toBeGreaterThan(0)
    expect(r.prior_art[0]?.solution_ref).toBe("runtime/调度器-超时-重试")
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
    expect(researcherHistory).toBe(researcherHistoryHeuristic)
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

describe("preFilterSolutions — pre-filter helper (Phase H T2)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-pre-filter-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("P1: returns PriorArtCandidate[] with solution_ref / category / excerpt / keyword_hits", () => {
    seedSolution(
      tmp,
      "auth",
      "oauth-token-refresh",
      "---\nintent: Fixed silent token refresh failure\n---\n\nWhen the upstream returns 401, retry with backoff instead of swallowing the error.",
    )
    const cands = preFilterSolutions(
      "add token refresh retry to OAuth client",
      tmp,
    )
    expect(cands.length).toBe(1)
    // Read fields before toMatchObject to avoid Bun matcher-replacement quirk
    const keywordHits = cands[0]?.keyword_hits
    const excerptLen = cands[0]?.excerpt.length ?? 0
    expect(cands[0]).toMatchObject({
      solution_ref: "auth/oauth-token-refresh",
      category: "auth",
    })
    expect(typeof keywordHits).toBe("number")
    expect(keywordHits).toBeGreaterThan(0)
    expect(excerptLen).toBeGreaterThan(0)
    expect(excerptLen).toBeLessThanOrEqual(500)
  })

  test("P2: corpus > 20 → top-20 by keyword_hits descending", () => {
    for (let i = 0; i < 25; i++) {
      seedSolution(
        tmp,
        "perf",
        `entry-${i}`,
        `---\nintent: optimization ${i}\n---\n\nperformance tuning ${"keyword ".repeat(i % 5)}`,
      )
    }
    const cands = preFilterSolutions("optimize performance keyword tuning", tmp)
    expect(cands.length).toBe(20)
    for (let i = 0; i + 1 < cands.length; i++) {
      expect(cands[i]!.keyword_hits).toBeGreaterThanOrEqual(cands[i + 1]!.keyword_hits)
    }
  })

  test("P3: missing solutions/ dir → empty array, no throw", () => {
    const cands = preFilterSolutions("anything", tmp)
    expect(cands).toEqual([])
  })

  test("P4: corpus exists but no keyword overlap → empty array", () => {
    seedSolution(tmp, "ui", "css-grid", "---\nintent: layout\n---\n\nfix grid.")
    const cands = preFilterSolutions("rename CLI flag from --foo to --bar", tmp)
    expect(cands).toEqual([])
  })
})

describe("coerceLlmOutput — 5 guards (Phase H T3)", () => {
  const cands: PriorArtCandidate[] = [
    {
      solution_ref: "auth/oauth-token-refresh",
      category: "auth",
      excerpt: "Fixed silent token refresh failure on 401 by adding retry.",
      keyword_hits: 3,
    },
    {
      solution_ref: "runtime/spawn-timeout-retry",
      category: "runtime",
      excerpt: "Added retry-with-backoff to spawn() on timeout.",
      keyword_hits: 2,
    },
  ]

  test("C1: happy path — valid LLM output coerced to ResearcherHistoryOutput", () => {
    const raw = {
      prior_art: [
        {
          solution_ref: "auth/oauth-token-refresh",
          relevance_score: 0.85,
          relevance_reason: "Same retry-with-backoff pattern transferable to rate-limit middleware on 429.",
        },
      ],
      warnings: [],
    }
    const out = coerceLlmOutput(raw, cands)
    expect(out.prior_art.length).toBe(1)
    expect(out.prior_art[0]?.solution_ref).toBe("auth/oauth-token-refresh")
    expect(out.prior_art[0]?.relevance_score).toBe(0.85)
    expect(out.prior_art[0]?.relevance_reason).toContain("retry-with-backoff")
    // Excerpt back-filled from candidates map (LLM didn't emit it)
    expect(out.prior_art[0]?.excerpt).toBe(cands[0]!.excerpt)
    expect(out.prior_art[0]?.source).toBe("solutions")
    expect(out.warnings).toEqual([])
  })

  test("C2: invented solution_ref → OutputShapeMismatch (Guard 2)", () => {
    const raw = {
      prior_art: [
        {
          solution_ref: "ghost/never-existed",
          relevance_score: 0.8,
          relevance_reason: "fabricated reference",
        },
      ],
      warnings: [],
    }
    expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
  })

  test("C3a: relevance_score above 1.0 → OutputShapeMismatch (Guard 3)", () => {
    const raw = {
      prior_art: [
        {
          solution_ref: "auth/oauth-token-refresh",
          relevance_score: 1.5,
          relevance_reason: "ok",
        },
      ],
      warnings: [],
    }
    expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
  })

  test("C3b: relevance_score below 0.3 → OutputShapeMismatch (Guard 3 floor)", () => {
    const raw = {
      prior_art: [
        {
          solution_ref: "auth/oauth-token-refresh",
          relevance_score: 0.25,
          relevance_reason: "low overlap",
        },
      ],
      warnings: [],
    }
    expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
  })

  test("C4: empty relevance_reason → OutputShapeMismatch (Guard 4)", () => {
    const raw = {
      prior_art: [
        {
          solution_ref: "auth/oauth-token-refresh",
          relevance_score: 0.7,
          relevance_reason: "",
        },
      ],
      warnings: [],
    }
    expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
  })

  test("C5: 6 entries → silent truncate to first 5 (Guard 5 tolerant)", () => {
    const raw = {
      prior_art: Array.from({ length: 6 }, (_, i) => ({
        solution_ref: i % 2 === 0 ? "auth/oauth-token-refresh" : "runtime/spawn-timeout-retry",
        relevance_score: 0.5 + i * 0.05,
        relevance_reason: `entry ${i}`,
      })),
      warnings: [],
    }
    const out = coerceLlmOutput(raw, cands)
    expect(out.prior_art.length).toBe(5)
    expect(out.prior_art[0]?.relevance_reason).toBe("entry 0")
    expect(out.prior_art[4]?.relevance_reason).toBe("entry 4")
  })

  test("C6: prior_art not array → OutputShapeMismatch (Guard 1)", () => {
    const raw = { prior_art: "string instead of array", warnings: [] }
    expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
  })

  test("C7: empty prior_art array is valid + passes through warnings", () => {
    const raw = {
      prior_art: [],
      warnings: ["no candidate cleared 0.3 relevance floor"],
    }
    const out = coerceLlmOutput(raw, cands)
    expect(out.prior_art).toEqual([])
    expect(out.warnings).toEqual(["no candidate cleared 0.3 relevance floor"])
  })
})
