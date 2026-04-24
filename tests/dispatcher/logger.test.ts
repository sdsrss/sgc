import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import type { EventRecord, Logger } from "../../src/dispatcher/logger"
import { createLogger } from "../../src/dispatcher/logger"

describe("Logger types (Phase G.1.a)", () => {
  test("EventRecord has required fields", () => {
    const e: EventRecord = {
      schema_version: 1,
      ts: "2026-04-24T14:32:17.123Z",
      task_id: "task-123",
      spawn_id: "spawn-abc",
      agent: "planner.eng",
      event_type: "spawn.start",
      level: "info",
      payload: {},
    }
    expect(e.schema_version).toBe(1)
  })

  test("Logger interface has say + event methods", () => {
    const l: Logger = {
      say: (_m: string) => {},
      event: (_e) => {},
    }
    expect(typeof l.say).toBe("function")
    expect(typeof l.event).toBe("function")
  })
})

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-logger-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("createLogger (Phase G.1.a)", () => {
  test("default say sink prints to console.log (captured)", () => {
    const captured: string[] = []
    const origLog = console.log
    console.log = (...args) => captured.push(args.join(" "))
    try {
      const logger = createLogger({})
      logger.say("hello")
      expect(captured).toEqual(["hello"])
    } finally {
      console.log = origLog
    }
  })

  test("default event sink appends NDJSON to .sgc/progress/events.ndjson", () => {
    const logger = createLogger({ stateRoot: tmp })
    logger.event({
      task_id: "t1",
      spawn_id: "s1",
      agent: "a1",
      event_type: "spawn.start",
      level: "info",
      payload: { mode: "inline" },
    })
    const path = resolve(tmp, "progress/events.ndjson")
    const content = readFileSync(path, "utf8")
    const record = JSON.parse(content.trim())
    expect(record.schema_version).toBe(1)
    expect(record.task_id).toBe("t1")
    expect(record.event_type).toBe("spawn.start")
    expect(typeof record.ts).toBe("string")
    expect(record.ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })

  test("event sink injects schema_version=1 and current ts automatically", () => {
    const logger = createLogger({ stateRoot: tmp })
    const before = Date.now()
    logger.event({
      task_id: null, spawn_id: null, agent: null,
      event_type: "test.event", level: "info", payload: {},
    })
    const after = Date.now()
    const path = resolve(tmp, "progress/events.ndjson")
    const record = JSON.parse(readFileSync(path, "utf8").trim())
    expect(record.schema_version).toBe(1)
    const ts = Date.parse(record.ts)
    expect(ts).toBeGreaterThanOrEqual(before)
    expect(ts).toBeLessThanOrEqual(after)
  })

  test("multiple event() calls produce multiple NDJSON lines", () => {
    const logger = createLogger({ stateRoot: tmp })
    for (let i = 0; i < 3; i++) {
      logger.event({
        task_id: `t${i}`, spawn_id: null, agent: null,
        event_type: "test.n", level: "info", payload: { i },
      })
    }
    const path = resolve(tmp, "progress/events.ndjson")
    const lines = readFileSync(path, "utf8").trim().split("\n")
    expect(lines.length).toBe(3)
    lines.forEach((line, i) => {
      expect(JSON.parse(line).payload.i).toBe(i)
    })
  })

  test("custom say + eventSink override defaults", () => {
    const sayCaptured: string[] = []
    const eventCaptured: unknown[] = []
    const logger = createLogger({
      say: (m) => sayCaptured.push(m),
      eventSink: (e) => eventCaptured.push(e),
    })
    logger.say("hi")
    logger.event({
      task_id: null, spawn_id: null, agent: null,
      event_type: "x.y", level: "info", payload: {},
    })
    expect(sayCaptured).toEqual(["hi"])
    expect(eventCaptured.length).toBe(1)
  })

  test("event sink error is swallowed (spawn must not fail on log failure)", () => {
    const logger = createLogger({
      eventSink: () => { throw new Error("disk full") },
    })
    const origError = console.error
    const errCaptured: string[] = []
    console.error = (...args) => errCaptured.push(args.join(" "))
    try {
      expect(() => logger.event({
        task_id: null, spawn_id: null, agent: null,
        event_type: "x.y", level: "info", payload: {},
      })).not.toThrow()
      expect(errCaptured.some((m) => m.includes("event sink failed"))).toBe(true)
    } finally {
      console.error = origError
    }
  })
})
