// src/dispatcher/logger.ts
//
// Structured event stream for Phase G.1.a — dual-channel with opts.log
// (human-readable) and opts.event (NDJSON-appending to .sgc/progress/events.ndjson).
//
// Invariant §13: spawn.ts + LLM-mode agents MUST emit paired events — see
// docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

import { appendFileSync, mkdirSync } from "node:fs"
import { dirname, resolve } from "node:path"

export interface EventRecord {
  schema_version: 1
  ts: string                       // ISO 8601 UTC millisecond precision
  task_id: string | null           // null for pre-task events
  spawn_id: string | null          // null for non-spawn events
  agent: string | null             // manifest.name or null
  event_type: `${string}.${string}` // "<domain>.<verb_past>" dot notation, enforced at compile time
  level: "debug" | "info" | "warn" | "error"
  payload: Record<string, unknown>
}

export interface Logger {
  say(msg: string): void
  event(e: Omit<EventRecord, "schema_version" | "ts">): void
}

// LLM event payload schemas per Invariant §13 Tier 2.
// These are typed helpers; EventRecord.payload is still Record<string, unknown>
// to keep schema evolution cheap. Call sites should use these shapes.

export interface LlmRequestPayload {
  model: string
  prompt_chars: number
  cached_prefix_chars?: number
  mode: "anthropic-sdk" | "openrouter" | "claude-cli"
}

export interface LlmResponsePayload {
  outcome: "success" | "timeout" | "error" | "schema_violation"
  latency_ms: number
  input_tokens?: number
  output_tokens?: number
  cache_read_tokens?: number
  cache_creation_tokens?: number
  error_class?: string
}

// Context threaded from spawn() into LLM-mode agents for Tier 2 event emission.
// Centralized here so all three LLM agents (anthropic-sdk, openrouter, claude-cli)
// share the same shape.
export interface LlmAgentContext {
  spawnId: string
  taskId: string | null
  agentName: string
  logger: Logger
}

function defaultNdjsonSink(stateRoot: string): (e: EventRecord) => void {
  const path = resolve(stateRoot, "progress/events.ndjson")
  // Create the parent directory once at sink creation (fail fast if
  // filesystem is unwritable; no per-write syscall overhead).
  mkdirSync(dirname(path), { recursive: true })
  return (e: EventRecord) => {
    try {
      appendFileSync(path, JSON.stringify(e) + "\n", "utf8")
    } catch (err) {
      console.error("[sgc] ndjson write failed:", String(err))
    }
  }
}

export function createLogger(opts: {
  stateRoot?: string
  say?: (m: string) => void
  eventSink?: (e: EventRecord) => void
} = {}): Logger {
  const stateRoot = opts.stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const say = opts.say ?? ((m: string) => console.log(m))
  const sink = opts.eventSink ?? defaultNdjsonSink(stateRoot)
  return {
    say,
    event(partial) {
      const record: EventRecord = {
        schema_version: 1,
        ts: new Date().toISOString(),
        ...partial,
      }
      try {
        sink(record)
      } catch (err) {
        console.error("[sgc] event sink failed:", String(err))
      }
    },
  }
}
