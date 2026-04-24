// Eval scenarios: dedup match + dedup miss.
//
// Invariant §3 (0.85 threshold for semantic duplicate). Eval covers the
// behavioral contract: identical problem text hits dedup and merges
// source_task_ids; distinct problem texts produce separate entries.
//
// Invariants exercised: §3 (dedup threshold), §10 (atomic), §12 (this)
//
// Notes:
//   - dedup uses signature (SHA-256 of normalized problem) + Jaccard on
//     tags and problem tokens (D-dec-2 tier b).
//   - --force bypasses dedup and writes a second entry — not tested here;
//     covered by compound.test.ts.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runCompound } from "../../src/commands/compound"
import { runPlan } from "../../src/commands/plan"
import { listSolutions } from "../../src/dispatcher/state"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-dedup-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("dedup match scenario (eval §12)", () => {
  test("identical problem text → update_existing + source_task_ids merged", async () => {
    // First task: create the entry
    const p1 = await runPlan(
      "refactor the auth token validation middleware for the public API",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    const r1 = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r1.action).toBe("compound")
    expect(listSolutions(tmp).length).toBe(1)

    // Second task with the same problem text → signature matches exactly
    const p2 = await runPlan(
      "refactor the auth token validation middleware for the public API",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, forceNewTask: true, log: () => {} },
    )
    const r2 = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r2.action).toBe("update_existing")
    expect(r2.duplicateRef).toBeDefined()

    // Still exactly 1 entry on disk; source_task_ids merged
    const entries = listSolutions(tmp)
    expect(entries.length).toBe(1)
    expect(entries[0]?.entry.source_task_ids).toContain(p1.taskId)
    expect(entries[0]?.entry.source_task_ids).toContain(p2.taskId)
    // times_referenced bumped on merge
    expect(entries[0]?.entry.times_referenced).toBe(1)
  })
})

describe("dedup match scenario — 中文 (Unicode hotfix 2026-04-24)", () => {
  test("identical Chinese problem text → update_existing + source_task_ids merged", async () => {
    // Pre-hotfix: tokenize() returned empty Set for all CJK input, so Jaccard
    // on problem_tokens was 0 and dedup collapsed to tags-only matching.
    // Post-hotfix: Intl.Segmenter produces real CJK tokens, full dedup works.
    const chineseIntent = "重构认证中间件的会话管理以支持多租户场景"
    // Note: motivation uses English because sgc-state.schema.yaml min_words
    // counts whitespace-separated tokens. Chinese text has no whitespace
    // between characters so fails min_words ≥ 20. That's a separate bug
    // (same class as this dedup fix) — out of scope here.
    const motivation = LONG_MOTIVATION_FIXTURE

    const p1 = await runPlan(chineseIntent, {
      stateRoot: tmp,
      motivation,
      log: () => {},
    })
    const r1 = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r1.action).toBe("compound")
    expect(listSolutions(tmp).length).toBe(1)

    const p2 = await runPlan(chineseIntent, {
      stateRoot: tmp,
      motivation,
      forceNewTask: true,
      log: () => {},
    })
    const r2 = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r2.action).toBe("update_existing")
    expect(r2.duplicateRef).toBeDefined()

    const entries = listSolutions(tmp)
    expect(entries.length).toBe(1)
    expect(entries[0]?.entry.source_task_ids).toContain(p1.taskId)
    expect(entries[0]?.entry.source_task_ids).toContain(p2.taskId)
  })
})

describe("dedup miss scenario (eval §12)", () => {
  test("distinct problem texts → two separate entries", async () => {
    await runPlan(
      "refactor the auth token validation middleware for the public API",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, log: () => {} },
    )
    await runCompound({ stateRoot: tmp, log: () => {} })

    // Entirely different problem: runtime crash has no token overlap with
    // auth-middleware refactor (after tokenize strips stopwords).
    await runPlan(
      "fix null pointer crash in startup config loader module",
      { stateRoot: tmp, motivation: LONG_MOTIVATION_FIXTURE, forceNewTask: true, log: () => {} },
    )
    const r2 = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r2.action).toBe("compound")

    // Two entries, different categories
    const entries = listSolutions(tmp)
    expect(entries.length).toBe(2)
    const categories = entries.map((e) => e.category).sort()
    expect(categories).toContain("auth")
    // Second entry categorizes as runtime or other depending on keyword
    // match; both are acceptable for miss behavior.
    const second = categories.find((c) => c !== "auth")
    expect(second).toBeDefined()
  })
})
