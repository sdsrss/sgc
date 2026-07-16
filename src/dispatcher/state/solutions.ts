// Solutions layer: solutions/{cat}/{slug}.md — append-or-update-existing,
// delete forbidden (Invariant §3). Writes are dedup-gated by a compound.related
// stamp and serialized cross-process by an O_EXCL file lock.
//
// Split out of the former monolithic state.ts (ARCH-3, audit v1.37.0 C10).

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { parseSpawnId, resultPath as spawnResultPath } from "../spawn-protocol"
import { clearFingerprintCache } from "../fingerprint"
import { withFileLock } from "../file-lock"
import type { DedupStamp, SolutionCategory, SolutionEntry } from "../types"
import {
  StateError,
  parseFrontmatter,
  resolveStateRoot as root,
  serializeFrontmatter,
  writeAtomic,
} from "./atomic"

const SOLUTION_CATEGORIES: ReadonlySet<SolutionCategory> = new Set([
  "runtime",
  "build",
  "auth",
  "data",
  "perf",
  "ui",
  "infra",
  "other",
])

const REQUIRED_SOLUTION_FIELDS = [
  "id",
  "signature",
  "category",
  "problem",
  "symptoms",
  "what_didnt_work",
  "solution",
  "prevention",
  "tags",
  "first_seen",
  "last_updated",
  "times_referenced",
  "source_task_ids",
] as const

function validateSolution(entry: SolutionEntry): void {
  for (const f of REQUIRED_SOLUTION_FIELDS) {
    const v = entry[f as keyof SolutionEntry]
    if (v === undefined || v === null) {
      throw new StateError("SchemaViolation", `solution missing required field: ${f}`)
    }
  }
  if (!SOLUTION_CATEGORIES.has(entry.category)) {
    throw new StateError(
      "SchemaViolation",
      `solution.category '${entry.category}' not in {${Array.from(SOLUTION_CATEGORIES).join(", ")}}`,
    )
  }
  if (!Array.isArray(entry.tags) || entry.tags.length < 1) {
    throw new StateError("SchemaViolation", "solution.tags must be a non-empty array")
  }
  if (!Array.isArray(entry.symptoms) || entry.symptoms.length < 1) {
    throw new StateError("SchemaViolation", "solution.symptoms must be a non-empty array")
  }
  if (!Array.isArray(entry.source_task_ids) || entry.source_task_ids.length < 1) {
    throw new StateError(
      "SchemaViolation",
      "solution.source_task_ids must be a non-empty array",
    )
  }
}

export function solutionPath(
  category: SolutionCategory,
  slug: string,
  stateRoot?: string,
): string {
  return resolve(root(stateRoot), "solutions", category, `${slug}.md`)
}

/**
 * P2-6 (audit v1.31.8): §3's write gate now verifies the stamp's PROVENANCE,
 * not just its shape.
 *
 * It used to accept any non-empty string as `compound_related_spawn_id` while
 * its own error text promised the value "must reference an on-disk spawn" — so
 * `{compound_related_spawn_id: "x", threshold_met_or_forced: true, reason:
 * "new_entry"}` passed the single chokepoint guarding the knowledge corpus.
 *
 * Why this matters beyond tidiness: compound.related is kept permanently
 * heuristic (agents/compound.ts) precisely so an LLM cannot mint a verdict of
 * `best_similarity: 0` and wave a duplicate through. That design only holds if
 * the stamp is something a caller must actually *earn* by running the agent.
 * Unverified, it was decoration on the one gate that isn't allowed to be.
 *
 * Checks, in order: the id parses as a spawn id · it names compound.related
 * (a planner's spawn is not a dedup verdict, however real its file is) · that
 * spawn left a result on disk in the same state root we are writing to.
 */
function validateDedupStamp(
  stamp: DedupStamp | undefined,
  stateRoot?: string,
): asserts stamp is DedupStamp {
  if (!stamp || typeof stamp !== "object") {
    throw new StateError(
      "DedupStampMissing",
      "writeSolution requires a dedup_stamp (Invariant §3). " +
        "Callers must route through runCompound or construct a stamp from " +
        "an explicit compound.related spawn.",
    )
  }
  if (typeof stamp.compound_related_spawn_id !== "string" || stamp.compound_related_spawn_id.length === 0) {
    throw new StateError(
      "DedupStampMissing",
      "dedup_stamp.compound_related_spawn_id is required and must reference an on-disk spawn",
    )
  }
  if (stamp.threshold_met_or_forced !== true) {
    throw new StateError(
      "DedupStampMissing",
      `dedup_stamp.threshold_met_or_forced is false — compound.related denied the write (Invariant §3)`,
    )
  }
  const allowedReasons: DedupStamp["reason"][] = [
    "new_entry",
    "update_existing_dedup",
    "user_forced",
  ]
  if (!allowedReasons.includes(stamp.reason)) {
    throw new StateError(
      "DedupStampMissing",
      `dedup_stamp.reason must be one of ${allowedReasons.join(", ")}`,
    )
  }
  // Provenance runs LAST: the checks above are pure structure, so a
  // structurally-bad stamp is rejected without touching the filesystem, and it
  // keeps the most actionable message ("the verdict denied the write") winning
  // over the vaguer "no evidence on disk" when a stamp fails both.
  let agentName: string
  try {
    agentName = parseSpawnId(stamp.compound_related_spawn_id).agentName
  } catch {
    throw new StateError(
      "DedupStampMissing",
      `dedup_stamp.compound_related_spawn_id "${stamp.compound_related_spawn_id}" is not a spawn id ` +
        `(expected "<ulid>-compound.related")`,
    )
  }
  if (agentName !== "compound.related") {
    throw new StateError(
      "DedupStampMissing",
      `dedup_stamp.compound_related_spawn_id must name a compound.related spawn, got "${agentName}" ` +
        `(Invariant §3: only compound.related's deterministic verdict authorizes a solutions write)`,
    )
  }
  const evidence = spawnResultPath(stamp.compound_related_spawn_id, root(stateRoot))
  if (!existsSync(evidence)) {
    throw new StateError(
      "DedupStampMissing",
      `dedup_stamp cites compound.related spawn "${stamp.compound_related_spawn_id}" but no result ` +
        `exists at ${evidence} — the dedup verdict must be earned by running the agent (Invariant §3)`,
    )
  }
}

/**
 * Write or update a solution entry.
 *
 * Requires a `dedup_stamp` — Invariant §3 enforcement. The stamp must be
 * produced by a prior compound.related spawn (or an explicit --force
 * authorization). Direct writes without a stamp are refused with
 * StateError("DedupStampMissing"). See types.ts DedupStamp.
 *
 *   - New path   → fresh write
 *   - Existing   → update-existing semantics (Invariant §3):
 *                   • append new source_task_ids (dedup preserved)
 *                   • refresh last_updated
 *                   • merge new what_didnt_work entries (dedup by `approach`)
 *                   • DO NOT overwrite existing solution / prevention fields
 *                   • bump times_referenced by 1
 *
 * `times_referenced` semantics (CE-1 audit clarification): this counts
 * dedup WRITE-MERGES only — i.e. how many times the SAME problem was
 * re-compounded and merged into this entry. It is NOT a reuse/recall metric
 * and does not increment when a solution is surfaced as prior-art or applied
 * in a later plan. Reuse is tracked separately by `surfaced_in` (L2+
 * researcher.history surfacing) and `applied_in` (L3 adversarial-validated
 * application) — see applied-tracker.ts. Do not read `times_referenced` as
 * "how often this knowledge paid off".
 * Returns the canonical path and the final (merged) entry written.
 */
export function writeSolution(
  entry: SolutionEntry,
  slug: string,
  dedupStamp: DedupStamp,
  body = "",
  stateRoot?: string,
): { path: string; entry: SolutionEntry } {
  validateDedupStamp(dedupStamp, stateRoot)
  validateSolution(entry)
  const path = solutionPath(entry.category, slug, stateRoot)

  let finalEntry = entry
  let finalBody = body
  if (existsSync(path)) {
    const existing = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
    const mergedTasks = Array.from(
      new Set([...(existing.data.source_task_ids ?? []), ...entry.source_task_ids]),
    )
    const mergedWdw = [
      ...(existing.data.what_didnt_work ?? []),
      ...entry.what_didnt_work.filter(
        (nw) => !(existing.data.what_didnt_work ?? []).some((ew) => ew.approach === nw.approach),
      ),
    ]
    finalEntry = {
      ...existing.data,
      source_task_ids: mergedTasks,
      what_didnt_work: mergedWdw,
      last_updated: entry.last_updated,
      // Dedup write-merge counter — NOT a reuse metric (see docblock above).
      times_referenced: (existing.data.times_referenced ?? 0) + 1,
      // Preserve existing solution + prevention (do NOT overwrite)
    }
    finalBody = existing.body
  }

  const { body: _bodyField, ...fm } = finalEntry as SolutionEntry & { body?: string }
  writeAtomic(
    path,
    serializeFrontmatter(fm as unknown as Record<string, unknown>, finalBody),
  )
  // P2-7: the solutions corpus just changed; drop the leak-check fingerprint
  // cache so a same-process review (embedded use) rebuilds from disk rather
  // than leak-checking against a stale snapshot. No-op in the CLI (one process
  // per command).
  clearFingerprintCache()
  return { path, entry: finalEntry }
}

/** The cross-process lock file guarding one solution's read-merge-write. */
export function solutionLockPath(
  category: SolutionCategory,
  slug: string,
  stateRoot?: string,
): string {
  return solutionPath(category, slug, stateRoot) + ".lock"
}

/**
 * ARCH-1 (audit v1.37.0): writeSolution is a read-merge-write (read the existing
 * file, union source_task_ids / what_didnt_work, bump times_referenced, write).
 * Unlocked, two concurrent writers to the same slug lost-update — the second
 * silently discards the first's merge. The writers are separate PROCESSES (a
 * manual `sgc compound` and an automated canary/ship promotion), so the race is
 * cross-process; writeSolution itself is synchronous and cannot interleave
 * within one process.
 *
 * This wraps the whole sync critical section in the O_EXCL cross-process lock
 * (file-lock.ts). withFileLock WAITS on live contention (2s default budget) so
 * the writers serialize instead of overwriting each other. Every concurrent
 * production caller (compound / compound-promote / canary-promote) MUST use
 * this; direct `writeSolution` remains for single-process/test callers.
 */
export async function writeSolutionLocked(
  entry: SolutionEntry,
  slug: string,
  dedupStamp: DedupStamp,
  body = "",
  stateRoot?: string,
  lockOpts: { retries?: number; retryDelayMs?: number } = {},
): Promise<{ path: string; entry: SolutionEntry }> {
  // The lock file is created with O_EXCL, which needs the category dir to
  // already exist — writeSolution's writeAtomic would create it, but that runs
  // INSIDE the lock. Ensure it up front so a brand-new solution can be locked.
  mkdirSync(dirname(solutionPath(entry.category, slug, stateRoot)), { recursive: true })
  const lockPath = solutionLockPath(entry.category, slug, stateRoot)
  return withFileLock(
    lockPath,
    () => writeSolution(entry, slug, dedupStamp, body, stateRoot),
    lockOpts,
  )
}

export function readSolution(
  category: SolutionCategory,
  slug: string,
  stateRoot?: string,
): { entry: SolutionEntry; body: string } | null {
  const path = solutionPath(category, slug, stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
  return { entry: data, body }
}

export interface SolutionFile {
  category: SolutionCategory
  slug: string
  path: string
  entry: SolutionEntry
  body: string
}

/**
 * Walk solutions/ and return every entry. Malformed files are silently
 * skipped (logged in debug mode; see D-6.2 transaction rollback).
 */
export function listSolutions(stateRoot?: string): SolutionFile[] {
  const dir = resolve(root(stateRoot), "solutions")
  if (!existsSync(dir)) return []
  const out: SolutionFile[] = []
  let categories: string[]
  try {
    categories = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
  } catch {
    return []
  }
  for (const cat of categories) {
    if (!SOLUTION_CATEGORIES.has(cat as SolutionCategory)) continue
    const catDir = resolve(dir, cat)
    let files: string[]
    try {
      files = readdirSync(catDir).filter((f) => f.endsWith(".md"))
    } catch {
      continue
    }
    for (const f of files) {
      const fpath = resolve(catDir, f)
      try {
        const { data, body } = parseFrontmatter<SolutionEntry>(readFileSync(fpath, "utf8"))
        out.push({
          category: cat as SolutionCategory,
          slug: f.replace(/\.md$/, ""),
          path: fpath,
          entry: data,
          body,
        })
      } catch {
        // Skip unparseable
      }
    }
  }
  return out
}

/**
 * Invariant §3-adjacent: solutions/ is delete-forbidden.
 * This helper exists so callers get a typed error rather than touching fs.
 */
export function deleteSolution(
  _category: SolutionCategory,
  _slug: string,
  _stateRoot?: string,
): never {
  throw new StateError(
    "SolutionDeleteForbidden",
    "solutions/ is delete-forbidden per sgc-state.schema.yaml (delete_policy: forbidden)",
  )
}
