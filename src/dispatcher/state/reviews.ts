// Reviews layer: reviews/{id}/{stage}/{reviewer}.md (append-only per
// (task, stage, reviewer), Invariant §6) plus two review-adjacent records that
// physically live under the same tree or alongside it:
//
//   reviews/{id}/janitor/compound-decision.md   janitor decision log (§6)
//   red-green/<slug>.md                          TDD-ledger RED→GREEN captures
//
// Split out of the former monolithic state.ts (ARCH-3, audit v1.37.0 C10).

import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs"
import { resolve } from "node:path"
import type { JanitorDecision, ReviewReport, Stage, TaskId } from "../types"
import {
  StateError,
  parseFrontmatter,
  resolveStateRoot as root,
  serializeFrontmatter,
  writeAtomic,
} from "./atomic"

// TDD-ledger red-green capture (Phase 2a) ─────────────────────────────────────

export interface RedGreenFrontmatter {
  kind: "red-green"
  captured_at: string
  task_id: string
  feature_id: string
  level: string
  prior_red: string
  red_output: string
  verify_command: string
  evidence?: string
  prevention_seed: string
  promoted_to?: string
}

export const RED_GREEN_PLACEHOLDER = "TODO: operator-fill the reusable prevention"

function redGreenSlug(title: string, taskId: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "feature"
  return `${base}-${taskId.slice(0, 8).toLowerCase()}`
}

/**
 * Write a red-green capture record under <stateRoot>/red-green/<slug>.md,
 * mirroring ship-failures. Same-minute collision appends -2, -3, … Uses
 * writeAtomic (STAB-4). Returns the slug actually written. prevention_seed is
 * seeded with the operator-fill placeholder — promote refuses until it is
 * filled (parity with ship-failure promote).
 */
export function writeRedGreenCapture(
  fm: Omit<RedGreenFrontmatter, "kind" | "captured_at" | "prevention_seed"> & {
    title: string
  },
  stateRoot?: string,
): string {
  const dir = resolve(root(stateRoot), "red-green")
  mkdirSync(dir, { recursive: true })
  const baseSlug = redGreenSlug(fm.title, fm.task_id)
  let slug = baseSlug
  let n = 1
  while (existsSync(resolve(dir, `${slug}.md`))) {
    n += 1
    slug = `${baseSlug}-${n}`
    if (n > 50) throw new Error(`red-green slug collision overflow for ${fm.task_id}`)
  }
  const data: RedGreenFrontmatter = {
    kind: "red-green",
    captured_at: new Date().toISOString(),
    task_id: fm.task_id,
    feature_id: fm.feature_id,
    level: fm.level,
    prior_red: fm.prior_red,
    red_output: fm.red_output,
    verify_command: fm.verify_command,
    ...(fm.evidence ? { evidence: fm.evidence } : {}),
    prevention_seed: RED_GREEN_PLACEHOLDER,
  }
  const body =
    `## RED→GREEN\n\n- prior RED: ${fm.prior_red}\n- observed: ${fm.red_output}\n` +
    `- verified by: ${fm.verify_command}\n\nFill \`prevention_seed:\` with the ` +
    `reusable safeguard, then run \`sgc compound --from-red-green ${slug}\`.\n`
  writeAtomic(
    resolve(dir, `${slug}.md`),
    serializeFrontmatter(data as unknown as Record<string, unknown>, body),
  )
  return slug
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
    // B3/F3: an override needs an attributable human, not just a long reason.
    // Symmetric with the L3 plan gate's user_signature — a fail verdict cannot
    // be waved through by an anonymous `{by:""}`.
    if ((report.override.by ?? "").trim().length === 0) {
      throw new StateError(
        "SchemaViolation",
        "review override.by (the signer) must be a non-empty name (Invariant §5)",
      )
    }
  }
}

// Append-as suffix: lets a follow-up review pass write `<reviewer>.<suffix>.md`
// alongside the original `<reviewer>.md` without violating Invariant §6 (each
// individual file is still write-once). Invalid suffix shapes (path traversal,
// reserved chars, empty) are rejected at the write boundary so CLI + library
// callers share the same gate.
const REVIEW_SUFFIX_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,30}$/

export function reviewPath(
  taskId: TaskId,
  stage: Stage,
  reviewerId: string,
  stateRoot?: string,
  suffix?: string,
): string {
  const base = suffix ? `${reviewerId}.${suffix}.md` : `${reviewerId}.md`
  return resolve(root(stateRoot), "reviews", taskId, stage, base)
}

export function appendReview(
  report: ReviewReport,
  body = "",
  stateRoot?: string,
  suffix?: string,
): string {
  if (suffix !== undefined && !REVIEW_SUFFIX_RE.test(suffix)) {
    throw new StateError(
      "SchemaViolation",
      `invalid review suffix ${JSON.stringify(suffix)} — must match ${REVIEW_SUFFIX_RE.source}`,
    )
  }
  const path = reviewPath(report.task_id, report.stage, report.reviewer_id, stateRoot, suffix)
  if (existsSync(path)) {
    const ref = suffix ? `${report.reviewer_id}.${suffix}` : report.reviewer_id
    throw new StateError(
      "AppendOnly",
      `review ${ref} already exists for ${report.task_id}/${report.stage} — append-only per Invariant §6`,
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
