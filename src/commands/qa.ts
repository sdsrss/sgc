// `sgc qa [<target>] [--flows ...]` — real-browser end-to-end QA.
//
// Flow:
//   1. Read current-task to resolve task_id
//   2. Spawn qa.browser agent with { target_url, user_flows }
//      - scope tokens pinned: read:decisions, read:progress, write:reviews,
//        exec:browser (Invariant §8)
//      - Invariant §1: qa.browser manifest forbids read:solutions
//   3. appendReview to reviews/{task_id}/qa/qa.browser.md (Invariant §6
//      append-only per task/stage/reviewer triple)
//   4. Print verdict + failed flows
//
// Default is a non-rubber-stamping stub (verdict `concern`). The real-browser
// smoke is opt-in via --browse or SGC_QA_REAL=1: runQa builds the Playwright
// runner (see ../dispatcher/agents/playwright-runner.ts) and injects it as
// opts.browseRunner. A browser is needed at runtime (`npx playwright install
// chromium`, or SGC_QA_BROWSER=chrome).

import { mkdirSync } from "node:fs"
import { join } from "node:path"
import { spawn } from "../dispatcher/spawn"
import {
  qaBrowser,
  type BrowseRunner,
  type QaBrowserOutput,
  type QaVerdict,
} from "../dispatcher/agents/qa-browser"
import {
  makeBrowseRunner,
  launchPlaywrightSession,
} from "../dispatcher/agents/playwright-runner"
import { appendReview, readCurrentTask, resolveStateRoot } from "../dispatcher/state"
import type { ReviewReport, Severity, TaskId } from "../dispatcher/types"
import { createLogger, type Logger } from "../dispatcher/logger"

export interface QaOptions {
  stateRoot?: string
  target?: string
  flows?: string[]
  /** Opt in to the real-browser smoke (Playwright). Also enabled by SGC_QA_REAL=1. */
  browse?: boolean
  /** Test/explicit injection; used verbatim instead of building a Playwright runner. */
  browseRunner?: BrowseRunner
  log?: (msg: string) => void
  logger?: Logger
}

/** Real-browser QA screenshot dir. Must resolve under the SAME state root as
 *  the qa.browser.md review (appendReview → resolveStateRoot) so the PNG evidence
 *  co-locates with the report. Inlining `stateRoot ?? process.cwd()` ignored
 *  SGC_STATE_ROOT and dumped PNGs into <cwd>/reviews/ (repo root, not gitignored)
 *  split from the .md — same class as the handoff.ts state-root bypass. Exported
 *  for unit testing. */
export function qaScreenshotDir(stateRoot: string | undefined, taskId: string): string {
  return join(resolveStateRoot(stateRoot), "reviews", taskId, "qa")
}

function generateReportId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function nowIso(): string {
  return new Date().toISOString()
}

function verdictToSeverity(v: QaVerdict): Severity {
  if (v === "pass") return "none"
  if (v === "concern") return "low"
  return "high"
}

export async function runQa(opts: QaOptions = {}): Promise<{
  taskId: TaskId
  verdict: QaVerdict
  reportPath: string
}> {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const stateRoot = opts.stateRoot

  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id

  const target = opts.target ?? ""
  const flows = opts.flows ?? []

  // Opt-in real-browser smoke (Playwright). Default stays the stub (concern).
  const optIn = opts.browse === true || process.env["SGC_QA_REAL"] === "1"
  let browseRunner = opts.browseRunner
  if (!browseRunner && optIn) {
    const shotDir = qaScreenshotDir(stateRoot, String(taskId))
    mkdirSync(shotDir, { recursive: true })
    browseRunner = makeBrowseRunner({ launch: launchPlaywrightSession, screenshotDir: shotDir })
  }

  const r = await spawn<unknown, QaBrowserOutput>(
    "qa.browser",
    { target_url: target, user_flows: flows },
    {
      stateRoot,
      inlineStub: (i) =>
        qaBrowser(
          i as { target_url: string; user_flows: string[] },
          browseRunner ? { browseRunner } : {},
        ),
      logger,
      taskId,
    },
  )

  // Prose flow labels (step "note") are recorded by the runner for surfacing,
  // but they are NOT failures — they must not inflate the "failed flow(s)" count
  // or land in the review findings as "Step 'note' failed". Almost every run
  // with named --flows (load, checkout, …) emits these, so counting them would
  // print "N failed flow(s)" on a clean pass. They still surface in stdout below.
  const realFlows = r.output.failed_flows.filter((f) => f.step !== "note")

  const report: ReviewReport = {
    report_id: generateReportId(),
    task_id: taskId,
    stage: "qa",
    reviewer_id: "qa.browser",
    reviewer_version: "0.1",
    verdict: r.output.verdict,
    severity: verdictToSeverity(r.output.verdict),
    findings: realFlows.map((f) => ({
      location: f.flow,
      description: `Step '${f.step}' failed: ${f.observed}`,
    })),
    evidence_refs: r.output.evidence_refs,
    created_at: nowIso(),
    engine: r.mode,
  }

  const reportPath = appendReview(report, "", stateRoot)

  log(
    `qa.browser: ${report.verdict} (severity: ${report.severity}, ${realFlows.length} failed flow(s), ${r.output.evidence_refs.length} evidence ref(s))`,
  )
  for (const f of r.output.failed_flows.slice(0, 5)) {
    log(`  - [${f.flow}] ${f.step}: ${f.observed}`)
  }
  log(`wrote ${reportPath}`)

  return { taskId, verdict: report.verdict, reportPath }
}
