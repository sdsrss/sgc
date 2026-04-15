import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runWork } from "../../src/commands/work"
import { readCurrentTask, readFeatureList } from "../../src/dispatcher/state"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-work-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

async function freshTask() {
  return runPlan("add a markdown table to the README", { stateRoot: tmp, log: () => {} })
}

describe("runWork", () => {
  test("no active task → throws helpful error", async () => {
    await expect(runWork({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/sgc plan/)
  })

  test("default invocation lists features and reports active", async () => {
    await freshTask()
    const r = await runWork({ stateRoot: tmp, log: () => {} })
    expect(r.allDone).toBe(false)
    expect(r.remaining.length).toBe(1)
    expect(r.active?.id).toBe("f1")
  })

  test("--add appends a feature", async () => {
    await freshTask()
    await runWork({ stateRoot: tmp, add: "second feature", log: () => {} })
    const fl = readFeatureList(tmp)
    expect(fl?.list.features.length).toBe(2)
    expect(fl?.list.features[1]?.id).toBe("f2")
    expect(fl?.list.features[1]?.title).toBe("second feature")
  })

  test("--done marks feature done; active advances", async () => {
    await freshTask()
    await runWork({ stateRoot: tmp, add: "second feature", log: () => {} })
    const after1 = await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    expect(after1.active?.id).toBe("f2")
    expect(after1.allDone).toBe(false)
    const after2 = await runWork({ stateRoot: tmp, done: "f2", log: () => {} })
    expect(after2.allDone).toBe(true)
    expect(after2.remaining.length).toBe(0)
  })

  test("--done on unknown feature throws", async () => {
    await freshTask()
    await expect(
      runWork({ stateRoot: tmp, done: "nope", log: () => {} }),
    ).rejects.toThrow(/not found/)
  })

  test("--done on already-done feature is idempotent (no error)", async () => {
    await freshTask()
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} })
    await expect(
      runWork({ stateRoot: tmp, done: "f1", log: () => {} }),
    ).resolves.toBeDefined()
  })

  test("current-task last_activity updates", async () => {
    await freshTask()
    const before = readCurrentTask(tmp)!.task.last_activity
    await new Promise((r) => setTimeout(r, 5))  // ensure ms tick
    await runWork({ stateRoot: tmp, log: () => {} })
    const after = readCurrentTask(tmp)!.task.last_activity
    expect(after).not.toBe(before)
  })

  test("all-done prompts to run sgc review", async () => {
    const logs: string[] = []
    await freshTask()
    await runWork({ stateRoot: tmp, done: "f1", log: (m) => logs.push(m) })
    expect(logs.some((m) => m.includes("sgc review"))).toBe(true)
  })
})
