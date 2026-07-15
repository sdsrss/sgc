// src/dispatcher/logger.ts
//
// Structured event stream for Phase G.1.a — dual-channel with opts.log
// (human-readable) and opts.event (NDJSON-appending to .sgc/progress/events.ndjson).
//
// Invariant §13: spawn.ts + LLM-mode agents MUST emit paired events — see
// docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

import { appendFileSync, mkdirSync, renameSync, statSync } from "node:fs"
import { acquireFileLock } from "./file-lock"
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
 * forever. The load-bearing argument is memory, not analysis quality (M4
 * correction — the original rationale here overstated it): cso and handoff do
 * window their analysis to a tail, but they `readFileSync` the entire file
 * first, so past ~2GB `sgc cso` throws on Node's max string length and goes
 * down outright. Nothing reclaims the space either.
 *
 * Rotation does drop the oldest audit trail, which §13 cares about — but
 * unbounded growth does not preserve that trail either, it just makes it
 * unreadable while also taking the tooling down with it. One rotated generation
 * bounds the stream at 2× this cap and still leaves far more history than any
 * consumer reads. ~10MB is ~50k events at typical payload size.
 */
export const EVENTS_MAX_BYTES = 10_000_000

/** M4: a project with a larger stream can size it without a rebuild. */
function configuredMaxBytes(): number {
  const raw = process.env["SGC_EVENTS_MAX_BYTES"]
  if (!raw) return EVENTS_MAX_BYTES
  const n = Number.parseInt(raw, 10)
  return Number.isFinite(n) && n > 0 ? n : EVENTS_MAX_BYTES
}

function defaultNdjsonSink(stateRoot: string, maxBytes: number): (e: EventRecord) => void {
  const path = resolve(stateRoot, "progress/events.ndjson")
  const rotated = `${path}.1`
  const rotateLock = `${path}.rotate.lock`
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

  /**
   * M4: `bytes` counts only OUR writes, but the stream is shared. Against a
   * second sgc process the counter is an undercount while it appends and a
   * stale OVERcount once it rotates — and acting on the overcount is what
   * destroyed data: we would rename the freshly-rotated, near-empty live file
   * over the generation that process had just preserved. Measured before the
   * fix: 12 events across two sinks, 1 still readable.
   *
   * So the counter is only a cheap *trigger*; crossing it buys one stat, and
   * the real size decides. Zero syscalls per write on the common path.
   *
   * Bound, stated honestly: one writer → the live stream never exceeds the cap,
   * total never exceeds 2×. N concurrent writers each bound their own
   * contribution, so the live stream can reach N× the cap before anyone's
   * counter trips. That overshoot is benign (N is 2 in the realistic case — an
   * async plan child plus an operator command) and the alternative is a stat on
   * every event.
   */
  const rotateIfNeeded = (lineLen: number): void => {
    if (bytes + lineLen <= maxBytes) return
    let actual: number
    try {
      actual = statSync(path).size
    } catch {
      bytes = 0 // stream vanished under us — treat as fresh
      return
    }
    if (actual + lineLen <= maxBytes) {
      bytes = actual // someone else already rotated; resync, don't rotate again
      return
    }
    // Serialize the rename itself: two writers that both measure over-cap would
    // otherwise race, and the loser can still clobber the winner's generation.
    // Rotation happens once per cap, so this costs nothing per write.
    let release: (() => void) | null = null
    try {
      release = acquireFileLock(rotateLock)
    } catch {
      return // another writer is rotating; appending one event past the cap is fine
    }
    try {
      const recheck = statSync(path).size
      if (recheck + lineLen > maxBytes) {
        // Keep exactly one generation: rename replaces any prior .1, so the
        // pile is bounded rather than growing a .2/.3/... tail.
        renameSync(path, rotated)
        bytes = 0
      } else {
        bytes = recheck
      }
    } catch {
      // Rotation failed (permissions, races) — keep appending rather than
      // dropping the event. An oversize stream beats a lost audit record.
    } finally {
      release()
    }
  }

  return (e: EventRecord) => {
    try {
      const line = JSON.stringify(e) + "\n"
      rotateIfNeeded(line.length)
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
  /** P3-9: rotation cap override (tests). Defaults to SGC_EVENTS_MAX_BYTES, else EVENTS_MAX_BYTES. */
  maxBytes?: number
} = {}): Logger {
  const stateRoot = opts.stateRoot ?? process.env["SGC_STATE_ROOT"] ?? ".sgc"
  const say = opts.say ?? ((m: string) => console.log(m))
  const sink = opts.eventSink ?? defaultNdjsonSink(stateRoot, opts.maxBytes ?? configuredMaxBytes())
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
