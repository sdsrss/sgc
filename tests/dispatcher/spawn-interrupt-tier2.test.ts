// P2-4 regression: Invariant §13 **Tier 2** must survive SIGINT/SIGTERM.
//
// The v1.17.0 drain fixed Tier 1 (spawn.start/spawn.end) but backfilled only
// half the symptom it was built from. The original dogfood finding was 9
// entries matching `spawn.start + llm.request + (no llm.response, no
// spawn.end)` — the drain synthesized the missing spawn.end and left the
// llm.request just as orphaned as before.
//
// Why the agents' own try/catch can't cover it: the drain calls abort(), which
// rejects the in-flight fetch *asynchronously*, then synchronously emits
// spawn.end and calls process.exit(). The catch block that would emit
// llm.response never gets scheduled. So the drain must close Tier 2 itself,
// exactly as it already does for Tier 1.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  spawn,
  __drainOpenSpawnsForSignal,
  __getOpenSpawnCount,
  __resetOpenSpawnsForTests,
} from "../../src/dispatcher/spawn"
import type { EventRecord, Logger } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-tier2-interrupt-"))
  __resetOpenSpawnsForTests()
})
afterEach(() => {
  __resetOpenSpawnsForTests()
  rmSync(tmp, { recursive: true, force: true })
})

/**
 * openrouter mode gates on OPENROUTER_API_KEY (openrouter-agent.ts reads
 * process.env directly), so these tests must set it — but scoped to the awaited
 * body only, never via beforeEach. Mode resolution prefers a key over an
 * inlineStub, so a key left set for even one extra test turns unrelated
 * inline-mode spawns into live network calls that hang for 5s and then fail.
 * (Learned the hard way: a beforeEach version of this leaked into the Tier-1
 * suites and reported 6 phantom failures.) Mirrors llm-agent-events.test.ts.
 */
async function withOpenRouterKey<T>(fn: () => Promise<T>): Promise<T> {
  const prev = process.env["OPENROUTER_API_KEY"]
  process.env["OPENROUTER_API_KEY"] = "test-key"
  try {
    return await fn()
  } finally {
    if (prev === undefined) delete process.env["OPENROUTER_API_KEY"]
    else process.env["OPENROUTER_API_KEY"] = prev
  }
}

function collectingLogger(events: EventRecord[]): Logger {
  return {
    say: () => {},
    event: (partial) => events.push({ schema_version: 1, ts: new Date().toISOString(), ...partial }),
  }
}

/** A fetch that never settles — the "operator hits Ctrl+C mid-LLM-call" shape. */
function hangingFetch(onAbort: () => void) {
  return async (_url: string, init: RequestInit): Promise<Response> =>
    new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => {
        onAbort()
        reject(Object.assign(new Error("aborted"), { name: "AbortError" }))
      })
    })
}

describe("Invariant §13 Tier 2 — signal-interrupted LLM calls (P2-4)", () => {
  test("drain pairs an in-flight llm.request with a synthetic llm.response", async () => {
    const events: EventRecord[] = []
    let aborted = false
    await withOpenRouterKey(async () => {
    const p = spawn(
      "classifier.level",
      { user_request: "x" },
      {
        stateRoot: tmp,
        taskId: "T-tier2",
        mode: "openrouter",
        openRouterFetch: hangingFetch(() => (aborted = true)),
        logger: collectingLogger(events),
        llmMaxRetries: 0,
        sleep: async () => {},
      },
    )
    await new Promise<void>((r) => setTimeout(r, 20))

    // Precondition: the request went out and the spawn is open.
    expect(events.filter((e) => e.event_type === "llm.request")).toHaveLength(1)
    expect(__getOpenSpawnCount()).toBe(1)

    __drainOpenSpawnsForSignal("SIGINT")

    // The §13 Tier-2 contract: every llm.request has a matching llm.response.
    const reqs = events.filter((e) => e.event_type === "llm.request")
    const reses = events.filter((e) => e.event_type === "llm.response")
    expect(reses).toHaveLength(reqs.length)
    expect(reses[0]?.payload["outcome"]).toBe("interrupted")
    expect(reses[0]?.level).toBe("warn")
    expect(reses[0]?.spawn_id).toBe(reqs[0]?.spawn_id)
    expect(reses[0]?.task_id).toBe("T-tier2")
    expect(reses[0]?.agent).toBe("classifier.level")
    expect(typeof reses[0]?.payload["latency_ms"]).toBe("number")

    // Tier 1 still holds (the existing guarantee is not regressed).
    expect(events.filter((e) => e.event_type === "spawn.end")).toHaveLength(1)
    // STAB-2 still holds: the fetch was aborted, not left dangling.
    expect(aborted).toBe(true)

    await p.catch(() => {}) // the aborted fetch rejects; settle it
    })
  })

  test("no double-emit: an already-answered llm.request is not closed twice", async () => {
    const events: EventRecord[] = []
    // A fetch that returns a normal response → the agent emits its own
    // llm.response. A later drain must not append a second one.
    const okFetch = async (_url: string, _init: RequestInit): Promise<Response> =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content:
                    "```yaml\nlevel: L0\nrationale: trivial typo fix in readme.md\naffected_readers_candidates: [dispatcher]\n```",
                },
              },
            ],
            usage: { prompt_tokens: 1, completion_tokens: 1 },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
    await withOpenRouterKey(() =>
      spawn(
        "classifier.level",
        { user_request: "fix typo" },
        {
          stateRoot: tmp,
          mode: "openrouter",
          openRouterFetch: okFetch,
          logger: collectingLogger(events),
          llmMaxRetries: 0,
          sleep: async () => {},
        },
      ),
    )
    expect(events.filter((e) => e.event_type === "llm.response")).toHaveLength(1)
    expect(events.filter((e) => e.event_type === "llm.response")[0]?.payload["outcome"]).toBe(
      "success",
    )

    // Spawn completed → deregistered → drain is a no-op, no phantom response.
    __drainOpenSpawnsForSignal("SIGINT")
    expect(events.filter((e) => e.event_type === "llm.response")).toHaveLength(1)
  })

  test("inline-mode spawn has no llm.request, so the drain adds no llm.response", async () => {
    const events: EventRecord[] = []
    let resolveStub: ((v: unknown) => void) | null = null
    const p = spawn(
      "classifier.level",
      { user_request: "x" },
      {
        stateRoot: tmp,
        // Explicit: this suite's beforeEach sets OPENROUTER_API_KEY, and mode
        // resolution prefers a key over an inlineStub — without this the
        // "inline" case would silently become a live openrouter call.
        mode: "inline",
        logger: collectingLogger(events),
        inlineStub: () => new Promise((r) => (resolveStub = r)),
      },
    )
    await new Promise<void>((r) => setTimeout(r, 10))
    __drainOpenSpawnsForSignal("SIGTERM")
    // Tier 1 closes; Tier 2 never opened, so nothing to close.
    expect(events.filter((e) => e.event_type === "spawn.end")).toHaveLength(1)
    expect(events.filter((e) => e.event_type === "llm.response")).toHaveLength(0)
    ;(resolveStub as ((v: unknown) => void) | null)?.({
      level: "L0",
      rationale: "x",
      affected_readers_candidates: [],
    })
    await p.catch(() => {})
  })
})
