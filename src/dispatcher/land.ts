// `sgc land` — post-publish ship chain orchestrator.
//
// GS-7 (f10) feature. Standalone CLI command; runs after `git push --tags`.
// Chains `watchPublishWorkflow` (CE-3 dispatcher primitive) + `runCanaryChecks`
// (GS-1 dispatcher primitive) as a single fail-fast verification. Stateless:
// underlying primitives write their own capture artifacts on failure
// (.sgc/ship-failures/, .sgc/canaries/); land itself emits only three
// voluntary events.ndjson telemetry entries.

import type { CaptureResult, WatchedRun } from "./ship-failure"
import type { CanaryPhase, CaptureCanaryResult } from "./canary"
import type { Logger } from "./logger"

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

export async function runLand(_opts: LandOptions = {}): Promise<LandResult> {
  throw new Error("not implemented")
}

export function defaultStepRunners(): LandStepRunners {
  throw new Error("not implemented")
}
