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
// MVP stub returns pass for non-empty inputs. Real browse binary bridge
// is opt-in via --browse or SGC_QA_REAL=1 (deferred — browse test
// environment requires chromium that may need --no-sandbox on Ubuntu
// 23.10+).

import { spawn } from "../dispatcher/spawn"
import {
  qaBrowser,
  type QaBrowserOutput,
  type QaVerdict,
} from "../dispatcher/agents/qa-browser"
import { appendReview, readCurrentTask } from "../dispatcher/state"
import type { ReviewReport, Severity, TaskId } from "../dispatcher/types"

export interface QaOptions {
  stateRoot?: string
  target?: string
  flows?: string[]
  log?: (msg: string) => void
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
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id

  const target = opts.target ?? ""
  const flows = opts.flows ?? []

  const r = await spawn<unknown, QaBrowserOutput>(
    "qa.browser",
    { target_url: target, user_flows: flows },
    {
      stateRoot,
      inlineStub: (i) =>
        qaBrowser(i as { target_url: string; user_flows: string[] }),
    },
  )

  const report: ReviewReport = {
    report_id: generateReportId(),
    task_id: taskId,
    stage: "qa",
    reviewer_id: "qa.browser",
    reviewer_version: "0.1",
    verdict: r.output.verdict,
    severity: verdictToSeverity(r.output.verdict),
    findings: r.output.failed_flows.map((f) => ({
      location: f.flow,
      description: `Step '${f.step}' failed: ${f.observed}`,
    })),
    evidence_refs: r.output.evidence_refs,
    created_at: nowIso(),
  }

  const reportPath = appendReview(report, "", stateRoot)

  log(
    `qa.browser: ${report.verdict} (severity: ${report.severity}, ${r.output.failed_flows.length} failed flow(s), ${r.output.evidence_refs.length} evidence ref(s))`,
  )
  for (const f of r.output.failed_flows.slice(0, 5)) {
    log(`  - [${f.flow}] ${f.step}: ${f.observed}`)
  }
  log(`wrote ${reportPath}`)

  return { taskId, verdict: report.verdict, reportPath }
}
