// reviewer.correctness — heuristic fallback + LLM path.
//
// Two modes:
//   1. reviewerCorrectnessHeuristic (default fallback) — scans for unresolved
//      markers (TODO|FIXME|XXX) in added lines + flags empty diffs.
//   2. LLM path — when prompt_path is set in the manifest and an API key is
//      available, spawn.ts routes through prompts/reviewer-correctness.md for
//      semantic analysis (intent alignment, null deref, missing error paths…).
//
// The heuristic is intentionally shallow: it catches marker noise but misses
// semantic bugs (off-by-one, null deref, missing error handling).

import type { Finding, Severity, Verdict } from "../types"

export interface ReviewerCorrectnessInput {
  diff: string
  intent: string
}

export interface ReviewerCorrectnessOutput {
  verdict: Verdict
  severity: Severity
  findings: Finding[]
}

const MARKER_RE = /\b(TODO|FIXME|XXX)\b/

export function reviewerCorrectnessHeuristic(
  input: ReviewerCorrectnessInput,
): ReviewerCorrectnessOutput {
  const diff = input.diff ?? ""
  if (diff.trim() === "") {
    return {
      verdict: "concern",
      severity: "low",
      findings: [{ description: "no diff to review (empty change)" }],
    }
  }
  const findings: Finding[] = []
  const lines = diff.split("\n")
  for (const line of lines) {
    if (line.startsWith("+") && !line.startsWith("+++") && MARKER_RE.test(line)) {
      findings.push({
        description: `unresolved marker in added line: ${line.slice(1, 100).trim()}`,
      })
    }
  }
  return {
    verdict: findings.length > 0 ? "concern" : "pass",
    severity: findings.length > 0 ? "low" : "none",
    findings,
  }
}

/** Backward-compat alias — callers importing reviewerCorrectness keep working. */
export const reviewerCorrectness = reviewerCorrectnessHeuristic
