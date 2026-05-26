// `sgc canary` — post-publish health check.
//
// GS-1 (f8) feature. Standalone CLI; runs after `git push --tags` (and
// optionally after CE-3 `sgc watch-ci-failure` confirms publish.yml
// green). Dispatcher logic lives at src/dispatcher/canary.ts; this file
// is only argument shaping + git-side derivation + stderr UX.
//
// Exit codes (distinct from CE-3):
//   success → 0
//   timeout → 0  (PARTIAL — npm not yet propagated)
//   failure → 1  (gating signal — operator may chain `sgc canary && ...`)

import { readFile } from "node:fs/promises"
import { resolve } from "node:path"
import {
  type CanaryFailure,
  type CanaryPhase,
  captureCanaryFailure,
  DEFAULT_PHASES,
  runCanaryChecks,
} from "../dispatcher/canary"

export interface CanaryCliOptions {
  packageName?: string
  expectedVersion?: string
  phases?: CanaryPhase[]
  healthUrl?: string
  healthRegex?: string
  binName?: string
  intervalSec?: number
  timeoutSec?: number
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

async function readPackageJson(): Promise<{ name?: string; version?: string } | null> {
  try {
    const raw = await readFile(resolve(process.cwd(), "package.json"), "utf8")
    return JSON.parse(raw) as { name?: string; version?: string }
  } catch {
    return null
  }
}

export const VALID_PHASES: CanaryPhase[] = [
  "npm_propagation",
  "smoke_install",
  "health_url",
]

export function parsePhases(csv: string | undefined): CanaryPhase[] {
  if (!csv) return DEFAULT_PHASES
  const tokens = csv
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  const invalid = tokens.filter((t) => !VALID_PHASES.includes(t as CanaryPhase))
  if (invalid.length > 0) {
    throw new Error(
      `unknown canary phase(s): ${invalid.join(", ")}; valid: ${VALID_PHASES.join(", ")}`,
    )
  }
  return tokens as CanaryPhase[]
}

export async function runCanary(opts: CanaryCliOptions = {}): Promise<void> {
  const pkgJson = await readPackageJson()
  const packageName = opts.packageName ?? pkgJson?.name
  if (!packageName) {
    console.error(
      "sgc canary: cannot resolve package name — pass --package <name> or run from a directory with package.json",
    )
    process.exitCode = 2
    return
  }
  const tagFromGit = await gitOutput(["describe", "--tags", "--exact-match", "HEAD"])
  const expectedVersion = opts.expectedVersion ?? pkgJson?.version ?? tagFromGit?.replace(/^v/, "")
  if (!expectedVersion) {
    console.error(
      "sgc canary: cannot resolve expected version — pass --version <ver>, run from a directory with package.json, or tag HEAD",
    )
    process.exitCode = 2
    return
  }

  const commitSha = (await gitOutput(["rev-parse", "HEAD"])) ?? "(unknown)"
  const tag = (await gitOutput(["tag", "--points-at", "HEAD"]))?.split("\n")[0] ?? null

  const phases = opts.phases ?? DEFAULT_PHASES

  const result = await runCanaryChecks({
    packageName,
    expectedVersion,
    phases,
    healthUrl: opts.healthUrl,
    healthRegex: opts.healthRegex,
    binName: opts.binName,
    intervalSec: opts.intervalSec,
    timeoutSec: opts.timeoutSec,
  })

  if (result.status === "success") {
    console.error(`canary green for ${packageName}@${expectedVersion}; no capture.`)
    return
  }

  if (result.status === "timeout") {
    const t = opts.timeoutSec ?? "default"
    console.error(
      `[PARTIAL: canary timed out after ${t}s; ${packageName}@${expectedVersion} not yet propagated to npm; no capture written]`,
    )
    return
  }

  // status === "failure"
  if (!result.failedPhase) {
    console.error(`[PARTIAL: failure detected but no failedPhase recorded; no capture written]`)
    process.exitCode = 1
    return
  }
  const failure: CanaryFailure = {
    commitSha,
    tag,
    packageName,
    expectedVersion,
    failedPhase: result.failedPhase,
    healthUrl: opts.healthUrl ?? null,
    phaseOutputs: result.phaseOutputs,
  }
  const captured = await captureCanaryFailure(failure)
  if (captured.action === "captured") {
    console.error(
      `canary failure: phase ${result.failedPhase} for ${packageName}@${expectedVersion}; captured: ${captured.path}`,
    )
  } else {
    console.error(
      `canary failure: phase ${result.failedPhase} for ${packageName}@${expectedVersion}; deduped: ${captured.path} (same (sha, phase) already recorded)`,
    )
  }
  process.exitCode = 1
}
