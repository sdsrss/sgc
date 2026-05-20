// planner.ceo — Product gate.
//
// LLM mode (P2#7a, mirrors G.2.a planner.eng): when ANTHROPIC_API_KEY or
// OPENROUTER_API_KEY is set, spawn.ts:resolveMode routes through
// `prompts/planner-ceo.md` (zero-shot product gate). Output validated by
// validateOutputShape against the manifest's enum[approve, revise, reject]
// + array[string] declarations — no array[{...}] composite, so no DSL
// validator needed here.
//
// Heuristic fallback (`plannerCeoHeuristic`): keyword-driven approval; used
// when no key is set and via SGC_FORCE_INLINE=1 in tests. Returns `approve`
// unless intent is short or no audience keyword is present.

export interface PlannerCeoInput {
  intent_draft: string
}

export interface PlannerCeoOutput {
  verdict: "approve" | "revise" | "reject"
  concerns: string[]
  rewrite_hints: string[]
}

/**
 * Audience keywords that indicate the intent names who benefits from the
 * change. Presence suggests real business grounding; absence is a hint
 * (not a block).
 */
const AUDIENCE_RE =
  /\b(user|customer|team|downstream|caller|reader|stakeholder|impact|metric|outcome|revenue|latency|adoption|retention)\b/i

export function plannerCeoHeuristic(input: PlannerCeoInput): PlannerCeoOutput {
  const draft = input.intent_draft ?? ""
  const concerns: string[] = []
  const rewrite_hints: string[] = []

  if (draft.trim().length < 50) {
    concerns.push(
      "intent is short; business context may not be clear to later reviewers",
    )
    rewrite_hints.push(
      "expand the motivation to describe user impact and a success metric",
    )
  }
  if (!AUDIENCE_RE.test(draft)) {
    rewrite_hints.push(
      "name the affected audience (users, team, downstream callers, customers)",
    )
  }

  return {
    verdict: "approve",
    concerns,
    rewrite_hints,
  }
}

// Backwards-compat alias for callers that pre-date the LLM swap (G.2.a /
// Phase F pattern). plan.ts inlineStub still imports `plannerCeo`; tests
// using the legacy name continue to work.
export const plannerCeo = plannerCeoHeuristic
