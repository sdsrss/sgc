import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
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

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

async function freshTask() {
  return runPlan("add a markdown table to the README", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    log: () => {},
  })
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
    const after1 = await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed: "test-fixture", log: () => {} })
    expect(after1.active?.id).toBe("f2")
    expect(after1.allDone).toBe(false)
    const after2 = await runWork({ stateRoot: tmp, done: "f2", verifyCommand: "tests pass", waiveRed: "test-fixture", log: () => {} })
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
    await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed: "test-fixture", log: () => {} })
    await expect(
      runWork({ stateRoot: tmp, done: "f1", log: () => {} }),
    ).resolves.toBeDefined()
  })

  test("--done without --verify-command is refused (close-gate)", async () => {
    await freshTask()
    await expect(
      runWork({ stateRoot: tmp, done: "f1", log: () => {} }),
    ).rejects.toThrow(/verify-command/)
  })

  test("--done with empty/whitespace --verify-command is refused", async () => {
    await freshTask()
    await expect(
      runWork({ stateRoot: tmp, done: "f1", verifyCommand: "   ", log: () => {} }),
    ).rejects.toThrow(/verify-command/)
  })

  test("--done with --verify-command persists verify_command into the feature record", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp,
      done: "f1",
      verifyCommand: "bun test tests/dispatcher/sgc-work.test.ts: 12 passed",
      waiveRed: "test-fixture",
      log: () => {},
    })
    const fl = readFeatureList(tmp)
    const f1 = fl?.list.features.find((f) => f.id === "f1")
    expect(f1?.status).toBe("done")
    expect(f1?.verify_command).toBe(
      "bun test tests/dispatcher/sgc-work.test.ts: 12 passed",
    )
  })

  test("--done persists optional --evidence alongside verify_command", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp,
      done: "f1",
      verifyCommand: "tsc --noEmit: 0 errors",
      evidence: "gate refuses bare --done; field round-trips",
      waiveRed: "test-fixture",
      log: () => {},
    })
    const fl = readFeatureList(tmp)
    const f1 = fl?.list.features.find((f) => f.id === "f1")
    expect(f1?.evidence).toBe("gate refuses bare --done; field round-trips")
  })

  test("already-done feature is grandfathered (idempotent, no verify-command needed)", async () => {
    await freshTask()
    await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "x", waiveRed: "test-fixture", log: () => {} })
    // Second --done with no verify-command must NOT throw (already done → no-op).
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
    await runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed: "test-fixture", log: (m) => logs.push(m) })
    expect(logs.some((m) => m.includes("sgc review"))).toBe(true)
  })

  // TDD-ledger close-gate (Phase 2a)
  test("--done without prior-red or waive-red is refused", async () => {
    await freshTask()
    await expect(
      runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", log: () => {} }),
    ).rejects.toThrow(/prior-red|waive-red/)
  })

  test("--done with --prior-red but no --red-output is refused", async () => {
    await freshTask()
    await expect(
      runWork({
        stateRoot: tmp, done: "f1", verifyCommand: "tests pass",
        priorRed: "tests/x.test.ts::t", log: () => {},
      }),
    ).rejects.toThrow(/red-output/)
  })

  test("--done with a prior-red pair AND --waive-red is refused (conflict)", async () => {
    await freshTask()
    await expect(
      runWork({
        stateRoot: tmp, done: "f1", verifyCommand: "tests pass",
        priorRed: "tests/x.test.ts::t", redOutput: "AssertionError", waiveRed: "x",
        log: () => {},
      }),
    ).rejects.toThrow(/not both|conflict/)
  })

  test("--done with a prior-red pair persists prior_red/red_output on the feature", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "tests pass",
      priorRed: "tests/x.test.ts::t_pagination", redOutput: "expected 20 got 50",
      log: () => {},
    })
    const fl = readFeatureList(tmp)
    expect(fl?.list.features[0]?.prior_red).toBe("tests/x.test.ts::t_pagination")
    expect(fl?.list.features[0]?.red_output).toBe("expected 20 got 50")
    expect(fl?.list.features[0]?.waived_red).toBeUndefined()
  })

  test("--done with --waive-red persists waived_red and no prior_red", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed: "docs-only",
      log: () => {},
    })
    const fl = readFeatureList(tmp)
    expect(fl?.list.features[0]?.waived_red).toBe("docs-only")
    expect(fl?.list.features[0]?.prior_red).toBeUndefined()
  })

  // TDD-ledger red-green capture (Phase 2a)
  test("--done with a prior-red pair writes a red-green capture file", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "bun test x",
      priorRed: "tests/x.test.ts::t_pagination", redOutput: "expected 20 got 50",
      evidence: "f1 green after lock", log: () => {},
    })
    const dir = join(tmp, "red-green")
    expect(existsSync(dir)).toBe(true)
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"))
    expect(files.length).toBe(1)
    const raw = readFileSync(join(dir, files[0]!), "utf8")
    expect(raw).toContain("kind: red-green")
    expect(raw).toContain("prior_red:")
    expect(raw).toContain("expected 20 got 50")
    expect(raw).toContain("prevention_seed:")
  })

  test("--done with --waive-red writes NO capture file", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "n/a", waiveRed: "docs-only", log: () => {},
    })
    expect(existsSync(join(tmp, "red-green"))).toBe(false)
  })

  test("already-done feature is a grandfathered no-op (no capture)", async () => {
    await freshTask()
    await runWork({
      stateRoot: tmp, done: "f1", verifyCommand: "x",
      priorRed: "t", redOutput: "boom", log: () => {},
    })
    const dir = join(tmp, "red-green")
    const before = readdirSync(dir).length
    await runWork({ stateRoot: tmp, done: "f1", log: () => {} }) // re-done, no gate
    expect(readdirSync(dir).length).toBe(before)
  })
})
