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

export async function runLand(_opts: LandOptions = {}): Promise<LandResult> {
  throw new Error("not implemented")
}

export function defaultStepRunners(): LandStepRunners {
  throw new Error("not implemented")
}
