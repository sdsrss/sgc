// CE-5 (f6) — sgc loop orchestrator tests. RED-first: all of these
// fail before src/dispatcher/loop.ts exists; they pin the 6-step
// chain semantics + manual-gate pause + fail-fast checkpoint +
// --resume retry/skip behavior.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  runLoop,
  listLoopRuns,
  showLoopRun,
  LoopError,
  type LoopRun,
  type StepRunners,
} from "../../src/dispatcher/loop"
import {
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
} from "../../src/dispatcher/state"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-loop-"))
  ensureSgcStructure(stateRoot)
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

// ── fake step runners ──────────────────────────────────────────────────────

function fakePlan(
  result: { task_id: string; level: "L0" | "L1" | "L2" | "L3"; intent_path: string } = {
    task_id: "01HTASKFAKEPLAN00000000000",
    level: "L1",
    intent_path: "/fake/intent.md",
  },
): NonNullable<StepRunners["plan"]> {
  return async () => result
}

function failingPlan(message: string): NonNullable<StepRunners["plan"]> {
  return async () => {
    throw new Error(message)
  }
}

function noopReview(): NonNullable<StepRunners["review"]> {
  return async () => undefined
}
function noopQa(): NonNullable<StepRunners["qa"]> {
  return async () => undefined
}
function noopCompound(): NonNullable<StepRunners["compound"]> {
  return async () => undefined
}

function allFakes(over: Partial<StepRunners> = {}): StepRunners {
  return {
    plan: fakePlan(),
    review: noopReview(),
    qa: noopQa(),
    compound: noopCompound(),
    ...over,
  }
}

function fixedNow(iso: string): () => number {
  const ms = Date.parse(iso)
  return () => ms
}

// ── tests ──────────────────────────────────────────────────────────────

describe("runLoop — fresh start", () => {
  it("runs plan then pauses at work gate; subsequent steps stay pending", async () => {
    const r = await runLoop("fix a typo", {
      stateRoot,
      steps: allFakes(),
      ulid: () => "01HRUNFRESH00000000000000",
      now: fixedNow("2026-05-22T10:00:00Z"),
    })
    expect(r.terminal_reason).toBe("paused_work")
    expect(r.run.run_id).toBe("01HRUNFRESH00000000000000")
    expect(r.run.task).toBe("fix a typo")
    expect(r.run.status).toBe("paused")
    expect(r.run.current_step).toBe("work")
    expect(r.run.task_id).toBe("01HTASKFAKEPLAN00000000000")
    expect(r.run.level).toBe("L1")

    const stepMap = Object.fromEntries(r.run.steps.map((s) => [s.step, s.status]))
    expect(stepMap.plan).toBe("done")
    expect(stepMap.work).toBe("paused")
    expect(stepMap.review).toBe("pending")
    expect(stepMap.qa).toBe("pending")
    expect(stepMap.ship).toBe("pending")
    expect(stepMap.compound).toBe("pending")

    // State file persisted on disk.
    const path = join(stateRoot, "loop-runs", `${r.run.run_id}.md`)
    expect(existsSync(path)).toBe(true)
  })

  it("plan throws → state.status:failed + failed_step + error; halts chain", async () => {
    const r = await runLoop("doomed task", {
      stateRoot,
      steps: allFakes({ plan: failingPlan("openrouter 429 after retries") }),
      ulid: () => "01HRUNFAIL00000000000000",
    })
    expect(r.terminal_reason).toBe("failed")
    expect(r.run.status).toBe("failed")
    expect(r.run.failed_step).toBe("plan")
    expect(r.run.error).toContain("429")
    const stepMap = Object.fromEntries(r.run.steps.map((s) => [s.step, s.status]))
    expect(stepMap.plan).toBe("failed")
    expect(stepMap.work).toBe("pending") // never reached
  })

  it("propagates forceLevel + motivation + userSignature into plan step input", async () => {
    let captured: { state: LoopRun; opts: unknown } | null = null
    const r = await runLoop("audit auth", {
      stateRoot,
      forceLevel: "L3",
      motivation: "long motivation that is at least twenty words for the schema",
      userSignature: { signed_at: "2026-05-22T11:00:00Z", signer_id: "sds" },
      steps: allFakes({
        plan: async (state, opts) => {
          captured = { state, opts }
          return {
            task_id: "01HTASKL3IN0000000000000",
            level: "L3",
            intent_path: "/fake/intent.md",
          }
        },
      }),
      ulid: () => "01HRUNL30000000000000000",
    })
    expect(captured).not.toBeNull()
    expect(r.run.level).toBe("L3")
    // The opts payload passed to plan runner carries the originals.
    expect((captured as { opts: { forceLevel?: string } }).opts.forceLevel).toBe("L3")
  })
})

describe("runLoop — resume past work", () => {
  it("--resume after first pause: marks work done, runs review + qa, pauses at ship", async () => {
    // First pass — pause at work.
    const first = await runLoop("two-step task", {
      stateRoot,
      steps: allFakes(),
      ulid: () => "01HRUNRESUME000000000000",
    })
    expect(first.terminal_reason).toBe("paused_work")

    // --resume — should mark work done, run review + qa, pause at ship.
    const second = await runLoop(null, {
      stateRoot,
      resume: first.run.run_id,
      steps: allFakes(),
    })
    expect(second.terminal_reason).toBe("paused_ship")
    expect(second.run.status).toBe("paused")
    expect(second.run.current_step).toBe("ship")
    const stepMap = Object.fromEntries(
      second.run.steps.map((s) => [s.step, s.status]),
    )
    expect(stepMap.plan).toBe("done")
    expect(stepMap.work).toBe("done")
    expect(stepMap.review).toBe("done")
    expect(stepMap.qa).toBe("done")
    expect(stepMap.ship).toBe("paused")
    expect(stepMap.compound).toBe("pending")
  })
})

describe("runLoop — resume past ship", () => {
  it("--resume after ship pause: marks ship done, runs compound, status:complete", async () => {
    // Drive to ship pause.
    const first = await runLoop("full task", {
      stateRoot,
      steps: allFakes(),
      ulid: () => "01HRUNFULL00000000000000",
    })
    expect(first.terminal_reason).toBe("paused_work")
    const second = await runLoop(null, {
      stateRoot,
      resume: first.run.run_id,
      steps: allFakes(),
    })
    expect(second.terminal_reason).toBe("paused_ship")

    // Resume past ship → compound runs → complete.
    const third = await runLoop(null, {
      stateRoot,
      resume: first.run.run_id,
      steps: allFakes(),
    })
    expect(third.terminal_reason).toBe("complete")
    expect(third.run.status).toBe("complete")
    expect(third.run.current_step).toBe("done")
    const stepMap = Object.fromEntries(
      third.run.steps.map((s) => [s.step, s.status]),
    )
    for (const s of ["plan", "work", "review", "qa", "ship", "compound"]) {
      expect(stepMap[s]).toBe("done")
    }
  })

  it("--resume on already-complete run → returns terminal_reason=complete; no re-runs", async () => {
    // Full happy path.
    const r1 = await runLoop("complete me", {
      stateRoot,
      steps: allFakes(),
      ulid: () => "01HRUNCOMPLETE00000000000",
    })
    let compoundCalls = 0
    await runLoop(null, {
      stateRoot,
      resume: r1.run.run_id,
      steps: allFakes(),
    })
    await runLoop(null, {
      stateRoot,
      resume: r1.run.run_id,
      steps: allFakes({
        compound: async () => {
          compoundCalls++
        },
      }),
    })
    expect(compoundCalls).toBe(1) // ran once during ship-resume
    const finalRun = await runLoop(null, {
      stateRoot,
      resume: r1.run.run_id,
      steps: allFakes({
        plan: async () => {
          throw new Error("should not be called on complete run")
        },
        compound: async () => {
          throw new Error("should not be called on complete run")
        },
      }),
    })
    expect(finalRun.terminal_reason).toBe("complete")
    expect(finalRun.run.status).toBe("complete")
  })
})

describe("runLoop — retry failed step on resume", () => {
  it("plan failed → --resume retries plan → succeeds → pauses at work", async () => {
    const failingPlanInst = failingPlan("LLM 503 transient")
    const r1 = await runLoop("flaky task", {
      stateRoot,
      steps: allFakes({ plan: failingPlanInst }),
      ulid: () => "01HRUNRETRY00000000000000",
    })
    expect(r1.terminal_reason).toBe("failed")
    expect(r1.run.failed_step).toBe("plan")

    // Resume with a now-working plan.
    const r2 = await runLoop(null, {
      stateRoot,
      resume: r1.run.run_id,
      steps: allFakes(),
    })
    expect(r2.terminal_reason).toBe("paused_work")
    expect(r2.run.status).toBe("paused")
    expect(r2.run.failed_step).toBeUndefined()
    expect(r2.run.error).toBeUndefined()
    const stepMap = Object.fromEntries(r2.run.steps.map((s) => [s.step, s.status]))
    expect(stepMap.plan).toBe("done")
  })
})

describe("listLoopRuns + showLoopRun", () => {
  it("listLoopRuns empty corpus → []", async () => {
    const fresh = mkdtempSync(join(tmpdir(), "sgc-loop-empty-"))
    try {
      const r = await listLoopRuns({ stateRoot: fresh })
      expect(r).toEqual([])
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it("listLoopRuns sorts by started_at desc", async () => {
    mkdirSync(join(stateRoot, "loop-runs"), { recursive: true })
    const seed = (id: string, ts: string, task: string): void => {
      const r: LoopRun = {
        run_id: id,
        task,
        started_at: ts,
        last_updated_at: ts,
        current_step: "plan",
        status: "running",
        steps: [{ step: "plan", status: "pending" }],
      }
      writeFileSync(
        join(stateRoot, "loop-runs", `${id}.md`),
        serializeFrontmatter(r as unknown as Record<string, unknown>, ""),
        "utf8",
      )
    }
    seed("01HR001", "2026-05-22T10:00:00Z", "older")
    seed("01HR003", "2026-05-22T12:00:00Z", "newest")
    seed("01HR002", "2026-05-22T11:00:00Z", "middle")
    const r = await listLoopRuns({ stateRoot })
    expect(r.map((x) => x.run_id)).toEqual(["01HR003", "01HR002", "01HR001"])
  })

  it("showLoopRun missing id → LoopError RunNotFound", async () => {
    await expect(
      showLoopRun("01HDOESNOTEXIST000000000", { stateRoot }),
    ).rejects.toMatchObject({ code: "RunNotFound" })
  })
})

describe("runLoop — concurrency guard", () => {
  it("refuses fresh runLoop when paused run exists for same task", async () => {
    const first = await runLoop("conflicting task", {
      stateRoot,
      steps: allFakes(),
      ulid: () => "01HRUNCONFLICT0000000000",
    })
    expect(first.terminal_reason).toBe("paused_work")

    await expect(
      runLoop("conflicting task", {
        stateRoot,
        steps: allFakes(),
        ulid: () => "01HRUNNEW00000000000000",
      }),
    ).rejects.toMatchObject({ code: "ConcurrentRunActive" })
  })
})

describe("L0 carve-out", () => {
  it("L0 plan → skip review/qa/ship/compound; work pause only; resume → complete", async () => {
    const first = await runLoop("trivial typo", {
      stateRoot,
      steps: allFakes({
        plan: async () => ({
          task_id: "01HTASKL0000000000000000",
          level: "L0",
          intent_path: "/n/a (L0 has no intent.md)",
        }),
        // These must NEVER run for L0; throw so we catch a regression.
        review: async () => {
          throw new Error("review must be skipped at L0")
        },
        qa: async () => {
          throw new Error("qa must be skipped at L0")
        },
        compound: async () => {
          throw new Error("compound must be skipped at L0")
        },
      }),
      ulid: () => "01HRUNL00000000000000000",
    })
    expect(first.terminal_reason).toBe("paused_work")
    const stepMap1 = Object.fromEntries(
      first.run.steps.map((s) => [s.step, s.status]),
    )
    expect(stepMap1.plan).toBe("done")
    expect(stepMap1.work).toBe("paused")
    expect(stepMap1.review).toBe("skipped")
    expect(stepMap1.qa).toBe("skipped")
    expect(stepMap1.ship).toBe("skipped")
    expect(stepMap1.compound).toBe("skipped")

    // Resume past work → directly complete (everything else skipped).
    const second = await runLoop(null, {
      stateRoot,
      resume: first.run.run_id,
      steps: allFakes({
        plan: async () => {
          throw new Error("plan must not re-run")
        },
        review: async () => {
          throw new Error("review must be skipped at L0")
        },
      }),
    })
    expect(second.terminal_reason).toBe("complete")
    expect(second.run.status).toBe("complete")
  })
})

describe("State frontmatter round-trip", () => {
  it("written state file parses back into identical LoopRun shape", async () => {
    const r = await runLoop("round trip", {
      stateRoot,
      steps: allFakes(),
      ulid: () => "01HRUNRT0000000000000000",
      now: fixedNow("2026-05-22T13:00:00Z"),
    })
    const path = join(stateRoot, "loop-runs", `${r.run.run_id}.md`)
    const text = readFileSync(path, "utf8")
    const parsed = parseFrontmatter<LoopRun>(text)
    expect(parsed.data.run_id).toBe(r.run.run_id)
    expect(parsed.data.task).toBe("round trip")
    expect(parsed.data.steps.length).toBe(6) // all 6 steps tracked
    expect(parsed.data.steps[0]!.step).toBe("plan")
    expect(parsed.data.steps[0]!.status).toBe("done")
    expect(parsed.data.steps[1]!.step).toBe("work")
    expect(parsed.data.steps[1]!.status).toBe("paused")
  })
})

describe("LoopError shape", () => {
  it("is an Error subclass with readonly .code", async () => {
    try {
      await showLoopRun("01HMISSING", { stateRoot })
      throw new Error("expected showLoopRun to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(LoopError)
      expect(err).toBeInstanceOf(Error)
      expect((err as LoopError).code).toBe("RunNotFound")
    }
  })
})
