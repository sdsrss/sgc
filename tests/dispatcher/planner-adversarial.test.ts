import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { plannerAdversarial } from "../../src/dispatcher/agents/planner-adversarial"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

describe("plannerAdversarial stub", () => {
  test("returns at least one failure mode for any input", () => {
    const r = plannerAdversarial({ intent_draft: "boring text" })
    expect(r.failure_modes.length).toBeGreaterThanOrEqual(1)
  })
  test("matches migration keyword → data-loss scenario", () => {
    const r = plannerAdversarial({
      intent_draft: "add a schema migration for the users table",
    })
    expect(r.failure_modes.some((fm) => /data loss|migration/i.test(fm.scenario))).toBe(true)
  })
  test("matches auth keyword → auth-bypass scenario", () => {
    const r = plannerAdversarial({
      intent_draft: "refactor the auth middleware",
    })
    expect(r.failure_modes.some((fm) => /auth bypass|session fixation/i.test(fm.scenario))).toBe(true)
  })
  test("matches infra → outage scenario", () => {
    const r = plannerAdversarial({
      intent_draft: "update the production deployment config",
    })
    expect(r.failure_modes.some((fm) => /outage|production/i.test(fm.scenario))).toBe(true)
  })
  test("matches payment → charging error scenario", () => {
    const r = plannerAdversarial({
      intent_draft: "adjust the Stripe subscription billing flow",
    })
    expect(r.failure_modes.some((fm) => /charged incorrectly|double-processed/i.test(fm.scenario))).toBe(true)
  })
  test("multiple keywords produce multiple failure modes", () => {
    const r = plannerAdversarial({
      intent_draft: "schema migration for the auth tokens table in production",
    })
    expect(r.failure_modes.length).toBeGreaterThanOrEqual(3)
  })
  test("no risk keywords → default 'insufficient testing' mode", () => {
    const r = plannerAdversarial({
      intent_draft: "add a helper function to format dates",
    })
    expect(r.failure_modes.length).toBe(1)
    expect(r.failure_modes[0]?.scenario).toMatch(/test coverage|regression/)
  })
  test("all failure modes have required fields + valid enum values", () => {
    const r = plannerAdversarial({
      intent_draft: "schema migration affecting auth flow",
    })
    for (const fm of r.failure_modes) {
      expect(fm.scenario.length).toBeGreaterThan(0)
      expect(["low", "medium", "high"]).toContain(fm.probability)
      expect(["low", "medium", "high"]).toContain(fm.impact)
      expect(fm.early_signal.length).toBeGreaterThan(0)
    }
  })
})

describe("runPlan — L3 adversarial wiring (D-3.1)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-plan-adv-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("L2 does NOT dispatch planner.adversarial", async () => {
    const r = await runPlan("add a new field to the public API response", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      log: () => {},
    })
    expect(r.level).toBe("L2")
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    expect(prompts.some((f) => f.includes("planner.adversarial"))).toBe(false)
  })

  test("L3 dispatches planner.adversarial + intent body has Pre-mortem", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      readConfirmation: async () => "yes",
      log: () => {},
    })
    expect(r.level).toBe("L3")
    const prompts = readdirSync(resolve(tmp, "progress/agent-prompts"))
    expect(prompts.some((f) => f.includes("planner.adversarial"))).toBe(true)
    // L3 audit trail has 5 prompt files
    expect(prompts.length).toBe(5)
    const intent = readIntent(r.taskId, tmp)
    expect(intent.body ?? "").toContain("Pre-mortem (planner.adversarial)")
  })

  test("L3 intent body lists probability/impact ratings", async () => {
    const r = await runPlan("add a database migration to rename column", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION,
      userSignature: { signed_at: "2026-04-15T10:00:00Z", signer_id: "alice" },
      readConfirmation: async () => "yes",
      log: () => {},
    })
    const intent = readIntent(r.taskId, tmp)
    const body = intent.body ?? ""
    // Format: ### [probability/impact] scenario
    expect(body).toMatch(/\[(low|medium|high)\/(low|medium|high)\]/)
  })
})
