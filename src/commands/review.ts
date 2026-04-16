// `sgc review` command implementation.
//
// Flow:
//   1. Read current-task to get task_id + level + intent
//   2. Capture git diff (vs HEAD by default; override with --base or
//      pass diffOverride for tests)
//   3. Spawn reviewer.correctness with { diff, intent }
//      - scope tokens pinned at spawn (Invariant §8)
//      - read:solutions forbidden (Invariant §1, enforced by manifest +
//        computeSubagentTokens)
//   4. At L3 only: detect diff-keyword triggers; spawn matching specialist
//      reviewers in parallel (security / migration / performance / infra).
//      Each writes its own append-only report under reviews/{task_id}/code/.
//   5. appendReview each report to .sgc/reviews/{task_id}/code/<reviewer>.md
//      (append-only per Invariant §6)
//   6. Aggregate verdict = worst across all reviewers; print summary.

import { execSync } from "node:child_process"
import { spawn } from "../dispatcher/spawn"
import {
  reviewerCorrectness,
  type ReviewerCorrectnessOutput,
} from "../dispatcher/agents/reviewer-correctness"
import {
  matchSpecialists,
  type ReviewerSpecialistOutput,
} from "../dispatcher/agents/reviewer-specialists"
import {
  appendReview,
  readCurrentTask,
  readIntent,
} from "../dispatcher/state"
import type { ReviewReport, Severity, TaskId, Verdict } from "../dispatcher/types"

export interface ReviewOptions {
  stateRoot?: string
  base?: string  // git ref to diff against (default: HEAD)
  diffOverride?: string  // bypass git for tests
  log?: (msg: string) => void
}

export interface SpecialistReportRef {
  reviewerId: string
  verdict: Verdict
  severity: Severity
  reportPath: string
  findingsCount: number
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

const VERDICT_ORDER: Record<Verdict, number> = { pass: 0, concern: 1, fail: 2 }

function worstVerdict(verdicts: Verdict[]): Verdict {
  return verdicts.reduce<Verdict>(
    (acc, v) => (VERDICT_ORDER[v] > VERDICT_ORDER[acc] ? v : acc),
    "pass",
  )
}

export async function runReview(opts: ReviewOptions = {}): Promise<{
  taskId: TaskId
  verdict: Verdict
  reportPath: string
  specialistReports: SpecialistReportRef[]
}> {
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id
  const level = ct.task.level
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

  const correctnessReport: ReviewReport = {
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
  const reportPath = appendReview(correctnessReport, "", stateRoot)

  log(
    `reviewer.correctness: ${correctnessReport.verdict} (severity: ${correctnessReport.severity}, ${correctnessReport.findings.length} finding(s))`,
  )
  for (const f of correctnessReport.findings.slice(0, 5)) {
    log(`  - ${f.description}`)
  }
  if (correctnessReport.findings.length > 5) {
    log(`  ... ${correctnessReport.findings.length - 5} more findings (see ${reportPath})`)
  }

  // L3 diff-conditional specialist cluster
  const specialistReports: SpecialistReportRef[] = []
  if (level === "L3") {
    const matched = matchSpecialists(diff)
    if (matched.length > 0) {
      const specResults = await Promise.all(
        matched.map((s) =>
          spawn<unknown, ReviewerSpecialistOutput>(
            s.name,
            { diff, intent: intent.body ?? "" },
            {
              stateRoot,
              inlineStub: (i) =>
                s.agent(i as { diff: string; intent: string }),
            },
          ),
        ),
      )
      for (let i = 0; i < matched.length; i++) {
        const s = matched[i]!
        const out = specResults[i]!.output
        const report: ReviewReport = {
          report_id: generateReportId(),
          task_id: taskId,
          stage: "code",
          reviewer_id: s.name,
          reviewer_version: "0.1",
          verdict: out.verdict,
          severity: out.severity,
          findings: out.findings,
          created_at: nowIso(),
        }
        const path = appendReview(report, "", stateRoot)
        specialistReports.push({
          reviewerId: s.name,
          verdict: out.verdict,
          severity: out.severity,
          reportPath: path,
          findingsCount: out.findings.length,
        })
        log(
          `${s.name}: ${out.verdict} (severity: ${out.severity}, ${out.findings.length} finding(s))`,
        )
        for (const f of out.findings.slice(0, 3)) {
          log(`  - ${f.description}`)
        }
      }
    }
  }

  log(`wrote ${reportPath}${specialistReports.length > 0 ? ` (+${specialistReports.length} specialists)` : ""}`)

  const aggregateVerdict = worstVerdict([
    correctnessReport.verdict,
    ...specialistReports.map((s) => s.verdict),
  ])

  return { taskId, verdict: aggregateVerdict, reportPath, specialistReports }
}
