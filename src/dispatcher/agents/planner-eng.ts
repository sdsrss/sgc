// planner.eng — minimal stub.
//
// Real planner.eng would identify files, plan implementation steps, and
// design tests. MVP returns a single-feature placeholder so the L1 loop
// can run end-to-end. The user is expected to refine the feature list
// during /work.

export interface PlannerEngInput {
  intent_draft: string
  repo_map?: string
}

export interface PlannerEngOutput {
  verdict: "approve" | "revise" | "reject"
  concerns: string[]
  structural_risks: { area: string; risk: string; mitigation: string }[]
}

export function plannerEng(input: PlannerEngInput): PlannerEngOutput {
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
