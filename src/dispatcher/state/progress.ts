// Progress layer: progress/{current-task,feature-list,handoff}.md (read-write,
// overwritten per task) plus the derived sp-style plan markdown writer.
//
// Split out of the former monolithic state.ts (ARCH-3, audit v1.37.0 C10).

import { existsSync, mkdirSync, readFileSync } from "node:fs"
import { join, resolve } from "node:path"
import type { CurrentTask, FeatureList, Handoff } from "../types"
import {
  StateError,
  parseFrontmatter,
  resolveStateRoot as root,
  serializeFrontmatter,
  writeAtomic,
} from "./atomic"

export type ProgressFile = "current-task" | "feature-list" | "handoff"

function progressPath(file: ProgressFile, stateRoot?: string): string {
  return resolve(root(stateRoot), "progress", `${file}.md`)
}

// Invariant §7: progress/ docs were written without validation, unlike
// decisions/ reviews/ solutions/ — a malformed in-memory object produced a file
// that only failed (cryptically) at read time. These validators close that gap,
// matching the established presence-check convention (validateIntent/Ship).
// `active_feature` is intentionally NOT required: it is cleared (undefined) once
// every feature is done (sgc-state.schema.yaml marks it required, but the code +
// the CurrentTask TS type treat it as optional — the type is the ground truth).
const REQUIRED_CURRENT_TASK_FIELDS = [
  "task_id",
  "level",
  "session_start",
  "last_activity",
] as const

function validateCurrentTask(task: CurrentTask): void {
  for (const f of REQUIRED_CURRENT_TASK_FIELDS) {
    const v = (task as unknown as Record<string, unknown>)[f]
    if (v === undefined || v === null) {
      throw new StateError("SchemaViolation", `current-task missing required field: ${f}`)
    }
  }
}

export function writeCurrentTask(task: CurrentTask, body = "", stateRoot?: string): string {
  validateCurrentTask(task)
  const path = progressPath("current-task", stateRoot)
  writeAtomic(path, serializeFrontmatter(task as unknown as Record<string, unknown>, body))
  return path
}

export function readCurrentTask(stateRoot?: string): { task: CurrentTask; body: string } | null {
  const path = progressPath("current-task", stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<CurrentTask>(readFileSync(path, "utf8"), path)
  return { task: data, body }
}

const REQUIRED_FEATURE_FIELDS = ["id", "title", "status"] as const

function validateFeatureList(list: FeatureList): void {
  if (!Array.isArray(list?.features)) {
    throw new StateError("SchemaViolation", "feature-list missing required field: features (array)")
  }
  for (let i = 0; i < list.features.length; i++) {
    const ft = list.features[i] as unknown as Record<string, unknown>
    if (ft === null || typeof ft !== "object") {
      throw new StateError("SchemaViolation", `feature-list.features[${i}] is not an object`)
    }
    for (const f of REQUIRED_FEATURE_FIELDS) {
      if (ft[f] === undefined || ft[f] === null) {
        throw new StateError("SchemaViolation", `feature-list.features[${i}] missing required field: ${f}`)
      }
    }
  }
}

export function writeFeatureList(list: FeatureList, body = "", stateRoot?: string): string {
  validateFeatureList(list)
  const path = progressPath("feature-list", stateRoot)
  writeAtomic(path, serializeFrontmatter(list as unknown as Record<string, unknown>, body))
  return path
}

/**
 * Write a derived sp-style plan markdown doc (Phase 2b). Path:
 * <base>/docs/superpowers/plans/<date>-<slug>.md. `base` defaults to cwd;
 * tests pass a tmp dir. The content is produced by renderPlanMarkdown — this
 * is a thin I/O wrapper only (the markdown is never hand-edited).
 */
export function writePlanDoc(
  slug: string,
  dateIso: string,
  content: string,
  base?: string,
): string {
  const dir = join(base ?? process.cwd(), "docs", "superpowers", "plans")
  mkdirSync(dir, { recursive: true })
  const path = join(dir, `${dateIso}-${slug}.md`)
  writeAtomic(path, content)
  return path
}

export function readFeatureList(stateRoot?: string): { list: FeatureList; body: string } | null {
  const path = progressPath("feature-list", stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<FeatureList>(readFileSync(path, "utf8"), path)
  return { list: data, body }
}

const REQUIRED_HANDOFF_FIELDS = [
  "from_session",
  "to_session_hint",
  "summary",
] as const

function validateHandoff(handoff: Handoff): void {
  for (const f of REQUIRED_HANDOFF_FIELDS) {
    const v = (handoff as unknown as Record<string, unknown>)[f]
    if (v === undefined || v === null) {
      throw new StateError("SchemaViolation", `handoff missing required field: ${f}`)
    }
  }
  // open_questions is required as an array (may be empty).
  if (!Array.isArray(handoff?.open_questions)) {
    throw new StateError("SchemaViolation", "handoff.open_questions must be an array")
  }
}

export function writeHandoff(handoff: Handoff, body = "", stateRoot?: string): string {
  validateHandoff(handoff)
  const path = progressPath("handoff", stateRoot)
  writeAtomic(path, serializeFrontmatter(handoff as unknown as Record<string, unknown>, body))
  return path
}

export function readHandoff(stateRoot?: string): { handoff: Handoff; body: string } | null {
  const path = progressPath("handoff", stateRoot)
  if (!existsSync(path)) return null
  const { data, body } = parseFrontmatter<Handoff>(readFileSync(path, "utf8"), path)
  return { handoff: data, body }
}
