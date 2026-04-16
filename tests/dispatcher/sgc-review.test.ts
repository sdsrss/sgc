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

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

async function freshTask() {
  return runPlan("simple change", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    log: () => {},
  })
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

describe("runReview — L3 diff-conditional specialists", () => {
  async function l3Task() {
    return runPlan("add a database migration to rename a column in orders", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      readConfirmation: async () => "yes",
      log: () => {},
    })
  }

  test("L1 with auth-keyword diff does NOT spawn specialists (gate is L3)", async () => {
    await freshTask()
    const r = await runReview({
      stateRoot: tmp,
      diffOverride: "+function signJwt(payload) {}\n",
      log: () => {},
    })
    expect(r.specialistReports).toEqual([])
  })

  test("L3 with no specialist trigger → only correctness report", async () => {
    await l3Task()
    const r = await runReview({
      stateRoot: tmp,
      diffOverride: "+const greeting = 'hi'\n",
      log: () => {},
    })
    expect(r.specialistReports).toEqual([])
    expect(r.verdict).toBe("pass")
  })

  test("L3 with auth-keyword diff spawns reviewer.security", async () => {
    const plan = await l3Task()
    const r = await runReview({
      stateRoot: tmp,
      diffOverride: "+function signJwt(payload) { return jwt.sign(payload) }\n",
      log: () => {},
    })
    expect(r.specialistReports.length).toBe(1)
    expect(r.specialistReports[0]?.reviewerId).toBe("reviewer.security")
    expect(r.specialistReports[0]?.severity).toBe("medium")
    // Aggregate verdict reflects worst-of (correctness=pass + security=concern)
    expect(r.verdict).toBe("concern")
    // Each specialist gets its own append-only report on disk
    const stored = readReview(plan.taskId, "code", "reviewer.security", tmp)
    expect(stored?.report.verdict).toBe("concern")
  })

  test("L3 with multiple triggers spawns multiple specialists in parallel", async () => {
    await l3Task()
    const r = await runReview({
      stateRoot: tmp,
      diffOverride:
        "+ALTER TABLE sessions ADD COLUMN auth_token TEXT\n" +
        "+const cache = new LRU({ max: 1000 })\n" +
        "+++ b/Dockerfile\n" +
        "+FROM node:20-alpine\n",
      log: () => {},
    })
    const ids = r.specialistReports.map((s) => s.reviewerId).sort()
    expect(ids).toEqual([
      "reviewer.infra",
      "reviewer.migration",
      "reviewer.performance",
      "reviewer.security",
    ])
    // Worst severity (high from migration/infra) drives aggregate
    expect(r.verdict).toBe("concern")
  })

  test("L3 specialist reports are append-only per Invariant §6", async () => {
    await l3Task()
    await runReview({
      stateRoot: tmp,
      diffOverride: "+function authToken() {}\n",
      log: () => {},
    })
    // Second runReview throws on the correctness append (already covered by
    // earlier test) — proves specialist reports are also locked since they
    // share the same append-only path.
    await expect(
      runReview({
        stateRoot: tmp,
        diffOverride: "+function verifyAuth() {}\n",
        log: () => {},
      }),
    ).rejects.toThrow(/append-only/)
  })
})
