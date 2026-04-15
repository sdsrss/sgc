// State layer I/O for `.sgc/{decisions,progress,solutions,reviews}/`.
//
// Each state file is markdown with YAML frontmatter:
//
//     ---
//     task_id: 01HXXX...
//     level: L1
//     ---
//
//     # Markdown body...
//
// Mutability rules (per contracts/sgc-state.schema.yaml + sgc-invariants.md):
//
//   decisions/{id}/intent.md   immutable after creation (Invariant §2)
//   decisions/{id}/ship.md     immutable after creation
//   progress/*.md              read-write, overwritten per task
//   solutions/{cat}/{slug}.md  append-or-update-existing (dedup-enforced
//                              elsewhere — this layer doesn't check)
//   reviews/{id}/{stage}/{r}   append-only per (task, stage, reviewer)
//
// Schema validation is field-presence only for MVP. Full typebox decoding
// is a D-phase concern.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs"
import { dirname, resolve } from "node:path"
import { dump as yamlDump, load as yamlLoad } from "js-yaml"
import type {
  CurrentTask,
  FeatureList,
  Handoff,
  IntentDoc,
  JanitorDecision,
  ReviewReport,
  ShipDoc,
  SolutionCategory,
  SolutionEntry,
  Stage,
  TaskId,
} from "./types"

export class StateError extends Error {
  constructor(
    public readonly code:
      | "NoFrontmatter"
      | "SchemaViolation"
      | "IntentImmutable"
      | "ShipImmutable"
      | "AppendOnly"
      | "NotFound"
      | "SolutionDeleteForbidden",
    message: string,
  ) {
    super(message)
    this.name = "StateError"
  }
}

const DEFAULT_STATE_DIR = ".sgc"

function root(custom?: string): string {
  return resolve(custom ?? process.env["SGC_STATE_ROOT"] ?? DEFAULT_STATE_DIR)
}

const LAYERS = ["decisions", "progress", "solutions", "reviews"] as const

export function ensureSgcStructure(stateRoot?: string): string {
  const r = root(stateRoot)
  for (const layer of LAYERS) {
    mkdirSync(resolve(r, layer), { recursive: true })
  }
  return r
}

// Frontmatter ────────────────────────────────────────────────────────────────

export interface FrontmatterFile<T> {
  data: T
  body: string
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/

export function parseFrontmatter<T = Record<string, unknown>>(
  text: string,
): FrontmatterFile<T> {
  const match = FRONTMATTER_RE.exec(text)
  if (!match) throw new StateError("NoFrontmatter", "file missing YAML frontmatter")
  const data = (yamlLoad(match[1]!) ?? {}) as T
  // Strip leading blank lines that the serializer adds for visual spacing,
  // so round-trip preserves the original body.
  const body = (match[2] ?? "").replace(/^\n+/, "")
  return { data, body }
}

export function serializeFrontmatter(
  data: Record<string, unknown>,
  body = "",
): string {
  const yaml = yamlDump(data, { lineWidth: -1, sortKeys: false }).trimEnd()
  const trimmedBody = body.replace(/^\n+/, "")
  return `---\n${yaml}\n---\n\n${trimmedBody}`
}

function writeAtomic(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  const tmp = `${path}.tmp.${process.pid}.${Date.now()}`
  writeFileSync(tmp, content, "utf8")
  renameSync(tmp, path)
}

// Decisions: intent.md ───────────────────────────────────────────────────────

const REQUIRED_INTENT_FIELDS = [
  "task_id",
  "level",
  "created_at",
  "title",
  "motivation",
  "affected_readers",
  "scope_tokens",
] as const

/** Whitespace-separated word count. */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

function validateIntent(intent: IntentDoc): void {
  for (const f of REQUIRED_INTENT_FIELDS) {
    const v = intent[f as keyof IntentDoc]
    if (v === undefined || v === null) {
      throw new StateError("SchemaViolation", `intent missing required field: ${f}`)
    }
  }
  if (!Array.isArray(intent.affected_readers) || intent.affected_readers.length < 1) {
    throw new StateError(
      "SchemaViolation",
      "affected_readers must be a non-empty array (required even at L1)",
    )
  }
  // sgc-state.schema.yaml:52 — motivation: { type: markdown, min_words: 20 }
  // Audit C-phase C3: this was previously not enforced; auto-padding produced
  // a 16-word motivation that was then immutably persisted.
  const mwords = wordCount(intent.motivation)
  if (mwords < 20) {
    throw new StateError(
      "SchemaViolation",
      `motivation must be ≥20 words (got ${mwords}); pass --motivation "<longer rationale>"`,
    )
  }
  if (intent.level === "L3" && !intent.user_signature) {
    throw new StateError(
      "SchemaViolation",
      "L3 intent requires user_signature (Invariant §4)",
    )
  }
}

export function intentPath(taskId: TaskId, stateRoot?: string): string {
  return resolve(root(stateRoot), "decisions", taskId, "intent.md")
}

export function writeIntent(intent: IntentDoc, stateRoot?: string): string {
  const path = intentPath(intent.task_id, stateRoot)
  if (existsSync(path)) {
    throw new StateError(
      "IntentImmutable",
      `intent.md exists for ${intent.task_id} — Invariant §2 (immutable)`,
    )
  }
  validateIntent(intent)
  const { body, ...frontmatter } = intent
  writeAtomic(path, serializeFrontmatter(frontmatter as Record<string, unknown>, body ?? ""))
  return path
}

export function readIntent(taskId: TaskId, stateRoot?: string): IntentDoc {
  const path = intentPath(taskId, stateRoot)
  if (!existsSync(path)) {
    throw new StateError("NotFound", `intent.md not found for ${taskId}`)
  }
  const { data, body } = parseFrontmatter<IntentDoc>(readFileSync(path, "utf8"))
  return { ...data, body }
}

// Decisions: ship.md ─────────────────────────────────────────────────────────

const REQUIRED_SHIP_FIELDS = [
  "task_id",
  "shipped_at",
  "outcome",
  "deviations",
  "residuals",
  "linked_reviews",
] as const

function validateShip(ship: ShipDoc): void {
  for (const f of REQUIRED_SHIP_FIELDS) {
    const v = ship[f as keyof ShipDoc]
    if (v === undefined || v === null) {
      throw new StateError("SchemaViolation", `ship missing required field: ${f}`)
    }
  }
  if (ship.outcome === "reverted" && !ship.rollback_ref) {
    throw new StateError(
      "SchemaViolation",
      "ship outcome=reverted requires rollback_ref",
    )
  }
}

export function shipPath(taskId: TaskId, stateRoot?: string): string {
  return resolve(root(stateRoot), "decisions", taskId, "ship.md")
}

export function writeShip(ship: ShipDoc, body = "", stateRoot?: string): string {
  const path = shipPath(ship.task_id, stateRoot)
  if (existsSync(path)) {
    throw new StateError("ShipImmutable", `ship.md exists for ${ship.task_id}`)
  }
  validateShip(ship)
  writeAtomic(path, serializeFrontmatter(ship as unknown as Record<string, unknown>, body))
  return path
}

export function readShip(taskId: TaskId, stateRoot?: string): { ship: ShipDoc; body: string } {
  const path = shipPath(taskId, stateRoot)
  if (!existsSync(path)) {
    throw new StateError("NotFound", `ship.md not found for ${taskId}`)
  }
  const { data, body } = parseFrontmatter<ShipDoc>(readFileSync(path, "utf8"))
  return { ship: data, body }
}

// Progress: current-task / feature-list / handoff ───────────────────────────

export type ProgressFile = "current-task" | "feature-list" | "handoff"

function progressPath(file: ProgressFile, stateRoot?: string): string {
  return resolve(root(stateRoot), "progress", `${file}.md`)
}

export function writeCurrentTask(task: CurrentTask, body = "", stateRoot?: string): string {
  const path = progressPath("current-task", stateRoot)
  writeAtomic(path, serializeFrontmatter(task as unknown as Record<string, unknown>, body))
  return path
}

export function readCurrentTask(stateRoot?: string): { task: CurrentTask; body: string } | null {
  const path = progressPath("current-task", stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<CurrentTask>(readFileSync(path, "utf8"))
  return { task: data, body }
}

export function writeFeatureList(list: FeatureList, body = "", stateRoot?: string): string {
  const path = progressPath("feature-list", stateRoot)
  writeAtomic(path, serializeFrontmatter(list as unknown as Record<string, unknown>, body))
  return path
}

export function readFeatureList(stateRoot?: string): { list: FeatureList; body: string } | null {
  const path = progressPath("feature-list", stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<FeatureList>(readFileSync(path, "utf8"))
  return { list: data, body }
}

export function writeHandoff(handoff: Handoff, body = "", stateRoot?: string): string {
  const path = progressPath("handoff", stateRoot)
  writeAtomic(path, serializeFrontmatter(handoff as unknown as Record<string, unknown>, body))
  return path
}

export function readHandoff(stateRoot?: string): { handoff: Handoff; body: string } | null {
  const path = progressPath("handoff", stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<Handoff>(readFileSync(path, "utf8"))
  return { handoff: data, body }
}

// Reviews: append-only per (taskId, stage, reviewerId) ──────────────────────

const REQUIRED_REVIEW_FIELDS = [
  "report_id",
  "task_id",
  "stage",
  "reviewer_id",
  "reviewer_version",
  "verdict",
  "severity",
  "findings",
  "created_at",
] as const

function validateReview(report: ReviewReport): void {
  for (const f of REQUIRED_REVIEW_FIELDS) {
    const v = report[f as keyof ReviewReport]
    if (v === undefined || v === null) {
      throw new StateError("SchemaViolation", `review missing required field: ${f}`)
    }
  }
  if (report.override) {
    const r = report.override.reason ?? ""
    if (r.length < 40) {
      throw new StateError(
        "SchemaViolation",
        `review override.reason must be ≥40 chars (Invariant §5); got ${r.length}`,
      )
    }
  }
}

export function reviewPath(
  taskId: TaskId,
  stage: Stage,
  reviewerId: string,
  stateRoot?: string,
): string {
  return resolve(root(stateRoot), "reviews", taskId, stage, `${reviewerId}.md`)
}

export function appendReview(
  report: ReviewReport,
  body = "",
  stateRoot?: string,
): string {
  const path = reviewPath(report.task_id, report.stage, report.reviewer_id, stateRoot)
  if (existsSync(path)) {
    throw new StateError(
      "AppendOnly",
      `review ${report.reviewer_id} already exists for ${report.task_id}/${report.stage} — append-only per Invariant §6`,
    )
  }
  validateReview(report)
  writeAtomic(path, serializeFrontmatter(report as unknown as Record<string, unknown>, body))
  return path
}

export function readReview(
  taskId: TaskId,
  stage: Stage,
  reviewerId: string,
  stateRoot?: string,
): { report: ReviewReport; body: string } | null {
  const path = reviewPath(taskId, stage, reviewerId, stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<ReviewReport>(readFileSync(path, "utf8"))
  return { report: data, body }
}

/**
 * True if any QA review exists for this task.
 *
 * Used by the ship gate (D-phase Step 5) to confirm L2+ tasks have qa
 * evidence before ship.md is written. D-4.2 introduces this helper; the
 * ship check wires it in Step 5.
 */
export function hasQaEvidence(taskId: TaskId, stateRoot?: string): boolean {
  const qaDir = resolve(root(stateRoot), "reviews", taskId, "qa")
  if (!existsSync(qaDir)) return false
  try {
    return readdirSync(qaDir).some((f) => f.endsWith(".md"))
  } catch {
    return false
  }
}

// Solutions: append-or-update-existing, delete forbidden ────────────────────

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
 * Write or update a solution entry.
 *   - New path   → fresh write
 *   - Existing   → update-existing semantics (Invariant §3):
 *                   • append new source_task_ids (dedup preserved)
 *                   • refresh last_updated
 *                   • merge new what_didnt_work entries (dedup by `approach`)
 *                   • DO NOT overwrite existing solution / prevention fields
 *                   • bump times_referenced by 1
 * Returns the canonical path and the final (merged) entry written.
 */
export function writeSolution(
  entry: SolutionEntry,
  slug: string,
  body = "",
  stateRoot?: string,
): { path: string; entry: SolutionEntry } {
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
  return { path, entry: finalEntry }
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

// Janitor decisions ──────────────────────────────────────────────────────────

const REQUIRED_JANITOR_FIELDS = [
  "task_id",
  "decision",
  "reason_code",
  "reason_human",
  "inputs_hash",
  "created_at",
] as const

function validateJanitorDecision(d: JanitorDecision): void {
  for (const f of REQUIRED_JANITOR_FIELDS) {
    const v = d[f as keyof JanitorDecision]
    if (v === undefined || v === null || (typeof v === "string" && v.length === 0)) {
      throw new StateError("SchemaViolation", `janitor decision missing: ${f}`)
    }
  }
}

export function janitorDecisionPath(taskId: TaskId, stateRoot?: string): string {
  return resolve(root(stateRoot), "reviews", taskId, "janitor", "compound-decision.md")
}

/**
 * Write the janitor decision. Invariant §6: every janitor decision MUST
 * be logged (including skips). One decision per task — duplicate writes
 * throw AppendOnly.
 */
export function writeJanitorDecision(
  decision: JanitorDecision,
  body = "",
  stateRoot?: string,
): string {
  const path = janitorDecisionPath(decision.task_id, stateRoot)
  if (existsSync(path)) {
    throw new StateError(
      "AppendOnly",
      `janitor decision already written for ${decision.task_id} (Invariant §6)`,
    )
  }
  validateJanitorDecision(decision)
  writeAtomic(path, serializeFrontmatter(decision as unknown as Record<string, unknown>, body))
  return path
}

export function readJanitorDecision(
  taskId: TaskId,
  stateRoot?: string,
): JanitorDecision | null {
  const path = janitorDecisionPath(taskId, stateRoot)
  if (!existsSync(path)) return null
  const { data } = parseFrontmatter<JanitorDecision>(readFileSync(path, "utf8"))
  return data
}

/**
 * List every review report for a (task, stage) pair. Returns parsed
 * ReviewReport objects, silently skipping files that fail to parse.
 * Used by the ship gate to enforce review coverage + override rules.
 */
export function listReviewsForStage(
  taskId: TaskId,
  stage: Stage,
  stateRoot?: string,
): ReviewReport[] {
  const dir = resolve(root(stateRoot), "reviews", taskId, stage)
  if (!existsSync(dir)) return []
  let files: string[]
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".md"))
  } catch {
    return []
  }
  const reports: ReviewReport[] = []
  for (const f of files) {
    try {
      const text = readFileSync(resolve(dir, f), "utf8")
      const { data } = parseFrontmatter<ReviewReport>(text)
      reports.push(data)
    } catch {
      // Skip unparseable file; not fatal for the list
    }
  }
  return reports
}
