// CE-5 (f6) — sgc loop end-to-end orchestrator.
//
// Spec: tasks/specs/ce-5-loop-orchestrator.md.
// Chains the 6-step task workflow plan → [pause work] → review →
// [pause qa] → [pause ship] → compound, with checkpoint state at
// <stateRoot>/loop-runs/<run-id>.md. Sync (no subprocess fork);
// failure halts + writes state; --resume continues from checkpoint.
//
// `reflect` is NOT in the chain (post-hoc audit, not per-task).

import { existsSync, readdirSync, readFileSync } from "node:fs"
import { mkdir } from "node:fs/promises"
import { resolve } from "node:path"
import {
  intentPath,
  parseFrontmatter,
  readCurrentTask,
  resolveStateRoot,
  serializeFrontmatter,
  writeAtomic,
} from "./state"
import { acquireFileLock, LockHeldError } from "./file-lock"

export type LoopStepName =
  | "plan"
  | "work"
  | "review"
  | "qa"
  | "ship"
  | "compound"

export type StepStatus =
  | "pending"
  | "in_progress"
  | "paused"
  | "done"
  | "failed"
  | "skipped"

export type RunStatus = "running" | "paused" | "failed" | "complete"

export const STEPS: readonly LoopStepName[] = [
  "plan",
  "work",
  "review",
  "qa",
  "ship",
  "compound",
] as const

/**
 * The two steps that v0 of the loop intentionally pauses on. `work` is
 * the operator implementing code (no LLM/agent belongs there); `ship`
 * is the human-signed release gate (Invariant §4 at L3). Both write
 * `status:paused` + exit so the operator can act; `--resume` marks
 * paused → done before continuing.
 */
// Manual gates pause the chain for operator input. `qa` joins work + ship
// because a real QA needs an operator-supplied target URL — the orchestrator
// has none to pass. Auto-running qa with no target produced an immutable
// (Invariant §6) verdict=fail report that both blocked ship (Invariant §5) and
// could not be re-run with a real target, leaving loop-driven L2/L3 tasks
// unshippable. Pausing lets the operator run `sgc qa <url> --flows ...`.
export const MANUAL_GATES = new Set<LoopStepName>(["work", "qa", "ship"])

export interface LoopStepEntry {
  step: LoopStepName
  status: StepStatus
  started_at?: string
  completed_at?: string
  output_ref?: string
  error?: string
}

export interface LoopRun {
  run_id: string
  task: string
  started_at: string
  last_updated_at: string
  task_id?: string
  level?: "L0" | "L1" | "L2" | "L3"
  current_step: LoopStepName | "done"
  status: RunStatus
  failed_step?: LoopStepName
  error?: string
  steps: LoopStepEntry[]
}

export type LoopErrorCode =
  | "RunNotFound"
  | "ConcurrentRunActive"
  | "MalformedRunFile"

export class LoopError extends Error {
  readonly code: LoopErrorCode
  readonly detail?: Record<string, unknown>
  constructor(
    code: LoopErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "LoopError"
    this.code = code
    this.detail = detail
  }
}

export interface StepRunners {
  plan?: (
    state: LoopRun,
    opts: LoopOptions,
  ) => Promise<{ task_id: string; level: string; intent_path: string }>
  review?: (state: LoopRun, opts: LoopOptions) => Promise<void>
  qa?: (state: LoopRun, opts: LoopOptions) => Promise<void>
  compound?: (state: LoopRun, opts: LoopOptions) => Promise<void>
}

export interface LoopOptions {
  stateRoot?: string
  /** Run id to resume; when set, `task` arg to runLoop must be null. */
  resume?: string
  /** Injectable step runners; default uses production runX functions. */
  steps?: StepRunners
  /** Test hooks. */
  now?: () => number
  ulid?: () => string
  /** Pass-through to plan. */
  motivation?: string
  userSignature?: { signed_at: string; signer_id: string }
  forceLevel?: "L0" | "L1" | "L2" | "L3"
}

export interface LoopResult {
  run: LoopRun
  terminal_reason:
    | "complete"
    | "paused_work"
    | "paused_qa"
    | "paused_ship"
    | "failed"
}

function generateUlid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function loopRunsDir(stateRoot: string | undefined): string {
  return resolve(resolveStateRoot(stateRoot), "loop-runs")
}
function runPath(stateRoot: string | undefined, runId: string): string {
  return resolve(loopRunsDir(stateRoot), `${runId}.md`)
}
// STAB-1: serializes the fresh-run [scan → writeRun] claim so two concurrent
// `sgc loop <task>` invocations cannot both pass the same-task active-run scan
// and both create a run.
function loopClaimLockPath(stateRoot: string | undefined): string {
  return resolve(loopRunsDir(stateRoot), ".claim.lock")
}

function readRun(path: string): LoopRun {
  const text = readFileSync(path, "utf8")
  try {
    const { data } = parseFrontmatter<LoopRun>(text)
    return data
  } catch (err) {
    throw new LoopError(
      "MalformedRunFile",
      `failed to parse ${path}: ${String(err)}`,
    )
  }
}

function writeRun(path: string, run: LoopRun): void {
  const content = serializeFrontmatter(
    run as unknown as Record<string, unknown>,
    "",
  )
  // STAB-5: atomic write — `--resume` re-reads this checkpoint; a torn write
  // (interrupted mid-serialize) would surface as MalformedRunFile.
  writeAtomic(path, content)
}

function freshSteps(): LoopStepEntry[] {
  return STEPS.map((step) => ({ step, status: "pending" as StepStatus }))
}

function findStep(run: LoopRun, name: LoopStepName): LoopStepEntry {
  const entry = run.steps.find((s) => s.step === name)
  if (!entry) {
    throw new LoopError(
      "MalformedRunFile",
      `run ${run.run_id} missing step entry for "${name}"`,
    )
  }
  return entry
}

/** Compute run-level status from the step states. */
function deriveRunStatus(steps: LoopStepEntry[]): RunStatus {
  if (steps.some((s) => s.status === "failed")) return "failed"
  if (steps.some((s) => s.status === "paused")) return "paused"
  if (steps.every((s) => s.status === "done" || s.status === "skipped")) {
    return "complete"
  }
  return "running"
}

/** First non-terminal step name (or "done" if everything's terminal). */
function deriveCurrentStep(steps: LoopStepEntry[]): LoopStepName | "done" {
  for (const s of steps) {
    if (s.status !== "done" && s.status !== "skipped") return s.step
  }
  return "done"
}

/**
 * Default step runners — production wiring. Lazy-imports the command
 * modules to keep loop.ts test-friendly (tests inject `opts.steps`
 * without forcing the full plan/review/qa/compound import graph).
 */
async function getDefaultRunners(): Promise<Required<StepRunners>> {
  const { runPlan } = await import("../commands/plan")
  const { runReview } = await import("../commands/review")
  const { runQa } = await import("../commands/qa")
  const { runCompound } = await import("../commands/compound")
  return {
    plan: async (state, opts) => {
      try {
        const r = await runPlan(state.task, {
          stateRoot: opts.stateRoot,
          motivation: opts.motivation,
          userSignature: opts.userSignature,
          forceLevel: opts.forceLevel,
        })
        return {
          task_id: r.taskId,
          // The loop never forks async, so runPlan always returns a real level
          // here (the optional level is only absent on the async-parent path).
          level: r.level!,
          intent_path: r.intentPath,
        }
      } catch (e) {
        // runPlan refuses when a task is already active (the operator ran
        // `sgc plan` manually before `sgc loop`, or a prior loop attempt
        // planned). Without adoption the loop's plan step dead-ends: `--resume`
        // retries plan and hits the same guard forever. Adopt the active task
        // instead so `discover → plan → loop` and a retried loop both proceed.
        // Only intercept the active-task refusal — other plan failures (LLM
        // errors, schema gates) still propagate. The loop pauses at the work
        // gate next, so the operator sees the adopted task_id and can abort.
        const msg = e instanceof Error ? e.message : String(e)
        const existing = /active task/i.test(msg) ? readCurrentTask(opts.stateRoot) : null
        if (!existing) throw e
        const t = existing.task
        console.error(
          `loop: adopting active task ${t.task_id} (level ${t.level}) — already planned, not re-planning`,
        )
        return {
          task_id: t.task_id,
          level: String(t.level),
          intent_path:
            t.level === "L0"
              ? "(L0 — no intent.md)"
              : intentPath(t.task_id, opts.stateRoot),
        }
      }
    },
    review: async (_state, opts) => {
      await runReview({ stateRoot: opts.stateRoot })
    },
    qa: async (_state, opts) => {
      await runQa({ stateRoot: opts.stateRoot })
    },
    compound: async (_state, opts) => {
      await runCompound({ stateRoot: opts.stateRoot })
    },
  }
}

export async function runLoop(
  task: string | null,
  opts: LoopOptions,
): Promise<LoopResult> {
  const stateRoot = opts.stateRoot
  const now = opts.now ?? Date.now
  const ulid = opts.ulid ?? generateUlid
  await mkdir(loopRunsDir(stateRoot), { recursive: true })

  let run: LoopRun
  let runFilePath: string

  if (opts.resume) {
    runFilePath = runPath(stateRoot, opts.resume)
    if (!existsSync(runFilePath)) {
      throw new LoopError(
        "RunNotFound",
        `loop-runs/${opts.resume}.md does not exist under ${resolveStateRoot(stateRoot)}`,
        { run_id: opts.resume },
      )
    }
    run = readRun(runFilePath)
  } else {
    if (!task) {
      throw new LoopError(
        "RunNotFound",
        "task arg required for fresh runLoop (or pass opts.resume)",
      )
    }
    // STAB-1: lock the entire check-and-claim so a concurrent invocation
    // cannot pass the scan before this one writes its run file.
    let releaseClaimLock: () => void
    try {
      releaseClaimLock = acquireFileLock(loopClaimLockPath(stateRoot))
    } catch (err) {
      if (err instanceof LockHeldError) {
        throw new LoopError(
          "ConcurrentRunActive",
          `another loop start is in progress (holder pid=${err.holderPid}). Retry once it completes.`,
          { active_pid: err.holderPid },
        )
      }
      throw err
    }
    try {
      // Concurrency guard: ANY non-terminal run blocks a fresh start — not just
      // a same-task one. Only one loop (one active task) can be in flight, and
      // the plan step now ADOPTS the active task, so a fresh loop for a
      // DIFFERENT task would otherwise silently adopt the in-flight task (wrong
      // task). Same task → resume; different task → finish/abandon it first.
      for (const prior of listRunsRaw(stateRoot)) {
        if (
          prior.status === "running" ||
          prior.status === "paused" ||
          prior.status === "failed"
        ) {
          const sameTask = prior.task === task
          const detail = sameTask
            ? `another loop run for task "${task}" is ${prior.status} (run_id=${prior.run_id}). Continue with: sgc loop --resume ${prior.run_id} (or delete the run file to start over).`
            : `a different loop run is ${prior.status} (run_id=${prior.run_id}, task="${prior.task}"). Finish it with: sgc loop --resume ${prior.run_id} (or delete the run file) before starting a new loop.`
          throw new LoopError("ConcurrentRunActive", detail, {
            active_run_id: prior.run_id,
            active_status: prior.status,
          })
        }
      }
      const run_id = ulid()
      const startedIso = new Date(now()).toISOString()
      run = {
        run_id,
        task,
        started_at: startedIso,
        last_updated_at: startedIso,
        current_step: "plan",
        status: "running",
        steps: freshSteps(),
      }
      runFilePath = runPath(stateRoot, run_id)
      writeRun(runFilePath, run)
    } finally {
      releaseClaimLock()
    }
  }

  // Resolve step runners — opts overrides win; defaults fill the rest.
  const overrides = opts.steps ?? {}
  let runners: Required<StepRunners>
  if (overrides.plan && overrides.review && overrides.qa && overrides.compound) {
    // All four supplied — skip the lazy default import entirely.
    runners = overrides as Required<StepRunners>
  } else {
    const defaults = await getDefaultRunners()
    runners = {
      plan: overrides.plan ?? defaults.plan,
      review: overrides.review ?? defaults.review,
      qa: overrides.qa ?? defaults.qa,
      compound: overrides.compound ?? defaults.compound,
    }
  }

  // Drive the chain.
  for (const stepName of STEPS) {
    const entry = findStep(run, stepName)

    // Skip terminal-done steps without touching the runner.
    if (entry.status === "done" || entry.status === "skipped") continue

    // --resume case: a paused manual gate from a prior invocation
    // means the operator has come back ready to proceed. Mark done
    // and fall through to the next step.
    if (entry.status === "paused") {
      entry.status = "done"
      entry.completed_at = new Date(now()).toISOString()
      run.last_updated_at = entry.completed_at
      writeRun(runFilePath, run)
      continue
    }

    // Manual gate (work / ship): pause + exit on first arrival.
    if (MANUAL_GATES.has(stepName)) {
      entry.status = "paused"
      entry.started_at = new Date(now()).toISOString()
      run.current_step = stepName
      run.status = "paused"
      run.last_updated_at = entry.started_at
      // Clear any prior failure crumbs (we resumed past them).
      delete run.failed_step
      delete run.error
      writeRun(runFilePath, run)
      const pauseReason =
        stepName === "work"
          ? "paused_work"
          : stepName === "qa"
            ? "paused_qa"
            : "paused_ship"
      return { run, terminal_reason: pauseReason }
    }

    // Auto step: run via injected runner; catch + mark failed.
    entry.status = "in_progress"
    entry.started_at = new Date(now()).toISOString()
    run.current_step = stepName
    run.status = "running"
    // We don't persist transient "running" / "in_progress" — only
    // write at terminal points (done / failed / paused).
    try {
      if (stepName === "plan") {
        const out = await runners.plan(run, opts)
        run.task_id = out.task_id
        run.level = out.level as LoopRun["level"]
        entry.output_ref = out.task_id
        // L0 carve-out: trivial tasks (typo / format / config) skip
        // the review/qa/ship/compound chain. L0 plans don't write
        // intent.md so runReview would crash; review/qa/compound have
        // nothing meaningful to do for a typo. work-step pause stays
        // (operator still needs to apply the L0 change).
        if (run.level === "L0") {
          for (const skipName of ["review", "qa", "ship", "compound"] as const) {
            const skipEntry = findStep(run, skipName)
            if (skipEntry.status === "pending") {
              skipEntry.status = "skipped"
              skipEntry.completed_at = new Date(now()).toISOString()
            }
          }
        }
      } else if (stepName === "review") {
        await runners.review(run, opts)
      } else if (stepName === "qa") {
        await runners.qa(run, opts)
      } else if (stepName === "compound") {
        await runners.compound(run, opts)
      }
      entry.status = "done"
      entry.completed_at = new Date(now()).toISOString()
      delete entry.error
      run.last_updated_at = entry.completed_at
      // Clear prior failure crumbs (success after retry).
      delete run.failed_step
      delete run.error
      writeRun(runFilePath, run)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      entry.status = "failed"
      entry.error = msg
      entry.completed_at = new Date(now()).toISOString()
      run.status = "failed"
      run.failed_step = stepName
      run.error = msg
      run.last_updated_at = entry.completed_at
      run.current_step = stepName
      writeRun(runFilePath, run)
      return { run, terminal_reason: "failed" }
    }
  }

  // All steps in done/skipped → complete.
  run.status = "complete"
  run.current_step = "done"
  run.last_updated_at = new Date(now()).toISOString()
  delete run.failed_step
  delete run.error
  writeRun(runFilePath, run)
  return { run, terminal_reason: "complete" }
}

function listRunsRaw(stateRoot: string | undefined): LoopRun[] {
  const dir = loopRunsDir(stateRoot)
  if (!existsSync(dir)) return []
  const out: LoopRun[] = []
  for (const fn of readdirSync(dir)) {
    if (!fn.endsWith(".md")) continue
    try {
      out.push(readRun(resolve(dir, fn)))
    } catch {
      // Malformed; skip silently in listing.
    }
  }
  return out
}

export async function listLoopRuns(
  opts: { stateRoot?: string } = {},
): Promise<LoopRun[]> {
  const out = listRunsRaw(opts.stateRoot)
  out.sort((a, b) => b.started_at.localeCompare(a.started_at))
  return out
}

export async function showLoopRun(
  runId: string,
  opts: { stateRoot?: string } = {},
): Promise<LoopRun> {
  const path = runPath(opts.stateRoot, runId)
  if (!existsSync(path)) {
    throw new LoopError(
      "RunNotFound",
      `loop-runs/${runId}.md not found under ${resolveStateRoot(opts.stateRoot)}`,
      { run_id: runId },
    )
  }
  return readRun(path)
}
