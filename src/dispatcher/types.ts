// Core types for the sgc dispatcher MVP.
// Keep narrowly aligned with contracts/sgc-state.schema.yaml — when the
// schema changes, update both.

export type TaskId = string  // ULID
export type Level = "L0" | "L1" | "L2" | "L3"
export type ScopeToken = string  // e.g. "read:decisions", "spawn:reviewer.*"

export type Verdict = "pass" | "concern" | "fail"
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

export interface Feature {
  id: string
  title: string
  status: FeatureStatus
  depends_on?: string[]
  blocked_by?: string
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
