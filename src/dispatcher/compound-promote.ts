// CE-3 promote (sibling spec: tasks/specs/ce-3-promote-helper.md) —
// bridge from `<stateRoot>/ship-failures/<slug>.md` into solutions/.
// Routes through the SAME Invariant §3 write-gate as runCompound:
// real compound.related spawn, real DedupStamp, real writeSolution.
//
// Heuristic-only — compoundContextHeuristic for category/tags/problem +
// compoundRelatedHeuristic for the dedup_stamp (the latter is
// intentionally never LLM-swapped per feedback_compound_related_invariant3
// — an LLM minting `best_similarity: 0` could bypass the corpus dedup).
// Operator-edited `prevention_seed:` is authoritative; no LLM rewrite.

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

export interface PromoteOptions {
  slug: string
  stateRoot?: string
  /** Bypass DuplicateMatch refuse only. AlreadyPromoted is orthogonal. */
  force?: boolean
  /** Override solution slug (default `ship-failure-<short-sha>`). */
  solutionSlug?: string
  logger?: Logger
}

export interface PromoteResult {
  shipFailurePath: string
  solutionPath: string
  /** `new_entry`: clean write. `user_forced`: --force bypassed a duplicate. */
  dedupAction: "new_entry" | "user_forced"
  /** Top-5 near-match refs from compound.related (0.3 < sim < threshold). */
  relatedRefs: string[]
}

export type PromoteErrorCode =
  | "MissingShipFailure"
  | "PlaceholderPreventionSeed"
  | "AlreadyPromoted"
  | "DuplicateMatch"

export class PromoteError extends Error {
  readonly code: PromoteErrorCode
  readonly detail?: Record<string, unknown>
  constructor(
    code: PromoteErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "PromoteError"
    this.code = code
    this.detail = detail
  }
}

interface ShipFailureFrontmatter {
  kind: string
  captured_at: string
  commit_sha: string
  tag: string | null
  workflow_run_id: string
  workflow_run_url: string
  workflow_name: string
  conclusion: string
  prevention_seed: string
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
 * Pull the `## $GITHUB_STEP_SUMMARY excerpt` block out of the
 * capture-time templated body. Section boundary is the literal heading
 * pair captureShipFailure wrote (`renderBody` in ship-failure.ts).
 * Returns "" if the section is missing or empty.
 */
function extractStepSummary(body: string): string {
  const re = /## \$GITHUB_STEP_SUMMARY excerpt\n\n([\s\S]*?)\n+## Next steps/
  const m = re.exec(body)
  return m?.[1]?.trim() ?? ""
}

export async function promoteShipFailure(
  opts: PromoteOptions,
): Promise<PromoteResult> {
  const stateRoot = opts.stateRoot
  const root = resolveStateRoot(stateRoot)
  const shipFailurePath = resolve(root, "ship-failures", `${opts.slug}.md`)

  if (!existsSync(shipFailurePath)) {
    throw new PromoteError(
      "MissingShipFailure",
      `ship-failures/${opts.slug}.md does not exist under ${root}. ` +
        `Run \`ls ${root}/ship-failures/\` to see available slugs.`,
      { slug: opts.slug, stateRoot: root },
    )
  }

  const raw = readFileSync(shipFailurePath, "utf8")
  const parsed = parseFrontmatter<ShipFailureFrontmatter>(raw)
  const fm = parsed.data

  // Idempotency guard: re-promote on a record that already carries
  // promoted_to: is a no-op refuse. Operator wanting re-promote must
  // explicitly remove the field. --force does NOT bypass this.
  if (typeof fm.promoted_to === "string" && fm.promoted_to.length > 0) {
    throw new PromoteError(
      "AlreadyPromoted",
      `ship-failures/${opts.slug}.md already carries promoted_to: ${fm.promoted_to}. ` +
        `Remove the field manually to re-promote; --force does NOT override.`,
      { promoted_to: fm.promoted_to },
    )
  }

  const seed = String(fm.prevention_seed ?? "").trim()
  if (seed.length === 0 || seed.startsWith(PLACEHOLDER_PREFIX)) {
    throw new PromoteError(
      "PlaceholderPreventionSeed",
      `ship-failures/${opts.slug}.md still carries the capture-time ` +
        `prevention_seed placeholder (or empty). Edit the file's ` +
        `\`prevention_seed:\` frontmatter into the actual safeguard ` +
        `before re-running promote.`,
      { prevention_seed: seed.slice(0, 80) },
    )
  }

  // Spec-locked heuristic input shape: <summary>\n\n<workflow_name>.
  // Keeps category-pattern matching driven by the failure text itself
  // while still routing the workflow hint into the tag candidates.
  const summary = extractStepSummary(parsed.body)
  const intentText = `${summary}\n\n${fm.workflow_name}`
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
    throw new PromoteError(
      "DuplicateMatch",
      `compound.related found a duplicate at ${related.duplicate_match.ref} ` +
        `(similarity ${related.duplicate_match.similarity.toFixed(3)} ≥ ` +
        `${related.dedup_stamp.threshold}). Pass --force to write anyway, ` +
        `or edit prevention_seed: to differentiate.`,
      {
        duplicate_ref: related.duplicate_match.ref,
        similarity: related.duplicate_match.similarity,
      },
    )
  }

  const current = readCurrentTask(stateRoot)
  const taskId =
    current?.task.task_id ?? `SHIP-FAILURE-${shortSha(fm.commit_sha)}`

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
            `captured ship failure of ${fm.workflow_name} at ${shortSha(fm.commit_sha)}`,
          ],
    what_didnt_work: [],
    solution:
      `Ship failure of ${fm.workflow_name} at ${shortSha(fm.commit_sha)} ` +
      `(run ${fm.workflow_run_id}); see body for $GITHUB_STEP_SUMMARY excerpt + ` +
      `operator's prevention_seed.`,
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
    opts.solutionSlug ?? `ship-failure-${shortSha(fm.commit_sha)}`
  const dedupAction: "new_entry" | "user_forced" =
    opts.force && related.duplicate_match ? "user_forced" : "new_entry"
  const stamp: DedupStamp = {
    compound_related_spawn_id: relRes.spawnId,
    threshold_met_or_forced: true,
    reason: dedupAction,
  }

  const written = writeSolution(entry, solutionSlug, stamp, "", stateRoot)
  const promotedRef = `${entry.category}/${solutionSlug}`

  // Side-effect: mutate ship-failure frontmatter with promoted_to.
  // Non-atomic; idempotent on retry (the AlreadyPromoted guard above
  // catches re-runs). writeSolution above is the §3-critical write;
  // this mutation is metadata-only audit trail + idempotency guard.
  const updatedFm: ShipFailureFrontmatter = { ...fm, promoted_to: promotedRef }
  writeFileSync(
    shipFailurePath,
    serializeFrontmatter(
      updatedFm as unknown as Record<string, unknown>,
      parsed.body,
    ),
    "utf8",
  )

  return {
    shipFailurePath,
    solutionPath: written.path,
    dedupAction,
    relatedRefs: related.related_entries,
  }
}
