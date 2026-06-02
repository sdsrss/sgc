// CE-3 (f4): `sgc watch-ci-failure` ship-failure capture.
//
// Pure-logic module — no CLI flag parsing. The CLI run handler at
// src/commands/watch-ci-failure.ts owns argument shaping; this
// module owns the watch loop + templated capture writer.
//
// Spec: tasks/specs/ce-3-ship-failure-capture.md (status: draft, r2).
// Heuristic-only: no LLM call, no agent spawn, no events emitted.
// Reuses CE-1/CE-2 patterns:
//   - resolveStateRoot + serializeFrontmatter  (state.ts)
//   - Bun.spawn shell-out                       (gh-runner.ts pattern)

import { mkdir, stat, writeFile } from "node:fs/promises"
import { resolve } from "node:path"
import { resolveStateRoot, serializeFrontmatter } from "./state"
import { spawnCapture } from "./subprocess"

export interface WatchOptions {
  intervalSec?: number
  timeoutSec?: number
  /**
   * Branch hint — kept for backward compat / non-tag-triggered
   * workflows. NOT passed to `gh run list` directly because
   * tag-triggered workflows (publish.yml fires `on: push: tags`)
   * yield runs whose `headBranch` is the TAG name, not the
   * branch — `--branch main` silently excludes them. v0 dogfood
   * on v1.6.0 caught this (DOG-2). Prefer `expectedSha` for
   * tag-triggered workflows.
   */
  branch?: string
  /**
   * Client-side filter: select the first discovered run whose
   * `headSha` starts with this. Used by `runWatchCiFailure` to pin
   * the watch to the just-pushed HEAD commit independently of
   * gh's branch/tag confusion.
   */
  expectedSha?: string
  /**
   * Display name of the workflow (e.g. "publish-npm"), NOT the
   * file path (`publish.yml`). gh CLI's `--workflow` flag accepts
   * the display name or file basename without extension. The
   * file-path form (`publish.yml`) returns `[]` silently in
   * `gh run list` — v0 dogfood on v1.6.0 caught this (DOG-1).
   * Default: "publish-npm".
   */
  workflowName?: string
  /** Skip discovery; attach to a specific gh run id directly. */
  runId?: string
  /** Test hook: inject a fake gh runner. Production = real `gh` CLI. */
  runCommand?: (args: string[]) => Promise<RunResult>
  /** Test hook: inject a fake clock (returns ms). Production = Date.now. */
  now?: () => number
  /** Test hook: inject a fake sleep. Production = setTimeout-based. */
  sleep?: (ms: number) => Promise<void>
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number
}

export interface WatchedRun {
  id: string
  url: string
  name: string
  headSha: string
  headBranch: string
}

export interface WatchResult {
  status: "success" | "failure" | "timeout"
  run?: WatchedRun
  summaryExcerpt?: string
}

export interface ShipFailure {
  commitSha: string
  tag: string | null
  workflowName: string
  workflowRunId: string
  workflowRunUrl: string
  summaryExcerpt: string
}

export interface CaptureResult {
  action: "captured" | "deduped"
  path: string
}

export const DEFAULT_INTERVAL_SEC = 15
export const DEFAULT_TIMEOUT_SEC = 600
export const MIN_INTERVAL_SEC = 5
export const MAX_INTERVAL_SEC = 60
export const MIN_TIMEOUT_SEC = 60
export const MAX_TIMEOUT_SEC = 1800
export const SUMMARY_MAX_CHARS = 2000
export const TRUNCATION_SENTINEL = "..."
export const EMPTY_SUMMARY_FALLBACK =
  "(empty — workflow did not write $GITHUB_STEP_SUMMARY)"

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n))
}

function shortSha(sha: string): string {
  return sha.slice(0, 7)
}

function todayUtcDate(now: () => number): string {
  return new Date(now()).toISOString().slice(0, 10)
}

async function defaultRunCommand(args: string[]): Promise<RunResult> {
  return spawnCapture(args)
}

async function defaultSleep(ms: number): Promise<void> {
  await new Promise<void>((r) => setTimeout(r, ms))
}

/**
 * Poll the publish workflow run on a branch (or an explicit run id)
 * until conclusion. On `failure`, also fetch the failing-step log
 * excerpt via `gh run view --log-failed` (truncated to
 * SUMMARY_MAX_CHARS). On `success`, return early with no excerpt.
 * On wall-clock exceeding `timeoutSec`, return `{status:"timeout"}`.
 *
 * Test injection: `opts.runCommand` / `opts.now` / `opts.sleep`.
 * Production = real `Bun.spawn` shell-out + Date.now + setTimeout.
 */
export async function watchPublishWorkflow(
  opts: WatchOptions = {},
): Promise<WatchResult> {
  const runCommand = opts.runCommand ?? defaultRunCommand
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
  const workflowName = opts.workflowName ?? "publish-npm"
  const expectedSha = opts.expectedSha ?? null
  const startMs = now()
  const timeoutMs = timeoutSec * 1000
  const intervalMs = intervalSec * 1000

  const remaining = (): number => timeoutMs - (now() - startMs)

  // Phase 1 — discover the run, unless --run-id is set.
  let runId: string | null = opts.runId ?? null
  let cachedRun: WatchedRun | null = null

  while (runId === null) {
    if (remaining() <= 0) return { status: "timeout" }
    const args = [
      "gh",
      "run",
      "list",
      "--workflow",
      workflowName,
      // DO NOT pass `--branch`: publish.yml is tag-triggered and gh
      // reports headBranch as the tag name (e.g. "v1.6.0"), so
      // --branch main excludes all matching runs (DOG-2).
      "--limit",
      "10",
      "--json",
      "databaseId,status,conclusion,name,headSha,headBranch,url",
    ]
    const res = await runCommand(args)
    if (res.exitCode === 0 && res.stdout.trim().length > 0) {
      try {
        const rows = JSON.parse(res.stdout) as Array<{
          databaseId: number | string
          status: string
          conclusion: string | null
          name: string
          headSha: string
          headBranch: string
          url: string
        }>
        // Client-side SHA filter when expectedSha is set, else
        // take the most-recent row.
        const matched = expectedSha
          ? rows.find((r) => r.headSha.startsWith(expectedSha))
          : rows[0]
        if (matched) {
          runId = String(matched.databaseId)
          cachedRun = {
            id: runId,
            url: matched.url,
            name: matched.name,
            headSha: matched.headSha,
            headBranch: matched.headBranch,
          }
          if (matched.status === "completed") {
            // Already concluded between push and our first poll.
            if (matched.conclusion === "success") {
              return { status: "success", run: cachedRun }
            }
            const excerpt = await fetchFailingLog(runCommand, runId)
            return { status: "failure", run: cachedRun, summaryExcerpt: excerpt }
          }
          break
        }
      } catch {
        // Malformed JSON — fall through to sleep + retry.
      }
    }
    await sleep(intervalMs)
  }

  // Phase 2 — poll status until completed or timeout.
  while (true) {
    if (remaining() <= 0) return { status: "timeout", ...(cachedRun ? { run: cachedRun } : {}) }
    const args = [
      "gh",
      "run",
      "view",
      runId,
      "--json",
      "databaseId,status,conclusion,name,headSha,headBranch,url",
    ]
    const res = await runCommand(args)
    if (res.exitCode === 0 && res.stdout.trim().length > 0) {
      try {
        const row = JSON.parse(res.stdout) as {
          databaseId: number | string
          status: string
          conclusion: string | null
          name: string
          headSha: string
          headBranch: string
          url: string
        }
        cachedRun = {
          id: String(row.databaseId),
          url: row.url,
          name: row.name,
          headSha: row.headSha,
          headBranch: row.headBranch,
        }
        if (row.status === "completed") {
          if (row.conclusion === "success") {
            return { status: "success", run: cachedRun }
          }
          const excerpt = await fetchFailingLog(runCommand, runId)
          return { status: "failure", run: cachedRun, summaryExcerpt: excerpt }
        }
      } catch {
        // Malformed JSON — fall through to sleep + retry.
      }
    }
    await sleep(intervalMs)
  }
}

async function fetchFailingLog(
  runCommand: (args: string[]) => Promise<RunResult>,
  runId: string,
): Promise<string> {
  const res = await runCommand(["gh", "run", "view", runId, "--log-failed"])
  if (res.exitCode !== 0 || res.stdout.trim().length === 0) return ""
  return res.stdout
}

/**
 * Render the templated body for a captured ship-failure record.
 * Truncates `summaryExcerpt` to SUMMARY_MAX_CHARS with `...` sentinel
 * if oversize; substitutes EMPTY_SUMMARY_FALLBACK when empty.
 */
function renderBody(failure: ShipFailure): string {
  let excerpt = failure.summaryExcerpt
  if (excerpt.length === 0) {
    excerpt = EMPTY_SUMMARY_FALLBACK
  } else if (excerpt.length > SUMMARY_MAX_CHARS) {
    excerpt = excerpt.slice(0, SUMMARY_MAX_CHARS) + TRUNCATION_SENTINEL
  }
  return [
    "## Failure context",
    "",
    `- workflow: ${failure.workflowName}`,
    `- run id:   ${failure.workflowRunId}`,
    `- run url:  ${failure.workflowRunUrl}`,
    `- commit:   ${failure.commitSha}`,
    `- tag:      ${failure.tag ?? "(none)"}`,
    "",
    "## $GITHUB_STEP_SUMMARY excerpt",
    "",
    excerpt,
    "",
    "## Next steps for operator",
    "",
    "- Investigate the failing step in the run url above.",
    "- Once root cause is known, edit `prevention_seed:` in the frontmatter with the safeguard to apply.",
    "- Promote to a finished prevention via `sgc compound` (manual today; auto-promotion is future scope).",
    "",
  ].join("\n")
}

/**
 * Persist a templated ship-failure record at
 * `<stateRoot>/ship-failures/<YYYY-MM-DD>-<short-sha>.md`. Dedup by
 * SHA: if the path already exists, return `{action:"deduped"}`
 * without overwrite. Otherwise write a fresh record + return
 * `{action:"captured"}`.
 */
export async function captureShipFailure(
  failure: ShipFailure,
  stateRoot?: string,
  opts: { now?: () => number } = {},
): Promise<CaptureResult> {
  const now = opts.now ?? Date.now
  const root = resolveStateRoot(stateRoot)
  const dir = resolve(root, "ship-failures")
  await mkdir(dir, { recursive: true })
  const slug = `${todayUtcDate(now)}-${shortSha(failure.commitSha)}`
  const path = resolve(dir, `${slug}.md`)

  // Dedup — same-SHA same-day → preserve original.
  try {
    await stat(path)
    return { action: "deduped", path }
  } catch {
    // ENOENT → proceed.
  }

  const preventionSeed =
    `TODO: operator-fill; captured failure of ${failure.workflowName} ` +
    `at ${shortSha(failure.commitSha)}. Convert via \`sgc compound\`.`
  const frontmatter = {
    kind: "ship-failure",
    captured_at: new Date(now()).toISOString(),
    commit_sha: failure.commitSha,
    tag: failure.tag ?? "(none)",
    workflow_run_id: failure.workflowRunId,
    workflow_run_url: failure.workflowRunUrl,
    workflow_name: failure.workflowName,
    conclusion: "failure",
    prevention_seed: preventionSeed,
  }
  const content = serializeFrontmatter(frontmatter, renderBody(failure))
  await writeFile(path, content, "utf8")
  return { action: "captured", path }
}
