import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  researcherHistory,
  researcherHistoryHeuristic,
  preFilterSolutions,
  coerceLlmOutput,
  handleCoerceFailure,
  type PriorArtCandidate,
} from "../../src/dispatcher/agents/researcher-history"
import { OutputShapeMismatch } from "../../src/dispatcher/validation"
import { spawn } from "../../src/dispatcher/spawn"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"
import type { EventRecord, Logger } from "../../src/dispatcher/logger"

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
    seedSolution(
      tmp,
      "auth",
      "seed-for-d22",
      "---\nintent: seed\n---\n\nadd new field to public API response payload schema.",
    )
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
    seedSolution(
      tmp,
      "data",
      "seed-for-audit",
      "---\nintent: seed\n---\n\nadd new API endpoint for users table database schema.",
    )
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

  test("C3c: NaN relevance_score → OutputShapeMismatch (Guard 3 finite check)", () => {
    // Phase H pre-ship review F-2: bare `score < 0 || score > 1` admitted NaN
    // (typeof NaN === "number" + NaN-comparisons-are-false). YAML allows
    // `relevance_score: .nan`; without Number.isFinite the literal "NaN"
    // would render via .toFixed(2) into intent.md.
    const raw = {
      prior_art: [
        {
          solution_ref: "auth/oauth-token-refresh",
          relevance_score: NaN,
          relevance_reason: "ok",
        },
      ],
      warnings: [],
    }
    expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
  })

  test("C3d: ±Infinity relevance_score → OutputShapeMismatch (Guard 3 finite check)", () => {
    for (const score of [Infinity, -Infinity]) {
      const raw = {
        prior_art: [
          {
            solution_ref: "auth/oauth-token-refresh",
            relevance_score: score,
            relevance_reason: "ok",
          },
        ],
        warnings: [],
      }
      expect(() => coerceLlmOutput(raw, cands)).toThrow(OutputShapeMismatch)
    }
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

  test("C0: raw is null / string / undefined → OutputShapeMismatch (outer-object check)", () => {
    // Phase H pre-ship review F-7: the outer raw-must-be-object check at the
    // top of coerceLlmOutput had no negative-path test. C6 covers
    // `prior_art: "string"` (which exercises Guard 1, not the outer check).
    for (const raw of [null, "string", undefined, 42]) {
      expect(() => coerceLlmOutput(raw as unknown, cands)).toThrow(
        OutputShapeMismatch,
      )
    }
  })
})

describe("handleCoerceFailure — Tier-2 audit emission (Phase H pre-ship review F-4)", () => {
  function makeCapturingLogger(): {
    logger: Logger
    events: EventRecord[]
  } {
    const events: EventRecord[] = []
    const logger: Logger = {
      say: () => {},
      event: (partial) => {
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        } as EventRecord)
      },
    }
    return { logger, events }
  }

  test("emits researcher.coerce_failed event with error class + message", () => {
    const { logger, events } = makeCapturingLogger()
    const err = new OutputShapeMismatch(
      "researcher.history",
      ["prior_art[0].solution_ref"],
      "ref ghost/x not in input candidates",
    )
    const out = handleCoerceFailure(err, logger, "task-abc")
    expect(events.length).toBe(1)
    const e = events[0]!
    expect(e.event_type).toBe("researcher.coerce_failed")
    expect(e.level).toBe("warn")
    expect(e.task_id).toBe("task-abc")
    expect(e.agent).toBe("researcher.history")
    expect(e.payload.error_class).toBe("OutputShapeMismatch")
    expect(e.payload.error_message).toContain("ghost/x")
    // Synthetic fallback shape
    expect(out.prior_art).toEqual([])
    expect(out.warnings.length).toBe(1)
    expect(out.warnings[0]).toContain("OutputShapeMismatch")
    expect(out.warnings[0]).toContain("ghost/x")
  })

  test("non-Error throwable → unknown class, empty message", () => {
    const { logger, events } = makeCapturingLogger()
    const out = handleCoerceFailure("string thrown", logger, null)
    expect(events[0]?.payload.error_class).toBe("unknown")
    expect(events[0]?.payload.error_message).toBe("")
    expect(events[0]?.task_id).toBeNull()
    expect(out.warnings[0]).toBe("researcher.history failed: unknown")
  })
})

describe("plan.ts wiring — preFilter + spawn + render (Phase H T6)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-plan-h-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("W1: empty solutions/ → spawn skipped, body still has Prior art section", async () => {
    // No seedSolution → empty corpus → preFilter returns [].
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
    // Spawn for researcher.history MUST NOT have written a prompt — the
    // short-circuit returns synthetic { prior_art: [], warnings: [...] }
    // before spawn() is called.
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    expect(prompts.some((f) => f.includes("researcher.history"))).toBe(false)
    // But the body still has the section with the synthetic warning.
    const intent = readIntent(r.taskId, tmp)
    const body = intent.body ?? ""
    expect(body).toContain("Prior art (researcher.history)")
    expect(body).toContain("no candidates from pre-filter")
  })

  test("W2: seeded corpus + SGC_FORCE_INLINE → heuristic populates prior_art (no relevance_reason)", async () => {
    seedSolution(
      tmp,
      "auth",
      "oauth-token-refresh",
      "---\nintent: token refresh fix\n---\n\nFixed token refresh on 401 by adding retry.",
    )
    const r = await runPlan("add token refresh retry on 401 to API client", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
    const intent = readIntent(r.taskId, tmp)
    const body = intent.body ?? ""
    expect(body).toContain("auth/oauth-token-refresh")
    expect(body).toContain("score")
    // Heuristic mode → no Reason: line
    expect(body).not.toContain("Reason:")
  })
})

import { readFileSync } from "node:fs"
import { getSubagentManifest } from "../../src/dispatcher/schema"

describe("prompts/researcher-history.md — template structure (Phase H T4)", () => {
  test("T1a: required structural markers (Input heading, input_yaml, Anti-patterns)", () => {
    const tmpl = readFileSync(resolve(process.cwd(), "prompts/researcher-history.md"), "utf8")
    // splitPrompt regex from anthropic-sdk-agent.ts:79
    expect(tmpl).toMatch(/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/)
    expect(tmpl).toContain("<input_yaml/>")
    expect(tmpl).toContain("## Anti-patterns")
    // §13 Delegate boundary — researcher must not bleed into planner / brainstorming
    expect(tmpl).toMatch(/NOT.*planner\.eng/i)
    expect(tmpl).toMatch(/NOT.*brainstorming/i)
  })

  test("T1b: 0.3 floor + ≤30 word constraint named in prompt body", () => {
    const tmpl = readFileSync(resolve(process.cwd(), "prompts/researcher-history.md"), "utf8")
    expect(tmpl).toContain("0.3")
    expect(tmpl).toMatch(/30 words/i)
    // No padding to 5 — explicit hard rule
    expect(tmpl).toMatch(/DO NOT pad to 5/i)
    // Banned-vocab hint — first term from spec banned list
    expect(tmpl).toMatch(/significantly|robust|comprehensive/)
  })
})

describe("researcher.history manifest (Phase H T5)", () => {
  test("M1: prompt_path declares prompts/researcher-history.md", () => {
    const m = getSubagentManifest("researcher.history")
    expect(m).toBeDefined()
    expect(m!.prompt_path).toBe("prompts/researcher-history.md")
  })

  test("M2: inputs include candidates; outputs include prior_art with composite shape", () => {
    const m = getSubagentManifest("researcher.history")
    expect(m).toBeDefined()
    const inputs = m!.inputs as Record<string, string>
    expect(inputs.intent_draft).toBe("markdown")
    expect(inputs.candidates).toMatch(/^array\[/)
    const outputs = m!.outputs as Record<string, string>
    expect(outputs.prior_art).toMatch(/^array\[/)
    expect(outputs.warnings).toMatch(/^array\[string\]$/)
  })
})

describe("researcher.history — LLM mock branch (Phase H T7)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-research-llm-"))
    // Seed one candidate so preFilter returns it; the LLM mock then
    // operates on a single-element candidates array for predictable IO.
    seedSolution(
      tmp,
      "auth",
      "oauth-token-refresh",
      "---\nintent: silent token refresh failure\n---\n\nFixed token refresh on 401 by adding retry-with-backoff loop.",
    )
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function makeMockClient(yamlText: string) {
    return {
      messages: {
        create: async () => ({
          id: "mock",
          content: [{ type: "text", text: yamlText }],
          role: "assistant",
          model: "claude-sonnet-4-6-mock",
          stop_reason: "end_turn",
          stop_sequence: null,
          type: "message",
          usage: {
            input_tokens: 200,
            output_tokens: 80,
            cache_read_input_tokens: 0,
            cache_creation_input_tokens: 0,
          },
        }),
      },
    }
  }

  test("L1: happy path — canned valid YAML parses + coerce populates relevance_reason", async () => {
    const cands = preFilterSolutions("add token refresh retry to OAuth", tmp)
    expect(cands.length).toBe(1)
    const cannedYaml = [
      "```yaml",
      "prior_art:",
      "  - solution_ref: auth/oauth-token-refresh",
      "    relevance_score: 0.85",
      "    relevance_reason: Same retry-with-backoff pattern transferable to rate-limit handling on 429.",
      "warnings: []",
      "```",
    ].join("\n")
    const r = await spawn(
      "researcher.history",
      { intent_draft: "add token refresh retry to OAuth", candidates: cands },
      {
        stateRoot: tmp,
        taskId: "L1",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => makeMockClient(cannedYaml) as never,
      },
    )
    const out = coerceLlmOutput(r.output, cands)
    expect(out.prior_art.length).toBe(1)
    expect(out.prior_art[0]?.solution_ref).toBe("auth/oauth-token-refresh")
    expect(out.prior_art[0]?.relevance_score).toBe(0.85)
    expect(out.prior_art[0]?.relevance_reason).toContain("retry-with-backoff")
    expect(out.prior_art[0]?.excerpt).toContain("retry")  // back-filled from cand
  })

  test("L2: invented solution_ref → coerce throws OutputShapeMismatch", async () => {
    const cands = preFilterSolutions("add token refresh retry to OAuth", tmp)
    const cannedYaml = [
      "```yaml",
      "prior_art:",
      "  - solution_ref: ghost/never-existed",
      "    relevance_score: 0.7",
      "    relevance_reason: pretending this exists",
      "warnings: []",
      "```",
    ].join("\n")
    const r = await spawn(
      "researcher.history",
      { intent_draft: "add token refresh retry", candidates: cands },
      {
        stateRoot: tmp,
        taskId: "L2",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => makeMockClient(cannedYaml) as never,
      },
    )
    expect(() => coerceLlmOutput(r.output, cands)).toThrow(OutputShapeMismatch)
  })

  test("L3: relevance_score out of range → coerce throws", async () => {
    const cands = preFilterSolutions("add token refresh retry to OAuth", tmp)
    const cannedYaml = [
      "```yaml",
      "prior_art:",
      "  - solution_ref: auth/oauth-token-refresh",
      "    relevance_score: 1.5",
      "    relevance_reason: out of range",
      "warnings: []",
      "```",
    ].join("\n")
    const r = await spawn(
      "researcher.history",
      { intent_draft: "add token refresh retry", candidates: cands },
      {
        stateRoot: tmp,
        taskId: "L3",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => makeMockClient(cannedYaml) as never,
      },
    )
    expect(() => coerceLlmOutput(r.output, cands)).toThrow(OutputShapeMismatch)
  })

  test("L4: empty relevance_reason → coerce throws", async () => {
    const cands = preFilterSolutions("add token refresh retry to OAuth", tmp)
    const cannedYaml = [
      "```yaml",
      "prior_art:",
      "  - solution_ref: auth/oauth-token-refresh",
      "    relevance_score: 0.7",
      "    relevance_reason: \"\"",
      "warnings: []",
      "```",
    ].join("\n")
    const r = await spawn(
      "researcher.history",
      { intent_draft: "add token refresh retry", candidates: cands },
      {
        stateRoot: tmp,
        taskId: "L4",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => makeMockClient(cannedYaml) as never,
      },
    )
    expect(() => coerceLlmOutput(r.output, cands)).toThrow(OutputShapeMismatch)
  })

  test("L5: 6 entries → coerce truncates to 5 (Guard 5 tolerant)", async () => {
    const cands = preFilterSolutions("add token refresh retry to OAuth", tmp)
    const cannedYaml = [
      "```yaml",
      "prior_art:",
      ...Array.from({ length: 6 }, (_, i) =>
        [
          `  - solution_ref: auth/oauth-token-refresh`,
          `    relevance_score: ${0.5 + i * 0.05}`,
          `    relevance_reason: entry ${i}`,
        ].join("\n"),
      ),
      "warnings: []",
      "```",
    ].join("\n")
    const r = await spawn(
      "researcher.history",
      { intent_draft: "add token refresh retry", candidates: cands },
      {
        stateRoot: tmp,
        taskId: "L5",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => makeMockClient(cannedYaml) as never,
      },
    )
    const out = coerceLlmOutput(r.output, cands)
    expect(out.prior_art.length).toBe(5)
    expect(out.prior_art[0]?.relevance_reason).toBe("entry 0")
  })
})
