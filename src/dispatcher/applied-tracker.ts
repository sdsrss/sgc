// CE-6 (f7): applied_in score feedback loop.
//
// When planner.adversarial (L3 only) emits a failure_mode whose early_signal
// substring-references a known prior_prevention.solution_ref (CE-1 step 5),
// the consuming task_id is appended to <stateRoot>/solutions/<cat>/<slug>.md
// frontmatter's `applied_in: TaskId[]` field. Score = applied_in.length.
//
// Spec: tasks/specs/ce-6-applied-in-tracker.md (status: draft, r1).
//
// Invariant §3 carve-out: this module mutates solution frontmatter outside
// writeSolution() because the change is metadata-only — no solution-content
// fields touched. Regression test in applied-tracker.test.ts:
// "preserves content (CRITICAL)" enforces this contract. The §3 gate exists
// to keep dedup_stamp deterministic (see feedback_compound_related_invariant3.md);
// applied_in is not part of the dedup signature.
//
// Heuristic-only: no LLM, no agent spawn, no Tier-2 llm.* events owed.

import { existsSync, readFileSync, statSync } from "node:fs"
import type { FailureMode } from "./agents/planner-adversarial"
import type { Logger } from "./logger"
import type { PriorPrevention } from "./preventions"
import {
  parseFrontmatter,
  serializeFrontmatter,
  solutionPath,
  writeAtomic,
} from "./state"
import type { SolutionCategory, SolutionEntry, TaskId } from "./types"

// Allowed shape: `<lowercase-category>/<slug>`. The category half is the
// SolutionCategory union (see src/dispatcher/types.ts); slug is computed
// from `walkSolutionsCorpus` directory listing per preventions.ts:153, so
// it is filesystem-safe by construction. The regex is a defensive
// belt-and-braces check against accidental upstream changes that might let
// user-controlled strings slip through; it does NOT enforce the category
// half is a real SolutionCategory member.
const SOLUTION_REF_RE = /^[a-z0-9_]+\/[a-zA-Z0-9._-]+$/

// Mtime-CAS retry depth. The realistic race is an operator running two sync
// `sgc plan` invocations in parallel terminals against the same project —
// minute-scale; one retry is enough. Higher tolerance can be added later if
// telemetry shows contention.
const MAX_MTIME_RETRIES = 1

export interface RecordAppliedResult {
  /** solution_refs whose file gained a new task_id this call. */
  updated: string[]
  /** task_id already present in applied_in — no write. */
  skipped_already_applied: string[]
  /** solution file not found on disk (e.g. corpus rotated). */
  skipped_missing: string[]
  /** ref shape invalid OR frontmatter parse failed. */
  skipped_malformed: string[]
  /** mtime changed under us and retry also lost the race. */
  stale_skipped: string[]
  /** writeAtomic threw (disk full, EPERM, etc). */
  write_failed: string[]
}

export interface RecordAppliedOptions {
  logger?: Logger
}

/**
 * CE-4 (audit fix): the relevance floor at which a recalled prior solution
 * counts as *surfaced* (a reuse signal), stricter than researcher.history's
 * 0.3 recall floor. researcher.history pulls every solution ≥0.3 keyword
 * overlap into the plan's prior-art context; recording all of them into
 * `surfaced_in` conflated "keyword-collided with a plan" with "meaningfully
 * surfaced", inflating the metric monotonically. 0.5 = at least half the task
 * keywords overlap (heuristic mode) or LLM-judged moderately+ relevant. Weak
 * 0.3–0.5 matches still inform the plan; they are not counted as reuse.
 */
export const SURFACED_RELEVANCE_FLOOR = 0.5

/**
 * Dedup + relevance-gate recalled prior-art down to the solution_refs that
 * count as surfaced (relevance_score ≥ SURFACED_RELEVANCE_FLOOR). Structural
 * input shape so this module need not import the researcher.history type.
 */
export function selectSurfacedRefs(
  prior_art: readonly { solution_ref: string; relevance_score: number }[],
  floor: number = SURFACED_RELEVANCE_FLOOR,
): string[] {
  return Array.from(
    new Set(
      prior_art
        .filter((p) => p.relevance_score >= floor)
        .map((p) => p.solution_ref),
    ),
  )
}

export function extractAppliedSolutionRefs(
  failure_modes: readonly FailureMode[],
  prior_preventions: readonly PriorPrevention[],
): string[] {
  if (failure_modes.length === 0 || prior_preventions.length === 0) return []
  // Minimum slug length for the prefix-dropped fallback. The adversarial
  // prompt asks the LLM to embed the full `category/slug` solution_ref in
  // early_signal, but LLMs commonly drop the `category/` prefix. Matching the
  // distinctive slug recovers those — gated by length so short, common-word
  // slugs (e.g. "abc") cannot match coincidentally.
  const MIN_SLUG_MATCH_LEN = 8
  const refs = new Set<string>()
  for (const fm of failure_modes) {
    // Defensive: type says string, but LLM JSON drift could omit; keep ?? "" as runtime guard.
    const signal = fm.early_signal ?? ""
    if (signal.length === 0) continue
    for (const pp of prior_preventions) {
      const slug = pp.solution_ref.split("/")[1] ?? ""
      const slugMatch = slug.length >= MIN_SLUG_MATCH_LEN && signal.includes(slug)
      if (signal.includes(pp.solution_ref) || slugMatch) refs.add(pp.solution_ref)
    }
  }
  return Array.from(refs)
}

/** Frontmatter array field this tracker appends to. */
type AppliedField = "applied_in" | "surfaced_in"
type EventAgent = "plan.applied" | "plan.surfaced"

function recordInto(
  field: AppliedField,
  eventAgent: EventAgent,
  stateRoot: string | undefined,
  solution_refs: readonly string[],
  task_id: TaskId,
  opts: RecordAppliedOptions,
): RecordAppliedResult {
  const result: RecordAppliedResult = {
    updated: [],
    skipped_already_applied: [],
    skipped_missing: [],
    skipped_malformed: [],
    stale_skipped: [],
    write_failed: [],
  }
  for (const ref of solution_refs) {
    recordOne(ref, task_id, stateRoot, opts, result, field, eventAgent)
  }
  return result
}

/** CE-6 (f7): record an L3 adversarial-validated application into `applied_in`. */
export function recordApplied(
  stateRoot: string | undefined,
  solution_refs: readonly string[],
  task_id: TaskId,
  opts: RecordAppliedOptions = {},
): RecordAppliedResult {
  return recordInto("applied_in", "plan.applied", stateRoot, solution_refs, task_id, opts)
}

/**
 * CE-6 L2 extension: record an L2+ researcher.history surfacing into
 * `surfaced_in`. Same metadata-only §3 carve-out as recordApplied; a weaker
 * signal (surfaced into a plan, not adversarially validated). Orthogonal to
 * `applied_in` — never touches it.
 */
export function recordSurfaced(
  stateRoot: string | undefined,
  solution_refs: readonly string[],
  task_id: TaskId,
  opts: RecordAppliedOptions = {},
): RecordAppliedResult {
  return recordInto("surfaced_in", "plan.surfaced", stateRoot, solution_refs, task_id, opts)
}

function recordOne(
  ref: string,
  task_id: TaskId,
  stateRoot: string | undefined,
  opts: RecordAppliedOptions,
  result: RecordAppliedResult,
  field: AppliedField,
  eventAgent: EventAgent,
): void {
  if (!SOLUTION_REF_RE.test(ref)) {
    result.skipped_malformed.push(ref)
    emitFailed(opts, task_id, ref, "malformed_ref", "ref shape rejected by SOLUTION_REF_RE", eventAgent)
    return
  }
  const [category, slug] = ref.split("/") as [SolutionCategory, string]
  const filePath = solutionPath(category, slug, stateRoot)
  if (!existsSync(filePath)) {
    result.skipped_missing.push(ref)
    return
  }

  for (let attempt = 0; attempt <= MAX_MTIME_RETRIES; attempt++) {
    const mtimeBefore = statSync(filePath).mtimeMs
    let parsed: { data: SolutionEntry; body: string }
    try {
      parsed = parseFrontmatter<SolutionEntry>(readFileSync(filePath, "utf8"))
    } catch (err) {
      result.skipped_malformed.push(ref)
      emitFailed(
        opts, task_id, ref, "parse_failed",
        err instanceof Error ? err.message : String(err), eventAgent,
      )
      return
    }
    const existing = parsed.data[field] ?? []
    if (existing.includes(task_id)) {
      result.skipped_already_applied.push(ref)
      return
    }
    const nextEntry: SolutionEntry = {
      ...parsed.data,
      [field]: [...existing, task_id],
    }
    // Re-check mtime; if it changed under us, the read is stale.
    const mtimeReread = statSync(filePath).mtimeMs
    if (mtimeReread !== mtimeBefore) {
      if (attempt === MAX_MTIME_RETRIES) {
        result.stale_skipped.push(ref)
        emitFailed(opts, task_id, ref, "stale_mtime_after_retry", "mtime drift after retry", eventAgent)
        return
      }
      continue
    }
    try {
      writeAtomic(
        filePath,
        serializeFrontmatter(nextEntry as unknown as Record<string, unknown>, parsed.body),
      )
      result.updated.push(ref)
      return
    } catch (err) {
      emitFailed(
        opts, task_id, ref, "io_error",
        err instanceof Error ? err.message : String(err), eventAgent,
      )
      result.write_failed.push(ref)
      return
    }
  }
}

function emitFailed(
  opts: RecordAppliedOptions,
  task_id: TaskId,
  solution_ref: string,
  reason: "malformed_ref" | "parse_failed" | "stale_mtime_after_retry" | "io_error",
  error_message: string,
  eventAgent: EventAgent,
): void {
  opts.logger?.event({
    task_id,
    spawn_id: null,
    agent: eventAgent,
    event_type: `${eventAgent}_failed`,
    level: "warn",
    payload: { solution_ref, reason, error_message },
  })
}
