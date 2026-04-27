// sgc tail — operator-facing reader for .sgc/progress/events.ndjson.
//
// Phase G.1.b deliverable. Pure local-file processing; no subagent spawn,
// no LLM path. See docs/superpowers/specs/2026-04-24-phase-g-design.md §5.

import { closeSync, existsSync, openSync, readSync, statSync } from "node:fs"
import { resolve } from "node:path"
import type { EventRecord } from "../dispatcher/logger"

export interface TailOptions {
  stateRoot?: string
  task?: string              // exact match on task_id
  agent?: string             // glob-match on agent (e.g. planner.*)
  eventType?: string         // substring match on event_type
  since?: string             // ISO 8601 timestamp; only events at/after this
  follow?: boolean
  pollIntervalMs?: number    // poll interval for --follow (default 500ms)
  abortSignal?: AbortSignal  // test hook: resolves promise on abort
  json?: boolean
  log?: (m: string) => void
  // Last N matching events to emit on initial drain. In --follow mode
  // applies to the initial drain only — subsequent appended events are
  // streamed unbounded (matches `tail -f -n N` semantics). G.3 DF-3.
  limit?: number
}

function globMatch(pattern: string, value: string | null): boolean {
  if (value === null) return false      // null agent never matches any glob
  const re = new RegExp(
    "^" +
      pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
      "$",
  )
  return re.test(value)
}

function matchFilters(e: EventRecord, opts: TailOptions): boolean {
  if (opts.task && e.task_id !== opts.task) return false
  if (opts.agent && !globMatch(opts.agent, e.agent)) return false
  if (opts.eventType && !e.event_type.includes(opts.eventType)) return false
  if (opts.since && e.ts < opts.since) return false
  return true
}

function eventsPath(stateRoot?: string): string {
  const root = stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  return resolve(root, "progress/events.ndjson")
}

function parseLine(line: string): EventRecord | null {
  try {
    const parsed = JSON.parse(line) as EventRecord
    if (parsed.schema_version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

function briefPayload(eventType: string, payload: Record<string, unknown>): string {
  switch (eventType) {
    case "spawn.start": return `mode=${payload["mode"]}`
    case "spawn.end": return `${payload["outcome"]} ${payload["elapsed_ms"]}ms`
    case "llm.request": return `model=${payload["model"]} chars=${payload["prompt_chars"]}`
    case "llm.response": {
      const tokenInfo =
        payload["input_tokens"] !== undefined
          ? ` in=${payload["input_tokens"]} out=${payload["output_tokens"]}`
          : ""
      return `${payload["outcome"]} ${payload["latency_ms"]}ms${tokenInfo}`
    }
    default: {
      const keys = Object.keys(payload)
      return keys.length === 0 ? "…" : `… (${keys.length} fields)`
    }
  }
}

function formatHuman(e: EventRecord): string {
  const time = e.ts.slice(11, 23)                             // HH:MM:SS.mmm
  const spawnTail = (e.spawn_id ?? "").slice(-12).padStart(12, " ")
  const agent = (e.agent ?? "").padEnd(18)
  const brief = briefPayload(e.event_type, e.payload)
  return `${time}  ${e.level.padEnd(5)}  ${e.event_type.padEnd(18)}  ${spawnTail}  ${agent}  ${brief}`
}

export async function runTail(opts: TailOptions = {}): Promise<void> {
  const say = opts.log ?? ((m: string) => console.log(m))
  const path = eventsPath(opts.stateRoot)

  let offset = 0
  let lastSize = 0
  let initialDrainDone = false

  const emitFromBuffer = (buf: string, applyLimit: boolean): void => {
    const lines = buf.split("\n").filter((l) => l.length > 0)
    const matched: string[] = []
    for (const line of lines) {
      const rec = parseLine(line)
      if (!rec) {
        console.error(`[sgc tail] malformed line skipped: ${line.slice(0, 80)}`)
        continue
      }
      if (!matchFilters(rec, opts)) continue
      matched.push(opts.json ? line : formatHuman(rec))
    }
    // Note: `slice(-0)` equals `slice(0)` (returns all) due to -0 === 0,
    // so limit=0 must be handled explicitly to mean "emit nothing".
    let out: string[]
    if (applyLimit && opts.limit !== undefined && opts.limit >= 0) {
      out = opts.limit === 0 ? [] : matched.slice(-opts.limit)
    } else {
      out = matched
    }
    for (const m of out) say(m)
  }

  const readNew = (): void => {
    if (!existsSync(path)) return
    const sz = statSync(path).size
    if (sz < lastSize) {
      offset = 0   // rotation / truncation detected
    }
    lastSize = sz
    if (sz <= offset) return
    const fd = openSync(path, "r")
    try {
      const buf = Buffer.alloc(sz - offset)
      readSync(fd, buf, 0, buf.length, offset)
      offset = sz
      emitFromBuffer(buf.toString("utf8"), !initialDrainDone)
    } finally {
      closeSync(fd)
    }
  }

  readNew()   // initial drain
  initialDrainDone = true

  if (!opts.follow) return

  const interval = opts.pollIntervalMs ?? 500
  await new Promise<void>((resolvePromise) => {
    const timer = setInterval(readNew, interval)
    if (opts.abortSignal) {
      if (opts.abortSignal.aborted) {
        clearInterval(timer)
        resolvePromise()
        return
      }
      opts.abortSignal.addEventListener(
        "abort",
        () => {
          clearInterval(timer)
          resolvePromise()
        },
        { once: true },
      )
    }
  })
}
