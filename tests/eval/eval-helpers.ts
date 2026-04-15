// Shared helpers for eval/*.eval.ts end-to-end scenarios.
//
// Eval scenarios exercise the full sgc pipeline (plan → work → review →
// qa → ship → compound) and assert holistic Invariant compliance, not
// per-unit behavior. For module-level tests see tests/dispatcher/.
//
// Per Invariant §12: the eval framework is authoritative — when the
// framework and the spec disagree, the framework wins and the spec is
// amended to match.

import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

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
