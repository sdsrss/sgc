// planner.ceo — Product gate stub.
//
// Real planner.ceo answers "is this worth doing?" — user impact, success
// metrics, strategic fit. MVP stub returns `approve` unless the intent
// draft is obviously thin on business context. Real LLM path handles it
// via claude-cli or anthropic-sdk mode (same spawn protocol).

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

export function plannerCeo(input: PlannerCeoInput): PlannerCeoOutput {
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
