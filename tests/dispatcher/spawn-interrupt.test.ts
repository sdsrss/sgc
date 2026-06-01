// Invariant §13 Tier 1 — SIGINT/SIGTERM mid-spawn MUST still emit a paired
// spawn.end. Default Bun signal behavior terminates without unwinding await
// stacks, so spawn.ts's try/finally is bypassed. The drain registry + signal
// handler synthesize a spawn.end(outcome="interrupted") for each open spawn
// before the process exits, preserving the paired-event contract.
//
// Surfaced by GS-5 v1.17.0 self-dogfood: 9 historical unpaired entries in
// .sgc/progress/events.ndjson, all openrouter-mode, all matching the pattern
// spawn.start + llm.request + (no llm.response, no spawn.end) — operator
// Ctrl+C during long LLM call.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  spawn,
  __drainOpenSpawnsForSignal,
  __getOpenSpawnCount,
  __resetOpenSpawnsForTests,
} from "../../src/dispatcher/spawn"
import { createLogger, type EventRecord, type Logger } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-spawn-interrupt-"))
  __resetOpenSpawnsForTests()
})
afterEach(() => {
  __resetOpenSpawnsForTests()
  rmSync(tmp, { recursive: true, force: true })
})

function readEvents(root: string): EventRecord[] {
  const path = resolve(root, "progress/events.ndjson")
  try {
    const content = readFileSync(path, "utf8").trim()
    if (!content) return []
    return content.split("\n").map((l) => JSON.parse(l) as EventRecord)
  } catch {
    return []
  }
}

describe("Invariant §13 Tier 1 — signal-interrupted spawns", () => {
  test("drain emits synthetic spawn.end(outcome=interrupted, signal=SIGINT) for an open spawn", () => {
    const events: EventRecord[] = []
    const logger: Logger = {
      say: () => {},
      event: (partial) =>
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        }),
    }
    // Simulate a spawn that registered but never ran finally (process killed).
    // Public spawn() does register/deregister; here we exercise drain directly
    // via a hand-built open entry — same API the SIGINT handler uses.
    const startTs = Date.now() - 5000
    // Drain expects entries populated via spawn() — to test drain in isolation
    // we hand-build by calling spawn() with a never-resolving stub that we
    // explicitly skip awaiting (see next test). For this unit test, use the
    // exported registry helper indirectly: we don't have one, so the test
    // must go through spawn(). Pattern instead: spawn() with a Promise that
    // we await briefly, then synchronously drain before the stub resolves.

    // Hand-construct a registered open spawn via a deliberately-pending stub.
    let resolveStub: ((v: unknown) => void) | null = null
    const pendingPromise = spawn(
      "classifier.level",
      { user_request: "test" },
      {
        stateRoot: tmp,
        taskId: "T-interrupt-1",
        logger,
        inlineStub: () =>
          new Promise((resolve) => {
            resolveStub = resolve
          }),
      },
    )
    // Yield once so spawn.start + register happen.
    return new Promise<void>((r) => setTimeout(r, 10)).then(() => {
      expect(__getOpenSpawnCount()).toBe(1)
      __drainOpenSpawnsForSignal("SIGINT")
      expect(__getOpenSpawnCount()).toBe(0)
      const ends = events.filter((e) => e.event_type === "spawn.end")
      expect(ends).toHaveLength(1)
      expect(ends[0]?.payload["outcome"]).toBe("interrupted")
      expect(ends[0]?.payload["signal"]).toBe("SIGINT")
      expect(ends[0]?.level).toBe("warn")
      expect(typeof ends[0]?.payload["elapsed_ms"]).toBe("number")
      expect((ends[0]?.payload["elapsed_ms"] as number) >= 0).toBe(true)
      expect(ends[0]?.task_id).toBe("T-interrupt-1")
      expect(ends[0]?.agent).toBe("classifier.level")
      // Let the pending stub resolve so the test runner doesn't leak the promise.
      resolveStub?.({
        level: "L0",
        rationale: "x",
        affected_readers_candidates: [],
      })
      return pendingPromise.then(() => {})
    })
  })

  test("successful spawn deregisters → drain after success finds no open spawns", async () => {
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
    expect(__getOpenSpawnCount()).toBe(0)
    const events = readEvents(tmp)
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(ends).toHaveLength(1)
    expect(ends[0]?.payload["outcome"]).toBe("success")
  })

  test("failed spawn (forceError) deregisters → no orphan after drain", async () => {
    await expect(
      spawn(
        "classifier.level",
        { user_request: "fix" },
        {
          stateRoot: tmp,
          inlineStub: () => ({
            level: "L0",
            rationale: "x",
            affected_readers_candidates: [],
          }),
          forceError: new Error("forced"),
        },
      ),
    ).rejects.toThrow("forced")
    expect(__getOpenSpawnCount()).toBe(0)
  })

  test("two concurrent open spawns → drain emits 2 synthetic spawn.ends", async () => {
    const events: EventRecord[] = []
    const logger: Logger = {
      say: () => {},
      event: (partial) =>
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        }),
    }
    let resolveA: ((v: unknown) => void) | null = null
    let resolveB: ((v: unknown) => void) | null = null
    const pA = spawn(
      "classifier.level",
      { user_request: "A" },
      {
        stateRoot: tmp,
        taskId: "T-A",
        logger,
        inlineStub: () => new Promise((r) => (resolveA = r)),
      },
    )
    const pB = spawn(
      "classifier.level",
      { user_request: "B" },
      {
        stateRoot: tmp,
        taskId: "T-B",
        logger,
        inlineStub: () => new Promise((r) => (resolveB = r)),
      },
    )
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(__getOpenSpawnCount()).toBe(2)
    __drainOpenSpawnsForSignal("SIGTERM")
    expect(__getOpenSpawnCount()).toBe(0)
    const ends = events.filter((e) => e.event_type === "spawn.end")
    expect(ends).toHaveLength(2)
    for (const e of ends) {
      expect(e.payload["outcome"]).toBe("interrupted")
      expect(e.payload["signal"]).toBe("SIGTERM")
    }
    const taskIds = new Set(ends.map((e) => e.task_id))
    expect(taskIds.has("T-A")).toBe(true)
    expect(taskIds.has("T-B")).toBe(true)
    ;(resolveA as ((v: unknown) => void) | null)?.({ level: "L0", rationale: "x", affected_readers_candidates: [] })
    ;(resolveB as ((v: unknown) => void) | null)?.({ level: "L0", rationale: "x", affected_readers_candidates: [] })
    await Promise.all([pA, pB])
  })

  test("STAB-2: drain SIGTERMs an in-flight claude-cli child via registered kill", async () => {
    const events: EventRecord[] = []
    const logger: Logger = {
      say: () => {},
      event: (partial) =>
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        }),
    }
    let killed = false
    let resolveRunner: ((v: unknown) => void) | null = null
    // Runner registers a kill callback via the onSpawn hook (3rd arg) and never
    // resolves on its own — mirrors a child still running when the signal lands.
    const runner = (
      _argv: string[],
      _timeoutMs: number,
      onSpawn?: (kill: () => void) => void,
    ): Promise<{
      stdout: string
      stderr: string
      exitCode: number
      timedOut: boolean
    }> => {
      onSpawn?.(() => {
        killed = true
      })
      return new Promise((r) => {
        resolveRunner = r as (v: unknown) => void
      })
    }
    const p = spawn(
      "classifier.level",
      { user_request: "x" },
      {
        stateRoot: tmp,
        mode: "claude-cli",
        claudeCliRunner: runner,
        logger,
        llmMaxRetries: 0, // isolate the kill-wiring from STAB-6 retry
        sleep: async () => {},
      },
    )
    await new Promise<void>((r) => setTimeout(r, 10))
    expect(__getOpenSpawnCount()).toBe(1)
    expect(killed).toBe(false)
    __drainOpenSpawnsForSignal("SIGTERM")
    // Drain must invoke the registered kill → child receives SIGTERM, not orphaned.
    expect(killed).toBe(true)
    expect(__getOpenSpawnCount()).toBe(0)
    // Resolve the runner (timed-out shape) so the spawn promise settles and the
    // test runner doesn't leak a pending promise.
    // Cast: TS narrows resolveRunner to its init type (null) because the only
    // assignment is inside the runner closure — mirrors the resolveA/B pattern.
    ;(resolveRunner as ((v: unknown) => void) | null)?.({
      stdout: "",
      stderr: "killed",
      exitCode: -1,
      timedOut: true,
    })
    await expect(p).rejects.toThrow()
  })

  test("drain with no open spawns is a no-op", () => {
    const events: EventRecord[] = []
    const logger: Logger = {
      say: () => {},
      event: (partial) =>
        events.push({
          schema_version: 1,
          ts: new Date().toISOString(),
          ...partial,
        }),
    }
    // No spawn registered.
    __drainOpenSpawnsForSignal("SIGINT")
    expect(events).toHaveLength(0)
    expect(__getOpenSpawnCount()).toBe(0)
    void logger // unused
    void createLogger // referenced for typing
  })
})
