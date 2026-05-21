// planner.adversarial — L3 pre-mortem.
//
// LLM mode (P2#7b, mirrors G.2.a planner.eng): when ANTHROPIC_API_KEY or
// OPENROUTER_API_KEY is set, spawn.ts:resolveMode routes through
// `prompts/planner-adversarial.md`. Output is `failure_modes: array[{...}]`
// — composite shape that validateOutputShape defers per the comment at
// validation.ts (the array element is `{scenario, probability, impact,
// early_signal}` and validateValueAgainstDecl only checks simple inner
// types). Per-entry enum constraint on probability/impact is enforced
// by the prompt template; tests sanity-check the heuristic + assert
// banned-vocab absence on LLM output.
//
// Heuristic fallback (`plannerAdversarialHeuristic`): regex-keyword
// scan of intent_draft picks up to 5 RISK_PATTERNS; falls back to a
// universal coverage-gap mode when nothing matches. Used when no key
// is set and via SGC_FORCE_INLINE=1 in tests.
//
// `repo_map` input dropped at v0.2 (mirrors G.2.a planner.eng) — the
// LLM has no concrete codebase access via this spawn and the prompt
// forbids inventing paths; the heuristic never consulted it either.

import type { PriorPrevention } from "../preventions"

export interface PlannerAdversarialInput {
  intent_draft: string
  /** L3-only: keyword-matched preventions from solutions/ corpus
   *  (CE-1). Heuristic ignores; LLM-mode prompt template consumes. */
  prior_preventions?: PriorPrevention[]
}

export type Probability = "low" | "medium" | "high"
export type Impact = "low" | "medium" | "high"

export interface FailureMode {
  scenario: string
  probability: Probability
  impact: Impact
  early_signal: string
}

export interface PlannerAdversarialOutput {
  failure_modes: FailureMode[]
}

interface RiskPattern {
  re: RegExp
  mode: FailureMode
}

const RISK_PATTERNS: RiskPattern[] = [
  {
    re: /\b(migration|ALTER|DROP|CREATE TABLE|schema)\b/i,
    mode: {
      scenario: "data loss or corruption from a migration script that misbehaves on real data",
      probability: "medium",
      impact: "high",
      early_signal: "schema check fails on pre-merge dry-run; backup snapshot size drops sharply",
    },
  },
  {
    re: /\b(auth|authentication|authorization|jwt|token|session|crypto)\b/i,
    mode: {
      scenario: "auth bypass or session fixation if a new code path skips an existing check",
      probability: "medium",
      impact: "high",
      early_signal: "integration test that drives /login end-to-end fails or skips a step",
    },
  },
  {
    re: /\b(infra|infrastructure|deploy|deployment|prod|production|k8s|terraform|docker)\b/i,
    mode: {
      scenario: "production outage if the change is shipped without staging validation",
      probability: "low",
      impact: "high",
      early_signal: "canary metrics (error rate, p99 latency) diverge from baseline on first rollout",
    },
  },
  {
    re: /\b(architecture|refactor|rename|cross[- ]module)\b/i,
    mode: {
      scenario: "ripple effect across downstream consumers that haven't been audited",
      probability: "medium",
      impact: "medium",
      early_signal: "grep for the renamed/moved symbol returns import sites that weren't in the plan",
    },
  },
  {
    re: /\b(payment|billing|charge|stripe|subscription)\b/i,
    mode: {
      scenario: "user is charged incorrectly or a transaction is double-processed",
      probability: "low",
      impact: "high",
      early_signal: "idempotency test or billing-event de-dupe test regresses",
    },
  },
]

const DEFAULT_FAILURE_MODE: FailureMode = {
  scenario:
    "insufficient test coverage masks a behavioral change; the bug ships because the regression test did not fire",
  probability: "medium",
  impact: "medium",
  early_signal: "coverage drops below baseline or reviewer.tests flags missing edge-case tests",
}

export function plannerAdversarialHeuristic(
  input: PlannerAdversarialInput,
): PlannerAdversarialOutput {
  const draft = input.intent_draft ?? ""
  const matched: FailureMode[] = []

  for (const pattern of RISK_PATTERNS) {
    if (pattern.re.test(draft)) {
      matched.push(pattern.mode)
    }
  }

  if (matched.length === 0) {
    matched.push(DEFAULT_FAILURE_MODE)
  }

  return { failure_modes: matched }
}

// Backwards-compat alias for callers that pre-date the LLM swap (G.2.a /
// Phase F pattern). plan.ts inlineStub still imports `plannerAdversarial`;
// tests using the legacy name continue to work.
export const plannerAdversarial = plannerAdversarialHeuristic
