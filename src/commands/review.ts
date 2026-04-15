// `sgc review` command implementation.
//
// Flow:
//   1. Read current-task to get task_id + intent
//   2. Capture git diff (staged + unstaged vs HEAD by default; override
//      with --base or pass diffOverride for tests)
//   3. Spawn reviewer.correctness with { diff, intent }
//      - scope tokens pinned at spawn (Invariant §8)
//      - read:solutions forbidden (Invariant §1, enforced by manifest +
//        computeSubagentTokens)
//   4. appendReview to .sgc/reviews/{task_id}/code/correctness.md
//      (append-only per Invariant §6)
//   5. Print verdict + findings summary

import { execSync } from "node:child_process"
import { spawn } from "../dispatcher/spawn"
import {
  reviewerCorrectness,
  type ReviewerCorrectnessOutput,
} from "../dispatcher/agents/reviewer-correctness"
import {
  appendReview,
  readCurrentTask,
  readIntent,
} from "../dispatcher/state"
import type { ReviewReport, TaskId, Verdict } from "../dispatcher/types"

export interface ReviewOptions {
  stateRoot?: string
  base?: string  // git ref to diff against (default: HEAD)
  diffOverride?: string  // bypass git for tests
  log?: (msg: string) => void
}

function generateReportId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 26).toUpperCase()
}

function nowIso(): string {
  return new Date().toISOString()
}

function captureDiff(base: string, cwd?: string): string {
  try {
    return execSync(`git diff ${base}`, { encoding: "utf8", cwd })
  } catch {
    return ""
  }
}

export async function runReview(opts: ReviewOptions = {}): Promise<{
  taskId: TaskId
  verdict: Verdict
  reportPath: string
}> {
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id
  const intent = readIntent(taskId, stateRoot)

  const diff = opts.diffOverride ?? captureDiff(opts.base ?? "HEAD")

  // Spawn reviewer.correctness; scope tokens pinned + Invariant §1 enforced
  const r = await spawn<unknown, ReviewerCorrectnessOutput>(
    "reviewer.correctness",
    { diff, intent: intent.body ?? "" },
    {
      stateRoot,
      inlineStub: (i) =>
        reviewerCorrectness(i as { diff: string; intent: string }),
    },
  )

  const report: ReviewReport = {
    report_id: generateReportId(),
    task_id: taskId,
    stage: "code",
    reviewer_id: "reviewer.correctness",
    reviewer_version: "0.1",
    verdict: r.output.verdict,
    severity: r.output.severity,
    findings: r.output.findings,
    created_at: nowIso(),
  }

  const reportPath = appendReview(report, "", stateRoot)

  log(
    `reviewer.correctness: ${report.verdict} (severity: ${report.severity}, ${report.findings.length} finding(s))`,
  )
  for (const f of report.findings.slice(0, 5)) {
    log(`  - ${f.description}`)
  }
  if (report.findings.length > 5) {
    log(`  ... ${report.findings.length - 5} more findings (see ${reportPath})`)
  }
  log(`wrote ${reportPath}`)

  return { taskId, verdict: report.verdict, reportPath }
}
