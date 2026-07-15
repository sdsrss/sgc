import { describe, expect, test } from "bun:test"
import {
  DIFF_CONDITIONAL_SPECIALISTS,
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
  test("DIFF_CONDITIONAL_SPECIALISTS lists exactly 4 specialists in priority order", () => {
    const names = DIFF_CONDITIONAL_SPECIALISTS.map((s) => s.name)
    expect(names).toEqual([
      "reviewer.security",
      "reviewer.migration",
      "reviewer.performance",
      "reviewer.infra",
    ])
  })
})

// M5 — the file's own documented invariant (reviewer-specialists.ts:129-137):
// "Triggers ... broader than each agent's internal pattern". A term the matcher
// scans for but no trigger can spawn on is dead code: the specialist never runs,
// so the match never happens. M4's descriptions enumerated three such terms as
// live capabilities. Testing the invariant (not examples) is what found `argo`,
// which two independent reviewers reading the same file both missed.
describe("M5 — every matcher term is reachable through its trigger", () => {
  // Probes enumerate each matcher's alternation terms. The regex-source pins
  // below exist so editing a pattern without updating these probes fails loudly
  // rather than silently re-introducing an unreachable term.
  const PROBES: Record<string, string[]> = {
    "reviewer.security": [
      "auth", "jwt", "token", "session", "crypto", "password", "secret",
      "signature", "encrypt", "decrypt", "verifyAuth", "signJwt", "signToken",
    ],
    "reviewer.migration": [
      "ALTER TABLE users", "DROP TABLE t", "CREATE TABLE t", "ALTER COLUMN c",
      "RENAME COLUMN c", "migration", "backfill",
    ],
    "reviewer.performance": [
      "cache", "cached", "caching", "index", "memoize", "memoise", "debounce",
      "throttle", "O(n)", "O(n^2)", "n+1", "benchmark", "p95", "p99",
    ],
    "reviewer.infra": [
      "Dockerfile", "FROM node", "kubectl", "k8s ", "terraform", "helm", "argo",
      "fly.toml", "render.yaml", "vercel.json", "github/workflows",
    ],
  }

  for (const spec of DIFF_CONDITIONAL_SPECIALISTS) {
    const probes = PROBES[spec.name] ?? []
    test(`${spec.name} — has probes`, () => {
      expect(probes.length).toBeGreaterThan(0)
    })
    for (const probe of probes) {
      test(`${spec.name} — "${probe}" spawns AND is reported`, () => {
        const diff = `--- a/x.ts\n+++ b/x.ts\n+  ${probe}\n`
        // Reachability: the trigger must spawn the specialist...
        expect(matchSpecialists(diff).map((s) => s.name)).toContain(spec.name)
        // ...and the specialist must then actually report it. A term that
        // spawns but reports nothing is advertised coverage that does not exist.
        expect(spec.agent({ diff, intent: "" }).findings.length).toBeGreaterThan(0)
      })
    }
  }
})

describe("M5 — regex-source pins (edit a pattern → update the probes above)", () => {
  const PINS: Record<string, string> = {
    "reviewer.security":
      "(auth|jwt|token|session|crypto|password|secret|signature|encrypt|decrypt)",
    "reviewer.migration":
      "(migration|ALTER\\s+TABLE|DROP\\s+TABLE|CREATE\\s+TABLE|ALTER\\s+COLUMN|RENAME\\s+COLUMN|backfill)",
    "reviewer.performance":
      "(perf|performance|cache|caching|memoi[sz]e|index|benchmark|n\\+1|O\\(n\\^?\\d*\\)|p9[59]|debounce|throttle)",
    "reviewer.infra":
      "(Dockerfile|FROM\\s+\\w|kubectl|k8s\\b|terraform|helm|fly\\.toml|vercel\\.json|render\\.yaml|github\\/workflows|argo)",
  }
  for (const spec of DIFF_CONDITIONAL_SPECIALISTS) {
    const pin = PINS[spec.name]
    test(`${spec.name} trigger source is pinned`, () => {
      // A missing pin must fail, not silently pass against undefined.
      expect(pin).toBeDefined()
      expect(spec.trigger.source).toBe(pin as string)
    })
  }
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
