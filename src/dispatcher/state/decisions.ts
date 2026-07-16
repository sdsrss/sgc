// Decisions layer: decisions/{id}/intent.md + ship.md.
//
//   decisions/{id}/intent.md   immutable after creation (Invariant §2)
//   decisions/{id}/ship.md     immutable after creation
//
// Split out of the former monolithic state.ts (ARCH-3, audit v1.37.0 C10).

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { LEVELS, PLAN_VERDICTS } from "../types"
import type { IntentDoc, ShipDoc, TaskId } from "../types"
import {
  StateError,
  parseFrontmatter,
  resolveStateRoot as root,
  serializeFrontmatter,
  wordCount,
  writeAtomic,
} from "./atomic"

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
  // `level` is the routing field every gate (review/qa/ship) keys off — an
  // out-of-range value (e.g. a bad `--level` override) must not be persisted.
  // Mirrors the fused_verdict enum guard below.
  if (!(LEVELS as readonly string[]).includes(intent.level)) {
    throw new StateError(
      "SchemaViolation",
      `level must be one of L0|L1|L2|L3 (got '${intent.level}')`,
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
  if (intent.fused_verdict !== undefined &&
      !(PLAN_VERDICTS as readonly string[]).includes(intent.fused_verdict)) {
    throw new StateError(
      "SchemaViolation",
      `fused_verdict must be one of approve|revise|reject (got '${intent.fused_verdict}')`,
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
  const { data, body } = parseFrontmatter<IntentDoc>(readFileSync(path, "utf8"), path)
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
  const { data, body } = parseFrontmatter<ShipDoc>(readFileSync(path, "utf8"), path)
  return { ship: data, body }
}
