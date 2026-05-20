// compound.solution — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline including Invariant §13 Tier-2 llm.request /
// llm.response emission via prompts/compound-solution.md.
//
// Sync rule: BANNED_VOCAB_RE below MUST list the same 15 terms as
// prompts/compound-solution.md ## Anti-patterns #4 (mirrors planner-* /
// clarifier-discover sync convention; "may break" exempt per lesson #18).
//
// Cost: ≈ 4 calls × ~800/300 in/out tokens × claude-sonnet ≈ a few cents
// per run.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type {
  CompoundContextOutput,
  CompoundSolutionOutput,
} from "../../src/dispatcher/agents/compound"
import type { ReviewReport } from "../../src/dispatcher/types"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

const ctxAuth: CompoundContextOutput = {
  category: "auth",
  tags: ["session-token", "refresh"],
  problem_summary:
    "OAuth token refresh middleware swallowed 401 responses from the issuer instead of retrying with backoff, so callers saw silent expiry rather than a transient retryable error.",
  symptoms: ["silent 401 swallowed", "callers re-auth loop without backoff"],
}

const ctxData: CompoundContextOutput = {
  category: "data",
  tags: ["migration", "schema"],
  problem_summary:
    "Adding a NOT NULL column to a 50M-row orders table needed a backfill strategy compatible with concurrent writes; the naive ALTER blocked writes for several minutes.",
  symptoms: ["lock_wait > 60s in CI dry-run", "p99 write latency on /orders spiked"],
}

const failedReview: ReviewReport = {
  report_id: "rev-1",
  task_id: "t",
  stage: "code",
  reviewer_id: "reviewer.security",
  reviewer_version: "0.1",
  verdict: "concern",
  severity: "medium",
  findings: [
    {
      description:
        "Trusting X-Forwarded-For without checking the upstream proxy IP allowlist lets a client spoof the header and skip the rate limit.",
    },
  ],
  created_at: "2026-05-01T00:00:00Z",
}

const FIXTURES = [
  {
    id: "s1",
    lang: "en",
    input: { context: ctxAuth, diff: "", reviews: [] as ReviewReport[] },
    // Pure happy path — no failed reviews; what_didnt_work must be empty.
    expectEmptyWdw: true,
    domainHit: /token|refresh|backoff|retry|401|expiry|auth/i,
  },
  {
    id: "s2",
    lang: "en",
    input: {
      context: ctxData,
      diff: "",
      reviews: [] as ReviewReport[],
    },
    expectEmptyWdw: true,
    domainHit: /migration|backfill|lock|ALTER|column|orders|cutover|schema/i,
  },
  {
    id: "s3",
    lang: "en",
    input: {
      context: ctxAuth,
      diff: "",
      reviews: [failedReview],
    },
    // One concern review → at least one what_didnt_work entry expected
    expectEmptyWdw: false,
    domainHit: /token|refresh|backoff|retry|401|expiry|auth/i,
  },
  {
    id: "s4",
    lang: "zh",
    input: {
      context: {
        category: "perf",
        tags: ["latency", "cache"],
        problem_summary: "搜索接口冷路径每次都重新计算租户前缀 SHA，导致 p99 超过 800ms。",
        symptoms: ["p99 latency 800ms", "CPU saturation under burst load"],
      } as CompoundContextOutput,
      diff: "",
      reviews: [] as ReviewReport[],
    },
    expectEmptyWdw: true,
    domainHit: /cache|memoize|prefix|latency|缓存|前缀|延迟|p99/i,
  },
] as const

const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

// Stub-killer phrases that the heuristic emits and the LLM must NOT.
const STUB_PHRASES_RE =
  /resolved by the committed change.*see the diff and review reports|see the diff and review reports for the implementation details/i

const EVAL_TIMEOUT_MS = 60_000

describe("compound.solution LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} (${f.lang}) — ${f.input.context.category} / ${f.input.context.problem_summary.slice(0, 30)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-comp-sol-${f.id}-`))
        try {
          const res = await spawn(
            "compound.solution",
            f.input,
            { stateRoot, taskId: f.id },
          )
          const out = res.output as CompoundSolutionOutput

          // Shape: 2 required fields
          expect(typeof out.solution).toBe("string")
          expect(out.solution.length).toBeGreaterThan(0)
          expect(Array.isArray(out.what_didnt_work)).toBe(true)

          // No banned vocab + no heuristic-stub phrases anywhere
          const allText = JSON.stringify(out)
          expect(allText).not.toMatch(BANNED_VOCAB_RE)
          expect(allText).not.toMatch(STUB_PHRASES_RE)

          // Solution must reference the failure category — anti-pattern #1
          // (intent-recap / diff-pointer) is asserted via the stub-phrase guard.
          expect(out.solution).toMatch(f.domainHit)

          if (f.expectEmptyWdw) {
            // No failed reviews → array MUST be empty (anti-fabrication).
            expect(out.what_didnt_work).toHaveLength(0)
          } else {
            // ≥1 entry, each with the two required fields populated.
            expect(out.what_didnt_work.length).toBeGreaterThanOrEqual(1)
            for (const w of out.what_didnt_work) {
              expect(typeof w.approach).toBe("string")
              expect(w.approach.length).toBeGreaterThan(0)
              expect(typeof w.reason_failed).toBe("string")
              expect(w.reason_failed.length).toBeGreaterThan(0)
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
