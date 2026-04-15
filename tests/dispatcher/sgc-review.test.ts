import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { readReview } from "../../src/dispatcher/state"
import { reviewerCorrectness } from "../../src/dispatcher/agents/reviewer-correctness"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-review-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

async function freshTask() {
  return runPlan("simple change", { stateRoot: tmp, log: () => {} })
}

describe("reviewerCorrectness — stub heuristic", () => {
  test("empty diff → concern + low severity", () => {
    const r = reviewerCorrectness({ diff: "", intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("low")
    expect(r.findings.length).toBe(1)
  })
  test("diff with no markers → pass / none", () => {
    const r = reviewerCorrectness({
      diff: "diff --git a/x b/x\n+++ b/x\n+const a = 1\n+const b = 2\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
    expect(r.severity).toBe("none")
    expect(r.findings.length).toBe(0)
  })
  test("diff with TODO in added line → concern + finding", () => {
    const r = reviewerCorrectness({
      diff: "diff --git a/x b/x\n+++ b/x\n+function f() { /* TODO refactor */ }\n",
      intent: "",
    })
    expect(r.verdict).toBe("concern")
    expect(r.findings.length).toBe(1)
    expect(r.findings[0]?.description).toContain("TODO")
  })
  test("TODO on a removed line is not flagged", () => {
    const r = reviewerCorrectness({
      diff: "diff --git a/x b/x\n--- a/x\n-old line with TODO\n+new line\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
  })
  test("FIXME and XXX also flagged", () => {
    const r = reviewerCorrectness({
      diff: "+code FIXME a\n+code XXX b\n",
      intent: "",
    })
    expect(r.findings.length).toBe(2)
  })
})

describe("runReview — full flow", () => {
  test("no active task → throws", async () => {
    await expect(runReview({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/sgc plan/)
  })

  test("clean diff: writes pass report", async () => {
    const plan = await freshTask()
    const r = await runReview({
      stateRoot: tmp,
      diffOverride: "diff --git a/x b/x\n+++ b/x\n+const ok = 1\n",
      log: () => {},
    })
    expect(r.verdict).toBe("pass")
    expect(r.taskId).toBe(plan.taskId)
    const stored = readReview(plan.taskId, "code", "reviewer.correctness", tmp)
    expect(stored?.report.verdict).toBe("pass")
    expect(stored?.report.severity).toBe("none")
    expect(stored?.report.reviewer_id).toBe("reviewer.correctness")
  })

  test("diff with TODO: writes concern report", async () => {
    const plan = await freshTask()
    const r = await runReview({
      stateRoot: tmp,
      diffOverride: "+function f() { /* TODO impl */ }\n",
      log: () => {},
    })
    expect(r.verdict).toBe("concern")
    const stored = readReview(plan.taskId, "code", "reviewer.correctness", tmp)
    expect(stored?.report.findings.length).toBe(1)
  })

  test("second review for same task fails AppendOnly", async () => {
    await freshTask()
    await runReview({ stateRoot: tmp, diffOverride: "+x\n", log: () => {} })
    await expect(
      runReview({ stateRoot: tmp, diffOverride: "+y\n", log: () => {} }),
    ).rejects.toThrow(/append-only/)
  })

  test("Invariant §1: reviewer.correctness cannot read solutions (manifest enforced)", async () => {
    // Indirect proof: spawn() in runReview calls computeSubagentTokens which
    // throws if manifest declares forbidden token. Manifest doesn't declare
    // read:solutions → no throw. The negative case (manifest mutation) is
    // covered by capabilities.test.ts.
    await freshTask()
    await expect(
      runReview({
        stateRoot: tmp,
        diffOverride: "+x\n",
        log: () => {},
      }),
    ).resolves.toBeDefined()
  })
})
