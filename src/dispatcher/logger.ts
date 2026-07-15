// src/dispatcher/logger.ts
//
// Structured event stream for Phase G.1.a — dual-channel with opts.log
// (human-readable) and opts.event (NDJSON-appending to .sgc/progress/events.ndjson).
//
// Invariant §13: spawn.ts + LLM-mode agents MUST emit paired events — see
// docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs"
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
  /** "interrupted" mirrors spawn.end's vocabulary: the call was cut short by a
   *  SIGINT/SIGTERM drain rather than by any answer from the provider (P2-4). */
  outcome: "success" | "timeout" | "error" | "schema_violation" | "interrupted"
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
  /**
   * STAB-2: register an abort/kill handle for the in-flight work (a child
   * process kill for claude-cli, an AbortController.abort() for the fetch-based
   * modes). spawn.ts stores it in the open-spawn registry so a SIGINT/SIGTERM
   * drain can reap the child instead of orphaning it. No-op if unset.
   */
  registerAbort?: (abort: () => void) => void
  /**
   * P2-4: register a Tier-2 closer for an llm.request that is now in flight.
   * A SIGINT/SIGTERM drain calls it with outcome="interrupted" to emit the
   * matching llm.response before the process exits.
   *
   * Necessary because registerAbort alone cannot close Tier 2: abort() rejects
   * the in-flight call *asynchronously*, and the drain calls process.exit()
   * synchronously right after, so the agent's own catch → emitResponse is never
   * scheduled. That left `llm.request` orphaned — the precise §13 Tier-2
   * violation the v1.17.0 drain was built to fix, but only closed for Tier 1.
   *
   * The closer MUST be idempotent: the agent may already have answered.
   */
  registerLlmClose?: (close: (outcome: LlmResponsePayload["outcome"]) => void) => void
}

/**
 * P3-9: size cap for `.sgc/progress/events.ndjson` before it rotates to `.1`.
 *
 * The stream was append-only with no bound: every spawn and every LLM call,
 * forever. Its consumers (`sgc tail`, cso's anomaly detection) all read the
 * whole file, so an old project's stream degrades them and nothing reclaims the
 * space.
 *
 * Rotation does drop the oldest audit trail, which §13 cares about — but
 * unbounded growth does not preserve that trail either, it just makes it
 * unreadable while also taking the tooling down with it. One rotated generation
 * bounds the stream at 2× this cap and still leaves far more history than any
 * consumer reads. ~10MB is ~50k events at typical payload size.
 */
export const EVENTS_MAX_BYTES = 10_000_000

function defaultNdjsonSink(stateRoot: string, maxBytes: number): (e: EventRecord) => void {
  const path = resolve(stateRoot, "progress/events.ndjson")
  const rotated = `${path}.1`
  // Create the parent directory once at sink creation (fail fast if
  // filesystem is unwritable; no per-write syscall overhead).
  mkdirSync(dirname(path), { recursive: true })
  // Seed from the file already on disk: the counter is per-process, and a
  // stream inherited from an earlier run must be measured, not assumed empty.
  // One stat at sink creation, then O(1) per write — no syscall per event.
  let bytes = 0
  try {
    bytes = statSync(path).size
  } catch {
    // No stream yet — starts at 0.
  }
  return (e: EventRecord) => {
    try {
      const line = JSON.stringify(e) + "\n"
      if (bytes + line.length > maxBytes) {
        // Keep exactly one generation: rename replaces any prior .1, so the
        // pile is bounded rather than growing a .2/.3/... tail.
        try {
          renameSync(path, rotated)
          bytes = 0
        } catch {
          // Rotation failed (permissions, races) — keep appending rather than
          // dropping the event. An oversize stream beats a lost audit record.
        }
      }
      appendFileSync(path, line, "utf8")
      bytes += line.length
    } catch (err) {
      console.error("[sgc] ndjson write failed:", String(err))
    }
  }
}

export function createLogger(opts: {
  stateRoot?: string
  say?: (m: string) => void
  eventSink?: (e: EventRecord) => void
  /** P3-9: rotation cap override (tests). Defaults to EVENTS_MAX_BYTES. */
  maxBytes?: number
} = {}): Logger {
  const stateRoot = opts.stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const say = opts.say ?? ((m: string) => console.log(m))
  const sink = opts.eventSink ?? defaultNdjsonSink(stateRoot, opts.maxBytes ?? EVENTS_MAX_BYTES)
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
