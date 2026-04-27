// compound.{context,solution,related,prevention} — 4-agent stub cluster.
//
// The manifests in sgc-capabilities.yaml share a base template and don't
// declare explicit outputs, so validateOutputShape doesn't enforce field
// presence — we add our own typed shapes for dispatcher + test use.

import type { ReviewReport, SolutionCategory } from "../types"
import {
  DEDUP_THRESHOLD,
  findBestMatch,
  similarity,
  type BestMatch,
} from "../dedup"
import type { SolutionFile } from "../state"

// ── compound.context ────────────────────────────────────────────────────────

export interface CompoundContextInput {
  task_id: string
  intent: string
  diff?: string
  ship_outcome?: string
}

export interface CompoundContextOutput {
  category: SolutionCategory
  tags: string[]
  problem_summary: string
  symptoms: string[]
}

const CATEGORY_PATTERNS: { re: RegExp; category: SolutionCategory }[] = [
  { re: /\b(auth|token|jwt|session|oauth|credential)\b/i, category: "auth" },
  { re: /\b(schema|migration|sql|database|postgres|mysql|sqlite)\b/i, category: "data" },
  { re: /\b(infra|deploy|k8s|docker|kubernetes|terraform|helm)\b/i, category: "infra" },
  { re: /\b(perf|slow|latency|cache|throughput|timeout)\b/i, category: "perf" },
  { re: /\b(ui|render|layout|button|css|style)\b/i, category: "ui" },
  { re: /\b(build|compile|dependency|bundler|webpack|vite)\b/i, category: "build" },
  { re: /\b(crash|error|exception|null|undefined|race)\b/i, category: "runtime" },
]

const TAG_CANDIDATES = [
  "auth", "schema", "migration", "perf", "ui", "infra", "test",
  "api", "typo", "refactor", "security", "timeout", "cache",
]

/** Heuristic fallback — used when no LLM is available (tests, inline mode). */
export function compoundContextHeuristic(
  input: CompoundContextInput,
): CompoundContextOutput {
  const text = `${input.intent} ${input.diff ?? ""}`
  let category: SolutionCategory = "other"
  for (const p of CATEGORY_PATTERNS) {
    if (p.re.test(text)) {
      category = p.category
      break
    }
  }
  const tags = TAG_CANDIDATES.filter((c) =>
    new RegExp(`\\b${c}\\b`, "i").test(text),
  )
  const problem_summary = input.intent.slice(0, 400).trim() || "(no intent text)"
  const symptoms =
    input.ship_outcome === "success"
      ? ["the change shipped without reverting"]
      : ["behavior documented in intent"]
  return { category, tags, problem_summary, symptoms }
}

/** Backward-compat alias. Prefer the heuristic-specific name in new code. */
export const compoundContext = compoundContextHeuristic

// ── compound.solution ───────────────────────────────────────────────────────

export interface CompoundSolutionInput {
  context: CompoundContextOutput
  diff?: string
  reviews: ReviewReport[]
}

export interface CompoundSolutionOutput {
  solution: string
  what_didnt_work: { approach: string; reason_failed: string }[]
}

export function compoundSolution(
  input: CompoundSolutionInput,
): CompoundSolutionOutput {
  const wdw: { approach: string; reason_failed: string }[] = []
  for (const r of input.reviews) {
    if (r.verdict === "fail" || r.verdict === "concern") {
      for (const f of r.findings.slice(0, 2)) {
        wdw.push({
          approach: f.description.slice(0, 120),
          reason_failed: `flagged by ${r.reviewer_id} (${r.verdict})`,
        })
      }
    }
  }
  const solution =
    `${input.context.problem_summary} — resolved by the committed change; ` +
    `see the diff and review reports for the implementation details.`
  return { solution, what_didnt_work: wdw }
}

// ── compound.related ────────────────────────────────────────────────────────

export interface CompoundRelatedInput {
  context: CompoundContextOutput
  signature: string
  existing_solutions: SolutionFile[]
}

export interface CompoundRelatedOutput {
  duplicate_match: { ref: string; similarity: number } | null
  related_entries: string[]
  // Dedup stamp: required by Invariant §3 to authorize a write. The caller
  // checks stamp.threshold_met_or_forced before invoking writeSolution.
  dedup_stamp: {
    threshold: number
    best_similarity: number
  }
}

export function compoundRelated(
  input: CompoundRelatedInput,
): CompoundRelatedOutput {
  const candidate = {
    signature: input.signature,
    tags: input.context.tags,
    problem: input.context.problem_summary,
  }
  const best: BestMatch | null = findBestMatch(candidate, input.existing_solutions)

  const duplicate_match =
    best && best.similarity >= DEDUP_THRESHOLD
      ? {
          ref: `${best.match.category}/${best.match.slug}`,
          similarity: best.similarity,
        }
      : null

  const related_entries = input.existing_solutions
    .map((s) => ({
      ref: `${s.category}/${s.slug}`,
      sim: similarity(candidate, {
        signature: s.entry.signature,
        tags: s.entry.tags,
        problem: s.entry.problem,
      }),
    }))
    .filter((r) => r.sim > 0.3 && r.sim < DEDUP_THRESHOLD)
    .sort((a, b) => b.sim - a.sim)
    .slice(0, 5)
    .map((r) => r.ref)

  return {
    duplicate_match,
    related_entries,
    dedup_stamp: {
      threshold: DEDUP_THRESHOLD,
      best_similarity: best ? best.similarity : 0,
    },
  }
}

// ── compound.prevention ─────────────────────────────────────────────────────

export interface CompoundPreventionInput {
  context: CompoundContextOutput
  solution: CompoundSolutionOutput
}

export interface CompoundPreventionOutput {
  prevention: string
}

export function compoundPrevention(
  input: CompoundPreventionInput,
): CompoundPreventionOutput {
  const catHint = CATEGORY_PREVENTION[input.context.category]
  const base = `Add a regression test covering the ${input.context.category}-category behavior described in the problem summary.`
  return {
    prevention: `${base} ${catHint}`,
  }
}

const CATEGORY_PREVENTION: Record<SolutionCategory, string> = {
  auth: "Include an adversarial test that exercises a missing/malformed token.",
  data: "Dry-run the migration against a production-shaped fixture before merge.",
  infra: "Add a canary check and a rollback script; gate on staging metrics.",
  perf: "Record a baseline benchmark and alert on regressions beyond a set %.",
  ui: "Add a visual snapshot or a DOM-shape assertion.",
  build: "Pin the critical dependency version and add a reproducible-build check.",
  runtime: "Add a boundary-input test that would have reproduced the failure.",
  other: "Document the change in the relevant skill reference so it surfaces next time.",
}
