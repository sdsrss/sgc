// Shared helpers for eval/*.eval.ts end-to-end scenarios.
//
// Eval scenarios exercise the full sgc pipeline (plan → work → review →
// qa → ship → compound) and assert holistic Invariant compliance, not
// per-unit behavior. For module-level tests see tests/dispatcher/.
//
// Per Invariant §12: the eval framework is authoritative — when the
// framework and the spec disagree, the framework wins and the spec is
// amended to match.

import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { serializeFrontmatter } from "../../src/dispatcher/state"
import type { ReviewReport } from "../../src/dispatcher/types"

export function createEvalWorkspace(prefix = "sgc-eval-"): string {
  return mkdtempSync(join(tmpdir(), prefix))
}

export function destroyEvalWorkspace(tmp: string): void {
  rmSync(tmp, { recursive: true, force: true })
}

export const LONG_MOTIVATION_FIXTURE =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

/** Count prompt audit files under `.sgc/progress/agent-prompts/`. */
export function countAgentPrompts(tmp: string): number {
  const dir = resolve(tmp, "progress/agent-prompts")
  try {
    return readdirSync(dir).filter((f) => f.endsWith(".md")).length
  } catch {
    return 0
  }
}

/** List agent names (from spawn_id suffix) that have prompts on disk. */
export function agentsInvoked(tmp: string): string[] {
  const dir = resolve(tmp, "progress/agent-prompts")
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => {
        // spawn_id format: "{ulid}-{agent.name}.md"
        const id = f.replace(/\.md$/, "")
        const dash = id.indexOf("-")
        return dash === -1 ? id : id.slice(dash + 1)
      })
      .sort()
  } catch {
    return []
  }
}

/**
 * Seed a failing code review on disk for a given task. The review is written
 * directly (bypasses appendReview to avoid append-only conflicts in
 * multi-review scenarios). Optionally accepts an override to embed.
 */
export function seedFailingReview(
  stateRoot: string,
  taskId: string,
  opts?: { override?: { by: string; at: string; reason: string }; reviewerId?: string },
): string {
  const reviewerId = opts?.reviewerId ?? "reviewer.correctness"
  const dir = resolve(stateRoot, "reviews", taskId, "code")
  mkdirSync(dir, { recursive: true })
  const report: ReviewReport = {
    report_id: crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase(),
    task_id: taskId,
    stage: "code",
    reviewer_id: reviewerId,
    reviewer_version: "0.1",
    verdict: "fail",
    severity: "high",
    findings: [{ description: "test seeded failure" }],
    created_at: new Date().toISOString(),
    ...(opts?.override ? { override: opts.override } : {}),
  }
  const filePath = resolve(dir, `${reviewerId}.md`)
  writeFileSync(
    filePath,
    serializeFrontmatter(report as unknown as Record<string, unknown>, "test seeded failure"),
    "utf8",
  )
  return filePath
}

/**
 * Seed a passing code review on disk for a given task.
 */
export function seedPassingReview(
  stateRoot: string,
  taskId: string,
  reviewerId = "reviewer.correctness",
): string {
  const dir = resolve(stateRoot, "reviews", taskId, "code")
  mkdirSync(dir, { recursive: true })
  const report: ReviewReport = {
    report_id: crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase(),
    task_id: taskId,
    stage: "code",
    reviewer_id: reviewerId,
    reviewer_version: "0.1",
    verdict: "pass",
    severity: "none",
    findings: [],
    created_at: new Date().toISOString(),
  }
  const filePath = resolve(dir, `${reviewerId}.md`)
  writeFileSync(
    filePath,
    serializeFrontmatter(report as unknown as Record<string, unknown>, ""),
    "utf8",
  )
  return filePath
}
