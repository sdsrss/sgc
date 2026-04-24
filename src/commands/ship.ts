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
  writeHandoff,
  writeJanitorDecision,
  writeShip,
} from "../dispatcher/state"
import {
  hasQaEvidence,
  intentPath,
  listReviewsForStage,
} from "../dispatcher/state"
import { createHash } from "node:crypto"
import { existsSync } from "node:fs"
import { defaultGhRunner, type GhRunner } from "../dispatcher/gh-runner"
import { spawn } from "../dispatcher/spawn"
import {
  janitorCompound,
  type JanitorCompoundOutput,
} from "../dispatcher/agents/janitor-compound"
import { runCompound } from "./compound"
import type { Handoff, JanitorDecision, ShipDoc, TaskId } from "../dispatcher/types"
import { createLogger, type Logger } from "../dispatcher/logger"

export interface ShipOptions {
  stateRoot?: string
  autoConfirm?: boolean  // --auto flag; refused at L3 per §4
  readConfirmation?: () => Promise<string>  // test hook for L3 stdin gate
  /** Create a GitHub PR via `gh pr create` after writing ship.md. */
  createPr?: boolean
  prTitle?: string
  prBody?: string
  ghRunner?: GhRunner  // test hook for PR creation
  /**
   * Explicit opt-out for janitor invocation. The CLI no longer exposes a
   * plain --no-janitor (that would silently violate Invariant §6). Instead,
   * callers pass a ≥40-char reason and a synthetic skip decision is logged
   * with reason_code=user_opt_out. Tests may also pass `runJanitor: false`
   * to fully skip — that path is reserved for harness code that doesn't
   * depend on §6 auditability.
   */
  janitorSkipReason?: string
  /** Test-only: fully suppress janitor (and the §6 log write). */
  runJanitor?: boolean
  /** Pass --force to janitor (bypass decision_rules into always-compound). */
  forceCompound?: boolean
  log?: (msg: string) => void
  logger?: Logger
}

export interface ShipResult {
  taskId: TaskId
  shipPath: string | null  // null for L0
  prUrl?: string
  janitorDecision?: JanitorCompoundOutput
  compoundAction?: "compound" | "update_existing" | "skip"
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
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
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

  // Janitor.compound auto-trigger (Invariant §6 — decision always logged)
  let janitorDecision: JanitorCompoundOutput | undefined
  let compoundAction: "compound" | "update_existing" | "skip" | undefined

  // User opt-out via --janitor-skip-reason still writes a synthetic decision
  // (§6 honesty: skips are logged). Only harness code that doesn't care about
  // §6 auditability may pass runJanitor=false.
  if (opts.janitorSkipReason !== undefined) {
    const reason = opts.janitorSkipReason.trim()
    if (reason.length < 40) {
      throw new Error(
        `--janitor-skip-reason must be ≥40 chars (got ${reason.length}). Invariant §6 forbids silent skips; supply a real justification.`,
      )
    }
    const inputs_hash = createHash("sha256")
      .update(`user_opt_out:${reason}`)
      .digest("hex")
    const skipDecision: JanitorDecision = {
      task_id: taskId,
      decision: "skip",
      reason_code: "user_opt_out",
      reason_human: reason,
      inputs_hash,
      created_at: nowIso(),
    }
    const decisionPath = writeJanitorDecision(skipDecision, "", stateRoot)
    janitorDecision = {
      decision: "skip",
      reason_code: "user_opt_out",
      reason_human: reason,
    }
    log(`janitor.compound: skip (user_opt_out) — reason logged`)
    log(`  logged to: ${decisionPath}`)
  } else if (opts.runJanitor !== false) {
    const janitorInput = {
      task_id: taskId,
      level,
      outcome: "success" as const,
      reviewer_flags: codeReviews.map((r) => ({
        severity: r.severity,
        novel: undefined,
      })),
      force: opts.forceCompound ?? false,
    }
    const jRes = await spawn<unknown, JanitorCompoundOutput>(
      "janitor.compound",
      janitorInput,
      {
        stateRoot,
        inlineStub: (i) => janitorCompound(i as typeof janitorInput),
        logger,
        taskId,
      },
    )
    janitorDecision = jRes.output

    // Invariant §6: log every decision (including skips)
    const inputs_hash = createHash("sha256")
      .update(JSON.stringify(janitorInput))
      .digest("hex")
    const decisionRecord: JanitorDecision = {
      task_id: taskId,
      decision: janitorDecision.decision,
      reason_code: janitorDecision.reason_code,
      reason_human: janitorDecision.reason_human,
      inputs_hash,
      created_at: nowIso(),
    }
    const decisionPath = writeJanitorDecision(decisionRecord, "", stateRoot)
    log(`janitor.compound: ${janitorDecision.decision} (${janitorDecision.reason_code})`)
    log(`  logged to: ${decisionPath}`)

    // If decision is compound or update_existing, invoke runCompound.
    // Compound runs its own dedup; its final `action` may differ from
    // janitor's suggestion (e.g. janitor says compound, runCompound finds
    // a match and returns update_existing).
    if (janitorDecision.decision === "compound" || janitorDecision.decision === "update_existing") {
      try {
        const c = await runCompound({
          stateRoot,
          force: opts.forceCompound,
          log: () => {},
        })
        compoundAction = c.action
        log(`compound: action=${c.action}${c.duplicateRef ? ` ref=${c.duplicateRef}` : ""}`)
      } catch (e) {
        // §10: if compound fails, no partial write happened (writeSolution
        // is the final step). Log the error but don't fail ship — ship.md
        // is already committed.
        log(`compound failed: ${(e as Error).message}`)
      }
    }
  }

  // Write handoff marker so a new session knows the task was shipped (audit:
  // writeHandoff was exported but never called from commands).
  const handoff: Handoff = {
    from_session: taskId,
    to_session_hint: "next task",
    summary: `Task ${taskId} shipped at level ${level}.`,
    open_questions: [],
  }
  writeHandoff(handoff, `Task ${taskId} shipped. Ready for next task.\n`, stateRoot)

  log(`shipped ${taskId} (${level})`)
  return { taskId, shipPath: shipFilePath, prUrl, janitorDecision, compoundAction }
}
