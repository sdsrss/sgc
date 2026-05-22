// CE-4 (f5) — async plan job runner.
//
// Spec: tasks/specs/ce-4-async-plan.md.
// Wraps the existing synchronous `runPlan` flow in a detached child
// process so `sgc plan <task> --async` returns a job handle in
// <100ms and the planner cluster runs in the background.
//
// File-based job state at `<stateRoot>/plan-jobs/<job-id>.{md,log,
// done,failed}` — no daemon, no IPC socket. fswatch / inotify can
// hook on the sentinel files; `sgc tail --event-type plan.async*`
// can stream the paired events.

import {
  closeSync,
  existsSync,
  openSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs"
import { mkdir } from "node:fs/promises"
import { spawn as nodeSpawn } from "node:child_process"
import { resolve } from "node:path"
import {
  parseFrontmatter,
  resolveStateRoot,
  serializeFrontmatter,
} from "./state"
import { createLogger, type Logger } from "./logger"

export interface PlanJob {
  job_id: string
  task: string
  started_at: string
  pid: number
  log_path: string
  status: "running" | "done" | "failed" | "stale"
  completed_at?: string
  error?: string
  intent_path?: string
  task_id?: string
  level?: "L0" | "L1" | "L2" | "L3"
}

export type PlanJobErrorCode =
  | "ConcurrentJobActive"
  | "JobNotFound"
  | "MalformedJobFile"

export class PlanJobError extends Error {
  readonly code: PlanJobErrorCode
  readonly detail?: Record<string, unknown>
  constructor(
    code: PlanJobErrorCode,
    message: string,
    detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = "PlanJobError"
    this.code = code
    this.detail = detail
  }
}

export interface ForkOptions {
  stateRoot?: string
  /**
   * Extra environment variables for the child process. Used by the
   * `plan.ts` parent branch to freeze the parent's flag-derived
   * options (motivation / forceLevel / userSignature / etc) into a
   * JSON env var so the child sees the same options the parent had
   * — child argv only carries `[bun, sgc.ts, "plan", task]`, no
   * flag re-serialization.
   */
  extraEnv?: Record<string, string>
  /** Test hook: inject a fake spawn. Production = detached node:child_process. */
  spawnImpl?: (
    argv: string[],
    opts: { logFd: number; env: Record<string, string> },
  ) => { pid: number }
  /** Test hook: clock injection. Production = Date.now. */
  now?: () => number
  /** Test hook: ULID gen injection. Production = crypto.randomUUID() slice. */
  ulid?: () => string
  /** Test hook: liveness probe. Production = process.kill(pid, 0). */
  isAlive?: (pid: number) => boolean
}

export interface ForkResult {
  job: PlanJob
  jobPath: string
}

function generateUlid(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

/**
 * `process.kill(pid, 0)` is the standard POSIX liveness probe — signal
 * 0 has no side effect but throws if the pid is gone. ESRCH → dead.
 * EPERM → exists but we lack permission to signal (treat as alive).
 */
function defaultIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    if (e && typeof e === "object" && "code" in e) {
      const code = (e as { code?: string }).code
      if (code === "ESRCH") return false
    }
    return true
  }
}

/** sgc entry path for the child re-exec. process.argv[1] is the script. */
function getSgcEntry(): string {
  return process.argv[1] ?? ""
}

function defaultSpawnImpl(
  argv: string[],
  opts: { logFd: number; env: Record<string, string> },
): { pid: number } {
  const [cmd, ...rest] = argv
  if (!cmd) throw new Error("forkAsyncPlanJob: argv[0] missing")
  const proc = nodeSpawn(cmd, rest, {
    stdio: ["ignore", opts.logFd, opts.logFd],
    detached: true,
    env: opts.env,
  })
  // Release the parent's handle on the child so parent can exit while
  // the child keeps running (this is the "detached" semantic — without
  // unref, the parent stays alive until the child exits).
  proc.unref()
  return { pid: proc.pid ?? -1 }
}

function jobsDir(stateRoot: string | undefined): string {
  return resolve(resolveStateRoot(stateRoot), "plan-jobs")
}
function jobPath(stateRoot: string | undefined, jobId: string): string {
  return resolve(jobsDir(stateRoot), `${jobId}.md`)
}
function logPathFor(stateRoot: string | undefined, jobId: string): string {
  return resolve(jobsDir(stateRoot), `${jobId}.log`)
}
function doneSentinel(stateRoot: string | undefined, jobId: string): string {
  return resolve(jobsDir(stateRoot), `${jobId}.done`)
}
function failedSentinel(
  stateRoot: string | undefined,
  jobId: string,
): string {
  return resolve(jobsDir(stateRoot), `${jobId}.failed`)
}

function readJob(path: string): PlanJob {
  const text = readFileSync(path, "utf8")
  const { data } = parseFrontmatter<PlanJob>(text)
  return data
}

function writeJob(path: string, job: PlanJob): void {
  const content = serializeFrontmatter(
    job as unknown as Record<string, unknown>,
    "",
  )
  writeFileSync(path, content, "utf8")
}

/** Raw listing — no stale probe. Used internally to avoid recursion
 * when the probe itself writes to disk. */
function listJobsRaw(stateRoot: string | undefined): PlanJob[] {
  const dir = jobsDir(stateRoot)
  if (!existsSync(dir)) return []
  const out: PlanJob[] = []
  for (const fn of readdirSync(dir)) {
    if (!fn.endsWith(".md")) continue
    try {
      out.push(readJob(resolve(dir, fn)))
    } catch {
      // Malformed frontmatter — skip silently in listing.
    }
  }
  return out
}

/**
 * Lazy stale-detect: a job with `status:running` whose pid is dead
 * (per the liveness probe) gets mutated to `status:stale` on disk
 * before being returned. This eliminates the "zombie running"
 * footgun without a periodic cleanup process.
 */
function applyStaleProbe(
  job: PlanJob,
  stateRoot: string | undefined,
  isAlive: (pid: number) => boolean,
): PlanJob {
  if (job.status !== "running") return job
  if (isAlive(job.pid)) return job
  const updated: PlanJob = { ...job, status: "stale" }
  writeJob(jobPath(stateRoot, job.job_id), updated)
  return updated
}

export async function forkAsyncPlanJob(
  task: string,
  opts: ForkOptions = {},
): Promise<ForkResult> {
  const stateRoot = opts.stateRoot
  const now = opts.now ?? Date.now
  const ulid = opts.ulid ?? generateUlid
  const isAlive = opts.isAlive ?? defaultIsAlive
  const spawnImpl = opts.spawnImpl ?? defaultSpawnImpl

  await mkdir(jobsDir(stateRoot), { recursive: true })

  // Concurrency guard: scan prior jobs; refuse if any running+alive.
  // Mark stale and continue otherwise (clears the lock).
  for (const prior of listJobsRaw(stateRoot)) {
    if (prior.status === "running") {
      if (isAlive(prior.pid)) {
        throw new PlanJobError(
          "ConcurrentJobActive",
          `another plan job is running (job_id=${prior.job_id}, pid=${prior.pid}). Tail with: sgc plan --status ${prior.job_id}`,
          { active_job_id: prior.job_id, active_pid: prior.pid },
        )
      }
      writeJob(jobPath(stateRoot, prior.job_id), {
        ...prior,
        status: "stale",
      })
    }
  }

  const job_id = ulid()
  const log_path = logPathFor(stateRoot, job_id)
  const job_path = jobPath(stateRoot, job_id)

  // Open log fd (append-mode). Child inherits via spawnImpl; parent
  // closes its end after spawn so only the child writes to it.
  const logFd = openSync(log_path, "a", 0o644)

  // Build child env. Carry through everything so SGC_FORCE_INLINE /
  // ANTHROPIC_API_KEY / etc reach the child unmodified.
  const env: Record<string, string> = {}
  for (const k of Object.keys(process.env)) {
    const v = process.env[k]
    if (v !== undefined) env[k] = v
  }
  env["SGC_PLAN_ASYNC_CHILD"] = job_id
  // Pin SGC_STATE_ROOT so the child writes its job file to the same
  // place the parent registered. Without this, an unset child env
  // would fall back to `.sgc` relative to child cwd.
  env["SGC_STATE_ROOT"] = resolveStateRoot(stateRoot)
  // Caller-supplied extras (e.g. parent-frozen PlanOptions JSON) win
  // over the auto-derived env so a test can override SGC_STATE_ROOT
  // if it ever needs to.
  if (opts.extraEnv) {
    for (const [k, v] of Object.entries(opts.extraEnv)) env[k] = v
  }

  const argv = [process.execPath, getSgcEntry(), "plan", task]

  try {
    const { pid } = spawnImpl(argv, { logFd, env })
    const job: PlanJob = {
      job_id,
      task,
      started_at: new Date(now()).toISOString(),
      pid,
      log_path,
      status: "running",
    }
    writeJob(job_path, job)
    return { job, jobPath: job_path }
  } finally {
    // Parent's fd duplicate; the child inherits its own. Close ours so
    // the OS reaps when the child exits.
    try {
      closeSync(logFd)
    } catch {
      // Ignore — child may have already closed if spawn failed.
    }
  }
}

export async function listJobs(
  opts: { stateRoot?: string; isAlive?: (pid: number) => boolean } = {},
): Promise<PlanJob[]> {
  const isAlive = opts.isAlive ?? defaultIsAlive
  const raw = listJobsRaw(opts.stateRoot)
  const probed = raw.map((j) => applyStaleProbe(j, opts.stateRoot, isAlive))
  // Sort by started_at descending (newest first).
  probed.sort((a, b) => b.started_at.localeCompare(a.started_at))
  return probed
}

export async function showJob(
  jobId: string,
  opts: {
    stateRoot?: string
    isAlive?: (pid: number) => boolean
    logTailLines?: number
  } = {},
): Promise<{ job: PlanJob; logTail: string }> {
  const path = jobPath(opts.stateRoot, jobId)
  if (!existsSync(path)) {
    throw new PlanJobError(
      "JobNotFound",
      `plan-jobs/${jobId}.md not found under ${resolveStateRoot(opts.stateRoot)}`,
      { job_id: jobId },
    )
  }
  const raw = readJob(path)
  const isAlive = opts.isAlive ?? defaultIsAlive
  const job = applyStaleProbe(raw, opts.stateRoot, isAlive)
  let logTail = ""
  if (existsSync(job.log_path)) {
    const text = readFileSync(job.log_path, "utf8")
    const lines = text.split("\n")
    // Drop trailing empty produced by final newline so a 250-line
    // file → 250 entries (not 251).
    if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop()
    const n = opts.logTailLines ?? 100
    logTail =
      lines.length === 0 ? "" : lines.slice(-n).join("\n") + "\n"
  }
  return { job, logTail }
}

export async function completePlanJob(
  jobId: string,
  completion: { taskId?: string; level?: string; intentPath?: string },
  opts: { stateRoot?: string; now?: () => number; logger?: Logger } = {},
): Promise<void> {
  const path = jobPath(opts.stateRoot, jobId)
  if (!existsSync(path)) {
    throw new PlanJobError("JobNotFound", `plan-jobs/${jobId}.md not found`)
  }
  const job = readJob(path)
  const now = opts.now ?? Date.now
  const updated: PlanJob = {
    ...job,
    status: "done",
    completed_at: new Date(now()).toISOString(),
  }
  if (completion.taskId) updated.task_id = completion.taskId
  if (completion.level) updated.level = completion.level as PlanJob["level"]
  if (completion.intentPath) updated.intent_path = completion.intentPath
  writeJob(path, updated)
  writeFileSync(doneSentinel(opts.stateRoot, jobId), "", "utf8")
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot })
  logger.event({
    task_id: completion.taskId ?? null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_complete",
    level: "info",
    payload: {
      job_id: jobId,
      task_id: completion.taskId ?? null,
      level: completion.level ?? null,
      intent_path: completion.intentPath ?? null,
    },
  })
}

export async function failPlanJob(
  jobId: string,
  error: string,
  opts: { stateRoot?: string; now?: () => number; logger?: Logger } = {},
): Promise<void> {
  const path = jobPath(opts.stateRoot, jobId)
  if (!existsSync(path)) {
    throw new PlanJobError("JobNotFound", `plan-jobs/${jobId}.md not found`)
  }
  const job = readJob(path)
  const now = opts.now ?? Date.now
  const updated: PlanJob = {
    ...job,
    status: "failed",
    completed_at: new Date(now()).toISOString(),
    error,
  }
  writeJob(path, updated)
  writeFileSync(failedSentinel(opts.stateRoot, jobId), "", "utf8")
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot })
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_failed",
    level: "error",
    payload: { job_id: jobId, error },
  })
}

/**
 * Emit the parent-side `plan.async_start` event right before
 * forking. Separate from forkAsyncPlanJob so callers can use a
 * shared logger that's already wired with their event sink.
 */
export function emitAsyncStart(
  jobId: string,
  task: string,
  logger: Logger,
  payload: Record<string, unknown> = {},
): void {
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "sgc.plan-async",
    event_type: "plan.async_start",
    level: "info",
    payload: { job_id: jobId, task, ...payload },
  })
}
