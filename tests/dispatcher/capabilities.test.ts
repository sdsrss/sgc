import { describe, test, expect } from "bun:test"
import {
  matchesPattern,
  tokenForbiddenFor,
  computeCommandTokens,
  computeSubagentTokens,
  tokensAllow,
  assertScope,
  canSpawn,
  assertCanSpawn,
  ScopeViolation,
  UnknownActor,
} from "../../src/dispatcher/capabilities"
import { getCapabilities, getSubagentManifest } from "../../src/dispatcher/schema"

describe("matchesPattern", () => {
  test("literal match", () => {
    expect(matchesPattern("reviewer.correctness", "reviewer.correctness")).toBe(true)
  })
  test("wildcard suffix", () => {
    expect(matchesPattern("reviewer.correctness", "reviewer.*")).toBe(true)
    expect(matchesPattern("reviewer.security", "reviewer.*")).toBe(true)
    expect(matchesPattern("compound.related", "reviewer.*")).toBe(false)
  })
  test("wildcard in scope token", () => {
    expect(matchesPattern("read:decisions:abc123", "read:decisions:*")).toBe(true)
    expect(matchesPattern("read:decisions", "read:decisions:*")).toBe(false)
  })
  test("no false-positive on dot", () => {
    expect(matchesPattern("reviewerXcorrectness", "reviewer.correctness")).toBe(false)
  })
})

describe("tokenForbiddenFor — Invariant §1 enforcement", () => {
  test("read:solutions forbidden for reviewer.*", () => {
    const spec = getCapabilities()
    expect(tokenForbiddenFor(spec, "read:solutions", "reviewer.correctness")).toBe(true)
    expect(tokenForbiddenFor(spec, "read:solutions", "reviewer.security")).toBe(true)
    expect(tokenForbiddenFor(spec, "read:solutions", "reviewer.adversarial")).toBe(true)
  })
  test("read:solutions forbidden for qa.*", () => {
    const spec = getCapabilities()
    expect(tokenForbiddenFor(spec, "read:solutions", "qa.browser")).toBe(true)
  })
  test("read:solutions allowed for compound.* and planner.*", () => {
    const spec = getCapabilities()
    expect(tokenForbiddenFor(spec, "read:solutions", "compound.context")).toBe(false)
    expect(tokenForbiddenFor(spec, "read:solutions", "planner.eng")).toBe(false)
  })
})

describe("computeCommandTokens", () => {
  test("/plan has full scope (decisions, progress, solutions, reviews, spawn)", () => {
    const tokens = computeCommandTokens("/plan")
    expect(tokens).toContain("read:decisions:*")
    expect(tokens).toContain("write:decisions")
    expect(tokens).toContain("write:progress")
    expect(tokens).toContain("read:solutions")
    expect(tokens).toContain("read:reviews")
    expect(tokens).toContain("spawn:planner.*")
    expect(tokens).toContain("spawn:researcher.*")
  })
  test("/review has NO read:solutions (Invariant §1)", () => {
    const tokens = computeCommandTokens("/review")
    expect(tokens).not.toContain("read:solutions")
    expect(tokens).toContain("write:reviews")
    expect(tokens).toContain("spawn:reviewer.*")
  })
  test("/qa has NO read:solutions", () => {
    const tokens = computeCommandTokens("/qa")
    expect(tokens).not.toContain("read:solutions")
    expect(tokens).toContain("exec:browser")
  })
  test("unknown command throws UnknownActor", () => {
    expect(() => computeCommandTokens("/nope")).toThrow(UnknownActor)
  })
})

describe("computeSubagentTokens", () => {
  test("classifier.level has only read:progress", () => {
    expect(computeSubagentTokens("classifier.level")).toEqual(["read:progress"])
  })
  test("reviewer.correctness has expected scope", () => {
    const tokens = computeSubagentTokens("reviewer.correctness")
    expect(tokens).toContain("read:decisions")
    expect(tokens).toContain("write:reviews")
    expect(tokens).toContain("exec:git:read")
    expect(tokens).not.toContain("read:solutions")
  })
  test("unknown subagent throws", () => {
    expect(() => computeSubagentTokens("nope.nope")).toThrow(UnknownActor)
  })
})

describe("tokensAllow + assertScope", () => {
  test("exact token allows op", () => {
    expect(tokensAllow(["write:reviews"], "write:reviews")).toBe(true)
  })
  test("wildcard token allows narrower op", () => {
    expect(tokensAllow(["read:decisions:*"], "read:decisions:abc")).toBe(true)
  })
  test("missing token denies op", () => {
    expect(tokensAllow(["write:reviews"], "read:solutions")).toBe(false)
  })
  test("assertScope throws on denied op", () => {
    expect(() => assertScope(["write:reviews"], "read:solutions", "reviewer.correctness")).toThrow(
      ScopeViolation,
    )
  })
  test("assertScope passes on allowed op", () => {
    expect(() => assertScope(["read:progress"], "read:progress")).not.toThrow()
  })
  // Negative tests for the C-phase audit C2 fix: narrow pinned token must
  // not authorize a broader request. Bidirectional match would have allowed
  // these — they must now be denied.
  test("narrow token does NOT allow wildcard request (C2 fix)", () => {
    expect(tokensAllow(["write:reviews"], "*:*")).toBe(false)
    expect(tokensAllow(["write:reviews"], "write:*")).toBe(false)
    expect(tokensAllow(["read:decisions"], "read:*")).toBe(false)
  })
  test("narrow token does NOT allow forbidden op via wildcard (C2 fix)", () => {
    // pinned reviewer-style tokens
    const reviewerTokens = ["read:decisions", "read:progress", "write:reviews", "exec:git:read"]
    expect(tokensAllow(reviewerTokens, "read:solutions")).toBe(false)
    expect(tokensAllow(reviewerTokens, "*")).toBe(false)
  })
})

describe("canSpawn / assertCanSpawn", () => {
  test("/plan can spawn planner.eng", () => {
    expect(canSpawn("/plan", "planner.eng")).toBe(true)
  })
  test("/plan can spawn researcher.history", () => {
    expect(canSpawn("/plan", "researcher.history")).toBe(true)
  })
  test("/review can spawn reviewer.correctness", () => {
    expect(canSpawn("/review", "reviewer.correctness")).toBe(true)
  })
  test("/review CANNOT spawn planner.eng", () => {
    expect(canSpawn("/review", "planner.eng")).toBe(false)
  })
  test("/work cannot spawn anyone (no spawn tokens)", () => {
    expect(canSpawn("/work", "reviewer.correctness")).toBe(false)
  })
  test("assertCanSpawn throws on unauthorized spawn", () => {
    expect(() => assertCanSpawn("/work", "reviewer.correctness")).toThrow(ScopeViolation)
  })
})

// Implementation-status annotations on subagent manifests (2026-04-16 audit).
// Four reviewer slots (tests/maintainability/adversarial/spec) plus
// janitor.archive are kept in the manifest for forward-compat roadmap
// visibility but are NOT yet wired. Status field distinguishes aspirational
// from shipped. See contracts/sgc-capabilities.yaml.
describe("subagent status annotations", () => {
  test("reviewer.security is marked implemented", () => {
    expect(getSubagentManifest("reviewer.security")?.status).toBe("implemented")
  })
  test("reviewer.performance is marked implemented", () => {
    expect(getSubagentManifest("reviewer.performance")?.status).toBe("implemented")
  })
  test("reviewer.migration is marked implemented", () => {
    expect(getSubagentManifest("reviewer.migration")?.status).toBe("implemented")
  })
  test("reviewer.infra is marked implemented", () => {
    expect(getSubagentManifest("reviewer.infra")?.status).toBe("implemented")
  })
  test("reviewer.tests is slot-only with deferred roadmap", () => {
    const m = getSubagentManifest("reviewer.tests")
    expect(m?.status).toBe("slot-only")
    expect(m?.roadmap).toMatch(/deferred/i)
  })
  test("reviewer.maintainability is slot-only with roadmap", () => {
    const m = getSubagentManifest("reviewer.maintainability")
    expect(m?.status).toBe("slot-only")
    expect(m?.roadmap).toBeDefined()
  })
  test("reviewer.adversarial is slot-only", () => {
    expect(getSubagentManifest("reviewer.adversarial")?.status).toBe("slot-only")
  })
  test("reviewer.spec is slot-only with v1.3+ roadmap", () => {
    const m = getSubagentManifest("reviewer.spec")
    expect(m?.status).toBe("slot-only")
    expect(m?.roadmap).toMatch(/v1\.3\+|deferred/i)
  })
  test("janitor.archive is manual-only", () => {
    expect(getSubagentManifest("janitor.archive")?.status).toBe("manual-only")
  })
})
