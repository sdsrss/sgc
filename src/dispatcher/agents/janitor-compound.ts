// janitor.compound — post-ship decision stub.
//
// Implements the decision_rules from the sgc-capabilities.yaml manifest:
//   skip_if:
//     - level == L0
//     - outcome == reverted
//     - diff.lines < 20 AND no reviewer flagged novel  (diff size check
//         is a placeholder — D-phase doesn't compute real diff stats yet)
//   compound_if:
//     - reviewer.adversarial (or any) severity >= medium
//     - level >= L2 AND outcome == success
//     - force flag (--force on ship)
//   default: skip (conservative — missing a compound is recoverable;
//            polluting solutions/ with noise is not)
//
// Output is always logged to reviews/{task_id}/janitor/compound-decision.md
// (Invariant §6 — silent skips are forbidden).

import type { Level, Outcome, Severity } from "../types"

export interface JanitorCompoundInput {
  task_id: string
  level: Level
  outcome: Outcome
  reviewer_flags: { severity: Severity; novel?: boolean }[]
  force: boolean
}

export type JanitorDecisionKind = "compound" | "skip" | "update_existing"

export interface JanitorCompoundOutput {
  decision: JanitorDecisionKind
  reason_code: string
  reason_human: string
}

const SEVERE: ReadonlySet<Severity> = new Set(["medium", "high", "critical"])

export function janitorCompound(input: JanitorCompoundInput): JanitorCompoundOutput {
  if (input.force) {
    return {
      decision: "compound",
      reason_code: "user_force",
      reason_human: "user forced compound via --force; decision rules bypassed",
    }
  }
  if (input.level === "L0") {
    return {
      decision: "skip",
      reason_code: "level_L0",
      reason_human: "L0 tasks are trivial (docs/typos/config); not worth compounding",
    }
  }
  if (input.outcome === "reverted") {
    return {
      decision: "skip",
      reason_code: "outcome_reverted",
      reason_human: "ship was reverted; no durable knowledge to extract",
    }
  }
  const hasSevere = input.reviewer_flags.some((f) => SEVERE.has(f.severity))
  if (hasSevere) {
    return {
      decision: "compound",
      reason_code: "reviewer_severity_medium_plus",
      reason_human:
        "at least one reviewer returned severity ≥ medium; capture the reasoning before it decays",
    }
  }
  if ((input.level === "L2" || input.level === "L3") && input.outcome === "success") {
    return {
      decision: "compound",
      reason_code: "L2_plus_success",
      reason_human: `${input.level} shipped successfully; multi-file/cross-context work is worth indexing`,
    }
  }
  if (input.reviewer_flags.some((f) => f.novel)) {
    return {
      decision: "compound",
      reason_code: "reviewer_flagged_novel",
      reason_human: "a reviewer flagged novel signal; index to avoid repeating the investigation",
    }
  }
  return {
    decision: "skip",
    reason_code: "default_conservative",
    reason_human: "no compound rule matched; skipping to avoid polluting solutions/ with low-signal entries",
  }
}
