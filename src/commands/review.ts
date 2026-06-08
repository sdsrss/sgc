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
import {
  spawn,
  PRIOR_ART_SENTINEL_BEGIN,
  PRIOR_ART_SENTINEL_END,
  PRE_MORTEM_SENTINEL_BEGIN,
  PRE_MORTEM_SENTINEL_END,
} from "../dispatcher/spawn"
import {
  reviewerCorrectness,
  type ReviewerCorrectnessOutput,
} from "../dispatcher/agents/reviewer-correctness"
import {
  matchSpecialists,
  type ReviewerSpecialistOutput,
} from "../dispatcher/agents/reviewer-specialists"
import {
  reviewerTests,
  reviewerMaintainability,
} from "../dispatcher/agents/reviewer-quality"
import {
  appendReview,
  readCurrentTask,
  readIntent,
} from "../dispatcher/state"
import { delegationHintsFor, formatHint } from "../dispatcher/delegation"
import type { ReviewReport, Severity, TaskId, Verdict } from "../dispatcher/types"
import { createLogger, type Logger } from "../dispatcher/logger"

export interface ReviewOptions {
  stateRoot?: string
  base?: string  // git ref to diff against (default: HEAD)
  diffOverride?: string  // bypass git for tests
  appendAs?: string  // F-5: suffix for follow-up reviewer reports — `<reviewer>.<suffix>.md`
  log?: (msg: string) => void
  logger?: Logger
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

// Strip the researcher.history Prior-art block from intent.body before
// passing it to reviewer subagents. Invariant §1 (sgc-invariants.md +
// sgc-capabilities.yaml:142-146 `/review.solutions: []`) requires reviewers
// to remain amnesiac to past solutions. plan.ts embeds up to 5 × 500-char
// solution excerpts + LLM-generated relevance_reason commentary — passing
// that to reviewer.correctness back-channels solutions content past the
// explicit scope_token denial. Phase H pre-ship review surfaced this leak
// (red team finding RT-1); P3 hardening wraps the block in sentinel HTML
// comments so strip + spawn.ts gate share a single literal contract.
//
// Two paths per sentinel pair:
//   (A) Sentinel-wrapped (current producer, plan.ts): exact begin/end pair
//       — remove everything between (heading lives INSIDE the sentinels
//       and goes with the block).
//   (B) Legacy heading-only (pre-sentinel intent.md files, immutable per
//       §2): fall back to heading-to-next-`## ` heuristic.
//
// Sentinel path is preferred and short-circuits; legacy path only runs
// when no sentinel is found. A malformed producer that emits begin
// without end strips from begin to next `## ` heading (or to EOF) —
// fail-safe toward "remove more, not less", since under-stripping leaks
// solutions content.
//
// CE-1 RT-1: extended to also strip the `## Pre-mortem (planner.adversarial)`
// block, which carries solution_ref strings in early_signal when the LLM
// consumed prior_preventions per the new prompt step 5. Same shape as
// prior-art: HTML-comment sentinel pair + legacy heading fallback.
function stripSentinelBlock(
  body: string,
  begin: string,
  end: string,
  legacyHeadingRe: RegExp,
): string {
  const beginIdx = body.indexOf(begin)
  if (beginIdx !== -1) {
    const endIdx = body.indexOf(end, beginIdx)
    if (endIdx !== -1) {
      const after = endIdx + end.length
      const cut = body[after] === "\n" ? after + 1 : after
      return body.slice(0, beginIdx) + body.slice(cut)
    }
    // Malformed: begin without end. Cut from begin to next `## ` or EOF.
    const tail = body.slice(beginIdx)
    const next = /\n## /.exec(tail)
    const cutEnd = beginIdx + (next?.index ?? tail.length)
    return body.slice(0, beginIdx) + body.slice(cutEnd)
  }
  const m = legacyHeadingRe.exec(body)
  if (!m) return body
  const afterHeading = body.slice(m.index + m[0].length)
  const nextHeading = /^## /m.exec(afterHeading)
  const sectionEnd =
    m.index + m[0].length + (nextHeading?.index ?? afterHeading.length)
  return body.slice(0, m.index) + body.slice(sectionEnd)
}

function stripBackChannelSections(body: string): string {
  let stripped = body
  stripped = stripSentinelBlock(
    stripped,
    PRIOR_ART_SENTINEL_BEGIN,
    PRIOR_ART_SENTINEL_END,
    /^## Prior art \(researcher\.history\)\r?\n/m,
  )
  stripped = stripSentinelBlock(
    stripped,
    PRE_MORTEM_SENTINEL_BEGIN,
    PRE_MORTEM_SENTINEL_END,
    /^## Pre-mortem \(planner\.adversarial\)\r?\n/m,
  )
  return stripped
}

const VERDICT_ORDER: Record<Verdict, number> = { pass: 0, concern: 1, fail: 2 }

export function worstVerdict(verdicts: Verdict[]): Verdict {
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
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const stateRoot = opts.stateRoot

  const ct = readCurrentTask(stateRoot)
  if (!ct) throw new Error("no active task — run `sgc plan <task>` first")
  const taskId = ct.task.task_id
  const level = ct.task.level
  // L0 is fast-path: no intent.md is written (Invariant §2 / schema), and
  // review/qa/ship are L2+ gates. Refuse with a clear explanation rather than
  // letting readIntent throw a cryptic "intent.md not found".
  if (level === "L0") {
    throw new Error(
      "L0 tasks are fast-path: no intent.md is written and review/qa/ship are L2+ gates. Nothing to review.",
    )
  }
  // P1.6: surface delegation hints before reviewer cluster fires.
  for (const hint of delegationHintsFor("review.cluster")) log(formatHint(hint))
  const intent = readIntent(taskId, stateRoot)
  // Invariant §1: reviewers must not see solutions content. Strip the
  // researcher.history Prior-art section embedded by plan.ts before passing
  // intent.body to any reviewer spawn.
  const intentForReviewer = stripBackChannelSections(intent.body ?? "")

  const diff = opts.diffOverride ?? captureDiff(opts.base ?? "HEAD")

  // Spawn reviewer.correctness; scope tokens pinned + Invariant §1 enforced
  const r = await spawn<unknown, ReviewerCorrectnessOutput>(
    "reviewer.correctness",
    { diff, intent: intentForReviewer },
    {
      stateRoot,
      inlineStub: (i) =>
        reviewerCorrectness(i as { diff: string; intent: string }),
      logger,
      taskId,
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
  const reportPath = appendReview(correctnessReport, "", stateRoot, opts.appendAs)

  log(
    `reviewer.correctness: ${correctnessReport.verdict} (severity: ${correctnessReport.severity}, ${correctnessReport.findings.length} finding(s))`,
  )
  for (const f of correctnessReport.findings.slice(0, 5)) {
    log(`  - ${f.description}`)
  }
  if (correctnessReport.findings.length > 5) {
    log(`  ... ${correctnessReport.findings.length - 5} more findings (see ${reportPath})`)
  }

  // Phase 2c: L2+ always-on quality reviewers (tests + maintainability) +
  // lowered specialist gate. L1 stays correctness-only. Reviewers receive the
  // already-stripped intentForReviewer (Invariant §1) and hold no read:solutions.
  const isL2Plus = level === "L2" || level === "L3"
  const clusterReports: SpecialistReportRef[] = []

  async function runClusterReviewer(
    name: string,
    agent: (i: { diff: string; intent: string }) => ReviewerSpecialistOutput,
  ): Promise<void> {
    const res = await spawn<unknown, ReviewerSpecialistOutput>(
      name,
      { diff, intent: intentForReviewer },
      { stateRoot, inlineStub: (i) => agent(i as { diff: string; intent: string }), logger, taskId },
    )
    const report: ReviewReport = {
      report_id: generateReportId(),
      task_id: taskId,
      stage: "code",
      reviewer_id: name,
      reviewer_version: "0.1",
      verdict: res.output.verdict,
      severity: res.output.severity,
      findings: res.output.findings,
      created_at: nowIso(),
    }
    const path = appendReview(report, "", stateRoot, opts.appendAs)
    clusterReports.push({
      reviewerId: name,
      verdict: res.output.verdict,
      severity: res.output.severity,
      reportPath: path,
      findingsCount: res.output.findings.length,
    })
    log(`${name}: ${res.output.verdict} (severity: ${res.output.severity}, ${res.output.findings.length} finding(s))`)
  }

  if (isL2Plus) {
    await runClusterReviewer("reviewer.tests", reviewerTests)
    await runClusterReviewer("reviewer.maintainability", reviewerMaintainability)
  }

  // L2+ diff-conditional specialist cluster (lowered from L3-only)
  const specialistReports: SpecialistReportRef[] = []
  if (isL2Plus) {
    const matched = matchSpecialists(diff)
    if (matched.length > 0) {
      const specResults = await Promise.all(
        matched.map((s) =>
          spawn<unknown, ReviewerSpecialistOutput>(
            s.name,
            { diff, intent: intentForReviewer },
            {
              stateRoot,
              inlineStub: (i) =>
                s.agent(i as { diff: string; intent: string }),
              logger,
              taskId,
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
        const path = appendReview(report, "", stateRoot, opts.appendAs)
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
    ...clusterReports.map((s) => s.verdict),
    ...specialistReports.map((s) => s.verdict),
  ])

  return { taskId, verdict: aggregateVerdict, reportPath, specialistReports: [...clusterReports, ...specialistReports] }
}
