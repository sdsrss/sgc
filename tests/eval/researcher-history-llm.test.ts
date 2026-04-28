// researcher.history — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline + Invariant §13 Tier-2 llm.request /
// llm.response emission against the fixture corpus at
// tests/fixtures/solutions/.
//
// Four fixtures match Phase H spec §5.4. e4 is an anti-over-flagging
// negative test (rename CLI flag → no candidate clears 0.3 floor → empty
// prior_art); e1/e2/e3 must produce non-empty prior_art with refs hitting
// the right category.
//
// Sync rule (spec §6): BANNED_VOCAB_RE below MUST list the same 15 terms
// as prompts/researcher-history.md ## Anti-patterns. Mirrors G.2.a/b
// patterns inline (no shared utility per repo convention).
//
// Cost: ≈ 4 calls × ~3K/300 in/out tokens × claude-sonnet ≈ a few cents
// per run. CI default: skip.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, copyFileSync, readdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import {
  preFilterSolutions,
  coerceLlmOutput,
  type ResearcherHistoryOutput,
} from "../../src/dispatcher/agents/researcher-history"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

const FIXTURES_SRC = resolve(process.cwd(), "tests/fixtures/solutions")

const SCENARIOS = [
  {
    id: "e1",
    level: "L2",
    lang: "en",
    intent: "add rate limiting middleware to public API endpoints",
    expectEmpty: false,
    expectRefSubstring: /api-throttle|oauth-token/,
    expectReasonHas: /(rate|throttle|backoff|retry)/i,
  },
  {
    id: "e2",
    level: "L3",
    lang: "en",
    intent: "migrate .sgc/state from YAML to SQLite",
    expectEmpty: false,
    expectRefSubstring: /sqlite-migration/,
    expectReasonHas: /(schema|migrat|rollback)/i,
  },
  {
    id: "e3",
    level: "L2",
    lang: "zh",
    intent: "给 dispatcher 的 spawn() 增加重试超时的结构化日志",
    expectEmpty: false,
    expectRefSubstring: /spawn-timeout-retry/,
    expectReasonHas: /(retry|timeout|spawn|重试|超时)/i,
  },
  {
    id: "e4",
    level: "L2",
    lang: "en",
    intent: "rename a CLI flag from --foo to --bar",
    expectEmpty: true,  // rigor: no candidate clears 0.3
    expectRefSubstring: null,
    expectReasonHas: null,
  },
] as const

const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

const EVAL_TIMEOUT_MS = 60_000

function seedFixtureCorpus(stateRoot: string): void {
  // Copy tests/fixtures/solutions/ → <stateRoot>/solutions/
  const dst = resolve(stateRoot, "solutions")
  mkdirSync(dst, { recursive: true })
  for (const cat of readdirSync(FIXTURES_SRC, { withFileTypes: true })) {
    if (!cat.isDirectory()) continue
    const dstCat = resolve(dst, cat.name)
    mkdirSync(dstCat, { recursive: true })
    for (const file of readdirSync(resolve(FIXTURES_SRC, cat.name), { withFileTypes: true })) {
      if (!file.isFile() || !file.name.endsWith(".md")) continue
      copyFileSync(
        resolve(FIXTURES_SRC, cat.name, file.name),
        resolve(dstCat, file.name),
      )
    }
  }
}

describe("researcher.history LLM eval (CI-skip)", () => {
  for (const s of SCENARIOS) {
    test.skipIf(!HAS_KEY)(
      `${s.id} (${s.level} ${s.lang}) — ${s.intent.slice(0, 50)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-h-${s.id}-`))
        try {
          seedFixtureCorpus(stateRoot)
          const cands = preFilterSolutions(s.intent, stateRoot)

          if (cands.length === 0) {
            // e4 may pre-filter to empty if no keyword overlap. That's a
            // valid expectEmpty path — the LLM is never called.
            if (s.expectEmpty) {
              expect(cands).toEqual([])
              return
            }
            throw new Error(`${s.id}: pre-filter returned empty unexpectedly`)
          }

          const r = await spawn(
            "researcher.history",
            { intent_draft: s.intent, candidates: cands },
            { stateRoot, taskId: s.id },
          )
          const out: ResearcherHistoryOutput = coerceLlmOutput(r.output, cands)

          // Universal: shape + no banned vocab anywhere
          const allText = JSON.stringify(out)
          expect(allText).not.toMatch(BANNED_VOCAB_RE)

          if (s.expectEmpty) {
            expect(out.prior_art).toEqual([])
          } else {
            expect(out.prior_art.length).toBeGreaterThanOrEqual(1)
            // ≥1 ref matches expectRefSubstring
            const refMatch = out.prior_art.some(
              (p) => p.solution_ref && s.expectRefSubstring!.test(p.solution_ref),
            )
            expect(refMatch).toBe(true)
            // ≥1 reason matches expectReasonHas
            const reasonMatch = out.prior_art.some(
              (p) => p.relevance_reason && s.expectReasonHas!.test(p.relevance_reason),
            )
            expect(reasonMatch).toBe(true)
            // All reasons ≤ 30 words
            for (const p of out.prior_art) {
              if (!p.relevance_reason) continue
              const wordCount = p.relevance_reason.trim().split(/\s+/).length
              expect(wordCount).toBeLessThanOrEqual(30)
            }
            // All scores in [0.3, 1.0] (coerce already enforces; redundant safety)
            for (const p of out.prior_art) {
              expect(p.relevance_score).toBeGreaterThanOrEqual(0.3)
              expect(p.relevance_score).toBeLessThanOrEqual(1.0)
            }
            // All refs ∈ candidates set (coerce enforces; redundant safety)
            const refSet = new Set(cands.map((c) => c.solution_ref))
            for (const p of out.prior_art) {
              expect(refSet.has(p.solution_ref!)).toBe(true)
            }
          }
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
