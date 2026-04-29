import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runReview } from "../../src/commands/review"
import { readIntent, readReview } from "../../src/dispatcher/state"
import { reviewerCorrectness } from "../../src/dispatcher/agents/reviewer-correctness"

function seedSolution(
  stateRoot: string,
  category: string,
  slug: string,
  content: string,
): void {
  const dir = resolve(stateRoot, "solutions", category)
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${slug}.md`), content, "utf8")
}

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

  test("W3: Invariant §1 back-channel — Prior-art section stripped from reviewer spawn input (Phase H pre-ship review)", async () => {
    // Setup: seed corpus so plan's researcher.history populates Prior art
    // section in intent.body. Use an L2-eligible task description.
    seedSolution(
      tmp,
      "auth",
      "oauth-token-refresh",
      "---\nintent: silent OAuth token refresh on 401\n---\n\nFixed token refresh on 401 by adding retry-with-backoff loop.",
    )
    const plan = await runPlan(
      "add token refresh retry on 401 to the public API client",
      { stateRoot: tmp, motivation: LONG_MOTIVATION, log: () => {} },
    )
    // Sanity: intent.md DOES have the Prior-art section + the leaked ref
    const intent = readIntent(plan.taskId, tmp)
    const body = intent.body ?? ""
    expect(body).toContain("Prior art (researcher.history)")
    expect(body).toContain("auth/oauth-token-refresh")

    // Run review
    await runReview({
      stateRoot: tmp,
      diffOverride: "+const ok = 1\n",
      log: () => {},
    })

    // Inspect the reviewer.correctness prompt audit; assert it does NOT
    // contain the Prior-art section nor the leaked solution_ref.
    const promptDir = resolve(tmp, "progress/agent-prompts")
    const files = readdirSync(promptDir)
    const reviewerPrompt = files.find((f) => f.includes("reviewer.correctness"))
    expect(reviewerPrompt).toBeDefined()
    const promptContent = readFileSync(
      resolve(promptDir, reviewerPrompt!),
      "utf8",
    )
    expect(promptContent).not.toContain("Prior art (researcher.history)")
    expect(promptContent).not.toContain("auth/oauth-token-refresh")
    // But the prior intent.md scaffolding (e.g. the classifier rationale
    // heading) IS still present — strip is surgical, not nuclear.
    expect(promptContent).toContain("Classifier rationale")
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

describe("runReview — F-5 --append-as suffix", () => {
  async function freshTaskHere() {
    return runPlan("simple change", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
  }

  test("with appendAs: writes <reviewer>.<suffix>.md alongside default name", async () => {
    const plan = await freshTaskHere()
    // First pass: bare reviewer.correctness.md
    await runReview({
      stateRoot: tmp,
      diffOverride: "+const ok = 1\n",
      log: () => {},
    })
    // Second pass with --append-as v2: writes reviewer.correctness.v2.md
    await runReview({
      stateRoot: tmp,
      diffOverride: "+function f() { /* TODO impl */ }\n",
      appendAs: "v2",
      log: () => {},
    })
    const dir = resolve(tmp, "reviews", plan.taskId, "code")
    const files = readdirSync(dir).sort()
    expect(files).toEqual(["reviewer.correctness.md", "reviewer.correctness.v2.md"])
    // Each file holds the verdict from its own pass
    const v1 = readFileSync(resolve(dir, "reviewer.correctness.md"), "utf8")
    expect(v1).toContain("verdict: pass")
    const v2 = readFileSync(resolve(dir, "reviewer.correctness.v2.md"), "utf8")
    expect(v2).toContain("verdict: concern")
  })

  test("same suffix twice on same task → AppendOnly throws", async () => {
    await freshTaskHere()
    await runReview({
      stateRoot: tmp,
      diffOverride: "+const ok = 1\n",
      appendAs: "v2",
      log: () => {},
    })
    await expect(
      runReview({
        stateRoot: tmp,
        diffOverride: "+const also = 1\n",
        appendAs: "v2",
        log: () => {},
      }),
    ).rejects.toThrow(/append-only/)
  })

  test("invalid suffix shapes are rejected at write boundary", async () => {
    await freshTaskHere()
    for (const bad of ["..", "../etc", "with/slash", "", "-leading-dash", "with space"]) {
      await expect(
        runReview({
          stateRoot: tmp,
          diffOverride: "+const ok = 1\n",
          appendAs: bad,
          log: () => {},
        }),
      ).rejects.toThrow(/invalid review suffix/)
    }
  })

  test("default (no appendAs) regresses to <reviewer>.md path", async () => {
    const plan = await freshTaskHere()
    await runReview({
      stateRoot: tmp,
      diffOverride: "+const ok = 1\n",
      log: () => {},
    })
    const stored = readReview(plan.taskId, "code", "reviewer.correctness", tmp)
    expect(stored?.report.verdict).toBe("pass")
  })
})
