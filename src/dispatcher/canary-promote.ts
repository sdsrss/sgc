// GS-1.1 promote (sibling spec: tasks/specs/gs-1-promote.md) — bridge
// from `<stateRoot>/canaries/<slug>.md` into solutions/. Routes through
// the SAME Invariant §3 write-gate as runCompound + runCompoundPromote
// (CE-3 promote): real compound.related spawn, real DedupStamp, real
// writeSolution.
//
// Heuristic-only — compoundContextHeuristic for category/tags/problem +
// compoundRelatedHeuristic for the dedup_stamp (the latter is
// intentionally never LLM-swapped per feedback_compound_related_invariant3
// — an LLM minting `best_similarity: 0` could bypass the corpus dedup).
// Operator-edited `regression_seed:` is authoritative; no LLM rewrite.
//
// Identical-shape to compound-promote.ts (CE-3 promote) — forked with
// ship-failure → canary-failure swaps:
//   - <stateRoot>/ship-failures/ → <stateRoot>/canaries/
//   - prevention_seed → regression_seed
//   - workflow_run_id/url/workflow_name → package_name + expected_version
//     + failed_phase + health_url
//   - SHIP-FAILURE-<sha> → CANARY-<sha>-<phase>
//   - ship-failure-<sha> → canary-<sha>-<phase> (preserves GS-1 (sha,
//     phase) dedup key — distinguishes from CE-3-promote single-key shape)

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  compoundContext,
  compoundRelated,
  type CompoundContextOutput,
  type CompoundRelatedOutput,
} from "./agents/compound"
import { computeSignature } from "./dedup"
import { createLogger, type Logger } from "./logger"
import { spawn } from "./spawn"
import {
  listSolutions,
  parseFrontmatter,
  readCurrentTask,
  resolveStateRoot,
  serializeFrontmatter,
  writeSolution,
} from "./state"
import type { DedupStamp, SolutionEntry } from "./types"

export type CanaryPhase = "npm_propagation" | "smoke_install" | "health_url"

export interface PromoteCanaryOptions {
  slug: string
  stateRoot?: string
  /** Bypass DuplicateMatch refuse only. AlreadyPromoted is orthogonal. */
  force?: boolean
  /**
   * Override solution slug. Default = `canary-<short-sha>-<phase>`
   * (preserves the (sha, phase) tuple from capture-side dedup key —
   * two canary records on same sha at different phases promote to
   * distinct solution slugs without collision).
   */
  solutionSlug?: string
  logger?: Logger
}

export interface PromoteCanaryResult {
  canaryPath: string
  solutionPath: string
  /** `new_entry`: clean write. `user_forced`: --force bypassed a duplicate. */
  dedupAction: "new_entry" | "user_forced"
  /** Top-5 near-match refs from compound.related (0.3 < sim < threshold). */
  relatedRefs: string[]
}

export type PromoteCanaryErrorCode =
  | "MissingCanaryFailure"
  | "PlaceholderRegressionSeed"
  | "AlreadyPromoted"
  | "DuplicateMatch"

export class PromoteCanaryError extends Error {
  readonly code: PromoteCanaryErrorCode
  readonly detail?: Record<string, unknown>
  constructor(
    code: PromoteCanaryErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "PromoteCanaryError"
    this.code = code
    this.detail = detail
  }
}

interface CanaryFailureFrontmatter {
  kind: string
  captured_at: string
  commit_sha: string
  tag: string | null
  package_name: string
  expected_version: string
  failed_phase: CanaryPhase
  health_url: string | null
  regression_seed: string
  promoted_to?: string
}

const PLACEHOLDER_PREFIX = "TODO: operator-fill"

function nowIso(): string {
  return new Date().toISOString()
}

function generateUlid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

/**
 * Pull the `## Phase output excerpt` block out of the capture-time
 * templated body. Section boundary is the literal heading pair
 * captureCanaryFailure wrote (`renderBody` in canary.ts). Returns
 * "" if the section is missing or empty.
 */
function extractPhaseOutput(body: string): string {
  const re = /## Phase output excerpt\n\n([\s\S]*?)\n+## Next steps/
  const m = re.exec(body)
  return m?.[1]?.trim() ?? ""
}

export async function promoteCanaryFailure(
  opts: PromoteCanaryOptions,
): Promise<PromoteCanaryResult> {
  const stateRoot = opts.stateRoot
  const root = resolveStateRoot(stateRoot)
  const canaryPath = resolve(root, "canaries", `${opts.slug}.md`)

  if (!existsSync(canaryPath)) {
    throw new PromoteCanaryError(
      "MissingCanaryFailure",
      `canaries/${opts.slug}.md does not exist under ${root}. ` +
        `Run \`ls ${root}/canaries/\` to see available slugs.`,
      { slug: opts.slug, stateRoot: root },
    )
  }

  const raw = readFileSync(canaryPath, "utf8")
  const parsed = parseFrontmatter<CanaryFailureFrontmatter>(raw)
  const fm = parsed.data

  // Idempotency guard: re-promote on a record that already carries
  // promoted_to: is a no-op refuse. Operator wanting re-promote must
  // explicitly remove the field. --force does NOT bypass this.
  if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) {
    throw new PromoteCanaryError(
      "AlreadyPromoted",
      `canaries/${opts.slug}.md already carries promoted_to: ${fm.promoted_to}. ` +
        `Remove the field manually to re-promote; --force does NOT override.`,
      { promoted_to: fm.promoted_to },
    )
  }

  const seed = String(fm.regression_seed ?? "").trim()
  if (seed.length === 0 || seed.startsWith(PLACEHOLDER_PREFIX)) {
    throw new PromoteCanaryError(
      "PlaceholderRegressionSeed",
      `canaries/${opts.slug}.md still carries the capture-time ` +
        `regression_seed placeholder (or empty). Edit the file's ` +
        `\`regression_seed:\` frontmatter into the actual safeguard ` +
        `before re-running promote.`,
      { regression_seed: seed.slice(0, 80) },
    )
  }

  // Spec-locked heuristic input shape:
  // <phase_output_excerpt>\n\n<package_name> <failed_phase>.
  // Keeps category-pattern matching driven by the failure text itself
  // while routing the package/phase context into tag candidates. Mirrors
  // CE-3-promote `<summary>\n\n<workflow_name>` posture but adapts the
  // GS-1 (sha, phase) dimensionality.
  const phaseOutput = extractPhaseOutput(parsed.body)
  const intentText = `${phaseOutput}\n\n${fm.package_name} ${fm.failed_phase}`
  const logger = opts.logger ?? createLogger({ stateRoot })

  const ctxRes = await spawn<unknown, CompoundContextOutput>(
    "compound.context",
    { task_id: "(promote)", intent: intentText },
    {
      stateRoot,
      inlineStub: (i) =>
        compoundContext(i as { task_id: string; intent: string; diff?: string }),
      logger,
    },
  )
  const context = ctxRes.output

  const signature = computeSignature(context.problem_summary)
  const existing = listSolutions(stateRoot)

  const relRes = await spawn<unknown, CompoundRelatedOutput>(
    "compound.related",
    { context, signature, existing_solutions: existing },
    {
      stateRoot,
      inlineStub: (i) =>
        compoundRelated(
          i as {
            context: CompoundContextOutput
            signature: string
            existing_solutions: typeof existing
          },
        ),
      logger,
    },
  )
  const related = relRes.output

  if (related.duplicate_match && !opts.force) {
    throw new PromoteCanaryError(
      "DuplicateMatch",
      `compound.related found a duplicate at ${related.duplicate_match.ref} ` +
        `(similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ` +
        `${related.dedup_stamp.threshold}). Pass --force to write anyway, ` +
        `or edit regression_seed: to differentiate.`,
      {
        duplicate_ref: related.duplicate_match.ref,
        similarity: related.duplicate_match.similarity,
      },
    )
  }

  const current = readCurrentTask(stateRoot)
  const taskId =
    current?.task.task_id ??
    `CANARY-${shortSha(fm.commit_sha)}-${fm.failed_phase}`

  const now = nowIso()
  const entry: SolutionEntry = {
    id: generateUlid(),
    signature,
    category: context.category,
    problem: context.problem_summary,
    symptoms:
      context.symptoms.length > 0
        ? context.symptoms
        : [
            `captured canary failure of ${fm.package_name}@${fm.expected_version} ` +
              `at ${fm.failed_phase} on ${shortSha(fm.commit_sha)}`,
          ],
    what_didnt_work: [],
    solution:
      `Canary failure of ${fm.package_name}@${fm.expected_version} at phase ` +
      `${fm.failed_phase} on ${shortSha(fm.commit_sha)}; see body for phase ` +
      `output excerpt + operator's regression_seed.`,
    prevention: seed,
    tags: context.tags.length > 0 ? context.tags : ["untagged"],
    first_seen: now,
    last_updated: now,
    times_referenced: 0,
    source_task_ids: [taskId],
    related_entries:
      related.related_entries.length > 0 ? related.related_entries : undefined,
    confidence: "provisional",
  }

  const solutionSlug =
    opts.solutionSlug ??
    `canary-${shortSha(fm.commit_sha)}-${fm.failed_phase}`
  const dedupAction: "new_entry" | "user_forced" =
    opts.force && related.duplicate_match ? "user_forced" : "new_entry"
  const stamp: DedupStamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: dedupAction,
  }

  const written = writeSolution(entry, solutionSlug, stamp, "", stateRoot)
  const promotedRef = `${entry.category}/${solutionSlug}`

  // Side-effect: mutate canary frontmatter with promoted_to.
  // Non-atomic; idempotent on retry (the AlreadyPromoted guard above
  // catches re-runs). writeSolution above is the §3-critical write;
  // this mutation is metadata-only audit trail + idempotency guard.
  const updatedFm: CanaryFailureFrontmatter = {
    ...fm,
    promoted_to: promotedRef,
  }
  writeFileSync(
    canaryPath,
    serializeFrontmatter(
      updatedFm as unknown as Record<string, unknown>,
      parsed.body,
    ),
    "utf8",
  )

  return {
    canaryPath,
    solutionPath: written.path,
    dedupAction,
    relatedRefs: related.related_entries,
  }
}
