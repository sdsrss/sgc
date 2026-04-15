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
  ReviewReport,
  ShipDoc,
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
      | "NotFound",
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
