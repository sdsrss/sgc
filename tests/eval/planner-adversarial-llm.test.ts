// planner.adversarial — real-LLM eval (CI-skip).
//
// Runs only when ANTHROPIC_API_KEY or OPENROUTER_API_KEY is set. Exercises
// the full spawn() pipeline including Invariant §13 Tier-2 llm.request /
// llm.response emission via prompts/planner-adversarial.md.
//
// Sync rule: BANNED_VOCAB_RE below MUST list the same 15 terms as
// prompts/planner-adversarial.md ## Anti-patterns #3 (mirrors planner-eng /
// planner-ceo sync convention; "may break" exempt per lesson #18).
//
// Cost: ≈ 4 calls × ~700/300 in/out tokens × claude-sonnet ≈ a few cents
// per run. Set ANTHROPIC_API_KEY (or OPENROUTER_API_KEY) locally to opt in;
// CI default is skip.

import { describe, test, expect } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { PlannerAdversarialOutput } from "../../src/dispatcher/agents/planner-adversarial"

import { hasLiveLlmKey } from "./eval-helpers"

const HAS_KEY = hasLiveLlmKey()

const FIXTURES = [
  {
    id: "s1",
    level: "L3",
    lang: "en",
    intent: "migrate .sgc/state from YAML to SQLite",
    // L3 schema migration — expect ≥1 mode touching data / migration /
    // lock / rollback domain.
    expectDomainHit: /\b(migration|schema|sql|database|data|lock|rollback|cutover|backfill|replication)\b/i,
  },
  {
    id: "s2",
    level: "L3",
    lang: "en",
    intent: "refactor the auth middleware to support OAuth2 device flow",
    // L3 auth — expect ≥1 mode touching auth / bypass / session / token domain.
    expectDomainHit: /\b(auth|bypass|session|token|jwt|fixation|oauth|credential|downgrade|replay)\b/i,
  },
  {
    id: "s3",
    level: "L3",
    lang: "zh",
    intent: "在生产部署配置里加入金丝雀流量切换",
    // L3 deploy / canary in 中文 — expect ≥1 mode touching deploy / canary / outage / rollout.
    expectDomainHit: /\b(deploy|deployment|production|canary|rollout|outage|infra|rollback)\b|发布|部署|金丝雀|回滚|生产|流量/i,
  },
  {
    id: "s4",
    level: "L1",
    lang: "en",
    intent: "fix typo in README.md plan section",
    // L1 typo — anti-pattern #4: emit exactly one mode (universal
    // coverage-gap), don't fabricate. We assert single-entry output OR
    // a generic coverage/test-related scenario.
    expectTrivial: true,
  },
] as const

// Mirrors planner-eng-llm + planner-ceo-llm BANNED_VOCAB_RE (G.2.a sync rule).
// 15 terms total (10 EN + 5 中文). "may break" intentionally absent per
// lesson #18 — concrete-conditional "may break IF X" is legitimate.
const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

const EVAL_TIMEOUT_MS = 60_000

describe("planner.adversarial LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} (${f.level} ${f.lang}) — ${f.intent.slice(0, 50)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-adv-${f.id}-`))
        try {
          const res = await spawn(
            "planner.adversarial",
            { intent_draft: f.intent },
            { stateRoot, taskId: f.id },
          )
          const out = res.output as PlannerAdversarialOutput

          // Universal: shape + no banned vocab anywhere
          expect(Array.isArray(out.failure_modes)).toBe(true)
          expect(out.failure_modes.length).toBeGreaterThanOrEqual(1)
          const allText = JSON.stringify(out)
          expect(allText).not.toMatch(BANNED_VOCAB_RE)

          // Per-entry shape: 4 required fields, probability + impact ∈ enum.
          for (const fm of out.failure_modes) {
            expect(typeof fm.scenario).toBe("string")
            expect(fm.scenario.length).toBeGreaterThan(0)
            expect(["low", "medium", "high"]).toContain(fm.probability)
            expect(["low", "medium", "high"]).toContain(fm.impact)
            expect(typeof fm.early_signal).toBe("string")
            expect(fm.early_signal.length).toBeGreaterThan(0)
          }

          if ("expectTrivial" in f && f.expectTrivial) {
            // s4 — typo intent must NOT fan out the pre-mortem; anti-pattern #4
            // allows exactly one universal coverage-gap mode.
            expect(out.failure_modes.length).toBeLessThanOrEqual(2)
            const allCallouts = out.failure_modes
              .map((fm) => `${fm.scenario} ${fm.early_signal}`)
              .join(" ")
            expect(allCallouts).toMatch(/test|coverage|regression|review|typo|docs|readme/i)
          } else if ("expectDomainHit" in f) {
            // s1/s2/s3 — at least one mode references the domain-specific
            // failure category (migration / auth / deploy).
            const hit = out.failure_modes.some((fm) =>
              f.expectDomainHit.test(`${fm.scenario} ${fm.early_signal}`),
            )
            expect(hit).toBe(true)
          }
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
