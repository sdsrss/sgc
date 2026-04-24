// Tier 2 (§13) — LLM-mode spawns MUST emit paired llm.request + llm.response.
// This file covers all three LLM modes; Task 6 = anthropic-sdk only, Tasks 7+8
// append openrouter + claude-cli describe blocks.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { spawn } from "../../src/dispatcher/spawn"
import type { EventRecord } from "../../src/dispatcher/logger"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-llm-events-"))
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

describe("Invariant §13 Tier 2 — anthropic-sdk llm.request/response pair", () => {
  test("successful anthropic-sdk call emits llm.request + llm.response(success)", async () => {
    const mockClient = {
      messages: {
        create: async () => ({
          id: "mock",
          content: [{ type: "text", text: "```yaml\nlevel: L1\nrationale: mock\naffected_readers_candidates: []\n```" }],
          role: "assistant",
          model: "claude-opus-4-6",
          stop_reason: "end_turn",
          stop_sequence: null,
          type: "message",
          usage: { input_tokens: 100, output_tokens: 50, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 },
        }),
      },
    }
    await spawn(
      "classifier.level",
      { user_request: "fix typo" },
      {
        stateRoot: tmp,
        taskId: "t1",
        mode: "anthropic-sdk",
        anthropicClientFactory: () => mockClient as never,
      },
    )
    const events = readEvents(tmp)
    const req = events.find((e) => e.event_type === "llm.request")
    const res = events.find((e) => e.event_type === "llm.response")
    expect(req).toBeDefined()
    expect(res).toBeDefined()
    expect(req?.payload["mode"]).toBe("anthropic-sdk")
    expect(typeof req?.payload["model"]).toBe("string")
    expect(typeof req?.payload["prompt_chars"]).toBe("number")
    expect(res?.payload["outcome"]).toBe("success")
    expect(typeof res?.payload["latency_ms"]).toBe("number")
    expect(res?.payload["input_tokens"]).toBe(100)
    expect(res?.payload["output_tokens"]).toBe(50)
    // Verify correlation with spawn.* events
    const starts = events.filter((e) => e.event_type === "spawn.start")
    expect(starts.length).toBe(1)
    expect(req?.spawn_id).toBe(starts[0]?.spawn_id)
  })

  test("anthropic-sdk API error emits llm.response(error) with error_class", async () => {
    const mockClient = {
      messages: {
        create: async () => { throw new Error("mock API failure") },
      },
    }
    await expect(
      spawn(
        "classifier.level",
        { user_request: "fix" },
        {
          stateRoot: tmp,
          taskId: "t2",
          mode: "anthropic-sdk",
          anthropicClientFactory: () => mockClient as never,
        },
      ),
    ).rejects.toThrow()
    const events = readEvents(tmp)
    const res = events.find((e) => e.event_type === "llm.response")
    expect(res).toBeDefined()
    expect(res?.payload["outcome"]).toBe("error")
    expect(typeof res?.payload["error_class"]).toBe("string")
  })
})

describe("Invariant §13 Tier 2 — openrouter llm.request/response pair", () => {
  test("successful openrouter call emits paired events with token counts", async () => {
    // OpenRouter requires OPENROUTER_API_KEY env var — inject a temporary one for this test
    const prevKey = process.env["OPENROUTER_API_KEY"]
    process.env["OPENROUTER_API_KEY"] = "test-key"
    try {
      const mockFetch = async (_url: string, _init: RequestInit) => {
        return new Response(JSON.stringify({
          id: "mock",
          model: "anthropic/claude-sonnet-4",
          choices: [{ message: { content: "```yaml\nlevel: L1\nrationale: mock\naffected_readers_candidates: []\n```" } }],
          usage: { prompt_tokens: 80, completion_tokens: 40, total_tokens: 120 },
        }), { status: 200, headers: { "content-type": "application/json" } })
      }
      await spawn(
        "classifier.level",
        { user_request: "fix" },
        {
          stateRoot: tmp,
          taskId: "t3",
          mode: "openrouter",
          openRouterFetch: mockFetch,
        },
      )
      const events = readEvents(tmp)
      const req = events.find((e) => e.event_type === "llm.request")
      const res = events.find((e) => e.event_type === "llm.response")
      expect(req?.payload["mode"]).toBe("openrouter")
      expect(typeof req?.payload["model"]).toBe("string")
      expect(res?.payload["outcome"]).toBe("success")
      expect(res?.payload["input_tokens"]).toBe(80)
      expect(res?.payload["output_tokens"]).toBe(40)
    } finally {
      if (prevKey === undefined) delete process.env["OPENROUTER_API_KEY"]
      else process.env["OPENROUTER_API_KEY"] = prevKey
    }
  })

  test("openrouter HTTP error emits llm.response(error) with error_class", async () => {
    const prevKey = process.env["OPENROUTER_API_KEY"]
    process.env["OPENROUTER_API_KEY"] = "test-key"
    try {
      const mockFetch = async (_url: string, _init: RequestInit) => {
        return new Response("rate limited", { status: 429 })
      }
      await expect(
        spawn(
          "classifier.level",
          { user_request: "fix" },
          {
            stateRoot: tmp,
            taskId: "t4",
            mode: "openrouter",
            openRouterFetch: mockFetch,
          },
        ),
      ).rejects.toThrow()
      const events = readEvents(tmp)
      const res = events.find((e) => e.event_type === "llm.response")
      expect(res?.payload["outcome"]).toBe("error")
      expect(typeof res?.payload["error_class"]).toBe("string")
    } finally {
      if (prevKey === undefined) delete process.env["OPENROUTER_API_KEY"]
      else process.env["OPENROUTER_API_KEY"] = prevKey
    }
  })
})
