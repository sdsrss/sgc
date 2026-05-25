// GS-1 (f8): `sgc canary` post-publish health check.
//
// Pure-logic module — no CLI flag parsing. The CLI run handler at
// src/commands/canary.ts owns argument shaping; this module owns the
// three-phase check ladder + templated capture writer.
//
// Spec: tasks/specs/gs-1-canary.md (status: draft, r1).
// Heuristic-only: no LLM call, no agent spawn, no events emitted in v0.
// Sibling to CE-3 `watch-ci-failure` — same shape (watch + capture),
// different domain (post-publish reality, not CI process).
//
// Reuses CE-1/CE-2/CE-3 patterns:
//   - resolveStateRoot + serializeFrontmatter (state.ts)
//   - Bun.spawn shell-out                     (ship-failure.ts pattern)
//   - dedup-by-filesystem-stat                (CE-3 ship-failures/)

import { mkdir, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { resolveStateRoot, serializeFrontmatter } from "./state"

export type CanaryPhase = "npm_propagation" | "smoke_install" | "health_url"

export interface CanaryOptions {
  packageName: string
  expectedVersion: string
  /** Default: ["npm_propagation", "smoke_install"]. */
  phases?: CanaryPhase[]
  /** Required when phases includes "health_url". */
  healthUrl?: string
  /** Optional body regex; on a 2xx response, body must match. */
  healthRegex?: string
  /** Polling interval seconds; clamped to [MIN_INTERVAL_SEC, MAX_INTERVAL_SEC]. */
  intervalSec?: number
  /** Total timeout seconds for npm_propagation; clamped to [MIN, MAX]. */
  timeoutSec?: number
  /** Test hook: inject a fake `npm view <pkg> dist-tags.latest --json`. */
  npmView?: (pkg: string) => Promise<string>
  /** Test hook: inject a fake `npx --yes <pkg>@<ver> --version`. */
  npxSmoke?: (
    pkg: string,
    ver: string,
  ) => Promise<{ exitCode: number; stdout: string; stderr: string }>
  /** Test hook: inject a fake `fetch` for the health-url phase. */
  httpFetch?: (url: string) => Promise<{ status: number; body: string }>
  /** Test hook: inject a fake clock (returns ms). Production = Date.now. */
  now?: () => number
  /** Test hook: inject a fake sleep. Production = setTimeout-based. */
  sleep?: (ms: number) => Promise<void>
}

export interface CanaryResult {
  status: "success" | "failure" | "timeout"
  failedPhase?: CanaryPhase
  phaseOutputs: Partial<Record<CanaryPhase, string>>
}

export interface CanaryFailure {
  commitSha: string
  tag: string | null
  packageName: string
  expectedVersion: string
  failedPhase: CanaryPhase
  healthUrl: string | null
  phaseOutputs: Partial<Record<CanaryPhase, string>>
}

export interface CaptureCanaryResult {
  action: "captured" | "deduped"
  path: string
}

export const DEFAULT_INTERVAL_SEC = 15
export const DEFAULT_TIMEOUT_SEC = 300
export const MIN_INTERVAL_SEC = 5
export const MAX_INTERVAL_SEC = 60
export const MIN_TIMEOUT_SEC = 60
export const MAX_TIMEOUT_SEC = 1800
export const PHASE_OUTPUT_MAX_CHARS = 2000
export const TRUNCATION_SENTINEL = "..."
export const DEFAULT_PHASES: CanaryPhase[] = ["npm_propagation", "smoke_install"]
export const HEALTH_RETRY_COUNT = 3
export const HEALTH_RETRY_INTERVAL_SEC = 5
export const HEALTH_FETCH_TIMEOUT_MS = 10_000

export class UnsafeUrlScheme extends Error {
  constructor(url: string) {
    super(`UnsafeUrlScheme: ${url} (only http:// and https:// allowed)`)
    this.name = "UnsafeUrlScheme"
  }
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

function todayUtcDate(now: () => number): string {
  return new Date(now()).toISOString().slice(0, 10)
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) + TRUNCATION_SENTINEL : s
}

function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url)
    return u.protocol === "http:" || u.protocol === "https:"
  } catch {
    return false
  }
}

async function defaultNpmView(pkg: string): Promise<string> {
  const proc = Bun.spawn(
    ["npm", "view", pkg, "dist-tags.latest", "--json"],
    { stdout: "pipe", stderr: "pipe" },
  )
  const stdout = await new Response(proc.stdout).text()
  await proc.exited
  return stdout
}

async function defaultNpxSmoke(
  pkg: string,
  ver: string,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  const proc = Bun.spawn(
    ["npx", "--yes", `${pkg}@${ver}`, "--version"],
    { stdout: "pipe", stderr: "pipe" },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

async function defaultHttpFetch(
  url: string,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController()
  const timer = setTimeout(
    () => controller.abort(),
    HEALTH_FETCH_TIMEOUT_MS,
  )
  try {
    const res = await fetch(url, { signal: controller.signal })
    const body = await res.text()
    return { status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * Run up to three canary phases sequentially with first-failure
 * short-circuit. Returns `{status:"success"}` if all phases pass,
 * `{status:"failure", failedPhase, phaseOutputs}` on the first
 * failing phase, or `{status:"timeout"}` when npm_propagation
 * never reports `expectedVersion` within `timeoutSec`.
 *
 * Validates health-url scheme upfront — throws `UnsafeUrlScheme` for
 * non-`https?://` URLs BEFORE any side effect.
 */
export async function runCanaryChecks(
  opts: CanaryOptions,
): Promise<CanaryResult> {
  const phases = opts.phases ?? DEFAULT_PHASES
  const npmView = opts.npmView ?? defaultNpmView
  const npxSmoke = opts.npxSmoke ?? defaultNpxSmoke
  const httpFetch = opts.httpFetch ?? defaultHttpFetch
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? defaultSleep
  const intervalSec = clamp(
    opts.intervalSec ?? DEFAULT_INTERVAL_SEC,
    MIN_INTERVAL_SEC,
    MAX_INTERVAL_SEC,
  )
  const timeoutSec = clamp(
    opts.timeoutSec ?? DEFAULT_TIMEOUT_SEC,
    MIN_TIMEOUT_SEC,
    MAX_TIMEOUT_SEC,
  )
  const intervalMs = intervalSec * 1000
  const timeoutMs = timeoutSec * 1000

  // Scheme validation upfront — refuses unsafe URLs before any side effect.
  if (phases.includes("health_url")) {
    if (!opts.healthUrl) {
      throw new Error("health_url phase requires healthUrl option")
    }
    if (!isSafeUrl(opts.healthUrl)) {
      throw new UnsafeUrlScheme(opts.healthUrl)
    }
  }

  const phaseOutputs: Partial<Record<CanaryPhase, string>> = {}

  for (const phase of phases) {
    if (phase === "npm_propagation") {
      const startMs = now()
      let propagated = false
      while (!propagated) {
        if (now() - startMs >= timeoutMs) {
          return { status: "timeout", phaseOutputs }
        }
        try {
          const raw = await npmView(opts.packageName)
          const parsed = JSON.parse(raw) as unknown
          if (typeof parsed === "string" && parsed === opts.expectedVersion) {
            propagated = true
            break
          }
        } catch {
          // malformed → treat as not-yet-propagated, continue polling
        }
        await sleep(intervalMs)
      }
    } else if (phase === "smoke_install") {
      const res = await npxSmoke(opts.packageName, opts.expectedVersion)
      if (res.exitCode !== 0) {
        const out = truncate(
          res.stderr || res.stdout || `npx exited ${res.exitCode}`,
          PHASE_OUTPUT_MAX_CHARS,
        )
        phaseOutputs.smoke_install = out
        return { status: "failure", failedPhase: "smoke_install", phaseOutputs }
      }
      if (!res.stdout.includes(opts.expectedVersion)) {
        const out = truncate(
          `exitCode=0 but stdout missing ${opts.expectedVersion}; stdout=${res.stdout}`,
          PHASE_OUTPUT_MAX_CHARS,
        )
        phaseOutputs.smoke_install = out
        return { status: "failure", failedPhase: "smoke_install", phaseOutputs }
      }
    } else if (phase === "health_url") {
      const url = opts.healthUrl as string // validated above
      const regex = opts.healthRegex ? new RegExp(opts.healthRegex) : null
      let lastResult: { status: number; body: string } | null = null
      let lastError: string | null = null
      let ok = false
      for (let attempt = 0; attempt < HEALTH_RETRY_COUNT; attempt++) {
        try {
          const res = await httpFetch(url)
          lastResult = res
          if (res.status >= 200 && res.status < 300) {
            if (!regex || regex.test(res.body)) {
              ok = true
              break
            }
            lastError = `body regex mismatch; body excerpt: ${res.body.slice(0, 500)}`
          } else {
            lastError = `non-2xx status: ${res.status}; body excerpt: ${res.body.slice(0, 500)}`
          }
        } catch (err) {
          lastError = `fetch error: ${err instanceof Error ? err.message : String(err)}`
        }
        if (attempt < HEALTH_RETRY_COUNT - 1) {
          await sleep(HEALTH_RETRY_INTERVAL_SEC * 1000)
        }
      }
      if (!ok) {
        phaseOutputs.health_url = truncate(
          lastError ?? "health_url failed with no captured error",
          PHASE_OUTPUT_MAX_CHARS,
        )
        return { status: "failure", failedPhase: "health_url", phaseOutputs }
      }
      // mark lastResult as consumed to satisfy strict-noUnusedLocals
      void lastResult
    }
  }

  return { status: "success", phaseOutputs }
}

/**
 * Render the templated body for a captured canary-failure record.
 * Truncates the failed phase's output to PHASE_OUTPUT_MAX_CHARS with
 * `...` sentinel; substitutes an empty-output fallback when missing.
 */
function renderBody(failure: CanaryFailure): string {
  const raw = failure.phaseOutputs[failure.failedPhase] ?? ""
  const excerpt =
    raw.length === 0
      ? "(empty — phase produced no output)"
      : raw.length > PHASE_OUTPUT_MAX_CHARS
        ? raw.slice(0, PHASE_OUTPUT_MAX_CHARS) + TRUNCATION_SENTINEL
        : raw
  return [
    "## Failure context",
    "",
    `- package:    ${failure.packageName}`,
    `- version:    ${failure.expectedVersion}`,
    `- phase:      ${failure.failedPhase}`,
    `- commit:     ${failure.commitSha}`,
    `- tag:        ${failure.tag ?? "(none)"}`,
    `- health url: ${failure.healthUrl ?? "(none)"}`,
    "",
    "## Phase output excerpt",
    "",
    excerpt,
    "",
    "## Next steps for operator",
    "",
    "- Reproduce the failing phase locally with the same arguments.",
    "- Once root cause is known, edit `regression_seed:` in the frontmatter with the safeguard to apply.",
    "- Promote to a finished prevention via `sgc compound --from-canary <slug>` (pending GS-1.1; manual `sgc compound` works today).",
    "",
  ].join("\n")
}

/**
 * Persist a templated canary-failure record at
 * `<stateRoot>/canaries/<YYYY-MM-DD>-<short-sha>-<phase>.md`. Dedup by
 * (SHA, phase): if the path already exists, return `{action:"deduped"}`
 * without overwrite. Otherwise write a fresh record + return
 * `{action:"captured"}`. Different `failedPhase` for the same SHA
 * writes a separate file.
 */
export async function captureCanaryFailure(
  failure: CanaryFailure,
  stateRoot?: string,
  opts: { now?: () => number } = {},
): Promise<CaptureCanaryResult> {
  const now = opts.now ?? Date.now
  const root = resolveStateRoot(stateRoot)
  const dir = resolve(root, "canaries")
  await mkdir(dir, { recursive: true })
  const slug = `${todayUtcDate(now)}-${shortSha(failure.commitSha)}-${failure.failedPhase}`
  const path = resolve(dir, `${slug}.md`)

  try {
    await stat(path)
    return { action: "deduped", path }
  } catch {
    // ENOENT → proceed.
  }

  const regressionSeed =
    `TODO: operator-fill; canary failed at ${failure.failedPhase} ` +
    `for ${failure.packageName}@${failure.expectedVersion} on ${shortSha(failure.commitSha)}. ` +
    `Convert via \`sgc compound --from-canary ${slug}\` (pending GS-1.1).`
  const frontmatter = {
    kind: "canary-failure",
    captured_at: new Date(now()).toISOString(),
    commit_sha: failure.commitSha,
    tag: failure.tag ?? "(none)",
    package_name: failure.packageName,
    expected_version: failure.expectedVersion,
    failed_phase: failure.failedPhase,
    health_url: failure.healthUrl ?? "(none)",
    regression_seed: regressionSeed,
  }
  const content = serializeFrontmatter(frontmatter, renderBody(failure))
  await writeFile(path, content, "utf8")
  return { action: "captured", path }
}
