// P3-6 regression: a loop run must be locked for its DURATION, not just while
// it claims a run id.
//
// The fresh-start path locks the check-and-claim (STAB-1) and releases the lock
// as soon as the run file is written — the run itself then executes unlocked.
// The resume path never took a lock at all. So two `sgc loop --resume <same-id>`
// invocations both drive the same run: both spawn planners, both write the same
// checkpoint, and last-writer-wins on the run file. Same class of hazard STAB-1
// was built for, one layer further in.
//
// P3-4 is here too: the loop's plan step passed no readConfirmation, so an L3
// task reached runPlan's interactive stdin gate and an unattended loop hung
// forever instead of failing with something an operator could act on.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runLoop, LoopError } from "../../src/dispatcher/loop"
import type { StepRunners } from "../../src/dispatcher/loop"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-loop-lock-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

/** Step runners that pause at `work` so the run parks in a resumable state. */
function pausingRunners(onPlan?: () => void): StepRunners {
  return {
    plan: async () => {
      onPlan?.()
      return {
        task_id: "01TASK0000000000000000000",
        level: "L1",
        intent_path: "decisions/01TASK0000000000000000000/intent.md",
      }
    },
    review: async () => {},
    qa: async () => {},
    compound: async () => {},
  }
}

describe("loop run locking (P3-6)", () => {
  test("a second resume while the first is IN-FLIGHT is refused, not double-run", async () => {
    // Start a run and let it park at the first manual gate.
    const first = await runLoop("add a field to the orders endpoint", {
      stateRoot: tmp,
      motivation: "long enough motivation for the plan gate to accept this task without complaining at all",
      steps: pausingRunners(),
    })
    const runId = first.run.run_id

    // Hold resume A inside the lock, on the `review` step (plan is already done
    // on a resume, so its runner is skipped entirely — gating on plan would
    // never fire). Firing both resumes and hoping they interleave does NOT test
    // mutual exclusion: with fast stub runners the first finishes and releases
    // before the second even reaches the acquire, and the test passes on a
    // codebase with no lock at all.
    let releaseA: () => void
    const aInReview = new Promise<void>((r) => (releaseA = r))
    let aReachedReview: () => void
    const aStarted = new Promise<void>((r) => (aReachedReview = r))

    let reviewCalls = 0
    const a = runLoop(null, {
      stateRoot: tmp,
      resume: runId,
      steps: {
        ...pausingRunners(),
        review: async () => {
          reviewCalls++
          aReachedReview()
          await aInReview
        },
      },
    })
    await aStarted // A now holds the exec lock, parked mid-run

    await expect(
      runLoop(null, { stateRoot: tmp, resume: runId, steps: pausingRunners() }),
    ).rejects.toThrow(LoopError)

    releaseA!()
    await a
    // B must not have re-driven the step A was running.
    expect(reviewCalls).toBe(1)
  })

  test("the refusal names the holder and says what to do", async () => {
    const first = await runLoop("add a field to the orders endpoint", {
      stateRoot: tmp,
      motivation: "long enough motivation for the plan gate to accept this task without complaining at all",
      steps: pausingRunners(),
    })
    let releaseA: () => void
    const gate = new Promise<void>((r) => (releaseA = r))
    let started: () => void
    const startedP = new Promise<void>((r) => (started = r))
    const a = runLoop(null, {
      stateRoot: tmp,
      resume: first.run.run_id,
      steps: {
        ...pausingRunners(),
        review: async () => {
          started()
          await gate
        },
      },
    })
    await startedP
    const err = await runLoop(null, {
      stateRoot: tmp,
      resume: first.run.run_id,
      steps: pausingRunners(),
    }).then(
      () => null,
      (e: unknown) => e as LoopError,
    )
    expect(err).toBeInstanceOf(LoopError)
    expect(err!.code).toBe("ConcurrentRunActive")
    expect(err!.message).toMatch(/in progress/i)
    expect(err!.detail?.["active_pid"]).toBe(process.pid)
    releaseA!()
    await a
  })

  test("a sequential resume still works (the lock releases)", async () => {
    const first = await runLoop("add a field to the orders endpoint", {
      stateRoot: tmp,
      motivation: "long enough motivation for the plan gate to accept this task without complaining at all",
      steps: pausingRunners(),
    })
    // Resume after the first call returned — the lock must be gone.
    const again = await runLoop(null, {
      stateRoot: tmp,
      resume: first.run.run_id,
      steps: pausingRunners(),
    })
    expect(again.run.run_id).toBe(first.run.run_id)
  })
})

describe("loop L3 stdin gate without a terminal (P3-4)", () => {
  test("an L3 step fails fast with operator guidance instead of blocking on stdin", async () => {
    // bun test has no terminal, so process.stdin.isTTY is falsy here exactly as
    // in CI or a detached run — the precondition for the hang.
    expect(process.stdin.isTTY).toBeFalsy()

    // userSignature is REQUIRED to reach the gate: runPlan's L3 signature check
    // (§4) fires first, so `sgc loop <l3-task>` without --signed-by never got as
    // far as the stdin prompt. The hang needed `sgc loop ... --signed-by X` on a
    // machine with no terminal, which is precisely the CI shape.
    const r = await runLoop("run the DB migration to drop the legacy sessions table", {
      stateRoot: tmp,
      motivation:
        "the legacy sessions table blocks the new auth flow and downstream readers depend on a clean schema for the correctness and clarity of the session contract they rely on",
      userSignature: { signed_at: new Date().toISOString(), signer_id: "ci-bot" },
      // No `steps` override → the production runners, including runPlan.
    })

    // The loop records step failures in the checkpoint rather than throwing —
    // that is what makes --resume able to retry. So the evidence is the parked
    // state, not an exception.
    expect(r.terminal_reason).toBe("failed")
    expect(r.run.failed_step).toBe("plan")
    // Must tell the operator how to proceed, not merely that it stopped.
    expect(r.run.error).toContain("sgc plan")
    expect(r.run.error).toContain("--signed-by")
    expect(r.run.error).toContain("sgc loop --resume")
    expect(r.run.error).toMatch(/no terminal|stdin/i)
  })
})
