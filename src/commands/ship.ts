// `sgc ship` — ship gate + writeShip.
//
// Gate checks (in order; first failure throws):
//   1. Active task exists (current-task.md present)
//   2. L3 refuses --auto (Invariant §4)
//   3. Feature-list all `done`
//   4. L1+ has intent.md (L0 skips decisions/ per schema)
//   5. L1+ has at least one code review
//   6. No review returns verdict=fail without populated override
//      (state.ts already enforces override.reason ≥40 on write per §5,
//      so we just need to reject missing-override cases)
//   7. L2+ has qa evidence (reviews/{task}/qa/*.md) — Invariant-adjacent
//   8. L3 requires interactive 'yes' at stdin (Invariant §4)
//
// After gates pass:
//   - L1+: writeShip (immutable, linked_reviews populated)
//   - L0:  skip ship.md per schema (L0 skips decisions/ entirely)
//   - Update current-task: active_feature=undefined, last_activity=now
//
// --pr flag and gh integration ship in D-5.2.

import {
  readCurrentTask,
  readFeatureList,
  readIntent,
  writeCurrentTask,
  writeShip,
} from "../dispatcher/state"
import {
  hasQaEvidence,
  intentPath,
  listReviewsForStage,
} from "../dispatcher/state"
import { existsSync } from "node:fs"
import { defaultGhRunner, type GhRunner } from "../dispatcher/gh-runner"
import type { ShipDoc, TaskId } from "../dispatcher/types"

export interface ShipOptions {
  stateRoot?: string
  autoConfirm?: boolean  // --auto flag; refused at L3 per §4
  readConfirmation?: () => Promise<string>  // test hook for L3 stdin gate
  /** Create a GitHub PR via `gh pr create` after writing ship.md. */
  createPr?: boolean
  prTitle?: string
  prBody?: string
  ghRunner?: GhRunner  // test hook for PR creation
  log?: (msg: string) => void
}

export interface ShipResult {
  taskId: TaskId
  shipPath: string | null  // null for L0
  prUrl?: string
}

function nowIso(): string {
  return new Date().toISOString()
}

async function readLineFromStdin(): Promise<string> {
  const stdin = process.stdin
  return new Promise((resolve) => {
    stdin.resume()
    stdin.setEncoding("utf8")
    let buf = ""
    const onData = (chunk: string) => {
      buf += chunk
      const nl = buf.indexOf("\n")
      if (nl !== -1) {
        stdin.removeListener("data", onData)
        stdin.pause()
        resolve(buf.slice(0, nl).trim())
      }
    }
    stdin.on("data", onData)
  })
}

export async function runShip(opts: ShipOptions = {}): Promise<ShipResult> {
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  // 1. Current task
  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id
  const level = ct.task.level

  // 2. L3 refuses --auto
  if (level === "L3" && opts.autoConfirm) {
    throw new Error("L3 ship refuses --auto (Invariant §4); human confirmation required")
  }

  // 3. Feature-list all done
  const fl = readFeatureList(stateRoot)
  if (!fl) throw new Error("no feature-list — was the plan complete?")
  if (fl.list.features.length === 0) throw new Error("feature-list is empty; nothing to ship")
  const remaining = fl.list.features.filter((f) => f.status !== "done")
  if (remaining.length > 0) {
    throw new Error(
      `${remaining.length} feature(s) not done: ${remaining.map((f) => f.id).join(", ")}`,
    )
  }

  // 4. L1+ requires intent.md
  if (level !== "L0") {
    if (!existsSync(intentPath(taskId, stateRoot))) {
      throw new Error(`no decisions/${taskId}/intent.md — cannot ship L${level} without intent`)
    }
  }

  // 5-6. L1+ review coverage + override rule
  const codeReviews = listReviewsForStage(taskId, "code", stateRoot)
  if (level !== "L0" && codeReviews.length === 0) {
    throw new Error(`no code reviews for ${taskId} — run \`sgc review\` first`)
  }
  const failedWithoutOverride = codeReviews.filter(
    (r) =>
      r.verdict === "fail" &&
      (!r.override || ((r.override.reason ?? "").length < 40)),
  )
  if (failedWithoutOverride.length > 0) {
    throw new Error(
      `${failedWithoutOverride.length} review(s) with verdict=fail need an override with reason ≥40 chars (Invariant §5)`,
    )
  }

  // 7. L2+ qa evidence
  if (level === "L2" || level === "L3") {
    if (!hasQaEvidence(taskId, stateRoot)) {
      throw new Error(
        `${level} ship requires qa evidence — run \`sgc qa <target> --flows ...\` first`,
      )
    }
  }

  // 8. L3 interactive confirmation
  if (level === "L3") {
    log("")
    log("=== L3 SHIP SUMMARY — confirm before ship.md is written (immutable) ===")
    log(`  task_id:        ${taskId}`)
    log(`  features done:  ${fl.list.features.length}`)
    log(`  code reviews:   ${codeReviews.length}`)
    log(`  qa evidence:    yes`)
    log("")
    log("Type 'yes' to ship (or Ctrl+C to abort):")
    const reader = opts.readConfirmation ?? readLineFromStdin
    const answer = (await reader()).trim().toLowerCase()
    if (answer !== "yes") {
      throw new Error(
        `L3 ship not confirmed at stdin (got '${answer || "(empty)"}'); ship.md NOT written.`,
      )
    }
    log("confirmed — writing ship.md")
  }

  // Write ship.md (L1+) or skip (L0)
  let shipFilePath: string | null = null
  if (level !== "L0") {
    const ship: ShipDoc = {
      task_id: taskId,
      shipped_at: nowIso(),
      outcome: "success",
      deviations: [],
      residuals: [],
      linked_reviews: codeReviews.map((r) => r.report_id),
    }
    shipFilePath = writeShip(ship, "", stateRoot)
    log(`wrote ${shipFilePath}`)
  } else {
    log(`L0 task: skipping ship.md per schema (decisions/ not written for L0)`)
  }

  // Update current-task to clear active_feature + bump last_activity
  writeCurrentTask(
    {
      ...ct.task,
      active_feature: undefined,
      last_activity: nowIso(),
    },
    "",
    stateRoot,
  )

  // Optional: create a PR via `gh pr create`
  let prUrl: string | undefined
  if (opts.createPr) {
    if (level === "L0") {
      log(`L0 task: skipping PR creation (L0 tasks typically don't merit a PR)`)
    } else {
      const runner = opts.ghRunner ?? defaultGhRunner
      const intent = readIntent(taskId, stateRoot)
      const title = opts.prTitle ?? `sgc ship: ${intent.title}`.slice(0, 200)
      const body =
        opts.prBody ??
        [
          `Automated PR from \`sgc ship\`.`,
          ``,
          `- **Task**: \`${taskId}\``,
          `- **Level**: ${level}`,
          `- **Code reviews**: ${codeReviews.length}`,
          shipFilePath ? `- **Ship record**: \`${shipFilePath}\`` : "",
          ``,
          `See \`decisions/${taskId}/intent.md\` for the full plan.`,
        ]
          .filter(Boolean)
          .join("\n")
      log(`creating PR via gh pr create…`)
      try {
        const res = await runner.createPr({ title, body })
        prUrl = res.url
        log(`PR: ${prUrl}`)
      } catch (e) {
        log(`PR creation failed: ${(e as Error).message}`)
        throw e
      }
    }
  }

  log(`shipped ${taskId} (${level})`)
  return { taskId, shipPath: shipFilePath, prUrl }
}
