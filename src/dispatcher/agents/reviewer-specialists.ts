// L3 diff-conditional reviewer specialists — keyword-pattern stubs.
//
// runReview at L3 spawns reviewer.correctness PLUS one or more of these
// specialists when the diff contains domain markers. Each stub matches a
// narrow keyword set on added lines (lines starting with `+` but not
// `+++`) and emits a targeted concern. Real LLM path replaces the stub
// per the spawn protocol — same SubagentManifest contract, same output
// shape (verdict / severity / findings).
//
// Same shape as reviewer-correctness so spawn() validateOutputShape
// accepts the result against the (shared `<<: *reviewer_base`) manifest.
//
// All four are gated by `runReview` on `level === "L3" && pattern.test(diff)`,
// so L1/L2 paths stay untouched.

import type { Finding, Severity, Verdict } from "../types"

export interface ReviewerSpecialistInput {
  diff: string
  intent: string
}

export interface ReviewerSpecialistOutput {
  verdict: Verdict
  severity: Severity
  findings: Finding[]
}

/** Lines starting with `+` (added) but not the `+++` file header. */
function addedLines(diff: string): string[] {
  return diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
}

interface SpecialistDef {
  name: string
  pattern: RegExp
  severity: Severity
  describe: (line: string) => string
}

function reviewBy(def: SpecialistDef, input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  const findings: Finding[] = []
  for (const line of addedLines(input.diff ?? "")) {
    if (def.pattern.test(line)) {
      findings.push({ description: def.describe(line.slice(1, 200).trim()) })
    }
  }
  return {
    verdict: findings.length > 0 ? "concern" : "pass",
    severity: findings.length > 0 ? def.severity : "none",
    findings,
  }
}

// reviewer.security — auth/crypto/token/jwt patterns. Real reviewer
// would model the threat surface; stub flags any added line touching
// these primitives so a human looks at it. Patterns are deliberately
// loose (no word boundaries) so camelCase identifiers like `signJwt`
// or `verifyAuthToken` still match — false positives are acceptable
// for a keyword-match stub; precision is the LLM path's job.
const SECURITY: SpecialistDef = {
  name: "reviewer.security",
  pattern: /(auth|jwt|token|session|crypto|password|secret|signature|encrypt|decrypt|verifyAuth|signJwt|signToken)/i,
  severity: "medium",
  describe: (line) => `security-sensitive change in added line: ${line}`,
}

export function reviewerSecurity(input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  return reviewBy(SECURITY, input)
}

// reviewer.migration — schema-DDL patterns + filename hint (migrations/).
// At L3 a migration touches durable state; the stub flags any DDL-shaped
// addition for explicit human review of rollback + lock behaviour.
const MIGRATION: SpecialistDef = {
  name: "reviewer.migration",
  pattern: /\b(ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+COLUMN|RENAME\s+COLUMN|migration|backfill)\b/i,
  severity: "high",
  describe: (line) => `migration-shaped change requires explicit rollback + concurrency review: ${line}`,
}

export function reviewerMigration(input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  return reviewBy(MIGRATION, input)
}

// reviewer.performance — cache / index / loop / O(n) hints. Stub catches
// the common foot-gun additions; a real reviewer would profile the diff.
const PERFORMANCE: SpecialistDef = {
  name: "reviewer.performance",
  pattern: /\b(cache|cach(ed|ing)|index|memoi[sz]e|debounce|throttle|O\(n\^?\d*\)|n\+1|benchmark|p9[59])\b/i,
  severity: "medium",
  describe: (line) => `performance-touching change in added line: ${line}`,
}

export function reviewerPerformance(input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  return reviewBy(PERFORMANCE, input)
}

// reviewer.infra — Dockerfile / k8s manifests / terraform / deploy
// configs. At L3 an infra change touches shared state outside the repo's
// own runtime; stub flags any added line referencing these surfaces.
// Loose pattern (no end-boundary): "FROM node:20-alpine" includes a "-"
// which breaks \b — so we just look for the surface name fragment.
const INFRA: SpecialistDef = {
  name: "reviewer.infra",
  pattern: /(Dockerfile|FROM\s+\w|kubectl|k8s\b|terraform|helm|argo|fly\.toml|render\.yaml|vercel\.json|github\/workflows)/i,
  severity: "high",
  describe: (line) => `infra-shaped change requires deploy + rollback review: ${line}`,
}

export function reviewerInfra(input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  return reviewBy(INFRA, input)
}

// ----- L3 diff-conditional dispatch table -----

export interface SpecialistDescriptor {
  name: "reviewer.security" | "reviewer.migration" | "reviewer.performance" | "reviewer.infra"
  trigger: RegExp
  agent: (input: ReviewerSpecialistInput) => ReviewerSpecialistOutput
}

/**
 * Triggers for L3 specialist spawn — broader than each agent's internal
 * pattern (which scans added lines): a hit anywhere in the diff (including
 * file headers, context lines) is enough to spawn the specialist. The
 * specialist itself then scans only added lines.
 *
 * Order matches the L3 priority spec (security > migration > performance >
 * infra). At most all 4 can spawn; aggregate verdict is worst-of (per
 * runReview's existing severity ordering).
 */
export const L3_SPECIALISTS: readonly SpecialistDescriptor[] = [
  {
    name: "reviewer.security",
    // Loose matching — same rationale as the agents themselves: snake_case
    // ("auth_token") and camelCase ("signJwt") identifiers should trigger.
    trigger: /(auth|jwt|token|session|crypto|password|secret|signature|encrypt|decrypt)/i,
    agent: reviewerSecurity,
  },
  {
    name: "reviewer.migration",
    trigger: /(migration|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+COLUMN|RENAME\s+COLUMN|backfill)/i,
    agent: reviewerMigration,
  },
  {
    name: "reviewer.performance",
    trigger: /(perf|performance|cache|caching|memoi[sz]e|index|benchmark|n\+1|O\(n\)|p9[59])/i,
    agent: reviewerPerformance,
  },
  {
    name: "reviewer.infra",
    trigger: /(Dockerfile|FROM\s+\w|kubectl|k8s\b|terraform|helm|fly\.toml|vercel\.json|render\.yaml|github\/workflows)/i,
    agent: reviewerInfra,
  },
] as const

/** Return the specialists whose triggers match the diff. */
export function matchSpecialists(diff: string): SpecialistDescriptor[] {
  return L3_SPECIALISTS.filter((s) => s.trigger.test(diff))
}
