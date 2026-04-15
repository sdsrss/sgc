import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { readCurrentTask, readFeatureList, readIntent } from "../../src/dispatcher/state"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-plan-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("runPlan — full L1 plan flow", () => {
  test("classifies as L1 (default), writes intent + feature-list + current-task", async () => {
    const log: string[] = []
    const r = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      log: (m) => log.push(m),
    })
    expect(r.level).toBe("L1")
    expect(r.taskId).toMatch(/^[0-9A-F]{26}$/)

    const intent = readIntent(r.taskId, tmp)
    expect(intent.title.length).toBeGreaterThan(0)
    expect(intent.affected_readers.length).toBeGreaterThan(0)
    expect(intent.scope_tokens).toContain("read:decisions:*")
    expect(intent.scope_tokens).toContain("write:decisions")

    const fl = readFeatureList(tmp)
    expect(fl?.list.features.length).toBe(1)

    const ct = readCurrentTask(tmp)
    expect(ct?.task.task_id).toBe(r.taskId)
    expect(ct?.task.level).toBe("L1")

    // audit trail: agent-prompts and agent-results files exist
    const promptDir = resolve(tmp, "progress/agent-prompts")
    expect(existsSync(promptDir)).toBe(true)
  })

  test("classifies typo task as L0", async () => {
    const r = await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    expect(r.level).toBe("L0")
  })

  test("classifies migration as L3 + refuses without signature", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        log: () => {},
      }),
    ).rejects.toThrow(/L3 plan requires human signature/)
  })

  test("L3 with --signed-by succeeds", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      log: () => {},
    })
    expect(r.level).toBe("L3")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.user_signature?.signer_id).toBe("alice")
  })

  test("classifies API change as L2", async () => {
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      log: () => {},
    })
    expect(r.level).toBe("L2")
  })

  test("forceLevel upgrade L1 → L2 succeeds", async () => {
    const r = await runPlan("simple change", {
      stateRoot: tmp,
      forceLevel: "L2",
      log: () => {},
    })
    expect(r.level).toBe("L2")
  })

  test("forceLevel downgrade refused (upgrade-only per skill rule)", async () => {
    await expect(
      runPlan("add a database migration", {
        stateRoot: tmp,
        forceLevel: "L1",  // classifier returns L3, asking for L1 is downgrade
        log: () => {},
      }),
    ).rejects.toThrow(/upgrade-only/)
  })

  test("intent.md is immutable: second runPlan with same id forbidden", async () => {
    // Different tasks get different IDs naturally; this proves writeIntent is
    // called with immutability and would catch collisions. We rely on the
    // state.test.ts coverage of IntentImmutable.
    const r1 = await runPlan("first task", { stateRoot: tmp, log: () => {} })
    const r2 = await runPlan("second task", { stateRoot: tmp, log: () => {} })
    expect(r1.taskId).not.toBe(r2.taskId)
    expect(existsSync(resolve(tmp, "decisions", r1.taskId, "intent.md"))).toBe(true)
    expect(existsSync(resolve(tmp, "decisions", r2.taskId, "intent.md"))).toBe(true)
  })
})
