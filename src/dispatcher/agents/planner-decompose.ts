// planner.decompose — file-level task decomposition with bite-sized TDD steps
// (Phase 2b). Mirrors the planner.adversarial pattern: a pure *Heuristic
// fallback + a backward-compat alias; the LLM path is routed by spawn.ts from
// the manifest prompt_path (prompts/planner-decompose.md).
//
// CE reuse-in: prior failure-modes / preventions become `guard` steps, and
// researcher.history prior_art solution_refs flow into each task's
// prior_art_refs (consumed by plan.ts for surfaced_in/applied_in writeback).
// The agent receives all prior data as INPUT — it holds no read:solutions in
// scope_tokens (Invariant §1, same relaxation as planner.adversarial / CE-1).

import type { PlanStep } from "../types"

export interface DecomposeInput {
  intent_draft: string
  structural_risks?: { area: string; risk: string; mitigation: string }[]
  prior_art?: { solution_ref: string; relevance_score: number; excerpt: string }[]
  failure_modes?: {
    scenario: string
    probability: string
    impact: string
    early_signal: string
  }[]
  prior_preventions?: {
    solution_ref: string
    category: string
    prevention_text: string
  }[]
}

export interface DecomposeTask {
  id: string
  title: string
  files: { create: string[]; modify: string[]; test: string[] }
  steps: PlanStep[]
  prior_art_refs: string[]
}

export interface DecomposeOutput {
  tasks: DecomposeTask[]
}

/**
 * Heuristic fallback — used when no LLM is available (tests, SGC_FORCE_INLINE).
 * Produces ONE coarse task: the canonical 5-step TDD cycle, with a `guard` step
 * inserted before commit for each known failure-mode / prevention, and
 * prior_art_refs carried from prior_art. Intentionally trivial; the real
 * file-level depth lives in the LLM path (prompts/planner-decompose.md).
 */
export function plannerDecomposeHeuristic(input: DecomposeInput): DecomposeOutput {
  const title = (input.intent_draft ?? "").trim().slice(0, 200) || "implement the task"

  const steps: PlanStep[] = [
    { kind: "test", text: `Write a failing test for: ${title}` },
    { kind: "verify-red", text: "Run the test and confirm it fails", run: "bun test", expect: "FAIL" },
    { kind: "implement", text: "Write the minimal implementation to make the test pass" },
    { kind: "verify-green", text: "Run the test and confirm it passes", run: "bun test", expect: "PASS" },
  ]

  // reuse-in: prior failure-modes → guard steps (defensive checks).
  for (const fm of input.failure_modes ?? []) {
    steps.push({
      kind: "guard",
      text: `Guard against prior failure mode: ${fm.scenario}. Early signal: ${fm.early_signal}`,
    })
  }
  // reuse-in: prior preventions → guard steps (avoid the known-bad shape).
  for (const p of input.prior_preventions ?? []) {
    steps.push({
      kind: "guard",
      text: `Apply prevention from ${p.solution_ref}: ${p.prevention_text}`,
    })
  }

  steps.push({ kind: "commit", text: "Commit the change", run: "git commit -m \"<conventional message>\"" })

  const prior_art_refs = (input.prior_art ?? []).map((p) => p.solution_ref)

  return {
    tasks: [{ id: "f1", title, files: { create: [], modify: [], test: [] }, steps, prior_art_refs }],
  }
}

/** Backward-compat alias (matches plannerAdversarial / plannerEng convention). */
export const plannerDecompose = plannerDecomposeHeuristic
