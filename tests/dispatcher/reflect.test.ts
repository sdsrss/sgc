// CE-2 (task 94913CB45F9D4C3E906B3C2C8E#f3) — `sgc reflect` audit tests.

import { describe, expect, it, test, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  auditAllDecisions,
  auditDecision,
  formatReport,
  writeReflectionFile,
} from "../../src/dispatcher/reflect"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-reflect-"))
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

function seedDecision(taskId: string, frontmatter: Record<string, string>, body = ""): void {
  const dir = join(stateRoot, "decisions", taskId)
  mkdirSync(dir, { recursive: true })
  const fmYaml = Object.entries(frontmatter)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n")
  writeFileSync(join(dir, "intent.md"), `---\n${fmYaml}\n---\n\n${body}\n`)
}

function seedSolution(category: string, slug: string, fm: Record<string, string>, body = ""): void {
  const dir = join(stateRoot, "solutions", category)
  mkdirSync(dir, { recursive: true })
  const fmYaml = Object.entries(fm)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join("\n")
  writeFileSync(join(dir, `${slug}.md`), `---\n${fmYaml}\n---\n\n${body}\n`)
}

function seedMalformedSolution(category: string, slug: string, raw: string): void {
  const dir = join(stateRoot, "solutions", category)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${slug}.md`), raw)
}

describe("auditDecision (CE-2 T2)", () => {
  it("empty solutions corpus → no candidates", async () => {
    seedDecision("T1", {
      task_id: "T1",
      title: "Add caching to orders endpoint",
      motivation: "Latency at p99 has crept above SLO; orders endpoint is the hotspot",
    })
    const report = await auditDecision("T1", stateRoot)
    expect(report.task_id).toBe("T1")
    expect(report.candidates).toEqual([])
  })

  it("keyword corpus exists but no overlap with intent → no candidates", async () => {
    seedDecision("T1", {
      task_id: "T1",
      title: "Add caching layer to orders endpoint",
      motivation: "Latency at p99 has crept above SLO; orders endpoint is the hotspot",
    })
    seedSolution("data", "migration-lock", {
      category: "data",
      intent: "avoid blocking ALTER on huge tables",
      prevention: "Use chunked backfill with nullable column first; ALTER TABLE on large tables locks writes for minutes.",
    })
    const report = await auditDecision("T1", stateRoot)
    expect(report.candidates).toEqual([])
  })

  it("strike (a): solution_ref appears in pre-mortem → discussed", async () => {
    seedSolution("data", "migration-lock", {
      category: "data",
      intent: "avoid blocking ALTER",
      prevention: "Chunked backfill on huge orders tables avoids long migration locks.",
    })
    seedDecision(
      "T1",
      {
        task_id: "T1",
        title: "Add archived_at column to orders table",
        motivation: "Need an archived_at timestamp on the orders table for analytics; production size matters here.",
      },
      `## Pre-mortem (planner.adversarial)\n\n### [high/medium] orders table migration lock\nEarly signal: long write lock on data/migration-lock recurrence; CI integration step times out`,
    )
    const report = await auditDecision("T1", stateRoot)
    expect(report.candidates.length).toBe(1)
    const c = report.candidates[0]!
    expect(c.solution_ref).toBe("data/migration-lock")
    expect(c.discussed).toBe(true)
    expect(c.discussed_evidence).toContain("solution_ref direct match")
  })

  it("strike (b): signal-line token overlap (≥3) without solution_ref → discussed", async () => {
    seedSolution("perf", "cache-stampede", {
      category: "perf",
      intent: "avoid thundering herd on cache miss",
      prevention: "Cache stampede thundering herd recompute serialize singleflight stale revalidate.",
    })
    seedDecision(
      "T1",
      {
        task_id: "T1",
        title: "Add tenant cache layer",
        motivation: "Tenant-keyed cache: stampede recompute thundering herd risk on cold cache.",
      },
      `## Pre-mortem (planner.adversarial)\n\n### [high/high] stampede risk\nEarly signal: stampede thundering herd recompute spikes on cold cache fill across N tenant workers`,
    )
    const report = await auditDecision("T1", stateRoot)
    expect(report.candidates.length).toBe(1)
    const c = report.candidates[0]!
    expect(c.solution_ref).toBe("perf/cache-stampede")
    expect(c.discussed).toBe(true)
    expect(c.discussed_evidence).toContain("signal-token overlap")
  })

  it("matched keyword but unrelated pre-mortem → silent", async () => {
    seedSolution("data", "migration-lock", {
      category: "data",
      intent: "avoid blocking ALTER",
      prevention: "Chunked backfill on huge orders tables avoids long migration locks under concurrent writes.",
    })
    seedDecision(
      "T1",
      {
        task_id: "T1",
        title: "Add archived_at column to orders table",
        motivation: "Need archived_at on orders for analytics queries; orders table is large.",
      },
      `## Pre-mortem (planner.adversarial)\n\n### [low/low] typo risk in column name\nEarly signal: snake-case vs camelCase drift in column name spec`,
    )
    const report = await auditDecision("T1", stateRoot)
    expect(report.candidates.length).toBe(1)
    const c = report.candidates[0]!
    expect(c.solution_ref).toBe("data/migration-lock")
    expect(c.discussed).toBe(false)
    expect(c.discussed_evidence).toBeNull()
  })

  it("malformed solution YAML → walker skips it, no throw", async () => {
    seedSolution("data", "ok", {
      category: "data",
      intent: "ok",
      prevention: "Orders table migration must use chunked backfill on large rows.",
    })
    // Two malformed cases: missing closing fence + broken YAML value.
    seedMalformedSolution(
      "data",
      "missing-fence",
      `---\nintent: "broken"\nprevention: "needs orders migration sanity"\n`,
    )
    seedMalformedSolution(
      "data",
      "broken-yaml",
      `---\nintent: "broken"\nprevention: "needs orders\nmigration sanity"\n---\n\nbody`,
    )
    seedDecision(
      "T1",
      {
        task_id: "T1",
        title: "orders table migration cleanup",
        motivation: "orders table migration needs chunked backfill and lock avoidance",
      },
      `## Pre-mortem\n\nEarly signal: locks on large orders during migration`,
    )
    const report = await auditDecision("T1", stateRoot)
    // The well-formed `data/ok` survives. Malformed entries are skipped
    // (they either fail walkSolutionsCorpus's tokenize match or fail the
    // parseFrontmatter inside auditDecision and `continue`).
    expect(report.candidates.some((c) => c.solution_ref === "data/ok")).toBe(true)
  })

  it("missing decision file → empty candidates, decision_path still set", async () => {
    const report = await auditDecision("NOPE", stateRoot)
    expect(report.task_id).toBe("NOPE")
    expect(report.decision_path).toContain("NOPE")
    expect(report.candidates).toEqual([])
  })

  it("decision missing frontmatter → empty candidates, no throw", async () => {
    const dir = join(stateRoot, "decisions", "T1")
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, "intent.md"), "just a body, no frontmatter")
    const report = await auditDecision("T1", stateRoot)
    expect(report.candidates).toEqual([])
  })
})

describe("auditAllDecisions + --since (CE-2 T3)", () => {
  it("no decisions/ dir → empty array", async () => {
    const reports = await auditAllDecisions(stateRoot)
    expect(reports).toEqual([])
  })

  it("--since includes decisions on/after the date", async () => {
    seedDecision("T_OLD", {
      task_id: "T_OLD",
      title: "old",
      motivation: "old work needing some orders cache",
      created_at: "2025-01-01T00:00:00.000Z",
    })
    seedDecision("T_NEW", {
      task_id: "T_NEW",
      title: "new",
      motivation: "new work touching orders cache",
      created_at: "2026-05-22T00:00:00.000Z",
    })
    const reports = await auditAllDecisions(stateRoot, { since: "2026-01-01" })
    const ids = reports.map((r) => r.task_id).sort()
    expect(ids).toEqual(["T_NEW"])
  })

  it("--since excludes decisions before the date", async () => {
    seedDecision("T_OLD", {
      task_id: "T_OLD",
      title: "old",
      motivation: "old work",
      created_at: "2025-01-01T00:00:00.000Z",
    })
    const reports = await auditAllDecisions(stateRoot, { since: "2026-01-01" })
    expect(reports).toEqual([])
  })

  it("invalid --since date → throws", async () => {
    seedDecision("T1", {
      task_id: "T1",
      title: "x",
      motivation: "x",
      created_at: "2026-01-01T00:00:00.000Z",
    })
    expect(auditAllDecisions(stateRoot, { since: "not-a-date" })).rejects.toThrow(
      /not a parseable date/,
    )
  })

  it("results sort most-recent-first", async () => {
    seedDecision("T_A", {
      task_id: "T_A",
      title: "a",
      motivation: "a work",
      created_at: "2026-01-01T00:00:00.000Z",
    })
    seedDecision("T_B", {
      task_id: "T_B",
      title: "b",
      motivation: "b work",
      created_at: "2026-05-22T00:00:00.000Z",
    })
    const reports = await auditAllDecisions(stateRoot)
    expect(reports.map((r) => r.task_id)).toEqual(["T_B", "T_A"])
  })
})

describe("formatReport + writeReflectionFile (CE-2 T5)", () => {
  it("formatReport empty candidates → 'No matched preventions.'", () => {
    const out = formatReport({
      task_id: "T1",
      decision_path: "/x/y",
      candidates: [],
    })
    expect(out).toContain("# Reflect: T1")
    expect(out).toContain("Decision: /x/y")
    expect(out).toContain("No matched preventions.")
  })

  it("formatReport contains discussed + silent markers when both present", () => {
    const out = formatReport({
      task_id: "T1",
      decision_path: "/x/y",
      candidates: [
        {
          solution_ref: "data/m",
          category: "data",
          prevention_text: "Avoid long locks. Use chunked backfill.",
          keyword_overlap: 5,
          discussed: false,
          discussed_evidence: null,
          applied_count: 0,
        },
        {
          solution_ref: "perf/c",
          category: "perf",
          prevention_text: "Cache stampede.",
          keyword_overlap: 2,
          discussed: true,
          discussed_evidence: "solution_ref direct match: perf/c",
          applied_count: 0,
        },
      ],
    })
    expect(out).toContain("[silent]")
    expect(out).toContain("data/m")
    expect(out).toContain("[discussed]")
    expect(out).toContain("perf/c")
    expect(out).toContain("evidence:")
  })

  it("writeReflectionFile creates reflections/ + replaces on rerun", async () => {
    const r1 = {
      task_id: "T1",
      decision_path: "/x/y",
      candidates: [],
    }
    const path = await writeReflectionFile(r1, stateRoot)
    expect(existsSync(path)).toBe(true)
    expect(readFileSync(path, "utf8")).toContain("No matched preventions.")

    // Rerun with a different report shape → file is replaced, not appended.
    const r2 = {
      task_id: "T1",
      decision_path: "/x/y",
      candidates: [
        {
          solution_ref: "data/m",
          category: "data",
          prevention_text: "Replace test.",
          keyword_overlap: 1,
          discussed: false,
          discussed_evidence: null,
          applied_count: 0,
        },
      ],
    }
    await writeReflectionFile(r2, stateRoot)
    const after = readFileSync(path, "utf8")
    expect(after).not.toContain("No matched preventions.")
    expect(after).toContain("data/m")
  })
})

describe("reflect — CE-6 applied_count surfacing", () => {
  test("CE6-R1: applied_count populated from solution frontmatter; stdout shows it", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { resolve } = await import("node:path")
    const { auditDecision, formatReport } = await import("../../src/dispatcher/reflect")

    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-reflect-r1-"))
    // Seed a solution with applied_in already populated
    const solDir = resolve(root, "solutions/runtime")
    mkdirSync(solDir, { recursive: true })
    writeFileSync(
      resolve(solDir, "alpha-2026.md"),
      `---\nid: runtime-alpha-2026\nsignature: x\ncategory: runtime\nproblem: p\nsymptoms: [s]\nwhat_didnt_work: []\nsolution: s\nprevention: rate limit middleware bucket refill\ntags: [rate-limit]\nfirst_seen: 2026-01-01T00:00:00.000Z\nlast_updated: 2026-01-01T00:00:00.000Z\ntimes_referenced: 0\nsource_task_ids: [T-FX]\napplied_in:\n  - T-A\n  - T-B\n  - T-C\n---\n\nbody\n`,
      "utf8",
    )
    // Seed a decision intent.md that keyword-overlaps with the prevention
    const decDir = resolve(root, "decisions", "TASK-DEC-001")
    mkdirSync(decDir, { recursive: true })
    writeFileSync(
      resolve(decDir, "intent.md"),
      `---\ntask_id: TASK-DEC-001\nlevel: L3\ncreated_at: '2026-05-25T00:00:00.000Z'\ntitle: refactor rate limit\nmotivation: change rate limit middleware bucket refill window\n---\n\n## Pre-mortem (planner.adversarial)\n\n### [high/high] rate limit bucket refill drift\nEarly signal: see runtime/alpha-2026 for the source incident\n`,
      "utf8",
    )

    const report = await auditDecision("TASK-DEC-001", root)
    expect(report.candidates.length).toBeGreaterThan(0)
    const c = report.candidates.find((c) => c.solution_ref === "runtime/alpha-2026")
    expect(c).toBeDefined()
    expect(c!.applied_count).toBe(3)

    const out = formatReport(report)
    expect(out).toContain("applied: 3")
  })

  test("CE6-R2: candidate without applied_in field → applied_count: 0", async () => {
    const { mkdtempSync, mkdirSync, writeFileSync } = await import("node:fs")
    const { tmpdir } = await import("node:os")
    const { resolve } = await import("node:path")
    const { auditDecision } = await import("../../src/dispatcher/reflect")

    const root = mkdtempSync(resolve(tmpdir(), "sgc-ce6-reflect-r2-"))
    const solDir = resolve(root, "solutions/runtime")
    mkdirSync(solDir, { recursive: true })
    writeFileSync(
      resolve(solDir, "beta-2026.md"),
      `---\nid: runtime-beta-2026\nsignature: x\ncategory: runtime\nproblem: p\nsymptoms: [s]\nwhat_didnt_work: []\nsolution: s\nprevention: cache invalidation lag\ntags: [cache]\nfirst_seen: 2026-01-01T00:00:00.000Z\nlast_updated: 2026-01-01T00:00:00.000Z\ntimes_referenced: 0\nsource_task_ids: [T-FX]\n---\n\nbody\n`,
      "utf8",
    )
    const decDir = resolve(root, "decisions", "TASK-DEC-002")
    mkdirSync(decDir, { recursive: true })
    writeFileSync(
      resolve(decDir, "intent.md"),
      `---\ntask_id: TASK-DEC-002\nlevel: L3\ncreated_at: '2026-05-25T00:00:00.000Z'\ntitle: cache work\nmotivation: cache invalidation lag fixes\n---\n\n## Pre-mortem (planner.adversarial)\n\nEarly signal: nothing specific\n`,
      "utf8",
    )

    const report = await auditDecision("TASK-DEC-002", root)
    const c = report.candidates.find((c) => c.solution_ref === "runtime/beta-2026")
    expect(c?.applied_count).toBe(0)
  })
})
