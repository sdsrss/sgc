import { describe, expect, test } from "bun:test"
import type { EventRecord, Logger } from "../../src/dispatcher/logger"

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
