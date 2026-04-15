// planner.adversarial — L3 pre-mortem stub.
//
// Real planner.adversarial analyzes the intent + repo for failure modes.
// MVP stub pattern-matches risk keywords and generates generic failure
// mode entries. Ships as a guardrail placeholder — real LLM path gives
// better results via claude-cli / anthropic-sdk mode.

export interface PlannerAdversarialInput {
  intent_draft: string
  repo_map?: string
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

export function plannerAdversarial(
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
