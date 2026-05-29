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
import { tokenize, jaccard, DEDUP_THRESHOLD } from "./dedup"

const PLAN_VERDICT_RANK: Record<PlanVerdict, number> = {
  approve: 0,
  revise: 1,
  reject: 2,
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

const SEVERITY_RANK: Record<ConcernSeverity, number> = { high: 2, medium: 1, low: 0 }
const SOURCE_ORDER: Record<ConcernSource, number> = {
  "eng.structural_risk": 0,
  adversarial: 1,
  eng: 2,
  ceo: 3,
}

/** Worse of two plan verdicts by precedence reject > revise > approve. */
export function worstPlanVerdict(a: PlanVerdict, b: PlanVerdict): PlanVerdict {
  return PLAN_VERDICT_RANK[a] >= PLAN_VERDICT_RANK[b] ? a : b
}

// Internal shape: carries a separate dedup key so structural_risk's formatted
// display text (with area prefix and mitigation suffix) does not dilute the
// jaccard score against plain-prose ceo/eng concerns that describe the same risk.
type RawConcern = FusedConcern & { _key: string }

function collectConcerns(input: FusePlanInput): RawConcern[] {
  const out: RawConcern[] = []
  if (input.ceo) {
    for (const c of input.ceo.concerns) out.push({ source: "ceo", text: c, severity: "medium", _key: c })
  }
  for (const c of input.eng.concerns) out.push({ source: "eng", text: c, severity: "medium", _key: c })
  for (const r of input.eng.structural_risks) {
    out.push({
      source: "eng.structural_risk",
      text: `${r.area}: ${r.risk} (mitigation: ${r.mitigation})`,
      severity: "high",
      // Use only the raw risk text as the dedup key so near-duplicate prose
      // in ceo/eng concerns (which omit the area/mitigation wrapper) matches.
      _key: r.risk,
    })
  }
  if (input.adversarial) {
    for (const m of input.adversarial.failure_modes) {
      const text = `[${m.probability}/${m.impact}] ${m.scenario} — early signal: ${m.early_signal}`
      // Impact and ConcernSeverity are structurally identical unions; intentional reuse.
      out.push({ source: "adversarial", text, severity: m.impact, _key: m.scenario })
    }
  }
  return out
}

function dedupeConcerns(concerns: RawConcern[]): FusedConcern[] {
  const kept: RawConcern[] = []
  for (const c of concerns) {
    const cTokens = tokenize(c._key)
    let merged = false
    for (const k of kept) {
      if (jaccard(cTokens, tokenize(k._key)) >= DEDUP_THRESHOLD) {
        if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[k.severity]) k.severity = c.severity
        k.also_flagged_by = [...(k.also_flagged_by ?? []), c.source]
        merged = true
        break
      }
    }
    if (!merged) kept.push({ ...c })
  }
  // Strip internal _key before returning public FusedConcern[].
  return kept.map(({ _key: _k, ...pub }) => pub)
}

function rankConcerns(concerns: FusedConcern[]): FusedConcern[] {
  return [...concerns].sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (sev !== 0) return sev
    return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]
  })
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
    conflicts.push(
      ceoV
        ? "adversarial high/high risk overrode unanimous approve"
        : "adversarial high/high risk overrode eng=approve",
    )
  } else if (ceoV && ceoV !== engV) {
    basis = `${base} dominates (ceo=${ceoV}, eng=${engV})`
  } else {
    basis = base === "approve" ? "all perspectives approve" : `consensus ${base}`
  }

  const ranked = rankConcerns(dedupeConcerns(collectConcerns(input)))

  return { fused_verdict: base, decision_basis: basis, ranked_concerns: ranked, conflicts }
}
