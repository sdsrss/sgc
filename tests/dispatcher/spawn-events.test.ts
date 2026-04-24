// Tier 1 (§13) — every spawn() MUST emit paired spawn.start + spawn.end.
// See docs/superpowers/specs/2026-04-24-phase-g-design.md §3.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { EventRecord } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-spawn-events-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function readEvents(tmp: string): EventRecord[] {
  const path = resolve(tmp, "progress/events.ndjson")
  try {
    const content = readFileSync(path, "utf8").trim()
    if (!content) return []
    return content.split("\n").map((l) => JSON.parse(l) as EventRecord)
  } catch {
    return []
  }
}

describe("Invariant §13 Tier 1 — spawn pair emission", () => {
  test("successful spawn emits spawn.start + spawn.end(success)", async () => {
    await spawn(
      "classifier.level",
      { user_request: "fix typo" },
      {
        stateRoot: tmp,
        taskId: "test-task-1",
        inlineStub: () => ({
          level: "L0",
          rationale: "test",
          affected_readers_candidates: [],
        }),
      },
    )
    const events = readEvents(tmp)
    const starts = events.filter((e) => e.event_type === "spawn.start")
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(starts.length).toBe(1)
    expect(ends.length).toBe(1)
    expect(starts[0]?.agent).toBe("classifier.level")
    expect(starts[0]?.task_id).toBe("test-task-1")
    expect(starts[0]?.spawn_id).toBe(ends[0]?.spawn_id)
    expect(ends[0]?.payload["outcome"]).toBe("success")
    expect(typeof ends[0]?.payload["elapsed_ms"]).toBe("number")
  })

  test("spawn that throws still emits spawn.end(error)", async () => {
    const err = new Error("forced failure")
    await expect(
      spawn(
        "classifier.level",
        { user_request: "fix typo" },
        {
          stateRoot: tmp,
          taskId: "test-task-2",
          inlineStub: () => ({
            level: "L0",
            rationale: "test",
            affected_readers_candidates: [],
          }),
          forceError: err,
        },
      ),
    ).rejects.toThrow("forced failure")
    const events = readEvents(tmp)
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(ends.length).toBe(1)
    expect(ends[0]?.payload["outcome"]).toBe("error")
    expect(ends[0]?.level).toBe("warn")
  })

  test("spawn_id correlates start and end events", async () => {
    await spawn(
      "classifier.level",
      { user_request: "fix" },
      {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "x",
          affected_readers_candidates: [],
        }),
      },
    )
    const events = readEvents(tmp)
    expect(events[0]?.spawn_id).toBe(events[1]?.spawn_id)
    expect(events[0]?.spawn_id).toMatch(/classifier\.level$/)
  })

  test("no taskId → task_id is null in events", async () => {
    await spawn(
      "classifier.level",
      { user_request: "fix" },
      {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "x",
          affected_readers_candidates: [],
        }),
      },
    )
    const events = readEvents(tmp)
    expect(events[0]?.task_id).toBe(null)
    expect(events[1]?.task_id).toBe(null)
  })
})
