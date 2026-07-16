// L2+ always-on quality reviewers — keyword/structure heuristic stubs.
//
// runReview at L2+ spawns reviewer.correctness PLUS these two quality
// reviewers (always), independent of the diff-conditional domain specialists
// in reviewer-specialists.ts. Same SubagentManifest contract + output shape
// (verdict / severity / findings).
//
// The two take different LLM paths, and this comment claimed otherwise through
// v1.36.0: reviewer.tests has `prompt_path: prompts/reviewer-tests.md` (v1.35.0
// gave it one; 智能化 11/23 → 13/23), so with a key it runs that template and
// falls back to the heuristic below without one. reviewer.maintainability has no
// prompt_path and its LLM path is the synthesized prompt. deriveCliFact reads
// that very field to pick a description shape, so a reader trusting this header
// would mis-predict what ships.
//
// Invariant §1: these reviewers receive only { diff, intent } (intent already
// stripped of prior-art/pre-mortem back-channel by review.ts) and hold no
// read:solutions in their inherited reviewer_base scope tokens.

import type { Finding, Severity, Verdict } from "../types"
import type {
  ReviewerSpecialistInput,
  ReviewerSpecialistOutput,
} from "./reviewer-specialists"
import { buildPattern, type Term } from "./terms"

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
    return { verdict: "concern", severity: TESTS_SEVERITY, findings }
  }
  return { verdict: "pass", severity: "none", findings: [] }
}

// reviewer.maintainability — readability/complexity smells on added lines.
// Advisory (severity low): long lines + suppression/escape-hatch markers.

/** Suppression / escape-hatch markers. `as any` is word-bounded; the rest are not. */
export const MAINT_MARKER_TERMS: readonly Term[] = [
  { display: "TODO", re: "TODO", wordBounded: false },
  { display: "FIXME", re: "FIXME", wordBounded: false },
  { display: "@ts-ignore", re: "@ts-ignore", wordBounded: false },
  { display: "@ts-nocheck", re: "@ts-nocheck", wordBounded: false },
  { display: "eslint-disable", re: "eslint-disable", wordBounded: false },
  { display: "as any", re: "as any", wordBounded: true },
]
const MAINT_MARKERS = buildPattern(MAINT_MARKER_TERMS, "")   // case-SENSITIVE, as before
export const MAX_LINE = 120
export const MAINTAINABILITY_SEVERITY: Severity = "low"
export const TESTS_SEVERITY: Severity = "medium"
export const TESTS_MECHANISM =
  "a file-path check over the diff's `+++ b/<path>` headers"

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
  const severity: Severity = findings.length > 0 ? MAINTAINABILITY_SEVERITY : "none"
  const verdict: Verdict = findings.length > 0 ? "concern" : "pass"
  return { verdict, severity, findings }
}
