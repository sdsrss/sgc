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
