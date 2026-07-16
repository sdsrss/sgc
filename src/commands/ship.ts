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
  intentPath,
  listReviewsForStage,
} from "../dispatcher/state"
import { createHash } from "node:crypto"
import { execSync } from "node:child_process"
import { existsSync } from "node:fs"
import {
  defaultGhRunner,
  defaultUpstreamCheck,
  type GhRunner,
  type UpstreamCheck,
} from "../dispatcher/gh-runner"
import { spawn } from "../dispatcher/spawn"
import {
  janitorCompound,
  type JanitorCompoundOutput,
} from "../dispatcher/agents/janitor-compound"
import { runCompound } from "./compound"
import { isHeuristicMode } from "../dispatcher/types"
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
   * F-4 fail-fast: read current branch + upstream before writeShip. When
   * `createPr` is set and the branch has no upstream, ship aborts BEFORE
   * writing ship.md (immutable), so `git push -u origin <branch>` + retry
   * is a clean path. Tests inject mocks here; prod uses `defaultUpstreamCheck`.
   */
  upstreamCheck?: UpstreamCheck
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
  /**
   * CE-5: test hook for the janitor "reusable knowledge" gate's changed-line
   * signal. Prod computes it from `git diff --numstat HEAD` (best-effort,
   * undefined on any failure → fail-safe to compound).
   */
  diffLineCount?: () => number | undefined
  /**
   * B1/F1: accept shipping an L2+ task whose code review is heuristic-only (no
   * LLM was configured, so the correctness gate verified only that a report
   * exists). Both must be supplied together and validated like a §5 override:
   * `acceptedBy` a non-empty signer, `acceptDegradedReview` a reason ≥40 chars.
   * Recorded immutably in ship.md. Absent → a degraded L2+ review blocks ship.
   */
  acceptDegradedReview?: string
  acceptedBy?: string
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

/**
 * CE-5: best-effort changed-line count (additions+deletions) for the janitor
 * "reusable knowledge" gate. Uses uncommitted working-tree changes vs HEAD —
 * for sgc's main-direct flow the task's edits are typically still unstaged at
 * `sgc ship` time. Any failure (not a git repo, git absent, committed work →
 * empty) returns undefined, which the gate treats fail-safe as "compound".
 */
function gitDiffLineCount(cwd?: string): number | undefined {
  try {
    const out = execSync("git diff --numstat HEAD", {
      encoding: "utf8",
      cwd,
      stdio: ["ignore", "pipe", "ignore"],
    })
    let total = 0
    for (const line of out.split("\n")) {
      const m = line.match(/^(\d+)\t(\d+)\t/)
      if (m) total += Number(m[1]) + Number(m[2])
    }
    return total
  } catch {
    return undefined
  }
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
      (!r.override ||
        (r.override.reason ?? "").length < 40 ||
        // B3/F3: an override with no named signer is not an override (defense
        // against a hand-edited review file; validateReview blocks it on write).
        (r.override.by ?? "").trim().length === 0),
  )
  if (failedWithoutOverride.length > 0) {
    throw new Error(
      `${failedWithoutOverride.length} review(s) with verdict=fail need an override with reason ≥40 chars (Invariant §5)`,
    )
  }

  // B1/F1: set by the degraded-review gate below when an L2+ ship proceeds on a
  // heuristic-only review via a signed acceptance; threaded into ship.md.
  let degradedAcceptance: ShipDoc["degraded_review_acceptance"] | undefined

  // 7. L2+ qa evidence — must exist AND not stand on a failed verdict.
  // Mirrors the code-review fail-gate above (Invariant §5): a qa report with
  // verdict=fail blocks ship unless an override with reason ≥40 chars is
  // recorded. Previously only existence was checked, so a failed QA (e.g. a
  // real-browser smoke that found console errors, or a stub run with no
  // target) silently satisfied the gate.
  if (level === "L2" || level === "L3") {
    const qaReports = listReviewsForStage(taskId, "qa", stateRoot)
    if (qaReports.length === 0) {
      throw new Error(
        `${level} ship requires qa evidence — run \`sgc qa <target> --flows ...\` first`,
      )
    }
    const failedQaWithoutOverride = qaReports.filter(
      (r) =>
        r.verdict === "fail" &&
        (!r.override ||
          (r.override.reason ?? "").length < 40 ||
          (r.override.by ?? "").trim().length === 0),
    )
    if (failedQaWithoutOverride.length > 0) {
      throw new Error(
        `${failedQaWithoutOverride.length} qa report(s) with verdict=fail need an override with reason ≥40 chars (Invariant §5)`,
      )
    }

    // B1/F1: BLOCK a degraded (heuristic-only) L2+ review. The gate reads the
    // engine stamp (A3). A code review is LLM-backed iff its engine is present
    // AND not "inline". If NONE is LLM-backed — every review heuristic, or a
    // pre-A3 report with no engine — the gate verified only that a report
    // EXISTS, not that the code was reviewed (a heuristic reviewer structurally
    // cannot emit the `fail` this gate blocked on). Note this is stricter than
    // A3's advisory notice, which counted only proven-`inline`: a gate errs
    // toward blocking, so a pre-A3 (unknown-engine) report is degraded here.
    // Scope: code-review cluster only — qa is stub-by-default and honestly
    // returns `concern`, a separate documented limitation (spec §Scope boundary).
    const degraded =
      codeReviews.length > 0 &&
      !codeReviews.some((r) => r.engine !== undefined && !isHeuristicMode(r.engine))
    if (degraded) {
      const by = (opts.acceptedBy ?? "").trim()
      const reason = (opts.acceptDegradedReview ?? "").trim()
      if (by.length > 0 || reason.length > 0) {
        // An acceptance was attempted — a malformed one is a throw, never a
        // silent bypass (mirrors the §5 fail-override rule B3 hardened).
        if (by.length === 0) {
          throw new Error(
            `--accept-degraded-review requires --accepted-by "<name>" — a named signer (Invariant §5)`,
          )
        }
        if (reason.length < 40) {
          throw new Error(
            `--accept-degraded-review reason must be ≥40 chars (Invariant §5); got ${reason.length}`,
          )
        }
        degradedAcceptance = { by, at: nowIso(), reason }
        log(`⚠ shipped on a heuristic-only review, accepted by ${by}: ${reason}`)
      } else {
        throw new Error(
          `${level} ship blocked: every code review is heuristic (no LLM was configured), so the ` +
            `correctness gate verified only that a report exists — not that the code was reviewed ` +
            `(audit F1). Either configure an LLM (OPENROUTER_API_KEY, or the claude CLI) and re-run ` +
            `\`sgc review\`, or accept the degraded review explicitly: ` +
            `sgc ship --accepted-by "<name>" --accept-degraded-review "<why, ≥40 chars>".`,
        )
      }
    }
  }

  // 7.5. F-4 fail-fast: if --pr is requested on L1+, the local branch MUST
  // have an upstream tracking ref. Otherwise gh pr create would fail AFTER
  // writeShip (which is immutable per §6), leaving a half-shipped state.
  // L0 skips PR creation entirely (see step "Optional: create a PR" below).
  if (opts.createPr && level !== "L0") {
    const check = opts.upstreamCheck ?? defaultUpstreamCheck
    const u = await check()
    if (u.upstream === null) {
      throw new Error(
        `current branch '${u.branch}' has no upstream — run \`git push -u origin ${u.branch}\` before \`sgc ship --pr\`. ship.md NOT written.`,
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
      ...(degradedAcceptance ? { degraded_review_acceptance: degradedAcceptance } : {}),
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
      // CE-5: feed the changed-line signal to the reusable-knowledge gate.
      diff_lines: (opts.diffLineCount ?? gitDiffLineCount)(),
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
