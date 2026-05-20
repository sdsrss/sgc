// compound.prevention — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline including Invariant §13 Tier-2 llm.request /
// llm.response emission via prompts/compound-prevention.md.
//
// Sync rule: BANNED_VOCAB_RE below MUST list the same 15 terms as
// prompts/compound-prevention.md ## Anti-patterns #4 ("may break" exempt
// per lesson #18). Plus a category-boilerplate guard (anti-pattern #1)
// asserts the LLM does NOT emit the heuristic's templated sentences.
//
// Cost: ≈ 4 calls × ~700/200 in/out tokens × claude-sonnet ≈ a few cents
// per run.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type {
  CompoundContextOutput,
  CompoundPreventionOutput,
  CompoundSolutionOutput,
} from "../../src/dispatcher/agents/compound"

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

const ctxPerf: CompoundContextOutput = {
  category: "perf",
  tags: ["latency", "cache"],
  problem_summary:
    "Search endpoint recomputed the tenant-prefix SHA on every request, pushing p99 above 800ms under burst load.",
  symptoms: ["p99 latency 800ms", "CPU saturation under burst load"],
}

const ctxOther: CompoundContextOutput = {
  category: "other",
  tags: ["docs-access", "reader-role"],
  problem_summary:
    "Documentation pages were globally readable but a subset (internal-only RFCs) needed reader-role gating without breaking the public docs path.",
  symptoms: ["(symptom not stated in input)"],
}

const dummySolution: CompoundSolutionOutput = {
  solution:
    "Wrapped the upstream refresh call in an exponential-backoff retry that bubbles a typed transient error to callers; the swallow-and-return-null branch was deleted.",
  what_didnt_work: [],
}

const FIXTURES = [
  {
    id: "s1",
    lang: "en",
    input: { context: ctxAuth, solution: dummySolution },
    // auth category → expect identity/boundary test mention
    domainHit: /\b(identity|boundary|integration test|\/login|expired|refresh|token|session|401)\b/i,
  },
  {
    id: "s2",
    lang: "en",
    input: { context: ctxData, solution: dummySolution },
    // data category → expect dry-run / fixture / migration mention
    domainHit: /\b(dry.run|fixture|production-shaped|migration|backfill|lock|cutover|column|ALTER)\b/i,
  },
  {
    id: "s3",
    lang: "en",
    input: { context: ctxPerf, solution: dummySolution },
    // perf category → expect baseline / benchmark / regression alert
    domainHit: /\b(baseline|benchmark|regression|alert|p99|p95|latency|metric|threshold)\b/i,
  },
  {
    id: "s4",
    lang: "zh",
    input: { context: ctxOther, solution: dummySolution },
    // other category → expect skill / runbook / docs mention
    domainHit: /\b(skill|runbook|docs|documentation|reference|playbook)\b|手册|文档|说明|参考|流程/i,
  },
] as const

const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

// Heuristic-stub category-boilerplate phrases that the LLM must NOT emit
// (anti-pattern #1). The exact heuristic templates from compound.ts.
const CATEGORY_BOILERPLATE_RE =
  /Add a regression test covering the (auth|data|infra|perf|ui|build|runtime|other)-category behavior described in the problem summary\.|Include an adversarial test that exercises a missing\/malformed token\.|Dry-run the migration against a production-shaped fixture before merge\.|Record a baseline benchmark and alert on regressions beyond a set %/i

const EVAL_TIMEOUT_MS = 60_000

describe("compound.prevention LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} (${f.lang}) — ${f.input.context.category} / ${f.input.context.problem_summary.slice(0, 30)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-comp-prev-${f.id}-`))
        try {
          const res = await spawn(
            "compound.prevention",
            f.input,
            { stateRoot, taskId: f.id },
          )
          const out = res.output as CompoundPreventionOutput

          // Shape: single string field
          expect(typeof out.prevention).toBe("string")
          expect(out.prevention.length).toBeGreaterThan(0)

          // No banned vocab
          expect(out.prevention).not.toMatch(BANNED_VOCAB_RE)

          // No category boilerplate — anti-pattern #1 (the exact stub it replaces)
          expect(out.prevention).not.toMatch(CATEGORY_BOILERPLATE_RE)

          // Domain-relevant guardrail
          expect(out.prevention).toMatch(f.domainHit)
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
