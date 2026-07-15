// P3-9: the §13 event stream grew without bound.
//
// `.sgc/progress/events.ndjson` was append-only with no cap. Every spawn, every
// llm.request/response, forever. Its consumers all read the whole file —
// `sgc tail`, and cso's anomaly detection — so an old project's stream degrades
// them, and nothing ever reclaims the space.
//
// The trade-off is real and worth naming: §13 treats this stream as the audit
// trail, and rotation drops the oldest of it. But unbounded growth does not
// preserve the audit — it eventually makes it unreadable, which loses the same
// history plus the tooling. Keeping one rotated generation bounds the stream at
// 2× the cap while leaving the consumers more recent history than they read.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createLogger, EVENTS_MAX_BYTES } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-logrot-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const eventsPath = () => resolve(tmp, "progress/events.ndjson")
const rotatedPath = () => resolve(tmp, "progress/events.ndjson.1")

function emit(logger: ReturnType<typeof createLogger>, n: number): void {
  for (let i = 0; i < n; i++) {
    logger.event({
      task_id: "T-1",
      spawn_id: `S-${i}`,
      agent: "classifier.level",
      event_type: "spawn.start",
      level: "info",
      payload: { i, filler: "x".repeat(400) },
    })
  }
}

describe("events.ndjson rotation (P3-9)", () => {
  test("a stream under the cap is never rotated", () => {
    const logger = createLogger({ stateRoot: tmp })
    emit(logger, 5)
    expect(existsSync(eventsPath())).toBe(true)
    expect(existsSync(rotatedPath())).toBe(false)
    expect(readFileSync(eventsPath(), "utf8").trim().split("\n").length).toBe(5)
  })

  test("crossing the cap rotates to .1 and starts a fresh stream", () => {
    const logger = createLogger({ stateRoot: tmp, maxBytes: 2_000 })
    emit(logger, 20) // ~450 bytes each → well past 2KB
    expect(existsSync(rotatedPath())).toBe(true)
    // The live file is fresh and small; the old generation is preserved.
    expect(statSync(eventsPath()).size).toBeLessThan(2_000)
    expect(statSync(rotatedPath()).size).toBeGreaterThan(0)
  })

  test("the stream stays bounded at 2× the cap no matter how much is written", () => {
    const logger = createLogger({ stateRoot: tmp, maxBytes: 2_000 })
    emit(logger, 200)
    const live = statSync(eventsPath()).size
    const rotated = existsSync(rotatedPath()) ? statSync(rotatedPath()).size : 0
    // Only ONE rotated generation is kept — no .2, no unbounded pile.
    expect(existsSync(resolve(tmp, "progress/events.ndjson.2"))).toBe(false)
    expect(live + rotated).toBeLessThan(2_000 * 2 + 1_000) // + one event's slack
  })

  test("rotation preserves recent events (the audit trail is not just dropped)", () => {
    const logger = createLogger({ stateRoot: tmp, maxBytes: 2_000 })
    emit(logger, 20)
    const all = readFileSync(eventsPath(), "utf8") + readFileSync(rotatedPath(), "utf8")
    // The most recent event must still be readable.
    expect(all).toContain('"i":19')
  })

  test("an existing oversize stream from a prior process is rotated on next write", () => {
    // The byte counter is per-process; a stream inherited from an earlier run
    // must be measured at sink creation, not assumed empty.
    mkdirSync(resolve(tmp, "progress"), { recursive: true })
    writeFileSync(eventsPath(), "x".repeat(3_000) + "\n", "utf8")
    const logger = createLogger({ stateRoot: tmp, maxBytes: 2_000 })
    emit(logger, 1)
    expect(existsSync(rotatedPath())).toBe(true)
    expect(readFileSync(rotatedPath(), "utf8")).toContain("xxx")
  })

  test("the default cap is exported and sane", () => {
    expect(EVENTS_MAX_BYTES).toBeGreaterThan(1_000_000)
  })
})
