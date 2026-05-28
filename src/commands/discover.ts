// `sgc discover` — produce forcing-questions for a vague topic.
//
// Spawns clarifier.discover with the topic (and optional context from
// progress/current-task.md), prints the structured questions plus a
// suggested `sgc plan` follow-up. No state writes — the user hand-carries
// answers into `sgc plan --motivation`.
//
// Contract: /discover holds read:progress + spawn:clarifier.* only.

import { spawn } from "../dispatcher/spawn"
import {
  clarifierDiscover,
  DISCOVER_TEMPLATES,
  type ClarifierDiscoverOutput,
  type DiscoverTemplate,
} from "../dispatcher/agents/clarifier-discover"
import { readCurrentTask } from "../dispatcher/state"
import { createLogger, type Logger } from "../dispatcher/logger"

export interface DiscoverOptions {
  stateRoot?: string
  topic: string
  /** GS-6 (v1.16.0): optional framing template. */
  template?: string
  log?: (msg: string) => void
  logger?: Logger
}

function summarizeActiveTask(stateRoot?: string): string {
  try {
    const ct = readCurrentTask(stateRoot)
    if (!ct) return ""
    return `${ct.task.task_id} (${ct.task.level})`
  } catch {
    return ""
  }
}

function renderQuestions(
  out: ClarifierDiscoverOutput,
  log: (m: string) => void,
): void {
  log(`topic: ${out.topic}`)
  log("")
  log(`Goal:`)
  log(`  ${out.goal_question}`)
  log("")
  const sections: [string, string[]][] = [
    ["Constraints:", out.constraint_questions],
    ["Scope:", out.scope_questions],
    ["Edge cases:", out.edge_case_questions],
    ["Acceptance:", out.acceptance_questions],
  ]
  for (const [header, qs] of sections) {
    if (qs.length === 0) continue
    log(header)
    for (const q of qs) log(`  - ${q}`)
    log("")
  }
  log(`Next:`)
  log(`  ${out.suggested_next}`)
}

export async function runDiscover(
  opts: DiscoverOptions,
): Promise<ClarifierDiscoverOutput> {
  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot, say: opts.log })
  const log = (m: string) => logger.say(m)
  const stateRoot = opts.stateRoot

  const topic = (opts.topic ?? "").trim()
  if (topic.length === 0) {
    throw new Error(
      "topic required — usage: sgc discover \"<what do you want to clarify>\"",
    )
  }

  // GS-6 (v1.16.0): validate --template against closed enum. Unknown
  // value → stderr + exit 1 via thrown Error (no silent fallback).
  let template: DiscoverTemplate | undefined
  if (opts.template !== undefined) {
    if (!(DISCOVER_TEMPLATES as readonly string[]).includes(opts.template)) {
      throw new Error(
        `unknown template: '${opts.template}'. valid: ${DISCOVER_TEMPLATES.join(", ")}`,
      )
    }
    template = opts.template as DiscoverTemplate
  }

  const current_task_summary = summarizeActiveTask(stateRoot)

  const r = await spawn<unknown, ClarifierDiscoverOutput>(
    "clarifier.discover",
    { topic, current_task_summary, ...(template ? { template } : {}) },
    {
      stateRoot,
      inlineStub: (i) =>
        clarifierDiscover(
          i as { topic: string; current_task_summary: string; template?: DiscoverTemplate },
        ),
      logger,
      taskId: undefined,
    },
  )

  renderQuestions(r.output, log)
  return r.output
}
