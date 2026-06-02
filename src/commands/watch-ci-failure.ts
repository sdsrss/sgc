// `sgc watch-ci-failure` — poll a publish-CI run + capture failures.
//
// CE-3 (f4) feature. Standalone CLI; runs after `git push --tags`.
// Dispatcher logic lives at src/dispatcher/ship-failure.ts; this
// file is only argument shaping + git-side derivation + stderr UX.

import {
  type ShipFailure,
  captureShipFailure,
  watchPublishWorkflow,
} from "../dispatcher/ship-failure"
import { spawnCapture } from "../dispatcher/subprocess"

export interface WatchCliOptions {
  workflow?: string
  branch?: string
  runId?: string
  intervalSec?: number
  timeoutSec?: number
}

async function gitOutput(args: string[]): Promise<string | null> {
  const { stdout, exitCode } = await spawnCapture(["git", ...args])
  if (exitCode !== 0) return null
  const trimmed = stdout.trim()
  return trimmed.length > 0 ? trimmed : null
}

export async function runWatchCiFailure(opts: WatchCliOptions = {}): Promise<void> {
  const branch = opts.branch ?? (await gitOutput(["rev-parse", "--abbrev-ref", "HEAD"]))
  const headSha = await gitOutput(["rev-parse", "HEAD"])
  const tag = await gitOutput(["describe", "--tags", "--abbrev=0"])
  const workflow = opts.workflow ?? "publish.yml"

  const result = await watchPublishWorkflow({
    branch: branch ?? undefined,
    expectedSha: headSha ?? undefined,
    runId: opts.runId,
    intervalSec: opts.intervalSec,
    timeoutSec: opts.timeoutSec,
    workflowName: workflow,
  })

  if (result.status === "success") {
    const sha = result.run?.headSha ?? headSha ?? "(unknown)"
    console.error(`CI green for ${sha.slice(0, 7)}; no capture.`)
    return
  }

  if (result.status === "timeout") {
    const t = opts.timeoutSec ?? "default"
    console.error(
      `[PARTIAL: watch timed out after ${t}s; CI still in progress; no capture written]`,
    )
    return
  }

  // status === "failure"
  if (!result.run) {
    console.error(`[PARTIAL: failure detected but no run metadata available; no capture written]`)
    return
  }
  const failure: ShipFailure = {
    commitSha: result.run.headSha,
    tag,
    workflowName: workflow,
    workflowRunId: result.run.id,
    workflowRunUrl: result.run.url,
    summaryExcerpt: result.summaryExcerpt ?? "",
  }
  const captured = await captureShipFailure(failure)
  if (captured.action === "captured") {
    console.error(`captured: ${captured.path}`)
  } else {
    console.error(`deduped: ${captured.path} (same SHA already recorded)`)
  }
}
