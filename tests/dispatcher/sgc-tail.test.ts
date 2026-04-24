import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { appendFileSync, mkdirSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-tail-cli-"))
  mkdirSync(resolve(tmp, "progress"), { recursive: true })
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function seedEvent(record: Record<string, unknown>): void {
  appendFileSync(
    resolve(tmp, "progress/events.ndjson"),
    JSON.stringify(record) + "\n",
    "utf8",
  )
}

describe("sgc tail CLI (G.1.b)", () => {
  test("sgc tail reads current .sgc/progress/events.ndjson", async () => {
    seedEvent({
      schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
      task_id: "t1", spawn_id: "s1-x", agent: "x",
      event_type: "spawn.start", level: "info", payload: { mode: "inline" },
    })
    const env = { ...process.env, SGC_STATE_ROOT: tmp }
    delete (env as Record<string, string | undefined>)["NODE_ENV"]  // citty stdout fix (per project_sgc.md)
    const proc = Bun.spawn(["bun", "src/sgc.ts", "tail"], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    expect(stdout).toContain("spawn.start")
    expect(stdout).toContain("inline")
  })

  test("sgc tail --json outputs raw NDJSON", async () => {
    seedEvent({
      schema_version: 1, ts: "2026-04-24T10:00:00.000Z",
      task_id: "t1", spawn_id: "s1-x", agent: "x",
      event_type: "spawn.start", level: "info", payload: { mode: "inline" },
    })
    const env = { ...process.env, SGC_STATE_ROOT: tmp }
    delete (env as Record<string, string | undefined>)["NODE_ENV"]
    const proc = Bun.spawn(["bun", "src/sgc.ts", "tail", "--json"], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    const line = stdout.trim().split("\n").find((l) => l.startsWith("{"))
    expect(line).toBeDefined()
    const parsed = JSON.parse(line!)
    expect(parsed.event_type).toBe("spawn.start")
    expect(parsed.schema_version).toBe(1)
  })

  test("sgc tail --task t2 filters correctly", async () => {
    seedEvent({ schema_version: 1, ts: "2026-04-24T10:00:00.000Z", task_id: "t1", spawn_id: "s1", agent: "x", event_type: "spawn.start", level: "info", payload: {} })
    seedEvent({ schema_version: 1, ts: "2026-04-24T10:00:01.000Z", task_id: "t2", spawn_id: "s2", agent: "x", event_type: "spawn.start", level: "info", payload: {} })
    seedEvent({ schema_version: 1, ts: "2026-04-24T10:00:02.000Z", task_id: "t1", spawn_id: "s1", agent: "x", event_type: "spawn.end", level: "info", payload: { outcome: "success" } })
    const env = { ...process.env, SGC_STATE_ROOT: tmp }
    delete (env as Record<string, string | undefined>)["NODE_ENV"]
    const proc = Bun.spawn(["bun", "src/sgc.ts", "tail", "--task", "t2"], {
      env,
      stdout: "pipe",
      stderr: "pipe",
    })
    const stdout = await new Response(proc.stdout).text()
    await proc.exited
    const lines = stdout.trim().split("\n").filter((l) => l.trim().length > 0)
    // Expect exactly 1 event (only t2's spawn.start)
    // Filter out any log-prefix noise (citty/consola) by looking for event_type string
    const eventLines = lines.filter((l) => l.includes("spawn."))
    expect(eventLines.length).toBe(1)
  })
})
