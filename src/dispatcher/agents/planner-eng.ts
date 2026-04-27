// planner.eng — heuristic fallback + LLM dispatch path.
//
// When spawn mode is inline (MVP, tests with SGC_FORCE_INLINE=1) → heuristic
// fallback below. When mode is anthropic-sdk / openrouter / claude-cli →
// real LLM via prompts/planner-eng.md (routed by spawn.ts when manifest
// prompt_path is set).
//
// The heuristic is intentionally trivial — length check only. It exists so
// command-level tests can run without an API key. The real value lives in
// the LLM path (prompts/planner-eng.md).

export interface PlannerEngInput {
  intent_draft: string
}

export interface PlannerEngOutput {
  verdict: "approve" | "revise" | "reject"
  concerns: string[]
  structural_risks: { area: string; risk: string; mitigation: string }[]
}

/** Heuristic fallback — used when no LLM is available (tests, inline mode). */
export function plannerEngHeuristic(input: PlannerEngInput): PlannerEngOutput {
  const len = input.intent_draft.length
  return {
    verdict: "approve",
    concerns:
      len < 20
        ? ["intent_draft is very short; consider clarifying motivation"]
        : [],
    structural_risks: [],
  }
}

/** Backward-compat alias. Prefer the heuristic-specific name in new code. */
export const plannerEng = plannerEngHeuristic
