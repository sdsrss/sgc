import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
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
