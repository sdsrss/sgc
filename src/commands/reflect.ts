// `sgc reflect` — audit decisions against accumulated preventions.
//
// CE-2 (f3) feature. Read-only; no LLM call, no agent spawn, no
// events emitted. The dispatcher logic lives at
// src/dispatcher/reflect.ts; this file is just the CLI glue.

import {
  type ReflectReport,
  auditAllDecisions,
  auditDecision,
  formatReport,
  writeReflectionFile,
} from "../dispatcher/reflect"

export interface ReflectCliOptions {
  task?: string
  since?: string
  save?: boolean
  json?: boolean
}

export async function runReflect(opts: ReflectCliOptions = {}): Promise<void> {
  let reports: ReflectReport[]
  if (opts.task) {
    reports = [await auditDecision(opts.task, undefined, { since: opts.since })]
  } else {
    reports = await auditAllDecisions(undefined, { since: opts.since })
  }

  if (opts.json) {
    console.log(JSON.stringify(reports, null, 2))
  } else {
    if (reports.length === 0) {
      console.log("No decisions audited.")
    } else {
      console.log(reports.map(formatReport).join("\n\n"))
    }
  }

  if (opts.save) {
    for (const r of reports) {
      const path = await writeReflectionFile(r)
      console.error(`saved: ${path}`)
    }
  }
}
