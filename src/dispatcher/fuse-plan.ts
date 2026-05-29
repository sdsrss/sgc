// GS-3 — deterministic multi-perspective plan-decision fusion.
// Spec: tasks/specs/gs-3-plan-fusion.md
//
// Pure function: reads the three FROZEN planner-cluster outputs and
// synthesizes one FusedDecision. No LLM, no IO, no solutions access —
// Invariant §1 is untouched (fusion runs after the planners freeze and
// never reads solutions/).

import type { PlanVerdict } from "./types"
import type { PlannerCeoOutput } from "./agents/planner-ceo"
import type { PlannerEngOutput } from "./agents/planner-eng"
import type { PlannerAdversarialOutput } from "./agents/planner-adversarial"

const PLAN_VERDICT_RANK: Record<PlanVerdict, number> = {
  approve: 0,
  revise: 1,
  reject: 2,
}

/** Worse of two plan verdicts by precedence reject > revise > approve. */
export function worstPlanVerdict(a: PlanVerdict, b: PlanVerdict): PlanVerdict {
  return PLAN_VERDICT_RANK[a] >= PLAN_VERDICT_RANK[b] ? a : b
}

export type ConcernSource = "ceo" | "eng" | "eng.structural_risk" | "adversarial"
export type ConcernSeverity = "high" | "medium" | "low"

export interface FusedConcern {
  source: ConcernSource
  text: string
  severity: ConcernSeverity
  also_flagged_by?: ConcernSource[]
}

export interface FusedDecision {
  fused_verdict: PlanVerdict
  decision_basis: string
  ranked_concerns: FusedConcern[]
  conflicts: string[]
}

export interface FusePlanInput {
  ceo?: PlannerCeoOutput | null
  eng: PlannerEngOutput
  adversarial?: PlannerAdversarialOutput | null
}

function hasHighHighFailure(adversarial?: PlannerAdversarialOutput | null): boolean {
  if (!adversarial) return false
  return adversarial.failure_modes.some(
    (m) => m.probability === "high" && m.impact === "high",
  )
}

export function fusePlan(input: FusePlanInput): FusedDecision {
  const ceoV = input.ceo?.verdict
  const engV = input.eng.verdict
  let base: PlanVerdict = ceoV ? worstPlanVerdict(ceoV, engV) : engV

  const conflicts: string[] = []
  if (ceoV && ceoV !== engV) conflicts.push(`ceo=${ceoV} vs eng=${engV}`)

  let basis: string
  if (hasHighHighFailure(input.adversarial) && base === "approve") {
    base = "revise"
    basis = "high/high pre-mortem risk floors approve → revise"
    conflicts.push("adversarial high/high risk overrode unanimous approve")
  } else if (ceoV && ceoV !== engV) {
    basis = `${base} dominates (ceo=${ceoV}, eng=${engV})`
  } else {
    basis = base === "approve" ? "all perspectives approve" : `consensus ${base}`
  }

  return { fused_verdict: base, decision_basis: basis, ranked_concerns: [], conflicts }
}
