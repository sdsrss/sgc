// Core types for the sgc dispatcher MVP.
// Keep narrowly aligned with contracts/sgc-state.schema.yaml — when the
// schema changes, update both.

export type TaskId = string  // ULID
/** Classification levels. Runtime array is the single source for the
 *  `validateIntent` enum guard (mirrors PLAN_VERDICTS) so an out-of-range
 *  `--level` can't be persisted into intent.md. */
export const LEVELS = ["L0", "L1", "L2", "L3"] as const
export type Level = (typeof LEVELS)[number]
export type ScopeToken = string  // e.g. "read:decisions", "spawn:reviewer.*"

export type Verdict = "pass" | "concern" | "fail"
/** Plan-cluster verdict vocabulary (planner.ceo / planner.eng / fused).
 *  DISTINCT from the review-cluster `Verdict` (pass|concern|fail). Do not
 *  conflate — see tasks/specs/gs-3-plan-fusion.md Constraint 5. */
export const PLAN_VERDICTS = ["approve", "revise", "reject"] as const
export type PlanVerdict = (typeof PLAN_VERDICTS)[number]
export type Severity = "none" | "low" | "medium" | "high" | "critical"
export type Outcome = "success" | "partial" | "reverted"
export type Stage = "plan" | "code" | "qa" | "ship"
export type FeatureStatus = "pending" | "in_progress" | "blocked" | "done"
export type SolutionCategory =
  | "runtime" | "build" | "auth" | "data" | "perf" | "ui" | "infra" | "other"

// State layer ────────────────────────────────────────────────────────────────

export type StateLayer = "decisions" | "progress" | "solutions" | "reviews"

export interface IntentDoc {
  task_id: TaskId
  level: Level
  created_at: string  // ISO 8601
  title: string
  motivation: string  // markdown
  affected_readers: string[]
  scope_tokens: ScopeToken[]
  rejected_alternatives?: { option: string; reason: string }[]
  parent_decision?: TaskId
  user_signature?: { signed_at: string; signer_id: string }  // required L3
  /** GS-3: deterministic fused plan verdict (planner cluster synthesis).
   *  Optional + additive — pre-GS-3 intents omit it. */
  fused_verdict?: PlanVerdict
  body?: string
}

export interface ShipDoc {
  task_id: TaskId
  shipped_at: string
  outcome: Outcome
  deviations: string[]
  residuals: string[]
  linked_reviews: string[]
  rollback_ref?: string
}

export type PlanStepKind =
  | "test"
  | "verify-red"
  | "implement"
  | "verify-green"
  | "commit"
  | "guard"

/**
 * One bite-sized step inside a decomposed plan task (Phase 2b). Mirrors the
 * sp:writing-plans 5-step TDD cycle (test → verify-red → implement →
 * verify-green → commit) plus `guard` — a defensive step derived from a prior
 * failure-mode / prevention (CE reuse-in).
 */
export interface PlanStep {
  kind: PlanStepKind
  /** Complete content for the engineer. NO placeholders (sp:writing-plans rule). */
  text: string
  /** Exact command for verify-* / commit steps. */
  run?: string
  /** Expected output for verify-* steps. */
  expect?: string
}

export interface Feature {
  id: string
  title: string
  status: FeatureStatus
  depends_on?: string[]
  blocked_by?: string
  /**
   * Verification close-gate (sp:verification-before-completion absorb, Tier 1).
   * Set when the feature transitions to `done` via `sgc work --done`. Arbitrary
   * non-empty string naming how the feature was verified — OPERATOR
   * RESPONSIBILITY, sgc does NOT execute it (parity with `sgc debug close`'s
   * Iron Law #3 verify_command). Absent on features marked done before the
   * gate existed (grandfathered).
   */
  verify_command?: string
  /** Optional free-text evidence naming what was observed (Iron Law #2). */
  evidence?: string
  /**
   * TDD-ledger (Phase 2a). Set when `--done` records a prior-RED pair: the
   * failing test / repro identifier and the observed failure output. sgc
   * records the attestation; it does not execute the test. Absent on
   * features closed via --waive-red or before the gate existed.
   */
  prior_red?: string
  red_output?: string
  /** Reason a feature was closed without a prior-RED (e.g. "docs-only"). */
  waived_red?: string
  /**
   * Deep-plan decomposition (Phase 2b). Set when `sgc plan` authors a
   * file-level task. Absent on the single-placeholder feature (non-deep paths).
   */
  files?: { create: string[]; modify: string[]; test: string[] }
  steps?: PlanStep[]
  /**
   * solution_refs from researcher.history prior_art that seeded this task
   * (CE reuse-in). Drives surfaced_in / applied_in writeback in plan.ts.
   */
  prior_art_refs?: string[]
}

export interface FeatureList {
  features: Feature[]
}

export interface CurrentTask {
  task_id: TaskId
  level: Level
  active_feature?: string
  session_start: string
  last_activity: string
  checkpoint?: unknown
}

export interface Handoff {
  from_session: string
  to_session_hint: string
  summary: string
  open_questions: string[]
}

export interface SolutionEntry {
  id: string
  signature: string  // sha256
  category: SolutionCategory
  problem: string
  symptoms: string[]
  what_didnt_work: { approach: string; reason_failed: string }[]
  solution: string
  prevention: string
  tags: string[]
  first_seen: string
  last_updated: string
  times_referenced: number
  source_task_ids: TaskId[]
  related_entries?: string[]
  confidence?: "provisional" | "confirmed" | "canonical"
  // CE-6 (f7): task_ids that consumed this prevention via planner.adversarial
  // recurrence flag (CE-1 step 5). Mutated by applied-tracker.recordApplied,
  // which bypasses writeSolution() — see tasks/specs/ce-6-applied-in-tracker.md
  // "Invariant §3 carve-out (metadata-only mutation)". L3-only (adversarial).
  applied_in?: TaskId[]
  // CE-6 L2 extension: task_ids whose L2+ plan surfaced this solution via
  // researcher.history.prior_art (informed planning, but NOT adversarially
  // validated like applied_in). Mutated by applied-tracker.recordSurfaced
  // under the same §3 metadata-only carve-out. Weaker signal than applied_in.
  surfaced_in?: TaskId[]
}

export interface Finding {
  location?: string
  description: string
  suggestion?: string
}

export interface ReviewReport {
  report_id: string
  task_id: TaskId
  stage: Stage
  reviewer_id: string
  reviewer_version: string
  verdict: Verdict
  severity: Severity
  findings: Finding[]
  created_at: string
  evidence_refs?: string[]
  override?: { by: string; at: string; reason: string }
}

export interface JanitorDecision {
  task_id: TaskId
  decision: "compound" | "skip" | "update_existing"
  reason_code: string
  reason_human: string
  inputs_hash: string
  created_at: string
}

// Capabilities + manifests ───────────────────────────────────────────────────

export interface ScopeTokenDef {
  description?: string
  scoped_to?: string
  default_ttl?: string
  notes?: string
  forbidden_for?: string[]
  granted_to?: string[]
  rationale?: string
  constraints?: string[]
  requires?: string
}

export interface CommandPermissions {
  decisions?: ScopeToken[]
  progress?: ScopeToken[]
  solutions?: ScopeToken[]
  reviews?: ScopeToken[]
  exec?: ScopeToken[]
  spawn?: ScopeToken[]
}

// Subagent manifest from sgc-capabilities.yaml `subagents:` block.
// Manifest keys are short-form (`reviewer.correctness`); dispatcher maps
// `sgc:X:Y` ↔ `X.Y` per decision #8.
//
// `status` / `roadmap` annotate implementation state for each slot:
//   - "implemented"  — wired end-to-end (stub or real LLM); safe to spawn
//   - "slot-only"    — declared for forward-compat; NOT yet wired; do not spawn
//   - "manual-only"  — never auto-spawned; invoked by explicit user/tool action
// Slots without a status field are grandfathered as implemented (all
// pre-2026-04-16 manifests). New manifests SHOULD set status explicitly.
export interface SubagentManifest {
  name: string  // e.g. "classifier.level"
  version: string
  source?: string
  purpose?: string
  inputs?: Record<string, unknown>
  outputs?: Record<string, unknown>
  scope_tokens: ScopeToken[]
  token_budget?: number
  timeout_s?: number
  notes?: string
  decision_rules?: unknown
  trigger?: string
  status?: "implemented" | "slot-only" | "manual-only"
  roadmap?: string
  /** Optional external prompt template path, relative to repo root.
   *  When set, spawn.ts loads this file and substitutes <input_yaml/> with
   *  per-call input, replacing the synthesized prompt prefix from manifest.
   *  The template must contain a '## Input' heading so the system/user split
   *  (for cache_control) works correctly. */
  prompt_path?: string
}

// Loaded full spec ────────────────────────────────────────────────────────────

export interface CapabilitiesSpec {
  schema_version: string
  scope_tokens: Record<string, ScopeTokenDef>
  permissions: Record<string, CommandPermissions>  // key = "/plan", "/work", etc.
  subagents: Record<string, SubagentManifest>      // key = "classifier.level"
}

export interface StateSchemaSpec {
  schema_version: string
  decisions: unknown
  progress: unknown
  solutions: unknown
  reviews: unknown
}

// Spawn protocol ─────────────────────────────────────────────────────────────

export interface SpawnId {
  ulid: string
  agent_name: string  // e.g. "classifier.level"
}

export function formatSpawnId(s: SpawnId): string {
  return `${s.ulid}-${s.agent_name}`
}

// Dedup stamp — Invariant §3 authorization token ─────────────────────────────
// writeSolution requires one. Produced by compound.related after it has
// scanned existing solutions/. Without a stamp, writeSolution refuses.
// This is the state-layer enforcement point for §3 — any caller (future
// real-LLM agents, scripts) bypassing runCompound is rejected.

export type DedupStampReason =
  | "new_entry"              // no duplicate match found; writing fresh entry
  | "update_existing_dedup"  // similarity ≥ threshold; merging into existing
  | "user_forced"            // --force bypass; requires explicit authorization

export interface DedupStamp {
  /** spawn_id of the compound.related invocation that produced this stamp. */
  compound_related_spawn_id: string
  /** True iff compound.related authorized the write OR user forced. */
  threshold_met_or_forced: boolean
  /** Machine-readable reason for the stamp. */
  reason: DedupStampReason
}
