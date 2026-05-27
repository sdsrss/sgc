// `sgc land` — post-publish ship chain orchestrator.
//
// GS-7 (f10) feature. Standalone CLI command; runs after `git push --tags`.
// Chains `watchPublishWorkflow` (CE-3 dispatcher primitive) + `runCanaryChecks`
// (GS-1 dispatcher primitive) as a single fail-fast verification. Stateless:
// underlying primitives write their own capture artifacts on failure
// (.sgc/ship-failures/, .sgc/canaries/); land itself emits only three
// voluntary events.ndjson telemetry entries.

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  captureShipFailure,
  type CaptureResult,
  type ShipFailure,
  type WatchedRun,
  watchPublishWorkflow,
} from "./ship-failure"
import {
  captureCanaryFailure,
  type CanaryFailure,
  type CanaryPhase,
  type CaptureCanaryResult,
  runCanaryChecks,
} from "./canary"
import { createLogger, type Logger } from "./logger"

export type LandStepName = "watch-ci-failure" | "canary"

export interface LandOptions {
  /** Default: read from package.json#name. */
  package?: string
  /** Default: read from package.json#version. */
  version?: string
  /** Default: process.cwd(). Test injection seam. */
  repoRoot?: string
  /** Default: <repoRoot>/.sgc. Test injection seam. */
  stateRoot?: string
  /** Default: createLogger(stateRoot). Test injection seam. */
  logger?: Logger
  /** Default: defaultStepRunners(). Test injection seam. */
  steps?: LandStepRunners
  /** Default: () => new Date(). Test injection seam. */
  now?: () => Date
  /** Default: process.stdout.write.bind(process.stdout). */
  stdoutWrite?: (chunk: string) => void
  /** Default: process.stderr.write.bind(process.stderr). */
  stderrWrite?: (chunk: string) => void
}

export interface LandStepRunners {
  watchCiFailure: (opts: { logger: Logger; stateRoot: string }) => Promise<WatchStepResult>
  canary: (opts: {
    packageName: string
    expectedVersion: string
    logger: Logger
    stateRoot: string
  }) => Promise<CanaryStepResult>
}

export interface WatchStepResult {
  status: "success" | "failure" | "timeout"
  run?: WatchedRun
  captured?: CaptureResult
}

export interface CanaryStepResult {
  status: "success" | "failure" | "timeout"
  failedPhase?: CanaryPhase
  captured?: CaptureCanaryResult
}

export interface LandResult {
  exitCode: 0 | 1
  step: LandStepName | "complete" | "arg-error"
  package?: string
  version?: string
  watchResult?: WatchStepResult
  canaryResult?: CanaryStepResult
  errorMessage?: string
}

export type LandErrorCode =
  | "cannot_derive_package"
  | "cannot_derive_version"

export class LandError extends Error {
  constructor(
    public code: LandErrorCode,
    message: string,
  ) {
    super(message)
    this.name = "LandError"
  }
}

export interface DeriveInputsOpts {
  repoRoot?: string
  package?: string
  version?: string
}

export interface DerivedLandInputs {
  packageName: string
  version: string
}

export async function deriveLandInputs(
  opts: DeriveInputsOpts,
): Promise<DerivedLandInputs> {
  const repoRoot = opts.repoRoot ?? process.cwd()
  let pkgName = opts.package
  let pkgVersion = opts.version

  if (!pkgName || !pkgVersion) {
    let parsed: { name?: string; version?: string } | null = null
    try {
      const raw = await readFile(resolve(repoRoot, "package.json"), "utf8")
      parsed = JSON.parse(raw) as { name?: string; version?: string }
    } catch {
      parsed = null
    }
    if (!pkgName) pkgName = parsed?.name
    if (!pkgVersion) pkgVersion = parsed?.version
  }

  if (!pkgName) {
    throw new LandError(
      "cannot_derive_package",
      `cannot derive package name (no readable package.json at ${repoRoot}; pass --package <name>)`,
    )
  }
  if (!pkgVersion) {
    throw new LandError(
      "cannot_derive_version",
      `cannot derive version (no readable package.json at ${repoRoot}; pass --version <ver>)`,
    )
  }
  return { packageName: pkgName, version: pkgVersion }
}

function emitLandEvent(
  logger: Logger,
  event_type: `${string}.${string}`,
  level: "info" | "warn",
  payload: Record<string, unknown>,
): void {
  logger.event({
    task_id: null,
    spawn_id: null,
    agent: "land",
    event_type,
    level,
    payload,
  })
}

export async function runLand(opts: LandOptions = {}): Promise<LandResult> {
  const repoRoot = opts.repoRoot ?? process.cwd()
  const stateRoot = opts.stateRoot ?? resolve(repoRoot, ".sgc")
  const stdoutWrite = opts.stdoutWrite ?? ((c: string) => { process.stdout.write(c) })
  const stderrWrite = opts.stderrWrite ?? ((c: string) => { process.stderr.write(c) })
  const now = opts.now ?? (() => new Date())
  const logger = opts.logger ?? createLogger({ stateRoot })
  const steps = opts.steps ?? defaultStepRunners()

  let derived: DerivedLandInputs
  try {
    derived = await deriveLandInputs({
      repoRoot,
      package: opts.package,
      version: opts.version,
    })
  } catch (e) {
    if (e instanceof LandError) {
      stderrWrite(`land error: ${e.message}\n`)
      return { exitCode: 1, step: "arg-error", errorMessage: e.message }
    }
    throw e
  }

  const start = now()
  emitLandEvent(logger, "land.start", "info", {
    package: derived.packageName,
    version: derived.version,
  })

  stdoutWrite(`[1/2] watch-ci-failure ...\n`)
  const watchResult = await steps.watchCiFailure({ logger, stateRoot })

  if (watchResult.status !== "success") {
    const capturePath = watchResult.captured?.path
    const detail = capturePath ? `inspect ${capturePath}; ` : ""
    stderrWrite(
      `land failed at watch-ci-failure: ${detail}fix CI; rerun sgc land\n`,
    )
    emitLandEvent(logger, "land.failed", "warn", {
      package: derived.packageName,
      version: derived.version,
      failed_step: "watch-ci-failure",
      capture_path: capturePath ?? null,
    })
    return {
      exitCode: 1,
      step: "watch-ci-failure",
      package: derived.packageName,
      version: derived.version,
      watchResult,
    }
  }

  stdoutWrite(`[2/2] canary ${derived.packageName}@${derived.version} ...\n`)
  const canaryResult = await steps.canary({
    packageName: derived.packageName,
    expectedVersion: derived.version,
    logger,
    stateRoot,
  })

  stdoutWrite(`land complete: ${derived.packageName}@${derived.version}\n`)
  const end = now()
  emitLandEvent(logger, "land.complete", "info", {
    package: derived.packageName,
    version: derived.version,
    duration_ms: end.getTime() - start.getTime(),
  })

  return {
    exitCode: 0,
    step: "complete",
    package: derived.packageName,
    version: derived.version,
    watchResult,
    canaryResult,
  }
}

async function gitOutput(args: string[]): Promise<string | null> {
  const proc = Bun.spawn(["git", ...args], { stdout: "pipe", stderr: "pipe" })
  const [stdout, _stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  if (exitCode !== 0) return null
  const trimmed = stdout.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function defaultStepRunners(): LandStepRunners {
  return {
    async watchCiFailure(_opts): Promise<WatchStepResult> {
      const headSha = await gitOutput(["rev-parse", "HEAD"])
      const tag = await gitOutput(["describe", "--tags", "--abbrev=0"])
      const workflowName = "publish-npm"
      const result = await watchPublishWorkflow({
        expectedSha: headSha ?? undefined,
        workflowName,
      })
      if (result.status === "success" || result.status === "timeout") {
        return { status: result.status, run: result.run }
      }
      if (!result.run) {
        return { status: "failure", run: result.run }
      }
      const failure: ShipFailure = {
        commitSha: result.run.headSha,
        tag,
        workflowName,
        workflowRunId: result.run.id,
        workflowRunUrl: result.run.url,
        summaryExcerpt: result.summaryExcerpt ?? "",
      }
      const captured = await captureShipFailure(failure)
      return { status: "failure", run: result.run, captured }
    },

    async canary(opts): Promise<CanaryStepResult> {
      const commitSha = (await gitOutput(["rev-parse", "HEAD"])) ?? "(unknown)"
      const tag =
        (await gitOutput(["tag", "--points-at", "HEAD"]))?.split("\n")[0] ?? null
      const result = await runCanaryChecks({
        packageName: opts.packageName,
        expectedVersion: opts.expectedVersion,
      })
      if (result.status === "success" || result.status === "timeout") {
        return { status: result.status, failedPhase: result.failedPhase }
      }
      if (!result.failedPhase) {
        return { status: "failure" }
      }
      const failure: CanaryFailure = {
        commitSha,
        tag,
        packageName: opts.packageName,
        expectedVersion: opts.expectedVersion,
        failedPhase: result.failedPhase,
        healthUrl: null,
        phaseOutputs: result.phaseOutputs,
      }
      const captured = await captureCanaryFailure(failure)
      return { status: "failure", failedPhase: result.failedPhase, captured }
    },
  }
}
