// tests/dispatcher/handoff.test.ts
//
// GS-2 (f9) — handoff state capture tests.
//
// Spec: tasks/specs/gs-2-handoff.md
// Tests mirror canary.test.ts / loop.test.ts mkdtempSync sandboxing.

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import {
  deriveSlug,
  kebabize,
  timestampFallback,
  inferVerifyCommand,
  gatherActiveIntent,
  gatherPlanJobs,
  gatherLoopRuns,
  gatherUnpromotedCaptures,
  gatherUnclosedSpawns,
  gatherGit,
  gatherRecentCommits,
  gatherHandoffState,
  renderHandoffMarkdown,
  writeHandoffMarkdown,
  type HandoffSnapshot,
  type VerifyCommandResult,
  type GitProbe,
} from "../../src/dispatcher/handoff"

let stateRoot: string
let repoRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-handoff-state-"))
  repoRoot = mkdtempSync(join(tmpdir(), "sgc-handoff-repo-"))
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
  rmSync(repoRoot, { recursive: true, force: true })
})

// ── helpers ────────────────────────────────────────────────────────────────

function writeYaml(path: string, frontmatter: Record<string, unknown>, body = ""): void {
  mkdirSync(dirname(path), { recursive: true })
  const lines = ["---"]
  for (const [k, v] of Object.entries(frontmatter)) {
    lines.push(`${k}: ${typeof v === "string" ? JSON.stringify(v) : String(v)}`)
  }
  lines.push("---", "", body)
  writeFileSync(path, lines.join("\n"))
}

// Test cases follow below per task.

describe("kebabize (GS-2 T2)", () => {
  it("lowercases + replaces punctuation + trims edges", () => {
    expect(kebabize("GS-2 Handoff: Auto Mode!")).toBe("gs-2-handoff-auto-mode")
  })

  it("strips NFD diacritics", () => {
    expect(kebabize("Café résumé")).toBe("cafe-resume")
  })

  it("returns empty string for pure CJK / pure symbols", () => {
    expect(kebabize("会话恢复")).toBe("")
    expect(kebabize("！@#￥%")).toBe("")
  })
})

describe("deriveSlug (GS-2 T3)", () => {
  const fixedNow = new Date("2026-05-26T18:42:15Z")

  it("happy: mtime-newest intent.md title → kebab-tailed slug", async () => {
    const decId = "ABCD1234EF"
    writeYaml(join(stateRoot, "decisions", decId, "intent.md"), {
      task_id: decId,
      level: "L3",
      title: "GS-2 Handoff Capture",
    })
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug).toBe("2026-05-26-gs-2-handoff-capture")
  })

  it("fallback when .sgc/decisions/ absent", async () => {
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug).toBe("2026-05-26-1842-handoff")
  })

  it("fallback when decisions/ exists but empty", async () => {
    mkdirSync(join(stateRoot, "decisions"))
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug).toBe("2026-05-26-1842-handoff")
  })

  it("fallback when title field absent", async () => {
    writeYaml(join(stateRoot, "decisions", "X1", "intent.md"), {
      task_id: "X1",
      level: "L1",
    })
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug).toBe("2026-05-26-1842-handoff")
  })

  it("fallback when title is pure CJK (kebab empty)", async () => {
    writeYaml(join(stateRoot, "decisions", "X2", "intent.md"), {
      task_id: "X2",
      level: "L2",
      title: "会话恢复",
    })
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug).toBe("2026-05-26-1842-handoff")
  })

  it("tie-break two intents identical mtime by lex(id) ASC", async () => {
    const t = new Date("2026-05-26T17:00:00Z")
    writeYaml(join(stateRoot, "decisions", "BBBB", "intent.md"), {
      task_id: "BBBB",
      level: "L1",
      title: "Bravo Decision",
    })
    writeYaml(join(stateRoot, "decisions", "AAAA", "intent.md"), {
      task_id: "AAAA",
      level: "L1",
      title: "Alpha Decision",
    })
    const fs2 = await import("node:fs/promises")
    await fs2.utimes(join(stateRoot, "decisions", "BBBB", "intent.md"), t, t)
    await fs2.utimes(join(stateRoot, "decisions", "AAAA", "intent.md"), t, t)
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug).toBe("2026-05-26-alpha-decision")
  })

  it("truncates kebab to 40 chars and trims trailing dash", async () => {
    writeYaml(join(stateRoot, "decisions", "X3", "intent.md"), {
      task_id: "X3",
      level: "L2",
      title: "session state checkpoint auto extra words trailing",
    })
    const slug = await deriveSlug(stateRoot, fixedNow)
    expect(slug.startsWith("2026-05-26-")).toBe(true)
    const kebabTail = slug.slice("2026-05-26-".length)
    expect(kebabTail.length).toBeLessThanOrEqual(40)
    expect(kebabTail.endsWith("-")).toBe(false)
  })
})

describe("inferVerifyCommand cascade (GS-2 T4)", () => {
  const emptySnapshot = (): HandoffSnapshot => ({
    slug: "2026-05-26-test",
    generated_at: "2026-05-26T18:00:00Z",
    cwd: "/tmp",
    sgc_version: "1.13.0",
    verify_command: { source: "todo" },
    plan_jobs: [],
    loop_runs: [],
    unpromoted_captures: [],
    git: { branch: "main", changes: [] },
    recent_commits: [],
    unclosed_spawns: [],
  })

  it("P1: loop-run paused → sgc loop --resume", () => {
    const snap = emptySnapshot()
    snap.loop_runs = [
      {
        run_id: "2026-05-26-1842-gs-2",
        status: "paused",
        current_step: "review",
        task: "GS-2 spec",
        started_at: "2026-05-26T18:42:00Z",
      },
    ]
    const result = inferVerifyCommand(snap)
    expect(result.source).toBe("loop-run")
    expect(result.command).toBe("sgc loop --resume 2026-05-26-1842-gs-2")
    expect(result.context).toContain("paused at step:review")
  })

  it("P2: no paused loop, plan-job running (alive) → sgc plan --status", () => {
    const snap = emptySnapshot()
    snap.plan_jobs = [
      {
        job_id: "2026-05-26-1800-handoff",
        status: "running",
        task: "GS-2 design",
        pid: 12345,
        started_at: "2026-05-26T18:00:00Z",
      },
    ]
    const result = inferVerifyCommand(snap)
    expect(result.source).toBe("plan-job")
    expect(result.command).toBe("sgc plan --status 2026-05-26-1800-handoff")
    expect(result.context).toContain("pid 12345")
  })

  it("P3: no loop/plan, unclosed spawn → sgc tail --since", () => {
    const snap = emptySnapshot()
    snap.unclosed_spawns = [
      {
        spawn_id: "spawn-abc",
        agent: "planner.eng",
        start_ts: "2026-05-26T17:55:00Z",
      },
    ]
    const result = inferVerifyCommand(snap)
    expect(result.source).toBe("events-spawn")
    expect(result.command).toBe("sgc tail --since 2026-05-26T17:55:00Z")
    expect(result.context).toContain("planner.eng")
    expect(result.context).toContain("spawn-abc")
  })

  it("P4: all signals empty → source:todo, no command", () => {
    const snap = emptySnapshot()
    const result = inferVerifyCommand(snap)
    expect(result.source).toBe("todo")
    expect(result.command).toBeUndefined()
    expect(result.context).toContain("no in-flight")
  })

  it("paused loop wins over running plan + unclosed spawn (priority)", () => {
    const snap = emptySnapshot()
    snap.loop_runs = [
      {
        run_id: "L1",
        status: "paused",
        current_step: "qa",
        task: "T1",
        started_at: "2026-05-26T16:00:00Z",
      },
    ]
    snap.plan_jobs = [
      {
        job_id: "P1",
        status: "running",
        task: "T2",
        pid: 99,
        started_at: "2026-05-26T17:00:00Z",
      },
    ]
    snap.unclosed_spawns = [
      { spawn_id: "S1", agent: "qa.browser", start_ts: "2026-05-26T18:00:00Z" },
    ]
    const result = inferVerifyCommand(snap)
    expect(result.source).toBe("loop-run")
  })
})

describe("gatherActiveIntent (GS-2 T5)", () => {
  it("returns mtime-newest intent summary with all fields populated", async () => {
    writeYaml(join(stateRoot, "decisions", "OLD", "intent.md"), {
      task_id: "OLD",
      level: "L1",
      title: "Older Decision",
    })
    await new Promise((r) => setTimeout(r, 50))
    writeYaml(join(stateRoot, "decisions", "NEW1", "intent.md"), {
      task_id: "NEW1",
      level: "L3",
      title: "Newer Decision",
    })
    const result = await gatherActiveIntent(stateRoot)
    expect(result).toBeDefined()
    expect(result!.task_id).toBe("NEW1")
    expect(result!.level).toBe("L3")
    expect(result!.title).toBe("Newer Decision")
    expect(result!.intent_path).toContain("NEW1/intent.md")
    expect(result!.mtime).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it("returns undefined when no .sgc/decisions/", async () => {
    const result = await gatherActiveIntent(stateRoot)
    expect(result).toBeUndefined()
  })

  it("returns undefined when intent.md is malformed YAML (no throw)", async () => {
    mkdirSync(join(stateRoot, "decisions", "BAD"), { recursive: true })
    writeFileSync(join(stateRoot, "decisions", "BAD", "intent.md"), "not yaml at all")
    const result = await gatherActiveIntent(stateRoot)
    expect(result).toBeUndefined()
  })
})

describe("gatherPlanJobs (GS-2 T6)", () => {
  it("maps listJobs output to PlanJobSummary (running + failed visible, done filtered out)", async () => {
    const jobsDir = join(stateRoot, "plan-jobs")
    mkdirSync(jobsDir, { recursive: true })
    writeYaml(join(jobsDir, "R1.md"), {
      job_id: "R1",
      task: "task running",
      started_at: "2026-05-26T18:00:00Z",
      pid: 99999,
      log_path: "/tmp/r1.log",
      status: "running",
    })
    writeYaml(join(jobsDir, "D1.md"), {
      job_id: "D1",
      task: "task done",
      started_at: "2026-05-26T17:00:00Z",
      pid: 1,
      log_path: "/tmp/d1.log",
      status: "done",
    })
    writeYaml(join(jobsDir, "F1.md"), {
      job_id: "F1",
      task: "task failed",
      started_at: "2026-05-26T16:00:00Z",
      pid: 2,
      log_path: "/tmp/f1.log",
      status: "failed",
    })
    const result = await gatherPlanJobs(stateRoot)
    const ids = result.map((j) => j.job_id).sort()
    expect(ids).toContain("R1")
    expect(ids).toContain("F1")
    expect(ids).not.toContain("D1")
  })

  it("returns empty array when .sgc/plan-jobs/ absent", async () => {
    const result = await gatherPlanJobs(stateRoot)
    expect(result).toEqual([])
  })
})

describe("gatherLoopRuns (GS-2 T7)", () => {
  it("maps listLoopRuns to LoopRunSummary, filters out complete runs", async () => {
    const runsDir = join(stateRoot, "loop-runs")
    mkdirSync(runsDir, { recursive: true })
    writeYaml(join(runsDir, "L1.md"), {
      run_id: "L1",
      task: "Loop paused",
      started_at: "2026-05-26T18:42:00Z",
      last_updated_at: "2026-05-26T18:45:00Z",
      current_step: "review",
      status: "paused",
    })
    writeYaml(join(runsDir, "L2.md"), {
      run_id: "L2",
      task: "Loop complete",
      started_at: "2026-05-26T17:00:00Z",
      last_updated_at: "2026-05-26T17:30:00Z",
      current_step: "done",
      status: "complete",
    })
    const result = await gatherLoopRuns(stateRoot)
    expect(result.map((r) => r.run_id)).toEqual(["L1"])
    expect(result[0]!.status).toBe("paused")
    expect(result[0]!.current_step).toBe("review")
  })

  it("returns empty array when .sgc/loop-runs/ absent", async () => {
    const result = await gatherLoopRuns(stateRoot)
    expect(result).toEqual([])
  })
})

describe("gatherUnpromotedCaptures (GS-2 T8)", () => {
  it("combines ship-failures + canaries, filters promoted_to set", async () => {
    const sfDir = join(stateRoot, "ship-failures")
    const caDir = join(stateRoot, "canaries")
    mkdirSync(sfDir, { recursive: true })
    mkdirSync(caDir, { recursive: true })
    writeYaml(join(sfDir, "2026-05-22-c2c534a.md"), {
      kind: "ship-failure",
      commit_sha: "c2c534a",
      prevention_seed: "TODO: operator-fill the prevention here",
    })
    writeYaml(join(sfDir, "2026-05-20-promoted.md"), {
      kind: "ship-failure",
      commit_sha: "promoted",
      prevention_seed: "operator-edited",
      promoted_to: "other/promoted-slug",
    })
    writeYaml(join(caDir, "2026-05-25-c29f021-smoke_install.md"), {
      kind: "canary-failure",
      commit_sha: "c29f021",
      regression_seed: "TODO: operator-fill canary failed at smoke_install",
    })
    writeYaml(join(caDir, "2026-05-24-already-promoted.md"), {
      kind: "canary-failure",
      commit_sha: "alreadyp",
      regression_seed: "operator-edited",
      promoted_to: "other/already-promoted",
    })
    const result = await gatherUnpromotedCaptures(stateRoot)
    expect(result.length).toBe(2)
    const sf = result.find((c) => c.kind === "ship-failure")
    const ca = result.find((c) => c.kind === "canary")
    expect(sf?.slug).toBe("2026-05-22-c2c534a")
    expect(sf?.seed_excerpt).toContain("TODO: operator-fill")
    expect(ca?.slug).toBe("2026-05-25-c29f021-smoke_install")
    expect(ca?.seed_excerpt).toContain("TODO: operator-fill")
  })

  it("returns empty array when no capture dirs present", async () => {
    const result = await gatherUnpromotedCaptures(stateRoot)
    expect(result).toEqual([])
  })
})

describe("gatherUnclosedSpawns (GS-2 T9)", () => {
  it("pairs spawn.start with spawn.end by spawn_id; surfaces unclosed", async () => {
    const eventsPath = join(stateRoot, "progress", "events.ndjson")
    mkdirSync(join(stateRoot, "progress"), { recursive: true })
    const lines = [
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-26T17:50:00Z",
        spawn_id: "A",
        agent: "planner.eng",
        event_type: "spawn.start",
        level: "info",
        payload: {},
      }),
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-26T17:50:30Z",
        spawn_id: "A",
        agent: "planner.eng",
        event_type: "spawn.end",
        level: "info",
        payload: {},
      }),
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-26T17:55:00Z",
        spawn_id: "B",
        agent: "compound.related",
        event_type: "spawn.start",
        level: "info",
        payload: {},
      }),
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-26T17:58:00Z",
        spawn_id: "C",
        agent: "qa.browser",
        event_type: "spawn.start",
        level: "info",
        payload: {},
      }),
    ]
    writeFileSync(eventsPath, lines.join("\n") + "\n")
    const result = await gatherUnclosedSpawns(stateRoot, 500)
    const ids = result.map((s) => s.spawn_id).sort()
    expect(ids).toEqual(["B", "C"])
    expect(result.find((s) => s.spawn_id === "B")?.agent).toBe("compound.related")
  })

  it("returns empty array when events.ndjson absent", async () => {
    const result = await gatherUnclosedSpawns(stateRoot, 500)
    expect(result).toEqual([])
  })

  it("skips malformed NDJSON lines, parses valid ones", async () => {
    const eventsPath = join(stateRoot, "progress", "events.ndjson")
    mkdirSync(join(stateRoot, "progress"), { recursive: true })
    const lines = [
      "not-json-at-all{{{",
      JSON.stringify({
        schema_version: 1,
        ts: "2026-05-26T17:50:00Z",
        spawn_id: "D",
        agent: "x.y",
        event_type: "spawn.start",
        level: "info",
        payload: {},
      }),
    ]
    writeFileSync(eventsPath, lines.join("\n") + "\n")
    const result = await gatherUnclosedSpawns(stateRoot, 500)
    expect(result.length).toBe(1)
    expect(result[0]!.spawn_id).toBe("D")
  })
})

describe("gatherGit (GS-2 T10a)", () => {
  it("uses injected probe to return branch + changes", async () => {
    const probe: GitProbe = {
      branchAheadBehind: async () => ({ branch: "main", ahead: 0, behind: 0 }),
      statusPorcelain: async () => ["?? new-file.ts", "M  changed.ts"],
      recentCommits: async () => [],
    }
    const result = await gatherGit(probe)
    expect(result.branch).toBe("main")
    expect(result.ahead).toBe(0)
    expect(result.changes).toEqual(["?? new-file.ts", "M  changed.ts"])
  })

  it("returns '(not a git repo)' when probe throws", async () => {
    const probe: GitProbe = {
      branchAheadBehind: async () => {
        throw new Error("not a git repo")
      },
      statusPorcelain: async () => [],
      recentCommits: async () => [],
    }
    const result = await gatherGit(probe)
    expect(result.branch).toBe("(not a git repo)")
    expect(result.changes).toEqual([])
  })
})

describe("gatherRecentCommits (GS-2 T10b)", () => {
  it("uses injected probe to return last N commits", async () => {
    const probe: GitProbe = {
      branchAheadBehind: async () => ({ branch: "main" }),
      statusPorcelain: async () => [],
      recentCommits: async (_n) => [
        { sha: "a34d60d", subject: "docs: sync v1.12.1 doc drift" },
        { sha: "bf35053", subject: "docs(GS-1.1): bump spec" },
      ],
    }
    const result = await gatherRecentCommits(probe)
    expect(result.length).toBe(2)
    expect(result[0]!.sha).toBe("a34d60d")
  })

  it("returns empty array when probe throws", async () => {
    const probe: GitProbe = {
      branchAheadBehind: async () => ({ branch: "main" }),
      statusPorcelain: async () => [],
      recentCommits: async () => {
        throw new Error("no git")
      },
    }
    const result = await gatherRecentCommits(probe)
    expect(result).toEqual([])
  })
})
