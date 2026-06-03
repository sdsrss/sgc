// L2+ always-on quality reviewers — keyword/structure heuristic stubs.
//
// runReview at L2+ spawns reviewer.correctness PLUS these two quality
// reviewers (always), independent of the diff-conditional domain specialists
// in reviewer-specialists.ts. Same SubagentManifest contract + output shape
// (verdict / severity / findings); the LLM path replaces the stub via the
// synthesized prompt (prompt_path: null in the manifest).
//
// Invariant §1: these reviewers receive only { diff, intent } (intent already
// stripped of prior-art/pre-mortem back-channel by review.ts) and hold no
// read:solutions in their inherited reviewer_base scope tokens.

import type { Finding, Severity, Verdict } from "../types"
import type {
  ReviewerSpecialistInput,
  ReviewerSpecialistOutput,
} from "./reviewer-specialists"

/** Lines starting with `+` (added) but not the `+++` file header. */
function addedLines(diff: string): string[] {
  return (diff ?? "")
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
}

/** File paths from `+++ b/<path>` headers in the diff. */
function changedFilePaths(diff: string): string[] {
  const paths: string[] = []
  for (const line of (diff ?? "").split("\n")) {
    if (line.startsWith("+++ ")) {
      // "+++ b/src/foo.ts" → "src/foo.ts"; "+++ /dev/null" skipped.
      const p = line.slice(4).replace(/^[ab]\//, "").trim()
      if (p && p !== "/dev/null") paths.push(p)
    }
  }
  return paths
}

/** A path is a test file if a path segment is test(s)/spec or the basename
 *  carries a .test./.spec./_test. marker. */
function isTestPath(path: string): boolean {
  return (
    /(^|\/)(tests?|spec|__tests__)(\/|$)/i.test(path) ||
    /\.(test|spec)\./i.test(path) ||
    /_test\./i.test(path)
  )
}

const NON_SOURCE = /\.(md|markdown|txt|json|ya?ml|toml|lock|cfg|ini)$/i

// reviewer.tests — flags source/behavior changes that ship without test
// additions. A real reviewer would assess coverage depth; the stub flags the
// coarse "you touched source but added no test file" smell.
export function reviewerTests(
  input: ReviewerSpecialistInput,
): ReviewerSpecialistOutput {
  const paths = changedFilePaths(input.diff ?? "")
  const sourceChanged = paths.filter(
    (p) => !isTestPath(p) && !NON_SOURCE.test(p),
  )
  const testChanged = paths.filter((p) => isTestPath(p))
  if (sourceChanged.length > 0 && testChanged.length === 0) {
    const findings: Finding[] = [
      {
        description: `source/behavior change without test additions: ${sourceChanged
          .slice(0, 5)
          .join(", ")}`,
      },
    ]
    return { verdict: "concern", severity: "medium", findings }
  }
  return { verdict: "pass", severity: "none", findings: [] }
}

// reviewer.maintainability — readability/complexity smells on added lines.
// Advisory (severity low): long lines + suppression/escape-hatch markers.
const MAINT_MARKERS = /(TODO|FIXME|@ts-ignore|@ts-nocheck|eslint-disable|\bas any\b)/
const MAX_LINE = 120

export function reviewerMaintainability(
  input: ReviewerSpecialistInput,
): ReviewerSpecialistOutput {
  const findings: Finding[] = []
  for (const raw of addedLines(input.diff ?? "")) {
    const line = raw.slice(1) // drop leading '+'
    if (line.length > MAX_LINE) {
      findings.push({
        description: `long added line (${line.length} > ${MAX_LINE} chars): ${line.slice(0, 80).trim()}`,
      })
    }
    if (MAINT_MARKERS.test(line)) {
      findings.push({
        description: `maintainability marker in added line: ${line.slice(0, 120).trim()}`,
      })
    }
  }
  const severity: Severity = findings.length > 0 ? "low" : "none"
  const verdict: Verdict = findings.length > 0 ? "concern" : "pass"
  return { verdict, severity, findings }
}
