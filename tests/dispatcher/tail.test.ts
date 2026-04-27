import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runTail } from "../../src/commands/tail"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-tail-"))
  mkdirSync(resolve(tmp, "progress"), { recursive: true })
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function writeEvent(tmp: string, record: Record<string, unknown>): void {
  appendFileSync(
    resolve(tmp, "progress/events.ndjson"),
    JSON.stringify(record) + "\n",
    "utf8",
  )
}

describe("sgc tail — basic read (G.1.b)", () => {
  test("empty events.ndjson → empty output", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines).toEqual([])
  })

  test("missing events.ndjson → exits cleanly, no error", async () => {
    rmSync(resolve(tmp, "progress"), { recursive: true, force: true })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines).toEqual([])
  })

  test("single event → one line output", async () => {
    writeEvent(tmp, {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "t1",
      spawn_id: "ulid-classifier.level",
      agent: "classifier.level",
      event_type: "spawn.start",
      level: "info",
      payload: { mode: "inline", manifest_version: "0.1" },
    })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines.length).toBe(1)
    expect(lines[0]).toContain("spawn.start")
    expect(lines[0]).toContain("classifier.level")
  })

  test("multiple events → multiple lines in order", async () => {
    for (let i = 0; i < 3; i++) {
      writeEvent(tmp, {
        schema_version: 1,
        ts: `2026-04-24T10:00:0${i}.000Z`,
        task_id: `t${i}`,
        spawn_id: null,
        agent: null,
        event_type: "test.n",
        level: "info",
        payload: { i },
      })
    }
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines.length).toBe(3)
  })

  test("malformed line → skipped with stderr warning, continues", async () => {
    appendFileSync(
      resolve(tmp, "progress/events.ndjson"),
      "not json at all\n" +
        JSON.stringify({
          schema_version: 1,
          ts: "2026-04-24T14:32:17.123Z",
          task_id: null, spawn_id: null, agent: null,
          event_type: "x.y", level: "info", payload: {},
        }) + "\n",
      "utf8",
    )
    const lines: string[] = []
    const errLines: string[] = []
    const origErr = console.error
    console.error = (...args) => errLines.push(args.join(" "))
    try {
      await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    } finally {
      console.error = origErr
    }
    expect(lines.length).toBe(1)   // only valid line printed
    expect(errLines.some((l) => l.includes("malformed"))).toBe(true)
  })

  test("human format has HH:MM:SS time + level + event_type", async () => {
    writeEvent(tmp, {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "t1",
      spawn_id: "abc-classifier.level",
      agent: "classifier.level",
      event_type: "spawn.start",
      level: "info",
      payload: { mode: "anthropic-sdk" },
    })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines.length).toBe(1)
    expect(lines[0]).toMatch(/14:32:17/)     // time
    expect(lines[0]).toContain("info")
    expect(lines[0]).toContain("spawn.start")
    expect(lines[0]).toContain("anthropic-sdk")  // payload_brief
  })

  test("--json emits raw NDJSON unchanged", async () => {
    const record = {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "t1",
      spawn_id: "s1",
      agent: "a1",
      event_type: "spawn.start",
      level: "info",
      payload: { mode: "inline" },
    }
    writeEvent(tmp, record)
    const lines: string[] = []
    await runTail({ stateRoot: tmp, json: true, log: (m) => lines.push(m) })
    expect(lines.length).toBe(1)
    const parsed = JSON.parse(lines[0])
    expect(parsed.event_type).toBe("spawn.start")
    expect(parsed.schema_version).toBe(1)
  })

  test("payload_brief for spawn.end formats outcome + elapsed_ms", async () => {
    writeEvent(tmp, {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "t1",
      spawn_id: "abc-classifier.level",
      agent: "classifier.level",
      event_type: "spawn.end",
      level: "info",
      payload: { outcome: "success", elapsed_ms: 2244 },
    })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines[0]).toContain("success")
    expect(lines[0]).toContain("2244")
  })

  test("payload_brief for llm.response formats outcome + latency + tokens", async () => {
    writeEvent(tmp, {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "t1",
      spawn_id: "abc-planner.eng",
      agent: "planner.eng",
      event_type: "llm.response",
      level: "info",
      payload: { outcome: "success", latency_ms: 412, input_tokens: 100, output_tokens: 50 },
    })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, log: (m) => lines.push(m) })
    expect(lines[0]).toContain("success")
    expect(lines[0]).toContain("412")
    expect(lines[0]).toMatch(/in=100/)
    expect(lines[0]).toMatch(/out=50/)
  })
})

describe("sgc tail — filters (G.1.b)", () => {
  beforeEach(() => {
    // Seed 6 events with 2 tasks, 3 agents, 4 event_types
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T10:00:00.000Z", task_id: "ta", spawn_id: "s1-planner.eng", agent: "planner.eng", event_type: "spawn.start", level: "info", payload: {} })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T10:00:01.000Z", task_id: "ta", spawn_id: "s1-planner.eng", agent: "planner.eng", event_type: "spawn.end", level: "info", payload: { outcome: "success" } })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T10:00:02.000Z", task_id: "ta", spawn_id: "s2-reviewer.correctness", agent: "reviewer.correctness", event_type: "spawn.start", level: "info", payload: {} })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T11:00:00.000Z", task_id: "tb", spawn_id: "s3-classifier.level", agent: "classifier.level", event_type: "llm.request", level: "info", payload: {} })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T11:00:01.000Z", task_id: "tb", spawn_id: "s3-classifier.level", agent: "classifier.level", event_type: "llm.response", level: "info", payload: { outcome: "success" } })
    writeEvent(tmp, { schema_version: 1, ts: "2026-04-24T11:00:02.000Z", task_id: "tb", spawn_id: "s3-classifier.level", agent: "classifier.level", event_type: "spawn.end", level: "info", payload: { outcome: "success" } })
  })

  test("--task filter narrows to one task_id", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, task: "ta", log: (m) => lines.push(m) })
    expect(lines.length).toBe(3)  // ta has 3 events
  })

  test("--agent exact match", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, agent: "planner.eng", log: (m) => lines.push(m) })
    expect(lines.length).toBe(2)
  })

  test("--agent glob matches with *", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, agent: "planner.*", log: (m) => lines.push(m) })
    expect(lines.length).toBe(2)   // planner.eng events
  })

  test("--event-type substring filter", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, eventType: "llm.", log: (m) => lines.push(m) })
    expect(lines.length).toBe(2)   // llm.request + llm.response
  })

  test("--since drops earlier events", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, since: "2026-04-24T10:30:00.000Z", log: (m) => lines.push(m) })
    expect(lines.length).toBe(3)   // only 11:00:xx events
  })

  test("multiple filters AND together", async () => {
    const lines: string[] = []
    await runTail({
      stateRoot: tmp, task: "tb", eventType: "llm.",
      log: (m) => lines.push(m),
    })
    expect(lines.length).toBe(2)   // tb ∩ llm.* = llm.request + llm.response
  })

  test("filter that matches nothing → empty output", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, task: "nonexistent", log: (m) => lines.push(m) })
    expect(lines.length).toBe(0)
  })

  test("--agent glob filter ignores null agent events", async () => {
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T12:00:00.000Z",
      task_id: "tc", spawn_id: null, agent: null,
      event_type: "cmd.plan_started", level: "info", payload: {},
    })
    const lines: string[] = []
    await runTail({ stateRoot: tmp, agent: "*", log: (m) => lines.push(m) })
    // Agent null does NOT match `*` glob — glob requires a non-null value
    expect(lines.length).toBe(6)   // all 6 seeded events have non-null agent
  })
})

// G.3 DF-3: --limit N applied post-filter on initial drain.
describe("sgc tail --limit (G.3 DF-3)", () => {
  beforeEach(() => {
    for (let i = 0; i < 5; i++) {
      writeEvent(tmp, {
        schema_version: 1,
        ts: `2026-04-27T10:00:0${i}.000Z`,
        task_id: "t1",
        spawn_id: `s${i}`,
        agent: i % 2 === 0 ? "planner.eng" : "classifier.level",
        event_type: "spawn.start",
        level: "info",
        payload: {},
      })
    }
  })

  test("--limit 3 returns last 3 of 5", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, limit: 3, log: (m) => lines.push(m) })
    expect(lines.length).toBe(3)
    expect(lines[0]).toContain("s2")
    expect(lines[2]).toContain("s4")
  })

  test("--limit larger than matched returns all matched", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, limit: 100, log: (m) => lines.push(m) })
    expect(lines.length).toBe(5)
  })

  test("--limit 0 returns nothing", async () => {
    const lines: string[] = []
    await runTail({ stateRoot: tmp, limit: 0, log: (m) => lines.push(m) })
    expect(lines.length).toBe(0)
  })

  test("--limit applies AFTER filters (last N matching, not last N raw)", async () => {
    const lines: string[] = []
    await runTail({
      stateRoot: tmp,
      agent: "planner.eng",
      limit: 2,
      log: (m) => lines.push(m),
    })
    // 3 planner.eng events (s0/s2/s4); --limit 2 returns last 2 of those
    expect(lines.length).toBe(2)
    expect(lines[0]).toContain("s2")
    expect(lines[1]).toContain("s4")
  })
})

describe("sgc tail --follow (G.1.b)", () => {
  test("picks up new lines appended after start", async () => {
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
      task_id: "t1", spawn_id: null, agent: null,
      event_type: "initial.event", level: "info", payload: {},
    })
    const lines: string[] = []
    const controller = new AbortController()
    const tailPromise = runTail({
      stateRoot: tmp,
      follow: true,
      pollIntervalMs: 50,
      abortSignal: controller.signal,
      log: (m) => lines.push(m),
    })
    await new Promise((r) => setTimeout(r, 100))
    expect(lines.length).toBe(1)
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:01.000Z",
      task_id: "t1", spawn_id: null, agent: null,
      event_type: "appended.event", level: "info", payload: {},
    })
    await new Promise((r) => setTimeout(r, 200))
    controller.abort()
    await tailPromise
    expect(lines.length).toBe(2)
    expect(lines[1]).toContain("appended.event")
  })

  test("file rotation (size shrinks) → offset reset + replays from 0", async () => {
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
      task_id: null, spawn_id: null, agent: null,
      event_type: "first.event", level: "info", payload: {},
    })
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:01.000Z",
      task_id: null, spawn_id: null, agent: null,
      event_type: "second.event", level: "info", payload: {},
    })
    const lines: string[] = []
    const controller = new AbortController()
    const tailPromise = runTail({
      stateRoot: tmp,
      follow: true,
      pollIntervalMs: 50,
      abortSignal: controller.signal,
      log: (m) => lines.push(m),
    })
    await new Promise((r) => setTimeout(r, 100))
    expect(lines.length).toBe(2)
    // Simulate rotation — truncate file and write fresh content
    writeFileSync(
      resolve(tmp, "progress/events.ndjson"),
      JSON.stringify({
        schema_version: 1, ts: "2026-04-24T11:00:00.000Z",
        task_id: null, spawn_id: null, agent: null,
        event_type: "post.rotation.event", level: "info", payload: {},
      }) + "\n",
      "utf8",
    )
    await new Promise((r) => setTimeout(r, 200))
    controller.abort()
    await tailPromise
    // Expected: 2 pre-rotation + 1 post-rotation = 3 lines total
    expect(lines.length).toBe(3)
    expect(lines[2]).toContain("post.rotation.event")
  })

  test("--follow in empty dir waits for file creation", async () => {
    rmSync(resolve(tmp, "progress"), { recursive: true, force: true })
    const lines: string[] = []
    const controller = new AbortController()
    const tailPromise = runTail({
      stateRoot: tmp,
      follow: true,
      pollIntervalMs: 50,
      abortSignal: controller.signal,
      log: (m) => lines.push(m),
    })
    await new Promise((r) => setTimeout(r, 100))
    expect(lines.length).toBe(0)  // nothing to tail yet
    mkdirSync(resolve(tmp, "progress"), { recursive: true })
    writeEvent(tmp, {
      schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
      task_id: null, spawn_id: null, agent: null,
      event_type: "first.event", level: "info", payload: {},
    })
    await new Promise((r) => setTimeout(r, 200))
    controller.abort()
    await tailPromise
    expect(lines.length).toBe(1)
  })
})
