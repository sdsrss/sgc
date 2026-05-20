import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  plannerAdversarial,
  plannerAdversarialHeuristic,
} from "../../src/dispatcher/agents/planner-adversarial"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import { runPlan } from "../../src/commands/plan"
import { readIntent } from "../../src/dispatcher/state"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

describe("plannerAdversarialHeuristic stub", () => {
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

  test("U4: plannerAdversarial alias === plannerAdversarialHeuristic (G.2.a pattern)", () => {
    expect(plannerAdversarial).toBe(plannerAdversarialHeuristic)
  })
})

describe("prompts/planner-adversarial.md — template structure (P2#7b)", () => {
  const promptPath = resolve(process.cwd(), "prompts/planner-adversarial.md")
  const tmpl = readFileSync(promptPath, "utf8")

  test("U1: required structural markers (Input heading, input_yaml, Anti-patterns)", () => {
    // splitPrompt regex from anthropic-sdk-agent.ts:79 — must match
    expect(tmpl).toMatch(/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/)
    expect(tmpl).toContain("<input_yaml/>")
    expect(tmpl).toContain("## Anti-patterns")
    // Delegate boundary — adversarial must not bleed into architect / mitigation
    expect(tmpl).toMatch(/NOT.*architect|Mitigation prose|pre-mortem/i)
  })

  test("U2: enum values for probability + impact named in prompt", () => {
    expect(tmpl).toContain("low | medium | high")
    // The four output fields explicitly named
    expect(tmpl).toContain("scenario")
    expect(tmpl).toContain("probability")
    expect(tmpl).toContain("impact")
    expect(tmpl).toContain("early_signal")
  })

  test("U3: banned-vocab list synced with planner-eng (15 terms; 'may break' exempt per lesson #18)", () => {
    for (const term of [
      "could potentially",
      "might affect",
      "various concerns",
      "several issues",
      "generally",
      "overall",
      "seems to",
      "production-ready",
      "comprehensive",
      "robust",
    ]) {
      expect(tmpl).toContain(term)
    }
    for (const term of ["显著", "大幅", "基本上", "大部分情况", "相当不错"]) {
      expect(tmpl).toContain(term)
    }
    // "may break" must NOT be banned — lesson #18.
    expect(tmpl).not.toMatch(/banned.*may break|may break.*banned/i)
  })

  test("U5: bad / good contrast section present", () => {
    expect(tmpl).toMatch(/(bad|Bad).*(good|Good)/s)
  })
})

describe("planner.adversarial manifest (P2#7b)", () => {
  test("M1: prompt_path declares prompts/planner-adversarial.md", () => {
    const m = getSubagentManifest("planner.adversarial")
    expect(m).toBeDefined()
    expect(m!.prompt_path).toBe("prompts/planner-adversarial.md")
  })

  test("M2: inputs include intent_draft; repo_map dropped at v0.2", () => {
    const m = getSubagentManifest("planner.adversarial")
    expect(m).toBeDefined()
    const inputs = m!.inputs as Record<string, string>
    expect(inputs.intent_draft).toBe("markdown")
    expect(inputs.repo_map).toBeUndefined()
  })

  test("M3: outputs.failure_modes uses array[{...}] composite form", () => {
    const m = getSubagentManifest("planner.adversarial")
    expect(m).toBeDefined()
    const outputs = m!.outputs as Record<string, string>
    expect(outputs.failure_modes).toMatch(/^array\[/)
    // The four fields named in the inner composite
    expect(outputs.failure_modes).toContain("scenario")
    expect(outputs.failure_modes).toContain("probability")
    expect(outputs.failure_modes).toContain("impact")
    expect(outputs.failure_modes).toContain("early_signal")
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
    // Seed corpus so T6 preFilter has a candidate → researcher.history spawns
    // (5-prompt assertion on line 99 requires the spawn to fire).
    const seedDir = resolve(tmp, "solutions", "_seed")
    mkdirSync(seedDir, { recursive: true })
    writeFileSync(
      resolve(seedDir, "migration.md"),
      "database migration rename column schema additive.",
      "utf8",
    )
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
