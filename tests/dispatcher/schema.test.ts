import { describe, test, expect } from "bun:test"
import {
  getCapabilities,
  getStateSchema,
  getSubagentManifest,
  getCommandPermissions,
} from "../../src/dispatcher/schema"

describe("schema cache", () => {
  test("getCapabilities returns same reference (cached)", () => {
    expect(getCapabilities()).toBe(getCapabilities())
  })
  test("getStateSchema returns same reference (cached)", () => {
    expect(getStateSchema()).toBe(getStateSchema())
  })
})

describe("getCapabilities — full structure", () => {
  test("has 20 subagents (Phase 3 scaffold + E-phase clarifier.discover)", () => {
    const spec = getCapabilities()
    expect(Object.keys(spec.subagents).length).toBe(20)
  })
  test("has 8 commands", () => {
    const spec = getCapabilities()
    const cmds = Object.keys(spec.permissions)
    // /discover /plan /work /review /qa /ship /compound /status
    expect(cmds.length).toBe(8)
    for (const c of ["/discover", "/plan", "/work", "/review", "/qa", "/ship", "/compound", "/status"]) {
      expect(cmds).toContain(c)
    }
  })
  test("subagent.name is injected from key", () => {
    const m = getSubagentManifest("classifier.level")
    expect(m?.name).toBe("classifier.level")
  })
})

describe("getSubagentManifest", () => {
  test("returns manifest for known subagent", () => {
    const m = getSubagentManifest("reviewer.correctness")
    expect(m).toBeDefined()
    expect(m?.scope_tokens).toContain("write:reviews")
    expect(m?.token_budget).toBe(5000)
    expect(m?.timeout_s).toBe(180)
  })
  test("returns undefined for unknown", () => {
    expect(getSubagentManifest("nope.nope")).toBeUndefined()
  })
  test("YAML anchor merge expands for reviewer.security (uses *reviewer_base)", () => {
    const base = getSubagentManifest("reviewer.correctness")
    const sec = getSubagentManifest("reviewer.security")
    expect(sec).toBeDefined()
    expect(sec?.scope_tokens).toEqual(base?.scope_tokens)
    expect(sec?.token_budget).toBe(base?.token_budget)
  })
})

describe("getCommandPermissions", () => {
  test("/review has empty solutions array (Invariant §1)", () => {
    const p = getCommandPermissions("/review")
    expect(p?.solutions).toEqual([])
  })
  test("/plan has spawn capability for planner + researcher", () => {
    const p = getCommandPermissions("/plan")
    expect(p?.spawn).toContain("spawn:planner.*")
    expect(p?.spawn).toContain("spawn:researcher.*")
  })
  test("/status is read-only across all layers", () => {
    const p = getCommandPermissions("/status")
    expect(p?.spawn).toBeUndefined()
    expect(p?.exec).toBeUndefined()
    expect(p?.decisions).toContain("read:decisions:*")
  })
})

describe("getStateSchema — top-level layers", () => {
  test("has all 4 state layers", () => {
    const spec = getStateSchema()
    expect(spec.decisions).toBeDefined()
    expect(spec.progress).toBeDefined()
    expect(spec.solutions).toBeDefined()
    expect(spec.reviews).toBeDefined()
  })
})
