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
})
