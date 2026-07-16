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
import { buildPattern, type Term } from "./terms"

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
  /** The single source: this matcher's regex AND the term list its agent
   *  description advertises are both built from these. See ./terms. */
  terms: readonly Term[]
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
// `verifyAuth|signJwt|signToken` are redundant — each contains an earlier
// unbounded term (`auth`, `jwt`, `token`), so nothing matches through them that
// would not match anyway. They are kept because dropping them would change the
// advertised term list, which is a decision about the description, not about
// this refactor. Removing them is a separate, deliberate change.
export const SECURITY_TERMS: readonly Term[] = [
  { display: "auth", re: "auth", wordBounded: false },
  { display: "jwt", re: "jwt", wordBounded: false },
  { display: "token", re: "token", wordBounded: false },
  { display: "session", re: "session", wordBounded: false },
  { display: "crypto", re: "crypto", wordBounded: false },
  { display: "password", re: "password", wordBounded: false },
  { display: "secret", re: "secret", wordBounded: false },
  { display: "signature", re: "signature", wordBounded: false },
  { display: "encrypt", re: "encrypt", wordBounded: false },
  { display: "decrypt", re: "decrypt", wordBounded: false },
  { display: "verifyAuth", re: "verifyAuth", wordBounded: false },
  { display: "signJwt", re: "signJwt", wordBounded: false },
  { display: "signToken", re: "signToken", wordBounded: false },
]

export const SECURITY: SpecialistDef = {
  name: "reviewer.security",
  terms: SECURITY_TERMS,
  pattern: buildPattern(SECURITY_TERMS),
  severity: "medium",
  describe: (line) => `security-sensitive change in added line: ${line}`,
}

export function reviewerSecurity(input: ReviewerSpecialistInput): ReviewerSpecialistOutput {
  return reviewBy(SECURITY, input)
}

// reviewer.migration — schema-DDL patterns + filename hint (migrations/).
// At L2+ a migration touches durable state; the stub flags any DDL-shaped
// addition for explicit human review of rollback + lock behaviour.
export const MIGRATION_TERMS: readonly Term[] = [
  { display: "ALTER TABLE", re: String.raw`ALTER\s+TABLE`, wordBounded: true },
  { display: "DROP TABLE", re: String.raw`DROP\s+TABLE`, wordBounded: true },
  { display: "CREATE TABLE", re: String.raw`CREATE\s+TABLE`, wordBounded: true },
  { display: "ALTER COLUMN", re: String.raw`ALTER\s+COLUMN`, wordBounded: true },
  { display: "RENAME COLUMN", re: String.raw`RENAME\s+COLUMN`, wordBounded: true },
  { display: "migration", re: "migration", wordBounded: true },
  { display: "backfill", re: "backfill", wordBounded: true },
]

export const MIGRATION: SpecialistDef = {
  name: "reviewer.migration",
  terms: MIGRATION_TERMS,
  pattern: buildPattern(MIGRATION_TERMS),
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
export const PERFORMANCE_TERMS: readonly Term[] = [
  { display: "cache", re: "cache", wordBounded: true },
  { display: "cached/caching", re: "cach(ed|ing)", wordBounded: true },
  { display: "index", re: "index", wordBounded: true },
  { display: "memoize/memoise", re: "memoi[sz]e", wordBounded: true },
  { display: "debounce", re: "debounce", wordBounded: true },
  { display: "throttle", re: "throttle", wordBounded: true },
  { display: "n+1", re: String.raw`n\+1`, wordBounded: true },
  { display: "benchmark", re: "benchmark", wordBounded: true },
  { display: "p95/p99", re: "p9[59]", wordBounded: true },
  // NOT word-bounded — the trailing \b after the literal ')' is what made big-O
  // detection dead through v1.35.0. Now a property of the data, not something
  // each matcher has to remember.
  { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false },
]

export const PERFORMANCE: SpecialistDef = {
  name: "reviewer.performance",
  terms: PERFORMANCE_TERMS,
  pattern: buildPattern(PERFORMANCE_TERMS),
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
export const INFRA_TERMS: readonly Term[] = [
  { display: "Dockerfile", re: "Dockerfile", wordBounded: false },
  { display: "FROM <image>", re: String.raw`FROM\s+\w`, wordBounded: false },
  { display: "kubectl", re: "kubectl", wordBounded: false },
  // The \b lives inside `re`, not in `wordBounded`: only the END of k8s is
  // bounded ("k8sx" must not match), while the start must stay free so
  // "--k8s-context" still does.
  { display: "k8s", re: String.raw`k8s\b`, wordBounded: false },
  { display: "terraform", re: "terraform", wordBounded: false },
  // C5/ALG-7: `helm` and `argo` are short English substrings — unbounded they
  // matched `overwhelm` and `cargo` in the REPORT matcher. Bounded here so the
  // report side needs a real word; the spawn trigger drops the wrapper (unbound)
  // and so still fires on `argocd`/`argoproj` etc.
  { display: "helm", re: "helm", wordBounded: true },
  { display: "argo", re: "argo", wordBounded: true },
  { display: "fly.toml", re: String.raw`fly\.toml`, wordBounded: false },
  { display: "render.yaml", re: String.raw`render\.yaml`, wordBounded: false },
  { display: "vercel.json", re: String.raw`vercel\.json`, wordBounded: false },
  { display: "github/workflows", re: String.raw`github\/workflows`, wordBounded: false },
]

export const INFRA: SpecialistDef = {
  name: "reviewer.infra",
  terms: INFRA_TERMS,
  pattern: buildPattern(INFRA_TERMS),
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
  /** Terms that SPAWN this specialist but that its matcher never reports on.
   *  Empty for three of the four: their trigger is the matcher's own term list
   *  with the word boundaries dropped, so it is wider in scope (whole diff vs
   *  added lines) rather than in vocabulary. Only performance carries extras.
   *  Read by agent-facts to say which of the two widths a description means. */
  triggerOnly: readonly Term[]
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
 * That invariant is now STRUCTURAL, not just tested: each trigger is built from
 * its own matcher's term list, so a matcher-only term can no longer be written.
 * The M5 reachability test stays anyway — its job from here is to fail on the
 * refactor that stops building them from one list.
 *
 * Order matches the priority spec (security > migration > performance >
 * infra). At most all 4 can spawn; aggregate verdict is worst-of (per
 * runReview's existing severity ordering).
 */

/**
 * Terms that SPAWN reviewer.performance but that its matcher never reports on —
 * the width the docblock above calls deliberate, made explicit. A diff saying
 * "perf" gets a performance reviewer; that reviewer then finds nothing to report
 * unless a real matcher term is present, which is the expected outcome, not a
 * clean bill of health.
 */
const PERFORMANCE_TRIGGER_ONLY: readonly Term[] = [
  { display: "perf", re: "perf", wordBounded: false },
  { display: "performance", re: "performance", wordBounded: false },
]

/**
 * A trigger tests the whole diff — file headers, context lines, removed lines —
 * so it drops the matchers' word boundaries by design: `index` must not match
 * `indexOf` in an added line the matcher REPORTS on, but a diff mentioning
 * `indexOf` anywhere is reason enough to SPAWN the reviewer. Boundaries written
 * into a term's `re` (INFRA's `k8s\b`) are preserved — only the `wordBounded`
 * wrapper is dropped.
 */
const unbound = (ts: readonly Term[]): Term[] => ts.map((t) => ({ ...t, wordBounded: false }))

export const DIFF_CONDITIONAL_SPECIALISTS: readonly SpecialistDescriptor[] = [
  {
    name: "reviewer.security",
    trigger: buildPattern(unbound(SECURITY_TERMS)),
    triggerOnly: [],
    agent: reviewerSecurity,
  },
  {
    name: "reviewer.migration",
    trigger: buildPattern(unbound(MIGRATION_TERMS)),
    triggerOnly: [],
    agent: reviewerMigration,
  },
  {
    name: "reviewer.performance",
    trigger: buildPattern(unbound([...PERFORMANCE_TERMS, ...PERFORMANCE_TRIGGER_ONLY])),
    triggerOnly: PERFORMANCE_TRIGGER_ONLY,
    agent: reviewerPerformance,
  },
  {
    name: "reviewer.infra",
    trigger: buildPattern(unbound(INFRA_TERMS)),
    triggerOnly: [],
    agent: reviewerInfra,
  },
] as const

/** Return the specialists whose triggers match the diff. */
export function matchSpecialists(diff: string): SpecialistDescriptor[] {
  return DIFF_CONDITIONAL_SPECIALISTS.filter((s) => s.trigger.test(diff))
}
