import { describe, expect, test } from "bun:test"
import {
  L3_SPECIALISTS,
  matchSpecialists,
  reviewerInfra,
  reviewerMigration,
  reviewerPerformance,
  reviewerSecurity,
} from "../../src/dispatcher/agents/reviewer-specialists"
import { computeSubagentTokens } from "../../src/dispatcher/capabilities"

describe("reviewer-specialists — manifest wiring", () => {
  test("reviewer.migration + reviewer.infra inherit reviewer_base scope tokens", () => {
    for (const name of ["reviewer.migration", "reviewer.infra"]) {
      const tokens = computeSubagentTokens(name)
      expect(tokens).toContain("read:decisions")
      expect(tokens).toContain("write:reviews")
      expect(tokens).toContain("exec:git:read")
      expect(tokens).not.toContain("read:solutions")  // Invariant §1
    }
  })
  test("L3_SPECIALISTS lists exactly 4 specialists in priority order", () => {
    const names = L3_SPECIALISTS.map((s) => s.name)
    expect(names).toEqual([
      "reviewer.security",
      "reviewer.migration",
      "reviewer.performance",
      "reviewer.infra",
    ])
  })
})

describe("matchSpecialists — diff trigger detection", () => {
  test("no triggers → empty list", () => {
    const m = matchSpecialists("+const x = 1\n+const y = 2\n")
    expect(m).toEqual([])
  })
  test("auth keyword triggers security only", () => {
    const m = matchSpecialists("+function verifyAuthToken(jwt: string) {\n")
    expect(m.map((s) => s.name)).toEqual(["reviewer.security"])
  })
  test("migration DDL triggers migration only", () => {
    const m = matchSpecialists("+ALTER TABLE users ADD COLUMN email TEXT\n")
    expect(m.map((s) => s.name)).toEqual(["reviewer.migration"])
  })
  test("perf keyword triggers performance only", () => {
    const m = matchSpecialists("+const cache = new LRU({ max: 1000 })\n")
    expect(m.map((s) => s.name)).toEqual(["reviewer.performance"])
  })
  test("infra path triggers infra only", () => {
    const m = matchSpecialists("+++ b/Dockerfile\n+FROM node:20\n")
    expect(m.map((s) => s.name)).toEqual(["reviewer.infra"])
  })
  test("multiple triggers spawn multiple specialists in priority order", () => {
    const diff =
      "+ALTER TABLE sessions ADD COLUMN token TEXT  -- auth migration\n" +
      "+const cache = new Map()\n"
    const names = matchSpecialists(diff).map((s) => s.name)
    // security (auth/token), migration (ALTER), performance (cache) — all 3
    expect(names).toContain("reviewer.security")
    expect(names).toContain("reviewer.migration")
    expect(names).toContain("reviewer.performance")
    expect(names.length).toBe(3)
  })
})

describe("reviewerSecurity stub", () => {
  test("clean diff → pass / none", () => {
    const r = reviewerSecurity({
      diff: "+const greeting = 'hello'\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
    expect(r.severity).toBe("none")
  })
  test("auth keyword on added line → concern + medium", () => {
    const r = reviewerSecurity({
      diff: "+function signJwt(payload: object) {\n",
      intent: "",
    })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("medium")
    expect(r.findings.length).toBe(1)
    expect(r.findings[0]?.description).toMatch(/security-sensitive/)
  })
  test("auth keyword on removed line is NOT flagged", () => {
    const r = reviewerSecurity({
      diff: "-function signJwt(payload: object) {\n+function helper() {}\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
  })
})

describe("reviewerMigration stub", () => {
  test("DDL added → concern + high", () => {
    const r = reviewerMigration({
      diff: "+CREATE TABLE orders (id SERIAL)\n",
      intent: "",
    })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("high")
    expect(r.findings[0]?.description).toMatch(/rollback.*concurrency/)
  })
  test("non-DDL change → pass", () => {
    const r = reviewerMigration({
      diff: "+const x = 1\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
  })
})

describe("reviewerPerformance stub", () => {
  test("cache addition → concern + medium", () => {
    const r = reviewerPerformance({
      diff: "+const memoized = memoize(slowFn)\n",
      intent: "",
    })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("medium")
  })
  test("nothing perf-touching → pass", () => {
    const r = reviewerPerformance({
      diff: "+const greeting = 'hi'\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
  })
})

describe("reviewerInfra stub", () => {
  test("Dockerfile addition → concern + high", () => {
    const r = reviewerInfra({
      diff: "+FROM node:20-alpine\n",
      intent: "",
    })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("high")
  })
  test("plain code → pass", () => {
    const r = reviewerInfra({
      diff: "+const x = 1\n",
      intent: "",
    })
    expect(r.verdict).toBe("pass")
  })
})
