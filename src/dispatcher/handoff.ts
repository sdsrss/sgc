// src/dispatcher/handoff.ts
//
// GS-2 (f9) — sgc handoff session-state checkpoint capture.
//
// Spec: tasks/specs/gs-2-handoff.md
// Heuristic-only: no LLM, no agent spawn, no events emitted in v0.
// Scans .sgc/ state across 6 namespaces (decisions / plan-jobs /
// loop-runs / ship-failures / canaries / progress events.ndjson) + git
// status + recent commits; produces a typed HandoffSnapshot; renders
// to markdown; writes atomically to tasks/<slug>-paused.md outside .sgc/.

import { existsSync } from "node:fs"
import * as fs from "node:fs/promises"
import { join, dirname } from "node:path"

export interface ActiveIntentSummary {
  task_id: string
  level: "L0" | "L1" | "L2" | "L3"
  title: string
  intent_path: string
  mtime: string
}

export interface VerifyCommandResult {
  source: "loop-run" | "plan-job" | "events-spawn" | "todo"
  command?: string
  context?: string
}

export interface PlanJobSummary {
  job_id: string
  status: "running" | "paused" | "failed" | "stale"
  task: string
  pid?: number
  started_at: string
}

export interface LoopRunSummary {
  run_id: string
  status: "running" | "paused" | "failed"
  current_step: string
  task: string
  started_at: string
}

export interface UnpromotedCapture {
  kind: "ship-failure" | "canary"
  slug: string
  seed_excerpt?: string
}

export interface CommitOneline {
  sha: string
  subject: string
}

export interface UnclosedSpawn {
  spawn_id: string
  agent: string
  start_ts: string
}

export interface GitStatus {
  branch: string
  ahead?: number
  behind?: number
  changes: string[]
}

export interface HandoffSnapshot {
  slug: string
  generated_at: string
  cwd: string
  sgc_version: string
  active_intent?: ActiveIntentSummary
  verify_command: VerifyCommandResult
  plan_jobs: PlanJobSummary[]
  loop_runs: LoopRunSummary[]
  unpromoted_captures: UnpromotedCapture[]
  git: GitStatus
  recent_commits: CommitOneline[]
  unclosed_spawns: UnclosedSpawn[]
}

// Test-injection seam for git shell-outs (production: real `git` binary)
export interface GitProbe {
  branchAheadBehind: () => Promise<{ branch: string; ahead?: number; behind?: number }>
  statusPorcelain: () => Promise<string[]>
  recentCommits: (n: number) => Promise<CommitOneline[]>
}

// ── kebab/slug helpers ────────────────────────────────────────────────────

export function kebabize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function timestampFallback(now: Date): string {
  const iso = now.toISOString()
  return `${iso.slice(0, 10)}-${iso.slice(11, 16).replace(":", "")}-handoff`
}

export async function deriveSlug(stateRoot: string, now: Date): Promise<string> {
  throw new Error("not implemented")
}

// ── verify-command cascade (pure) ─────────────────────────────────────────

export function inferVerifyCommand(snapshot: HandoffSnapshot): VerifyCommandResult {
  throw new Error("not implemented")
}

// ── sub-gather stubs ──────────────────────────────────────────────────────

export async function gatherActiveIntent(stateRoot: string): Promise<ActiveIntentSummary | undefined> {
  throw new Error("not implemented")
}

export async function gatherPlanJobs(stateRoot: string): Promise<PlanJobSummary[]> {
  throw new Error("not implemented")
}

export async function gatherLoopRuns(stateRoot: string): Promise<LoopRunSummary[]> {
  throw new Error("not implemented")
}

export async function gatherUnpromotedCaptures(stateRoot: string): Promise<UnpromotedCapture[]> {
  throw new Error("not implemented")
}

export async function gatherUnclosedSpawns(
  stateRoot: string,
  tailLines: number,
): Promise<UnclosedSpawn[]> {
  throw new Error("not implemented")
}

export async function gatherGit(probe?: GitProbe): Promise<GitStatus> {
  throw new Error("not implemented")
}

export async function gatherRecentCommits(probe?: GitProbe): Promise<CommitOneline[]> {
  throw new Error("not implemented")
}

// ── orchestrator + render + write ─────────────────────────────────────────

export interface GatherOptions {
  now?: Date
  git?: GitProbe
  sgcVersion?: string
}

export async function gatherHandoffState(
  stateRoot: string,
  repoRoot: string,
  opts?: GatherOptions,
): Promise<HandoffSnapshot> {
  throw new Error("not implemented")
}

export function renderHandoffMarkdown(snapshot: HandoffSnapshot): string {
  throw new Error("not implemented")
}

export async function writeHandoffMarkdown(
  repoRoot: string,
  slug: string,
  content: string,
): Promise<string> {
  throw new Error("not implemented")
}

export const EVENTS_TAIL_LINES = 500
export const SEED_EXCERPT_MAX = 80
export const SLUG_KEBAB_MAX = 40
export const TASK_EXCERPT_MAX = 80
