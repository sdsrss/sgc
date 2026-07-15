import { describe, expect, test } from "bun:test"
import {
  DIFF_CONDITIONAL_SPECIALISTS,
  INFRA,
  MIGRATION,
  PERFORMANCE,
  SECURITY,
  matchSpecialists,
  reviewerInfra,
  reviewerMigration,
  reviewerPerformance,
  reviewerSecurity,
} from "../../src/dispatcher/agents/reviewer-specialists"
import { buildPattern } from "../../src/dispatcher/agents/terms"
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

// The probe corpus both equivalence blocks below run against. Every alternation
// term of every matcher and every trigger as they shipped at 95d0421, plus the
// near-misses that distinguish a bounded term from an unbounded one
// ("indexOf" must NOT match `index`; "O(n)x" is the only thing the old big-O
// pattern could match) and inputs that must match nothing.
const EQUIV_PROBES = [
  "auth", "jwt", "token", "session", "crypto", "password", "secret",
  "signature", "encrypt", "decrypt", "verifyAuth", "signJwt", "signToken",
  "verifyAuthToken(x)", "encryptPayload(y)", "auth_token",
  "ALTER TABLE users", "DROP TABLE t", "CREATE TABLE t", "ALTER COLUMN c",
  "RENAME COLUMN c", "migration", "backfill", "ALTERTABLE",
  "cache", "cached", "caching", "index", "indexOf(z)", "reindexed",
  "memoize(f)", "memoise(f)", "debounce(fn,300)", "throttle(x)",
  "O(n)", "O(n^2)", "// O(n) scan", "O(n)x", "n+1", "benchmark",
  "p95", "p99", "p97", "perf", "performance",
  "Dockerfile", "FROM node:20-alpine", "kubectl", "k8s ", "k8sx", "terraform",
  "helm", "argo", "fly.toml", "render.yaml", "vercel.json", "github/workflows",
  "const x = 1", "", "  ",
] as const

// The refactor's only real risk is a silent change to what `sgc review` flags.
// These two blocks are what stands between it and that: FROZEN holds the four
// sources copied verbatim from 95d0421 (verified against git, not retyped from
// memory), and every probe must agree. If one disagrees, the term list is wrong
// — do NOT edit the frozen literal to match the new build.
describe("Task 2 — rebuilt matchers are equivalent to the v1.35.0 hand-written ones", () => {
  const FROZEN: Record<string, RegExp> = {
    "reviewer.security":
      /(auth|jwt|token|session|crypto|password|secret|signature|encrypt|decrypt|verifyAuth|signJwt|signToken)/i,
    "reviewer.migration":
      /\b(ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+COLUMN|RENAME\s+COLUMN|migration|backfill)\b/i,
    "reviewer.performance":
      /\b(cache|cach(ed|ing)|index|memoi[sz]e|debounce|throttle|n\+1|benchmark|p9[59])\b|O\(n\^?\d*\)/i,
    "reviewer.infra":
      /(Dockerfile|FROM\s+\w|kubectl|k8s\b|terraform|helm|argo|fly\.toml|render\.yaml|vercel\.json|github\/workflows)/i,
  }
  for (const def of [SECURITY, MIGRATION, PERFORMANCE, INFRA]) {
    test(`${def.name} — built pattern agrees with the frozen one on every probe`, () => {
      const frozen = FROZEN[def.name]
      expect(frozen).toBeDefined()
      for (const p of EQUIV_PROBES) {
        expect(`${def.name} ${JSON.stringify(p)} → ${def.pattern.test(p)}`)
          .toBe(`${def.name} ${JSON.stringify(p)} → ${(frozen as RegExp).test(p)}`)
      }
    })
    test(`${def.name} — pattern is literally built from its terms`, () => {
      expect(def.pattern.source).toBe(buildPattern(def.terms).source)
    })
  }
})

// Replaces M5's trigger-source pins. Those compared `.source` strings, which the
// term-list rebuild legitimately reorders (buildPattern emits bounded terms
// first) — so a source pin would now fail on a refactor that changed nothing.
// What must not change is which diffs SPAWN a specialist, and that is a separate
// path from the matcher above: the trigger decides spawn, the matcher decides
// report. Probing behaviour instead of source pins the property that matters and
// survives the rebuild.
describe("Task 2 — rebuilt triggers spawn on exactly what they spawned on at v1.35.0", () => {
  const FROZEN_TRIGGERS: Record<string, RegExp> = {
    "reviewer.security":
      /(auth|jwt|token|session|crypto|password|secret|signature|encrypt|decrypt)/i,
    "reviewer.migration":
      /(migration|ALTER\s+TABLE|DROP\s+TABLE|CREATE\s+TABLE|ALTER\s+COLUMN|RENAME\s+COLUMN|backfill)/i,
    "reviewer.performance":
      /(perf|performance|cache|caching|memoi[sz]e|index|benchmark|n\+1|O\(n\^?\d*\)|p9[59]|debounce|throttle)/i,
    "reviewer.infra":
      /(Dockerfile|FROM\s+\w|kubectl|k8s\b|terraform|helm|fly\.toml|vercel\.json|render\.yaml|github\/workflows|argo)/i,
  }
  for (const spec of DIFF_CONDITIONAL_SPECIALISTS) {
    test(`${spec.name} — trigger agrees with the frozen one on every probe`, () => {
      const frozen = FROZEN_TRIGGERS[spec.name]
      expect(frozen).toBeDefined()
      for (const p of EQUIV_PROBES) {
        expect(`${spec.name} ${JSON.stringify(p)} → ${spec.trigger.test(p)}`)
          .toBe(`${spec.name} ${JSON.stringify(p)} → ${(frozen as RegExp).test(p)}`)
      }
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
