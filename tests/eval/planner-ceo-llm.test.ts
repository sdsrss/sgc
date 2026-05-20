// planner.ceo — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline including Invariant §13 Tier-2 llm.request /
// llm.response emission. spawn.ts:resolveMode picks anthropic-sdk when
// ANTHROPIC_API_KEY is set; otherwise openrouter when OPENROUTER_API_KEY
// is set. Either route reaches the same prompts/planner-ceo.md template.
//
// Sync rule: BANNED_VOCAB_RE below MUST list the same 15 terms as
// prompts/planner-ceo.md ## Anti-patterns #3 (mirrors planner-eng-llm.test
// per the G.2.a sync convention; "may break" exempt per lesson #18).
//
// Cost: ≈ 4 calls × ~600/200 in/out tokens × claude-sonnet ≈ a few cents
// per run. Set ANTHROPIC_API_KEY (or OPENROUTER_API_KEY) locally to opt in;
// CI default is skip.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { PlannerCeoOutput } from "../../src/dispatcher/agents/planner-ceo"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

const FIXTURES = [
  {
    id: "s1",
    level: "L1",
    lang: "en",
    intent: "fix typo in README.md plan section",
    // L0/L1 over-flagging is itself a CEO anti-pattern — typo intent
    // should approve with no concerns / no rewrite_hints.
    expectApproveEmpty: true,
  },
  {
    id: "s2",
    level: "L2",
    lang: "en",
    intent: "improve dashboard performance",
    // Thin intent — no audience named, no metric, no why-now. CEO should
    // surface ≥1 concern OR ≥1 rewrite_hint touching audience/metric.
    expectApproveEmpty: false,
  },
  {
    id: "s3",
    level: "L2",
    lang: "zh",
    intent: "给分析团队的搜索接口降低 p99 延迟到 200ms 以内，本季度交付",
    // Strong intent — audience (分析团队) + metric (p99 < 200ms) + why-now
    // (本季度) all present. CEO can approve cleanly OR raise minor concerns,
    // either is valid — just verify shape + no banned vocab.
    expectApproveEmpty: false,
  },
  {
    id: "s4",
    level: "L3",
    lang: "en",
    intent: "migrate .sgc/state from YAML to SQLite",
    // L3 migration — no audience or metric in the intent string, so CEO
    // should surface ≥1 concern/hint. Verdict can be approve-with-concerns
    // or revise; either is valid.
    expectApproveEmpty: false,
  },
] as const

// Mirrors planner-eng-llm BANNED_VOCAB_RE (G.2.a sync rule). "may break"
// dropped per lesson #18 — concrete-conditional "may break IF X" is
// legitimate. 15 terms total (10 EN + 5 中文).
const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

// Product-vocab whitelist — CEO output should reference the three product
// axes (audience / metric / why-now) when calling out a gap. Used to verify
// the LLM stays on product framing, not drifting into eng/structural risk.
// Intentionally generous: includes EN + 中文 synonyms for each axis.
const PRODUCT_VOCAB_RE =
  /\b(audience|user|customer|team|caller|stakeholder|metric|criterion|criteria|measurable|measurement|outcome|success|goal|deadline|why|motivation|impact|adoption|retention|revenue|latency|p\d{2}|baseline|target|scope|user-visible|observable|受众|用户|客户|团队|指标|度量|衡量|成功|目标|动机|影响|采用|留存|延迟|基线|范围)/i

// Per-test timeout: bun's 5s default is below typical LLM round-trip latency
// (claude-sonnet via openrouter / anthropic-sdk commonly takes ~6-15s for
// L2/L3 prompts). Manifest has timeout_s: 120 as the spawn-level ceiling;
// 60s here is well under that and well over typical.
const EVAL_TIMEOUT_MS = 60_000

describe("planner.ceo LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} (${f.level} ${f.lang}) — ${f.intent.slice(0, 50)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-ceo-${f.id}-`))
        try {
          const res = await spawn(
            "planner.ceo",
            { intent_draft: f.intent },
            { stateRoot, taskId: f.id },
          )
          const out = res.output as PlannerCeoOutput

          // Universal: shape + no banned vocab anywhere
          expect(["approve", "revise", "reject"]).toContain(out.verdict)
          expect(Array.isArray(out.concerns)).toBe(true)
          expect(Array.isArray(out.rewrite_hints)).toBe(true)
          const allText = JSON.stringify(out)
          expect(allText).not.toMatch(BANNED_VOCAB_RE)

          if (f.expectApproveEmpty) {
            // s1 anti-over-flag — typo intent must not force product framing
            expect(out.verdict).toBe("approve")
            expect(out.concerns).toHaveLength(0)
            expect(out.rewrite_hints).toHaveLength(0)
          } else {
            // s2/s3/s4 — at least one of concerns / rewrite_hints non-empty,
            // OR an explicit clean approve with rationale-in-concerns is
            // acceptable. We assert the LLM stays on PRODUCT axes when it
            // does call out a gap.
            const surfaced = out.concerns.length > 0 || out.rewrite_hints.length > 0
            if (surfaced) {
              const allCallouts = [...out.concerns, ...out.rewrite_hints].join(" ")
              expect(allCallouts).toMatch(PRODUCT_VOCAB_RE)
            }
            // Either path is valid — but we DON'T accept silent-empty on
            // thin intents (s2) where the gap is unambiguous.
            if (f.id === "s2") {
              expect(surfaced).toBe(true)
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
