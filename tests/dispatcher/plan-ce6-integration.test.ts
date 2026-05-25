// CE-6 (f7): plan.ts L3 applied_in wire-up integration tests.
//
// W1: end-to-end — seeded runtime/rate-limit-bypass-2026 solution +
//   adversarialOverride emits early_signal containing the solution_ref →
//   applied_in lands on disk with the consuming task_id.
//
// W2: plan tolerates an absent solutions/ corpus — extractPreventions
//   returns empty, wire-up gate skips, intent.md still written.

import { describe, test, expect, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { parseFrontmatter } from "../../src/dispatcher/state"
import type { SolutionEntry } from "../../src/dispatcher/types"

const LONG_MOTIVATION =
  "We need to refactor the rate-limit middleware to use a sliding window algorithm because the existing token bucket implementation does not correctly handle burst traffic patterns at the edge of the refill window, causing stale cache entries to bypass the origin gate entirely."

// ──────────────────────────────────────────────────────────────────────────
// CE-6 (f7): plan.ts wires recordApplied after planner.adversarial returns
// ──────────────────────────────────────────────────────────────────────────

describe("plan.ts — CE-6 applied_in wire-up (L3)", () => {
  let stateRoot: string

  beforeEach(() => {
    stateRoot = mkdtempSync(join(tmpdir(), "sgc-ce6-plan-"))
  })

  afterEach(() => {
    rmSync(stateRoot, { recursive: true, force: true })
  })

  test("CE6-W1: applied_in lands on disk when planner.adversarial early_signal references a prior_prevention", async () => {
    // Seed a matching solution in solutions/runtime/.
    // keywords from taskDescription: "rate", "limit", "middleware", "refactor",
    // "sliding", "window" — "rate" and "limit" appear in the solution body,
    // guaranteeing walkSolutionsCorpus hits > 0.
    const solDir = resolve(stateRoot, "solutions", "runtime")
    mkdirSync(solDir, { recursive: true })
    const slug = "rate-limit-bypass-2026"
    const solutionRef = `runtime/${slug}`
    writeFileSync(
      resolve(solDir, `${slug}.md`),
      [
        `---`,
        `id: runtime-${slug}`,
        `signature: sha256-fixture`,
        `category: runtime`,
        `problem: rate limit bypass via stale cache`,
        `symptoms:`,
        `  - 429s drop at refill boundary`,
        `what_didnt_work:`,
        `  - approach: client-only token bucket`,
        `    reason_failed: still hit origin on stale window edge`,
        `solution: sliding window counter with Redis TTL aligned to refill period`,
        `prevention: When migrating rate-limit middleware, verify cache TTL aligns with bucket refill or stale tokens bypass the gate.`,
        `tags:`,
        `  - rate-limit`,
        `  - middleware`,
        `first_seen: 2026-01-01T00:00:00.000Z`,
        `last_updated: 2026-01-01T00:00:00.000Z`,
        `times_referenced: 0`,
        `source_task_ids:`,
        `  - TASK-FIXTURE`,
        `---`,
        ``,
        `Body: rate limit middleware bypass via stale cache at refill window edge.`,
        ``,
      ].join("\n"),
      "utf8",
    )

    // Run plan with adversarialOverride: early_signal contains the solution_ref
    // substring so extractAppliedSolutionRefs matches it against capturedPriorPreventions.
    await runPlan("refactor rate-limit middleware to use sliding window", {
      stateRoot,
      forceLevel: "L3",
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: new Date().toISOString(), signer_id: "test-ci" },
      readConfirmation: async () => "yes",
      log: () => {},
      adversarialOverride: {
        failure_modes: [
          {
            scenario: "rate limit cache stale on bucket refill window edge",
            probability: "high",
            impact: "high",
            early_signal: `p99 cache TTL exceeds bucket refill window; see ${solutionRef} for the original incident and fix`,
          },
        ],
      },
    })

    // applied_in must have been written to the seeded solution file.
    const raw = readFileSync(resolve(solDir, `${slug}.md`), "utf8")
    const { data } = parseFrontmatter<SolutionEntry>(raw)
    expect(data.applied_in).toBeDefined()
    expect(Array.isArray(data.applied_in)).toBe(true)
    expect(data.applied_in!.length).toBe(1)
    // The entry is a task_id (26-char uppercase hex UUID without hyphens).
    expect(typeof data.applied_in![0]).toBe("string")
    expect(data.applied_in![0]!.length).toBeGreaterThan(0)
  })

  test("CE6-W2: plan tolerates absent solutions/ corpus — writeback skipped gracefully", async () => {
    // No solutions/ dir created — walkSolutionsCorpus returns [] silently.
    // capturedPriorPreventions stays empty → wire-up gate at plan.ts:450 is false.
    // Plan must still complete and write intent.md under decisions/.

    const r = await runPlan(
      "add a database migration to rename column so the L3 classifier fires and the adversarial cluster runs",
      {
        stateRoot,
        forceLevel: "L3",
        motivation: LONG_MOTIVATION,
        userSignature: { signed_at: new Date().toISOString(), signer_id: "test-ci" },
        readConfirmation: async () => "yes",
        log: () => {},
      },
    )

    // Plan succeeded — returned a taskId.
    expect(typeof r.taskId).toBe("string")
    expect(r.taskId.length).toBeGreaterThan(0)
    expect(r.level).toBe("L3")

    // decisions/ dir was created (intent.md lives inside it).
    const decisionsDir = resolve(stateRoot, "decisions")
    expect(existsSync(decisionsDir)).toBe(true)

    // solutions/ exists (ensureSgcStructure scaffolds it) but contains no
    // category subdirs — walkSolutionsCorpus returns [] and no writeback fires.
    const solDir = resolve(stateRoot, "solutions")
    expect(existsSync(solDir)).toBe(true)
    const { readdirSync } = await import("node:fs")
    const solEntries = readdirSync(solDir, { withFileTypes: true }).filter((e) => e.isDirectory())
    expect(solEntries.length).toBe(0)
  })
})
