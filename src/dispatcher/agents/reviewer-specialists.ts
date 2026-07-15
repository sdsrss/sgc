// L2+ diff-conditional reviewer specialists — keyword-pattern stubs.
//
// runReview at L2+ spawns reviewer.correctness PLUS one or more of these
// specialists when the diff contains domain markers. Each stub matches a
// narrow keyword set on added lines (lines starting with `+` but not
// `+++`) and emits a targeted concern. Real LLM path replaces the stub
// per the spawn protocol — same SubagentManifest contract, same output
// shape (verdict / severity / findings).
//
// Same shape as reviewer-correctness so spawn() validateOutputShape
// accepts the result against the (shared `<<: *reviewer_base`) manifest.
//
// All four are gated by `runReview` on `isL2Plus && trigger.test(diff)`
// (review.ts) — L1 stays correctness-only. This file said "L3" throughout
// until M4: Phase 2c lowered the gate in v1.27.0 and the header, the four
// per-agent comments and the export name were all left behind, so a reader
// following skills/review/SKILL.md's "L2+ specialists" link landed on a file
// asserting the opposite.

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
// At L2+ a migration touches durable state; the stub flags any DDL-shaped
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
//
// M5: `O(n...)` sits OUTSIDE the \b(...)\b group. Inside it, the trailing \b
// landed after the literal `)` — a non-word char — so it only matched when the
// next char was a word char: "O(n)x" matched, "O(n)", "O(n^2)" and "// O(n)
// scan" did not. Big-O detection was dead in every natural context while the
// agent description advertised it. Same \b-vs-punctuation trap INFRA below
// already documents; it was handled there and missed here. Keeping \b on the
// word terms preserves their strictness (`index` still must not match
// `indexOf`) — only the parenthesised term is exempted.
const PERFORMANCE: SpecialistDef = {
  name: "reviewer.performance",
  pattern: /\b(cache|cach(ed|ing)|index|memoi[sz]e|debounce|throttle|n\+1|benchmark|p9[59])\b|O\(n\^?\d*\)/i,
  severity: "medium",
  describe: (line) => `performance-touching change in added line: ${line}`,
}

export function reviewerPerformance(input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  return reviewBy(PERFORMANCE, input)
}

// reviewer.infra — Dockerfile / k8s manifests / terraform / deploy
// configs. At L2+ an infra change touches shared state outside the repo's
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

// ----- L2+ diff-conditional dispatch table -----

export interface SpecialistDescriptor {
  name: "reviewer.security" | "reviewer.migration" | "reviewer.performance" | "reviewer.infra"
  trigger: RegExp
  agent: (input: ReviewerSpecialistInput) => ReviewerSpecialistOutput
}

/**
 * Triggers for L2+ specialist spawn — broader than each agent's internal
 * pattern (which scans added lines): a hit anywhere in the diff (including
 * file headers, context lines) is enough to spawn the specialist. The
 * specialist itself then scans only added lines.
 *
 * That width is deliberate — spawn on a weak signal, report on a strong one —
 * and it has a consequence worth stating plainly: a specialist that spawned and
 * reported nothing is NOT evidence of a clean diff. It is the expected outcome
 * whenever the trigger hit a file header, a context line, a removed line, or a
 * trigger-only term (`perf`, `performance`). Callers must not read "spawned,
 * zero findings" as "reviewed and clean".
 *
 * INVARIANT (M5, pinned by tests/dispatcher/reviewer-specialists.test.ts):
 * every term a matcher scans for MUST be reachable through its trigger.
 * A matcher-only term is dead code — the specialist never spawns, so the match
 * never runs. Three had drifted (`debounce`, `throttle` here; `argo` in INFRA)
 * while agent descriptions advertised them as live coverage.
 *
 * Order matches the priority spec (security > migration > performance >
 * infra). At most all 4 can spawn; aggregate verdict is worst-of (per
 * runReview's existing severity ordering).
 */
export const DIFF_CONDITIONAL_SPECIALISTS: readonly SpecialistDescriptor[] = [
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
    // M5: +debounce +throttle (matcher-only → unreachable), and O(n) widened to
    // O\(n\^?\d*\) so it spawns on "O(n^2)" the way the matcher now reports it.
    trigger: /(perf|performance|cache|caching|memoi[sz]e|index|benchmark|n\+1|O\(n\^?\d*\)|p9[59]|debounce|throttle)/i,
    agent: reviewerPerformance,
  },
  {
    name: "reviewer.infra",
    // M5: +argo (matcher-only → unreachable).
    trigger: /(Dockerfile|FROM\s+\w|kubectl|k8s\b|terraform|helm|fly\.toml|vercel\.json|render\.yaml|github\/workflows|argo)/i,
    agent: reviewerInfra,
  },
] as const

/** Return the specialists whose triggers match the diff. */
export function matchSpecialists(diff: string): SpecialistDescriptor[] {
  return DIFF_CONDITIONAL_SPECIALISTS.filter((s) => s.trigger.test(diff))
}
