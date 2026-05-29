// GS-3 — deterministic multi-perspective plan-decision fusion.
// Spec: tasks/specs/gs-3-plan-fusion.md
//
// Pure function: reads the three FROZEN planner-cluster outputs and
// synthesizes one FusedDecision. No LLM, no IO, no solutions access —
// Invariant §1 is untouched (fusion runs after the planners freeze and
// never reads solutions/).

import type { PlanVerdict } from "./types"

const PLAN_VERDICT_RANK: Record<PlanVerdict, number> = {
  approve: 0,
  revise: 1,
  reject: 2,
}

/** Worse of two plan verdicts by precedence reject > revise > approve. */
export function worstPlanVerdict(a: PlanVerdict, b: PlanVerdict): PlanVerdict {
  return PLAN_VERDICT_RANK[a] >= PLAN_VERDICT_RANK[b] ? a : b
}
