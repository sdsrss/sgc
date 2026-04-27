// planner.eng — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY is set. Exercises the full spawn()
// pipeline including Invariant §13 Tier-2 llm.request/response emission.
//
// Four fixtures match parent spec §8.2 (G.3 scenarios). s1 is an
// anti-over-flagging negative test; s2/s3/s4 must produce ≥1 risk
// referencing a plausible module category. Banned vocabulary is
// asserted absent across all four. See sub-spec §5.2 + §8 (Q3=b).
//
// Sync rule (spec §6): BANNED_VOCAB_RE below MUST list the same 16
// terms as prompts/planner-eng.md ## Anti-patterns #3.
//
// Cost: ≈ 4 calls × ~700/200 in/out tokens × claude-sonnet-4-6 ≈ a few cents
// per run. Set ANTHROPIC_API_KEY locally to opt in; CI default is skip.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { PlannerEngOutput } from "../../src/dispatcher/agents/planner-eng"

const HAS_KEY = !!process.env["ANTHROPIC_API_KEY"]

const FIXTURES = [
  {
    id: "s1",
    level: "L1",
    lang: "en",
    intent: "fix typo in README.md plan section",
    expectEmpty: true,
  },
  {
    id: "s2",
    level: "L2",
    lang: "en",
    intent: "add rate limiting middleware to public API endpoints",
    expectEmpty: false,
  },
  {
    id: "s3",
    level: "L2",
    lang: "zh",
    intent: "给 dispatcher 的 spawn() 增加重试超时的结构化日志",
    expectEmpty: false,
  },
  {
    id: "s4",
    level: "L3",
    lang: "en",
    intent: "migrate .sgc/state from YAML to SQLite",
    expectEmpty: false,
  },
] as const

const MODULE_CATEGORY_RE =
  /\b(auth|data|infra|perf|runtime|api|schema|migration|test|coverage|concurrency|race|lock|cache|database|middleware|dispatcher|spawn|manifest|log|event|audit|dedup|payment|session|token|deploy|production)\b/i

const BANNED_VOCAB_RE =
  /(could potentially|may break|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

describe("planner.eng LLM eval", () => {
  // Per spec §9: test.skipIf per-iteration (describe.skipIf produces identical
  // 4-skip output in bun 1.3.5; either form is acceptable per the spec fallback).
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(`${f.id} (${f.level} ${f.lang}) — ${f.intent.slice(0, 50)}`, async () => {
      const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-${f.id}-`))
      try {
        const res = await spawn(
          "planner.eng",
          { intent_draft: f.intent },
          { stateRoot, taskId: f.id },
        )
        const out = res.output as PlannerEngOutput

        // Universal: shape + no banned vocab anywhere
        expect(["approve", "revise", "reject"]).toContain(out.verdict)
        const allText = JSON.stringify(out)
        expect(allText).not.toMatch(BANNED_VOCAB_RE)

        if (f.expectEmpty) {
          // s1 anti-over-flag — typo intent must produce no fabricated risks
          expect(out.verdict).toBe("approve")
          expect(out.structural_risks).toHaveLength(0)
        } else {
          // s2/s3/s4 — ≥1 risk hitting module-category whitelist
          expect(out.structural_risks.length).toBeGreaterThanOrEqual(1)
          const hit = out.structural_risks.some((r) =>
            MODULE_CATEGORY_RE.test(`${r.area} ${r.risk}`),
          )
          expect(hit).toBe(true)
        }
      } finally {
        rmSync(stateRoot, { recursive: true, force: true })
      }
    })
  }
})
