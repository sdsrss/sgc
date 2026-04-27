// compound.context — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline including Invariant §13 Tier-2 llm.request /
// llm.response emission. spawn.ts:resolveMode picks anthropic-sdk when
// ANTHROPIC_API_KEY is set; otherwise openrouter. Either route reaches
// the same prompts/compound-context.md template.
//
// Four fixtures (e1–e4) cover heuristic-mis-classify negative test, an
// English clear-bucket case, an English data category, and a Chinese
// runtime category. e1 is the headline anti-pattern: the regex heuristic
// currently mis-classifies "authorize the user to read docs" as `auth`
// because the verb "authorize" hits the auth regex; the LLM must
// resist this forced fit. See sub-spec §4 anti-pattern #2 + §5.2.
//
// Sync rule (sub-spec §6): BANNED_VOCAB_RE below MUST list the same 15
// terms as prompts/compound-context.md ## Anti-patterns #6 AND
// prompts/planner-eng.md ## Anti-patterns #3 AND
// tests/eval/planner-eng-llm.test.ts BANNED_VOCAB_RE.
//
// Cost: ≈ 4 calls × ~600 in / ~200 out tokens × claude-sonnet ≈ a few
// cents per run. Set a key locally to opt in; CI default is skip.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { CompoundContextOutput } from "../../src/dispatcher/agents/compound"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

type Fixture =
  | {
      readonly id: string
      readonly intent: string
      readonly expectMinTags: number
      readonly expectCategoryNot: "auth"
    }
  | {
      readonly id: string
      readonly intent: string
      readonly expectMinTags: number
      readonly expectCategoryIn: readonly (
        | "auth"
        | "data"
        | "infra"
        | "perf"
        | "ui"
        | "build"
        | "runtime"
        | "other"
      )[]
    }

const FIXTURES: readonly Fixture[] = [
  // e1 — heuristic-mis-classify negative test. "authorize" + "user" hits
  // the auth regex bucket; LLM should NOT force-fit.
  {
    id: "e1",
    intent: "authorize internal users to read the RFC docs section",
    expectCategoryNot: "auth",
    expectMinTags: 1,
  },
  // e2 — clear runtime/auth/perf/infra boundary; any of those is acceptable.
  {
    id: "e2",
    intent: "add rate limiting middleware to public API endpoints",
    expectCategoryIn: ["auth", "runtime", "infra", "perf"],
    expectMinTags: 2,
  },
  // e3 — clear data category.
  {
    id: "e3",
    intent: "migrate .sgc/state from YAML to SQLite with rollback path",
    expectCategoryIn: ["data"],
    expectMinTags: 2,
  },
  // e4 — Chinese intent, clear runtime category. Validates Bun ICU
  // segmentation does not block multilingual classification.
  {
    id: "e4",
    intent: "修复 dispatcher 在并发 spawn 时的状态竞态",
    expectCategoryIn: ["runtime"],
    expectMinTags: 1,
  },
] as const

// 15 terms (10 EN + 5 中文); identical list to:
//   prompts/compound-context.md ## Anti-patterns #6
//   prompts/planner-eng.md ## Anti-patterns #3
//   tests/eval/planner-eng-llm.test.ts BANNED_VOCAB_RE
// "may break" remains excluded for the same false-positive reason logged
// in tests/eval/planner-eng-llm.test.ts (concrete-conditional usage).
const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

const ALL_CATEGORIES = [
  "auth",
  "data",
  "infra",
  "perf",
  "ui",
  "build",
  "runtime",
  "other",
] as const

// Per-test timeout: bun's 5s default is below typical LLM round-trip latency
// (claude-sonnet via openrouter / anthropic-sdk commonly takes ~6-15s).
// Manifest has timeout_s: 180 ceiling; 60s here is well under that and
// well over typical.
const EVAL_TIMEOUT_MS = 60_000

describe("compound.context LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} — ${f.intent.slice(0, 50)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-cc-${f.id}-`))
        try {
          const res = await spawn(
            "compound.context",
            { task_id: f.id, intent: f.intent },
            { stateRoot, taskId: f.id },
          )
          const out = res.output as CompoundContextOutput

          // Universal: enum membership + no banned vocab anywhere
          expect(ALL_CATEGORIES).toContain(out.category)
          const allText = JSON.stringify(out)
          expect(allText).not.toMatch(BANNED_VOCAB_RE)

          // Tag shape: count + length + lowercase
          expect(out.tags.length).toBeGreaterThanOrEqual(f.expectMinTags)
          expect(out.tags.length).toBeLessThanOrEqual(8)
          for (const t of out.tags) {
            expect(t.length).toBeLessThanOrEqual(20)
            expect(t).toBe(t.toLowerCase())
          }

          // Category constraint per fixture
          if ("expectCategoryNot" in f) {
            expect(out.category).not.toBe(f.expectCategoryNot)
          } else {
            expect(f.expectCategoryIn).toContain(out.category)
          }
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
