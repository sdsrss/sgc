// CE-1 (task 94913CB45F9D4C3E906B3C2C8E#f2) — plan.ts L3 integration test.
//
// Verifies the wiring contract: extractPreventions produces the expected
// payload from a seeded corpus, and plan.ts's source actually references
// the extractor + the prior_preventions field on the L3 branch. The
// extractor unit tests cover the algorithm; this file covers the wiring.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import {
  mkdtempSync,
  mkdirSync,
  writeFileSync,
  rmSync,
  readFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { extractPreventions } from "../../src/dispatcher/preventions"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-plan-ce1-"))
  mkdirSync(join(stateRoot, "solutions", "other"), { recursive: true })
  writeFileSync(
    join(stateRoot, "solutions", "other", "vendor-trap-2026-05-21.md"),
    [
      `---`,
      `intent: "vendor word triggers false-premise concerns"`,
      `category: "other"`,
      `prevention: "describing internal implementation as vendor X triggers planner.adversarial to assume third-party copy semantics — use implement / absorb / adopt instead"`,
      `---`,
      ``,
      `Body about the vendor-word lesson from feedback memory.`,
      ``,
    ].join("\n"),
  )
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

describe("plan.ts CE-1 wiring (L3 prior_preventions injection)", () => {
  it("extractPreventions surfaces seeded vendor-word entry on matching motivation", async () => {
    const out = await extractPreventions(
      "vendor X capabilities into our project so the closure loop and absorbed lessons reach planner adversarial cluster",
      stateRoot,
    )
    expect(out.length).toBeGreaterThanOrEqual(1)
    const found = out.find(
      (p) => p.solution_ref === "other/vendor-trap-2026-05-21",
    )
    expect(found).toBeDefined()
    expect(found!.prevention_text).toContain(
      "describing internal implementation as vendor X",
    )
  })

  it("plan.ts L3 branch source references extractPreventions and prior_preventions", () => {
    const planSrc = readFileSync(
      resolve(import.meta.dir, "../../src/commands/plan.ts"),
      "utf8",
    )
    expect(planSrc.includes("extractPreventions")).toBe(true)
    expect(planSrc.includes("prior_preventions")).toBe(true)
    // The call must be gated by the L3 branch — the extractor await sits
    // inside the `if (level === "L3")` block, not at the top of the
    // planner cluster (which would fire on L2 too).
    const l3BlockStart = planSrc.indexOf(`if (level === "L3")`)
    const extractCallIdx = planSrc.indexOf("await extractPreventions(")
    expect(l3BlockStart).toBeGreaterThan(-1)
    expect(extractCallIdx).toBeGreaterThan(l3BlockStart)
  })

  it("RT-6: extractPreventions throw emits Tier-2 audit event + plan continues", () => {
    // Source-level assertion: the try/catch block + audit event are present.
    // Mirrors the handleCoerceFailure pattern from researcher-history.ts:348
    // (agent failure must emit a Tier-2 event under §13, not silently crash
    // the entire planner cluster).
    const planSrc = readFileSync(
      resolve(import.meta.dir, "../../src/commands/plan.ts"),
      "utf8",
    )
    // try { await extractPreventions(...) } catch — single regex matching
    // across whitespace + arbitrary intermediate tokens.
    expect(
      /try\s*\{[\s\S]{0,200}await\s+extractPreventions[\s\S]{0,400}catch\s*\(/.test(
        planSrc,
      ),
    ).toBe(true)
    // Audit event emission with the expected event_type + warn level.
    expect(planSrc.includes("prevention.extract_failed")).toBe(true)
    expect(
      /event_type:\s*"prevention\.extract_failed"[\s\S]{0,200}level:\s*"warn"/.test(
        planSrc,
      ),
    ).toBe(true)
  })

  it("Perf-1: extractPreventions runs inside the planner-cluster IIFE (not serial before Promise.all)", () => {
    // Source-level assertion: the L3 branch wraps the extractor + spawn
    // inside `tasks.push((async () => ...)())` (mirroring researcher.history
    // IIFE at plan.ts:201-235), instead of awaiting before tasks.push.
    // Serial await would block eng+ceo+researcher+adversarial on disk I/O.
    const planSrc = readFileSync(
      resolve(import.meta.dir, "../../src/commands/plan.ts"),
      "utf8",
    )
    // tasks.push((async ... => — match across whitespace
    expect(/tasks\.push\(\s*\(async\b[^)]*\)\s*[:=]/.test(planSrc)).toBe(
      true,
    )
    // No bare `await extractPreventions(` at the top of the L3 branch —
    // the only one must be inside an arrow-async body.
    expect(planSrc.match(/await\s+extractPreventions\(/g)?.length).toBe(1)
  })
})
