// Eval-level invariant scenarios — cross-module regressions for contracts
// declared in contracts/sgc-invariants.md. Per Invariant §12, every new
// invariant gets a regression test in this directory in the same commit as
// its runtime enforcement.
//
// Phase G.1.a adds §13 (Spawn + LLM event audit completeness). This file
// currently covers only §13; other invariants have their own dedicated
// eval files (compound-*, reviewer-*, L3-auto-refused, etc.) that predate
// this file.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { spawn, SpawnError } from "../../src/dispatcher/spawn"
import type { EventRecord } from "../../src/dispatcher/logger"
import { createEvalWorkspace, destroyEvalWorkspace } from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-invariant-13-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
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

describe("Invariant §13 — event audit completeness under fault injection", () => {
  test("spawn throws mid-flight → spawn.end(outcome=error) still emitted (Tier 1)", async () => {
    await expect(
      spawn(
        "classifier.level",
        { user_request: "fix" },
        {
          stateRoot: tmp,
          taskId: "invariant-13-test-1",
          inlineStub: () => ({
            level: "L0",
            rationale: "x",
            affected_readers_candidates: [],
          }),
          forceError: new Error("fault injected"),
        },
      ),
    ).rejects.toThrow("fault injected")

    const events = readEvents(tmp)
    const starts = events.filter((e) => e.event_type === "spawn.start")
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(starts.length).toBe(1)
    expect(ends.length).toBe(1)
    expect(ends[0]?.payload["outcome"]).toBe("error")
    expect(ends[0]?.level).toBe("warn")
    // Paired by spawn_id
    expect(starts[0]?.spawn_id).toBe(ends[0]?.spawn_id)
    // task_id correlation preserved under fault injection
    expect(starts[0]?.task_id).toBe("invariant-13-test-1")
    expect(ends[0]?.task_id).toBe("invariant-13-test-1")
  })

  test("multiple concurrent spawns produce correctly-paired events", async () => {
    // Fire 3 spawns concurrently; verify events.ndjson has exactly 3 starts
    // + 3 ends, each pair sharing a spawn_id. Catches any shared-state bugs
    // in the logger (e.g. a singleton that commingles events).
    const runs = [
      { taskId: "concurrent-a", stub: () => ({ level: "L0" as const, rationale: "a", affected_readers_candidates: [] }) },
      { taskId: "concurrent-b", stub: () => ({ level: "L1" as const, rationale: "b", affected_readers_candidates: [] }) },
      { taskId: "concurrent-c", stub: () => ({ level: "L2" as const, rationale: "c", affected_readers_candidates: [] }) },
    ]
    await Promise.all(
      runs.map((r) =>
        spawn(
          "classifier.level",
          { user_request: r.taskId },
          { stateRoot: tmp, taskId: r.taskId, inlineStub: r.stub },
        ),
      ),
    )

    const events = readEvents(tmp)
    const starts = events.filter((e) => e.event_type === "spawn.start")
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(starts.length).toBe(3)
    expect(ends.length).toBe(3)

    // Every start has a matching end with the same spawn_id
    for (const start of starts) {
      const matchingEnd = ends.find((e) => e.spawn_id === start.spawn_id)
      expect(matchingEnd).toBeDefined()
      expect(matchingEnd?.payload["outcome"]).toBe("success")
    }

    // Every expected task_id is present
    const taskIds = new Set(starts.map((e) => e.task_id))
    expect(taskIds.has("concurrent-a")).toBe(true)
    expect(taskIds.has("concurrent-b")).toBe(true)
    expect(taskIds.has("concurrent-c")).toBe(true)
  })

  test("pre-§13 failure (manifest not found) → no events emitted", async () => {
    // Scope clarification from spec §3: Invariant §13 applies from spawn.start
    // emission onward. Pre-emission failures (manifest lookup, scope tokens)
    // are covered by Invariants §1 / §8, not §13. If manifest doesn't exist,
    // spawn() throws before emitting anything — and events.ndjson stays empty.
    await expect(
      spawn(
        "agent.that.does.not.exist",
        {},
        {
          stateRoot: tmp,
          inlineStub: () => ({}),
        },
      ),
    ).rejects.toThrow()

    const events = readEvents(tmp)
    expect(events.length).toBe(0)
  })
})
