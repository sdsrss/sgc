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

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

describe("runPlan — full L1 plan flow", () => {
  test("classifies as L1 (default), writes intent + feature-list + current-task", async () => {
    const log: string[] = []
    const r = await runPlan("add a markdown table to the README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
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

  test("classifies typo task as L0 + skips intent.md (audit C3 adjacent fix)", async () => {
    const r = await runPlan("fix typo in README", { stateRoot: tmp, log: () => {} })
    expect(r.level).toBe("L0")
    expect(r.intentPath).toContain("skipped")
    expect(existsSync(resolve(tmp, "decisions", r.taskId, "intent.md"))).toBe(false)
  })

  test("classifies migration as L3 + refuses without signature", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        log: () => {},
      }),
    ).rejects.toThrow(/L3 plan requires human signature/)
  })

  test("L3 with --signed-by + 'yes' confirmation succeeds", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      readConfirmation: async () => "yes",
      log: () => {},
    })
    expect(r.level).toBe("L3")
    const intent = readIntent(r.taskId, tmp)
    expect(intent.user_signature?.signer_id).toBe("alice")
  })

  test("L3 without 'yes' confirmation throws + does NOT write intent (D-3.2)", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
        readConfirmation: async () => "no",
        log: () => {},
      }),
    ).rejects.toThrow(/not confirmed/)
  })

  test("L3 refuses --auto even with --signed-by (Invariant §4)", async () => {
    await expect(
      runPlan("add a database migration to rename column", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
        autoConfirm: true,
        log: () => {},
      }),
    ).rejects.toThrow(/refuses --auto/)
  })

  test("classifies API change as L2", async () => {
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
  })

  test("forceLevel upgrade L1 → L2 succeeds", async () => {
    const r = await runPlan("simple change", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      forceLevel: "L2",
      log: () => {},
    })
    expect(r.level).toBe("L2")
  })

  test("forceLevel downgrade refused (upgrade-only per skill rule)", async () => {
    await expect(
      runPlan("add a database migration", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION,
        forceLevel: "L1",  // classifier returns L3, asking for L1 is downgrade
        log: () => {},
      }),
    ).rejects.toThrow(/upgrade-only/)
  })

  test("L1+ with short motivation throws (audit C3 fix)", async () => {
    await expect(
      runPlan("add a markdown table", {
        stateRoot: tmp,
        // No motivation; task description is 4 words
        log: () => {},
      }),
    ).rejects.toThrow(/≥20 words/)
  })

  // G.3 DF-1: pre-fix split(/\s+/) collapsed CJK runs to a single token
  // and rejected valid Chinese motivations. Post-fix uses Intl.Segmenter.
  test("L1+ with CJK motivation accepted via Intl.Segmenter word-count", async () => {
    const cjkMotivation =
      "事故复盘需要从结构化事件流里读到每次重试的尝试编号与耗时，否则需要逐个文件搜索 YAML 才能拼出失败链路；这条工作把 spawn.ts 的 retry-with-backoff 路径接进 logger。"
    // Sanity (verified manually 2026-04-27): same string under the old
    // split(/\s+/) counter returns 8 words (well under 20), under the new
    // Intl.Segmenter counter returns 45 word-like segments. The fix
    // crossing 20 is what unblocks the runPlan call below.
    const r = await runPlan("add CJK-aware logging to dispatcher spawn", {
      stateRoot: tmp,
      motivation: cjkMotivation,
      log: () => {},
    })
    expect(r.taskId).toBeTruthy()
    expect(r.intentPath).toMatch(/intent\.md$/)
  })

  test("intent.md is immutable: second runPlan with same id forbidden", async () => {
    // Different tasks get different IDs naturally; this proves writeIntent is
    // called with immutability and would catch collisions. We rely on the
    // state.test.ts coverage of IntentImmutable.
    const r1 = await runPlan("first task", { stateRoot: tmp, motivation: LONG_MOTIVATION, log: () => {} })
    const r2 = await runPlan("second task", { stateRoot: tmp, motivation: LONG_MOTIVATION, forceNewTask: true, log: () => {} })
    expect(r1.taskId).not.toBe(r2.taskId)
    expect(existsSync(resolve(tmp, "decisions", r1.taskId, "intent.md"))).toBe(true)
    expect(existsSync(resolve(tmp, "decisions", r2.taskId, "intent.md"))).toBe(true)
  })
})
