// reviewer.correctness — stub.
//
// Real reviewer would semantically analyze the diff against the intent.
// MVP scans for unresolved markers (TODO|FIXME|XXX) in added lines and
// flags an empty diff. Otherwise pass.

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

export function reviewerCorrectness(
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
