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
  type ClarifierDiscoverOutput,
} from "../dispatcher/agents/clarifier-discover"
import { readCurrentTask } from "../dispatcher/state"

export interface DiscoverOptions {
  stateRoot?: string
  topic: string
  log?: (msg: string) => void
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
  const log = opts.log ?? ((m) => console.log(m))
  const stateRoot = opts.stateRoot

  const topic = (opts.topic ?? "").trim()
  if (topic.length === 0) {
    throw new Error(
      "topic required — usage: sgc discover \"<what do you want to clarify>\"",
    )
  }

  const current_task_summary = summarizeActiveTask(stateRoot)

  const r = await spawn<unknown, ClarifierDiscoverOutput>(
    "clarifier.discover",
    { topic, current_task_summary },
    {
      stateRoot,
      inlineStub: (i) =>
        clarifierDiscover(i as { topic: string; current_task_summary: string }),
    },
  )

  renderQuestions(r.output, log)
  return r.output
}
