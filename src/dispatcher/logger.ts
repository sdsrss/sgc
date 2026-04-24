// src/dispatcher/logger.ts
//
// Structured event stream for Phase G.1.a — dual-channel with opts.log
// (human-readable) and opts.event (NDJSON-appending to .sgc/progress/events.ndjson).
//
// Invariant §13: spawn.ts + LLM-mode agents MUST emit paired events — see
// docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

export interface EventRecord {
  schema_version: 1
  ts: string                       // ISO 8601 UTC millisecond precision
  task_id: string | null           // null for pre-task events
  spawn_id: string | null          // null for non-spawn events
  agent: string | null             // manifest.name or null
  event_type: string               // "<domain>.<verb_past>" dot notation
  level: "debug" | "info" | "warn" | "error"
  payload: Record<string, unknown>
}

export interface Logger {
  say(msg: string): void
  event(e: Omit<EventRecord, "schema_version" | "ts">): void
}
