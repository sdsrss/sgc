// `sgc plan` command implementation.
//
// Flow:
//   1. Generate task_id (ULID)
//   2. Spawn classifier.level → get level + rationale
//   3. Display classification; allow upgrade-only (per /plan SKILL.md rule)
//   4. If level >= L1: spawn planner.eng → get verdict
//   5. Write decisions/{task_id}/intent.md (immutable, schema-validated)
//   6. Write progress/feature-list.md + current-task.md
//   7. Print "next: sgc work"
//
// MVP: classifier and planner.eng are inline stubs; demo runs without
// external Claude. Set SGC_USE_FILE_AGENTS=1 to use file-poll protocol
// (for real Claude main-session integration, future work).

import { existsSync, readFileSync } from "node:fs"
import {
  spawn,
  PRIOR_ART_SENTINEL_BEGIN,
  PRIOR_ART_SENTINEL_END,
  PRE_MORTEM_SENTINEL_BEGIN,
  PRE_MORTEM_SENTINEL_END,
} from "../dispatcher/spawn"
import {
  classifierLevel,
  type ClassifierOutput,
} from "../dispatcher/agents/classifier-level"
import { plannerEng, type PlannerEngOutput } from "../dispatcher/agents/planner-eng"
import { plannerCeo, type PlannerCeoOutput } from "../dispatcher/agents/planner-ceo"
import {
  researcherHistory,
  preFilterSolutions,
  coerceLlmOutput,
  handleCoerceFailure,
  type ResearcherHistoryOutput,
  type ResearcherHistoryInput,
} from "../dispatcher/agents/researcher-history"
import {
  plannerAdversarial,
  type PlannerAdversarialInput,
  type PlannerAdversarialOutput,
} from "../dispatcher/agents/planner-adversarial"
import {
  extractPreventions,
  type PriorPrevention,
} from "../dispatcher/preventions"
import {
  extractAppliedSolutionRefs,
  recordApplied,
} from "../dispatcher/applied-tracker"
import { validateClassifierRationale } from "../dispatcher/rationale"
import {
  ensureSgcStructure,
  readHandoff,
  wordCount,
  writeCurrentTask,
  writeFeatureList,
  writeHandoff,
  writeIntent,
} from "../dispatcher/state"
import { computeCommandTokens } from "../dispatcher/capabilities"
import { delegationHintsFor, formatHint } from "../dispatcher/delegation"
import type { Handoff, IntentDoc, Level } from "../dispatcher/types"
import { createLogger, type Logger } from "../dispatcher/logger"
import {
  completePlanJob,
  emitAsyncStart,
  failPlanJob,
  forkAsyncPlanJob,
} from "../dispatcher/plan-jobs"

export interface PlanOptions {
  stateRoot?: string
  // If set, accept this level instead of asking the user (for tests + demo).
  forceLevel?: Level
  // Required when level is L3 (Invariant §4). { signer_id } from CLI flag.
  userSignature?: { signed_at: string; signer_id: string }
  // Explicit motivation; defaults to taskDescription. Must be ≥20 words for
  // L1+ tasks (audit C-phase C3, sgc-state.schema.yaml:52 min_words rule).
  motivation?: string
  // --force-new-task: override active handoff and start a new task.
  forceNewTask?: boolean
  // --auto flag; REFUSED at L3 per Invariant §4.
  autoConfirm?: boolean
  // CE-4 (f5): --async flag. Parent forks a detached child running the
  // sync flow; parent prints job summary and exits. Child mode is
  // signaled to `runPlan` via the `SGC_PLAN_ASYNC_CHILD` env var and
  // runs runPlanCore wrapped in completePlanJob/failPlanJob.
  async?: boolean
  // Test hook: inject the interactive confirmation reader (returns user
  // input, e.g. "yes"). Default reads one line from process.stdin.
  readConfirmation?: () => Promise<string>
  // Logger sink; defaults to console.log
  log?: (msg: string) => void
  // Explicit logger injection (wraps log if provided)
  logger?: Logger
  /** CE-6 test hook: override the planner.adversarial inline stub output.
   *  Production path unchanged — undefined by default. Requires SGC_FORCE_INLINE=1. */
  adversarialOverride?: PlannerAdversarialOutput
}

const LEVEL_RANK: Record<Level, number> = { L0: 0, L1: 1, L2: 2, L3: 3 }

function generateTaskId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function nowIso(): string {
  return new Date().toISOString()
}

async function readLineSync(): Promise<string> {
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

/** Default stdin reader for L3 interactive confirmation (D-3.2). */
async function defaultReadConfirmation(): Promise<string> {
  return readLineSync()
}

/**
 * CE-4 (f5) async wrapper. Three paths:
 *
 *   1. Parent mode (`opts.async === true` AND no SGC_PLAN_ASYNC_CHILD):
 *      fork detached child running `bun sgc.ts plan <task>`, write a
 *      job-handle file, print operator-facing summary, return synthetic
 *      shape. Child runs the same `runPlan` in path 2.
 *
 *   2. Child mode (`SGC_PLAN_ASYNC_CHILD=<job-id>` in env): wrap the
 *      synchronous `runPlanCore` in try/catch; on success call
 *      completePlanJob with classification metadata, on throw call
 *      failPlanJob + re-throw so the child process exits non-zero.
 *
 *   3. Sync mode (default): call `runPlanCore` directly. Identical to
 *      the pre-CE-4 behavior.
 */
export async function runPlan(
  taskDescription: string,
  opts: PlanOptions = {},
): Promise<{
  taskId: string
  level: Level
  intentPath: string
}> {
  const asyncChildJobId = process.env["SGC_PLAN_ASYNC_CHILD"]

  // Parent branch — fork and exit.
  if (opts.async && !asyncChildJobId) {
    const parentLogger =
      opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
    // Freeze the parent's flag-derived options into a JSON env var so
    // the child sees them. Child argv is `[bun, sgc.ts, "plan", task]`
    // only — flags like --motivation / --signed-by / --level don't
    // round-trip via argv. async/log/logger/readConfirmation are NOT
    // forwarded (they're parent-process-only concerns).
    const childOpts: Partial<PlanOptions> = {}
    if (opts.forceLevel !== undefined) childOpts.forceLevel = opts.forceLevel
    if (opts.userSignature !== undefined)
      childOpts.userSignature = opts.userSignature
    if (opts.motivation !== undefined) childOpts.motivation = opts.motivation
    if (opts.autoConfirm !== undefined) childOpts.autoConfirm = opts.autoConfirm
    if (opts.forceNewTask !== undefined)
      childOpts.forceNewTask = opts.forceNewTask
    const fork = await forkAsyncPlanJob(taskDescription, {
      stateRoot: opts.stateRoot,
      extraEnv: { SGC_PLAN_CHILD_OPTS: JSON.stringify(childOpts) },
    })
    emitAsyncStart(fork.job.job_id, taskDescription, parentLogger, {
      pid: fork.job.pid,
      log_path: fork.job.log_path,
    })
    process.stderr.write(
      `async plan job ${fork.job.job_id} (pid=${fork.job.pid})\n`,
    )
    process.stderr.write(`  task:    ${taskDescription}\n`)
    process.stderr.write(`  log:     ${fork.job.log_path}\n`)
    process.stderr.write(`  watch:   sgc plan --status ${fork.job.job_id}\n`)
    process.stderr.write(
      `  events:  sgc tail --event-type plan.async_start,plan.async_complete,plan.async_failed --follow\n`,
    )
    // Synthetic shape; sgc.ts handler ignores the return value.
    return {
      taskId: fork.job.job_id,
      level: "L0",
      intentPath: fork.jobPath,
    }
  }

  // Child branch — run sync flow, then mark job done/failed.
  if (asyncChildJobId) {
    // Restore parent-frozen options from SGC_PLAN_CHILD_OPTS env.
    // CLI args in the child are bare (`plan <task>` only) so flag-
    // derived opts come through this channel.
    let childMerged = opts
    const rawChildOpts = process.env["SGC_PLAN_CHILD_OPTS"]
    if (rawChildOpts) {
      try {
        const parsed = JSON.parse(rawChildOpts) as Partial<PlanOptions>
        childMerged = { ...opts, ...parsed, async: false }
      } catch {
        // Malformed env JSON — fall through with raw opts; child will
        // likely fail validation downstream, which we'll capture as
        // failPlanJob below.
      }
    }
    try {
      const result = await runPlanCore(taskDescription, childMerged)
      await completePlanJob(
        asyncChildJobId,
        {
          taskId: result.taskId,
          level: result.level,
          intentPath: result.intentPath,
        },
        { stateRoot: opts.stateRoot, logger: opts.logger },
      )
      return result
    } catch (err) {
      await failPlanJob(
        asyncChildJobId,
        err instanceof Error ? err.message : String(err),
        { stateRoot: opts.stateRoot, logger: opts.logger },
      )
      throw err
    }
  }

  // Default: pre-CE-4 sync behavior.
  return runPlanCore(taskDescription, opts)
}

async function runPlanCore(taskDescription: string, opts: PlanOptions = {}): Promise<{
  taskId: string
  level: Level
  intentPath: string
}> {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const stateRoot = opts.stateRoot

  ensureSgcStructure(stateRoot)

  // Resume guard: refuse new task when an active handoff exists (audit gap).
  const existingHandoff = readHandoff(stateRoot)
  if (existingHandoff) {
    const { handoff } = existingHandoff
    // "Completed" handoffs (ship finished, session closed) don't block.
    const isCompleted =
      handoff.to_session_hint === "next task" ||
      handoff.summary?.includes("shipped") ||
      handoff.summary?.includes("Ready for next task")
    if (!isCompleted && !opts.forceNewTask) {
      log(
        `Active task detected in handoff: ${handoff.from_session}.\n` +
          `Summary: ${handoff.summary}\n` +
          `Pass --force-new-task to start a new task anyway.`,
      )
      throw new Error(
        `active task in handoff.md — complete it or pass --force-new-task`,
      )
    }
  }

  const taskId = generateTaskId()
  const createdAt = nowIso()

  log(`task_id = ${taskId}`)

  // Step 1: classify
  const classRes = await spawn<unknown, ClassifierOutput>(
    "classifier.level",
    { user_request: taskDescription },
    { stateRoot, inlineStub: (i) => classifierLevel(i as { user_request: string }), logger, taskId },
  )
  // Invariant §11: rationale must be concrete (D-1.2).
  validateClassifierRationale(classRes.output.rationale)
  let level = classRes.output.level
  log(`classifier verdict: ${level} — ${classRes.output.rationale}`)

  // Step 2: level confirmation (upgrade-only per skill rule)
  if (opts.forceLevel) {
    if (LEVEL_RANK[opts.forceLevel] < LEVEL_RANK[level]) {
      throw new Error(
        `forceLevel ${opts.forceLevel} would downgrade ${level} — refused (upgrade-only rule)`,
      )
    }
    level = opts.forceLevel
    log(`level overridden to ${level} (upgrade)`)
  }

  // Step 3: planner cluster
  //   L0 → skip
  //   L1 → planner.eng
  //   L2 → planner.eng + planner.ceo + researcher.history (3-way parallel)
  //   L3 → L2 cluster + planner.adversarial (4-way parallel)
  // Every spawn gets its own pinned scope tokens (Invariant §8).
  let plannerEngOut: PlannerEngOutput | null = null
  let plannerCeoOut: PlannerCeoOutput | null = null
  let researcherOut: ResearcherHistoryOutput | null = null
  let adversarialOut: PlannerAdversarialOutput | null = null
  // CE-6 (f7): hoisted so the wire-up block (after Promise.all) can read
  // the preventions that were fed to planner.adversarial. The IIFE assigns
  // capturedPriorPreventions after extractPreventions resolves.
  let capturedPriorPreventions: PriorPrevention[] = []
  if (LEVEL_RANK[level] >= 2) {
    // P1.6: surface delegation hints once per plan invocation before the
    // parallel planner cluster fires. Nudge only — sgc continues with its
    // inline path either way.
    for (const hint of delegationHintsFor("plan.researcher")) log(formatHint(hint))
    if (level === "L3") {
      for (const hint of delegationHintsFor("plan.adversarial")) log(formatHint(hint))
    }
    const tasks: Promise<unknown>[] = [
      spawn<unknown, PlannerEngOutput>(
        "planner.eng",
        { intent_draft: taskDescription },
        { stateRoot, inlineStub: (i) => plannerEng(i as { intent_draft: string }), logger, taskId },
      ),
      spawn<unknown, PlannerCeoOutput>(
        "planner.ceo",
        { intent_draft: taskDescription },
        { stateRoot, inlineStub: (i) => plannerCeo(i as { intent_draft: string }), logger, taskId },
      ),
      (async (): Promise<{ output: ResearcherHistoryOutput }> => {
        const candidates = await preFilterSolutions(taskDescription, stateRoot)
        if (candidates.length === 0) {
          return {
            output: {
              prior_art: [],
              warnings: ["no candidates from pre-filter"],
            },
          }
        }
        try {
          const r = await spawn<unknown, unknown>(
            "researcher.history",
            { intent_draft: taskDescription, candidates },
            {
              stateRoot,
              inlineStub: (i) =>
                researcherHistory(
                  i as ResearcherHistoryInput,
                  { stateRoot },
                ),
              logger,
              taskId,
            },
          )
          // Heuristic mode (inlineStub) returns the legacy shape — coerce passes
          // it through (Guard 4 only enforces non-empty *when present*, not
          // "must exist"); LLM mode returns the new shape with relevance_reason.
          return { output: coerceLlmOutput(r.output, candidates) }
        } catch (err) {
          // handleCoerceFailure emits the Tier-2 audit event + returns the
          // synthetic empty-output shape (Phase H pre-ship review F-4).
          return { output: handleCoerceFailure(err, logger, taskId) }
        }
      })(),
    ]
    if (level === "L3") {
      // CE-1: keyword-match preventions from solutions/ and feed to
      // planner.adversarial as spawn input. The agent does NOT hold
      // read:solutions itself; /plan pre-fetches. Data crosses as input,
      // not capability — Invariant §1 partial relaxation for .adversarial
      // only. See CHANGELOG "Feature (CE-1)" + tasks/specs/ce-1-prevention-injection.md.
      //
      // Wrapped as IIFE pushed into `tasks` so the disk walk runs in
      // parallel with eng/ceo/researcher.history (Perf-1 — mirrors the
      // researcher.history IIFE pattern above). try/catch around the
      // extractor emits a Tier-2 audit event on failure and falls back
      // to empty preventions instead of crashing the L3 cluster (RT-6 —
      // mirrors handleCoerceFailure in researcher-history.ts:348).
      tasks.push(
        (async (): Promise<{ output: PlannerAdversarialOutput }> => {
          let priorPreventions: PriorPrevention[] = []
          try {
            priorPreventions = await extractPreventions(
              taskDescription,
              stateRoot,
              { logger, taskId },
            )
            // CE-6 (f7): hoist to outer scope for wire-up block after Promise.all.
            capturedPriorPreventions = priorPreventions
          } catch (err) {
            const errName = err instanceof Error ? err.name : "unknown"
            const errMsg = err instanceof Error ? err.message : ""
            logger.event({
              task_id: taskId,
              spawn_id: null,
              agent: "plan.preventions",
              event_type: "prevention.extract_failed",
              level: "warn",
              payload: { error_class: errName, error_message: errMsg },
            })
          }
          if (priorPreventions.length > 0) {
            log(
              `prevention recall: ${priorPreventions.length} prior failure shape(s) matched`,
            )
            for (const p of priorPreventions) {
              log(`  prevention: ${p.solution_ref}`)
            }
          }
          const adversarialInput: PlannerAdversarialInput = {
            intent_draft: taskDescription,
            ...(priorPreventions.length > 0
              ? { prior_preventions: priorPreventions }
              : {}),
          }
          return spawn<unknown, PlannerAdversarialOutput>(
            "planner.adversarial",
            adversarialInput,
            {
              stateRoot,
              inlineStub: (i) =>
                opts.adversarialOverride ?? plannerAdversarial(i as PlannerAdversarialInput),
              logger,
              taskId,
            },
          )
        })(),
      )
    }
    const results = (await Promise.all(tasks)) as {
      output: unknown
    }[]
    plannerEngOut = results[0]!.output as PlannerEngOutput
    plannerCeoOut = results[1]!.output as PlannerCeoOutput
    researcherOut = results[2]!.output as ResearcherHistoryOutput
    if (level === "L3") {
      adversarialOut = results[3]!.output as PlannerAdversarialOutput
      // CE-6 (f7): score-feedback writeback. When planner.adversarial
      // surfaces a prior_prevention via recurrence flag (substring match
      // in early_signal per CE-1 step 5), record the consuming task_id
      // back to the source solution's applied_in array. Iron Law:
      // writeback failure NEVER fails plan — wrapped in try/catch and
      // converted to a plan.applied_failed event.
      if (capturedPriorPreventions.length > 0 && adversarialOut.failure_modes.length > 0) {
        try {
          const refs = extractAppliedSolutionRefs(
            adversarialOut.failure_modes,
            capturedPriorPreventions,
          )
          if (refs.length > 0) {
            const appliedResult = recordApplied(stateRoot, refs, taskId, { logger })
            logger.event({
              task_id: taskId,
              spawn_id: null,
              agent: "plan.applied",
              event_type: "plan.applied_recorded",
              level: "info",
              payload: {
                solution_refs_input: refs,
                updated: appliedResult.updated,
                skipped_already_applied: appliedResult.skipped_already_applied,
                skipped_missing: appliedResult.skipped_missing,
                skipped_malformed: appliedResult.skipped_malformed,
                stale_skipped: appliedResult.stale_skipped,
                write_failed: appliedResult.write_failed,
              },
            })
            if (appliedResult.updated.length > 0) {
              log(
                `applied_in updated: ${appliedResult.updated.length} solution(s) tracked task ${taskId}`,
              )
            }
          }
        } catch (err) {
          const errName = err instanceof Error ? err.name : "unknown"
          const errMsg = err instanceof Error ? err.message : String(err)
          logger.event({
            task_id: taskId,
            spawn_id: null,
            agent: "plan.applied",
            event_type: "plan.applied_failed",
            level: "warn",
            payload: { error_class: errName, error_message: errMsg, reason: "wire_up_throw" },
          })
        }
      }
    }
    log(`planner.eng verdict: ${plannerEngOut.verdict}`)
    if (plannerEngOut.concerns.length > 0) {
      for (const c of plannerEngOut.concerns) log(`  eng concern: ${c}`)
    }
    log(`planner.ceo verdict: ${plannerCeoOut.verdict}`)
    if (plannerCeoOut.concerns.length > 0) {
      for (const c of plannerCeoOut.concerns) log(`  ceo concern: ${c}`)
    }
    if (plannerCeoOut.rewrite_hints.length > 0) {
      for (const h of plannerCeoOut.rewrite_hints) log(`  ceo hint: ${h}`)
    }
    log(
      `researcher.history: ${researcherOut.prior_art.length} prior art entries${
        researcherOut.warnings.length ? `, ${researcherOut.warnings.length} warning(s)` : ""
      }`,
    )
    for (const w of researcherOut.warnings) log(`  research warning: ${w}`)
    if (adversarialOut) {
      log(`planner.adversarial: ${adversarialOut.failure_modes.length} failure mode(s)`)
      for (const fm of adversarialOut.failure_modes) {
        log(`  [${fm.probability}/${fm.impact}] ${fm.scenario}`)
      }
    }
  } else if (LEVEL_RANK[level] >= 1) {
    // L1: eng only
    const planRes = await spawn<unknown, PlannerEngOutput>(
      "planner.eng",
      { intent_draft: taskDescription },
      { stateRoot, inlineStub: (i) => plannerEng(i as { intent_draft: string }), logger, taskId },
    )
    plannerEngOut = planRes.output
    log(`planner.eng verdict: ${plannerEngOut.verdict}`)
    if (plannerEngOut.concerns.length > 0) {
      for (const c of plannerEngOut.concerns) log(`  concern: ${c}`)
    }
  }

  // L3 requires human signature per Invariant §4 + skill rule
  if (level === "L3" && !opts.userSignature) {
    throw new Error(
      `L3 plan requires human signature. Re-run with --signed-by <signer_id> ` +
        `to acknowledge architecture-level scope.`,
    )
  }
  // Invariant §4: L3 refuses --auto. Human must confirm interactively even
  // with --signed-by (D-3.2 gate).
  if (level === "L3" && opts.autoConfirm) {
    throw new Error(
      `L3 plan refuses --auto (Invariant §4). Human confirmation at stdin is required.`,
    )
  }
  if (level === "L3") {
    log("")
    log("=== L3 PLAN SUMMARY — confirm before intent.md is written (immutable) ===")
    log(`  task_id:    ${taskId}`)
    log(`  task:       ${taskDescription.slice(0, 120)}`)
    log(`  classifier: ${classRes.output.rationale}`)
    if (plannerEngOut)
      log(`  eng:        ${plannerEngOut.verdict} (${plannerEngOut.concerns.length} concerns)`)
    if (plannerCeoOut)
      log(`  ceo:        ${plannerCeoOut.verdict} (${plannerCeoOut.concerns.length} concerns)`)
    if (researcherOut)
      log(`  research:   ${researcherOut.prior_art.length} prior art entries`)
    if (adversarialOut)
      log(`  pre-mortem: ${adversarialOut.failure_modes.length} failure mode(s)`)
    log(`  signer:     ${opts.userSignature!.signer_id}`)
    log("")
    log("Type 'yes' to commit intent.md (or Ctrl+C to abort):")
    const reader = opts.readConfirmation ?? defaultReadConfirmation
    const answer = (await reader()).trim().toLowerCase()
    if (answer !== "yes") {
      throw new Error(
        `L3 plan not confirmed at stdin (got '${answer || "(empty)"}'); intent.md NOT written.`,
      )
    }
    log("confirmed — writing intent.md")
  }

  // L0 skips intent.md per sgc-state.schema.yaml:31 — "L0 tasks do NOT write
  // to decisions/ — they skip it entirely". Audit C3 adjacent fix.
  let intentPath = "(skipped — L0)"
  if (level !== "L0") {
    const motivation = opts.motivation ?? taskDescription
    const motivationWords = wordCount(motivation)
    if (motivationWords < 20) {
      throw new Error(
        `motivation must be ≥20 words (sgc-state.schema.yaml min_words rule); ` +
          `got ${motivationWords} word(s). Re-run with ` +
          `--motivation "<longer rationale describing why this matters and what changes>".`,
      )
    }
    const intent: IntentDoc = {
      task_id: taskId,
      level,
      created_at: createdAt,
      title: taskDescription.slice(0, 120),
      motivation,
      affected_readers: classRes.output.affected_readers_candidates,
      scope_tokens: computeCommandTokens("/plan"),
      user_signature: opts.userSignature,
      body:
        `## Classifier rationale\n\n${classRes.output.rationale}\n\n` +
        (plannerEngOut
          ? `## Planner.eng verdict\n\n${plannerEngOut.verdict}\n\n` +
            (plannerEngOut.concerns.length
              ? `### Eng concerns\n\n${plannerEngOut.concerns.map((c) => `- ${c}`).join("\n")}\n\n`
              : "")
          : "") +
        (plannerCeoOut
          ? `## Planner.ceo verdict\n\n${plannerCeoOut.verdict}\n\n` +
            (plannerCeoOut.concerns.length
              ? `### CEO concerns\n\n${plannerCeoOut.concerns.map((c) => `- ${c}`).join("\n")}\n\n`
              : "") +
            (plannerCeoOut.rewrite_hints.length
              ? `### CEO rewrite hints\n\n${plannerCeoOut.rewrite_hints.map((h) => `- ${h}`).join("\n")}\n\n`
              : "")
          : "") +
        (researcherOut
          ? `${PRIOR_ART_SENTINEL_BEGIN}\n` +
            `## Prior art (researcher.history)\n\n` +
            (researcherOut.prior_art.length === 0
              ? `_No prior art found._\n\n`
              : researcherOut.prior_art
                  .map((p) => {
                    const head = `- **${p.solution_ref}** (score ${p.relevance_score.toFixed(2)}): ${p.excerpt}`
                    return p.relevance_reason
                      ? `${head}\n  Reason: ${p.relevance_reason}`
                      : head
                  })
                  .join("\n") + "\n\n") +
            (researcherOut.warnings.length
              ? `### Research warnings\n\n${researcherOut.warnings.map((w) => `- ${w}`).join("\n")}\n\n`
              : "") +
            `${PRIOR_ART_SENTINEL_END}\n\n`
          : "") +
        (adversarialOut
          ? `${PRE_MORTEM_SENTINEL_BEGIN}\n` +
            `## Pre-mortem (planner.adversarial)\n\n` +
            adversarialOut.failure_modes
              .map(
                (fm) =>
                  `### [${fm.probability}/${fm.impact}] ${fm.scenario}\n` +
                  `Early signal: ${fm.early_signal}\n`,
              )
              .join("\n") +
            `\n${PRE_MORTEM_SENTINEL_END}\n`
          : ""),
    }
    intentPath = writeIntent(intent, stateRoot)
    log(`wrote ${intentPath}`)
  } else {
    log(`L0 task: skipping intent.md per schema (decisions/ not written for L0)`)
  }

  // Step 5: write feature-list (single placeholder for L0/L1 MVP)
  writeFeatureList(
    {
      features: [
        {
          id: "f1",
          title: taskDescription.slice(0, 200),
          status: "pending",
        },
      ],
    },
    "Refine this list during `sgc work`. The dispatcher does not infer fine-grained features in MVP.\n",
    stateRoot,
  )

  // Step 6: write current-task
  writeCurrentTask(
    {
      task_id: taskId,
      level,
      active_feature: "f1",
      session_start: createdAt,
      last_activity: createdAt,
    },
    "",
    stateRoot,
  )

  // Write handoff marker so a new session can resume (audit: writeHandoff was
  // exported but never called from commands).
  const handoff: Handoff = {
    from_session: taskId,
    to_session_hint: "sgc work",
    summary: `Plan created for task ${taskId} at level ${level}.`,
    open_questions: [],
  }
  writeHandoff(handoff, `Plan written for task ${taskId}. Level ${level}. Resume via 'sgc work'.\n`, stateRoot)

  log(``)
  log(`Plan complete. Run \`sgc work\` to begin execution.`)

  return { taskId, level, intentPath }
}

// Reserved for future interactive flow (currently unused in non-TTY tests):
export { readLineSync as _readLineSyncForFutureInteractiveFlow }

// Force suppression of unused-import warning for stdin when no interactive flow yet
void existsSync
void readFileSync
