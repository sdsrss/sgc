// Eval scenario: resume guard — refuse new task when handoff is active.
//
// User story: user runs `sgc plan` twice without completing the first task.
// Expected behavior: second plan throws unless --force-new-task is passed.
// Invariants exercised: handoff continuity (audit gap from 2026-04-16)

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { runPlan } from "../../src/commands/plan"
import { readHandoff } from "../../src/dispatcher/state"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-resume-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("resume guard (new task with active handoff)", () => {
  test("handoff is written after plan", async () => {
    await runPlan("fix typo in README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })

    const hf = readHandoff(tmp)
    expect(hf).not.toBeNull()
    expect(hf!.handoff.from_session).toBeTruthy()
    expect(hf!.handoff.to_session_hint).toBe("sgc work")
  })

  test("second runPlan without --force-new-task throws", async () => {
    await runPlan("fix typo in README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })

    await expect(
      runPlan("another task entirely", {
        stateRoot: tmp,
        motivation: LONG_MOTIVATION_FIXTURE,
        log: () => {},
      }),
    ).rejects.toThrow(/active task.*handoff|force-new-task/)
  })

  test("second runPlan with forceNewTask=true proceeds", async () => {
    await runPlan("fix typo in README", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })

    const plan2 = await runPlan("another task entirely", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      forceNewTask: true,
      log: () => {},
    })

    expect(plan2.taskId).toBeDefined()
    expect(plan2.level).toBeDefined()
  })
})
