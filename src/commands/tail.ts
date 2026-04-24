// sgc tail — operator-facing reader for .sgc/progress/events.ndjson.
//
// Phase G.1.b deliverable. Pure local-file processing; no subagent spawn,
// no LLM path. See docs/superpowers/specs/2026-04-24-phase-g-design.md §5.

import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { EventRecord } from "../dispatcher/logger"

export interface TailOptions {
  stateRoot?: string
  json?: boolean
  log?: (m: string) => void
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
  if (!existsSync(path)) return

  const content = readFileSync(path, "utf8")
  const lines = content.split("\n").filter((l) => l.length > 0)
  for (const line of lines) {
    const rec = parseLine(line)
    if (!rec) {
      console.error(`[sgc tail] malformed line skipped: ${line.slice(0, 80)}`)
      continue
    }
    say(opts.json ? line : formatHuman(rec))
  }
}
