// clarifier.discover — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline including Invariant §13 Tier-2 llm.request /
// llm.response emission via prompts/clarifier-discover.md.
//
// Sync rule: BANNED_VOCAB_RE below MUST list the same 15 terms as
// prompts/clarifier-discover.md ## Anti-patterns #3 (mirrors planner-eng /
// planner-ceo / planner-adversarial sync convention; "may break" exempt
// per lesson #18).
//
// Cost: ≈ 4 calls × ~600/300 in/out tokens × claude-sonnet ≈ a few cents
// per run. Set ANTHROPIC_API_KEY (or OPENROUTER_API_KEY) locally to opt in;
// CI default is skip.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { ClarifierDiscoverOutput } from "../../src/dispatcher/agents/clarifier-discover"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

const FIXTURES = [
  {
    id: "s1",
    lang: "en",
    topic: "improve the search page",
    current_task_summary: "",
    // Generic topic: no domain-specific hint should be invented.
    expectDomain: null,
  },
  {
    id: "s2",
    lang: "en",
    topic: "add OAuth token refresh for API callers",
    current_task_summary: "",
    // Auth domain: threat-model OR token-lifecycle question expected
    expectDomain: /\b(threat model|bypass|expired|revoked|forged|token lifecycle|session)\b/i,
  },
  {
    id: "s3",
    lang: "zh",
    topic: "把订单表的 created_at 字段从 timestamp 改成 timestamptz",
    current_task_summary: "",
    // Migration domain in 中文: rollback / 回滚 question expected
    expectDomain: /\b(rollback|backfill|additive|migration)\b|回滚|备份|迁移|可逆/i,
  },
  {
    id: "s4",
    lang: "en",
    topic: "add dashboards",
    current_task_summary: "01HXK9 (L2)",
    // current_task_summary present → suggested_next must include it
    expectContextHint: "01HXK9 (L2)",
  },
] as const

// 15 terms; same list as planner-* prompts. "may break" exempt per lesson #18.
const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

const EVAL_TIMEOUT_MS = 60_000

describe("clarifier.discover LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} (${f.lang}) — ${f.topic.slice(0, 50)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-clarifier-${f.id}-`))
        try {
          const res = await spawn(
            "clarifier.discover",
            { topic: f.topic, current_task_summary: f.current_task_summary },
            { stateRoot, taskId: f.id },
          )
          const out = res.output as ClarifierDiscoverOutput

          // Universal shape: all 7 fields present + correct primitives
          expect(typeof out.topic).toBe("string")
          expect(typeof out.goal_question).toBe("string")
          expect(out.goal_question.length).toBeGreaterThan(0)
          expect(Array.isArray(out.constraint_questions)).toBe(true)
          expect(Array.isArray(out.scope_questions)).toBe(true)
          expect(Array.isArray(out.edge_case_questions)).toBe(true)
          expect(Array.isArray(out.acceptance_questions)).toBe(true)
          expect(typeof out.suggested_next).toBe("string")

          // Hard caps (anti-pattern #4) — these are firm
          expect(out.constraint_questions.length).toBeLessThanOrEqual(5)
          expect(out.scope_questions.length).toBeLessThanOrEqual(3)
          expect(out.edge_case_questions.length).toBeLessThanOrEqual(4)
          expect(out.acceptance_questions.length).toBeLessThanOrEqual(3)

          // No banned vocab anywhere
          const allText = JSON.stringify(out)
          expect(allText).not.toMatch(BANNED_VOCAB_RE)

          // Topic echoed back (whitespace-trimmed but content-stable)
          expect(out.topic.trim()).toBe(f.topic.trim())

          // suggested_next has the literal CLI shape
          expect(out.suggested_next).toContain("sgc plan")
          expect(out.suggested_next).toContain("--motivation")

          if ("expectDomain" in f && f.expectDomain) {
            const allQuestions = [
              ...out.constraint_questions,
              ...out.scope_questions,
              ...out.edge_case_questions,
              ...out.acceptance_questions,
            ].join(" ")
            expect(allQuestions).toMatch(f.expectDomain)
          }
          if ("expectContextHint" in f && f.expectContextHint) {
            expect(out.suggested_next).toContain(f.expectContextHint)
          }
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
