import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { deriveInvestigationId, defaultHeuristic } from "../../src/dispatcher/debug"


describe("deriveInvestigationId", () => {
  test("kebabizes symptom + prefixes YYYY-MM-DD-HHMM", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    const id = deriveInvestigationId("Timeout in plan handler!", now)
    expect(id).toBe("2026-05-27-1423-timeout-in-plan-handler")
  })

  test("truncates kebab body to 30 chars + trims trailing dash", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    const id = deriveInvestigationId(
      "An overly long symptom about plan dispatcher and its many timeouts",
      now,
    )
    // body cap 30, then strip trailing -
    expect(id).toMatch(/^2026-05-27-1423-[a-z0-9-]{1,30}$/)
    expect(id).not.toMatch(/-$/)
  })

  test("strips NFD diacritics", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    expect(deriveInvestigationId("Café résumé crash", now)).toBe(
      "2026-05-27-1423-cafe-resume-crash",
    )
  })

  test("falls back to <YYYY-MM-DD>-<HHMM>-debug when kebab empty", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    expect(deriveInvestigationId("。。。", now)).toBe("2026-05-27-1423-debug")
    expect(deriveInvestigationId("   !!! ", now)).toBe("2026-05-27-1423-debug")
  })

  test("UTC date parts (deterministic across host TZ)", () => {
    const now = new Date("2026-05-27T23:59:00.000Z")
    expect(deriveInvestigationId("x", now)).toBe("2026-05-27-2359-x")
  })
})

function makeTmpState() {
  const root = mkdtempSync(join(tmpdir(), "sgc-debug-"))
  const stateRoot = join(root, ".sgc")
  mkdirSync(stateRoot, { recursive: true })
  mkdirSync(join(stateRoot, "progress"), { recursive: true })
  return { repoRoot: root, stateRoot }
}

describe("gatherInvestigateFacts", () => {
  test("returns events tail when events.ndjson present", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    // Initialize as git repo so git commands don't fail
    spawnSync("git", ["init"], { cwd: repoRoot })
    spawnSync("git", ["config", "user.email", "test@example.com"], { cwd: repoRoot })
    spawnSync("git", ["config", "user.name", "Test User"], { cwd: repoRoot })
    writeFileSync(join(repoRoot, "README.md"), "test")
    spawnSync("git", ["add", "README.md"], { cwd: repoRoot })
    spawnSync("git", ["commit", "-m", "initial"], { cwd: repoRoot })

    const lines = [
      `{"schema_version":1,"ts":"2026-05-27T10:00:00.000Z","event_type":"spawn.start","agent":"planner.eng"}`,
      `{"schema_version":1,"ts":"2026-05-27T10:00:01.000Z","event_type":"llm.response","agent":"planner.eng"}`,
    ]
    writeFileSync(join(stateRoot, "progress", "events.ndjson"), lines.join("\n") + "\n")

    const facts = await defaultHeuristic().gatherInvestigateFacts({
      stateRoot,
      repoRoot,
    })

    expect(facts.recent_events).toHaveLength(2)
    expect(facts.recent_events[0].event_type).toBe("spawn.start")
    expect(facts.recent_events[1].agent).toBe("planner.eng")
    expect(facts.errors).toEqual([])
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("handles missing events.ndjson defensively", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const facts = await defaultHeuristic().gatherInvestigateFacts({
      stateRoot,
      repoRoot,
    })
    expect(facts.recent_events).toEqual([])
    expect(facts.errors).toContain("events_tail: file missing")
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("handles non-git repoRoot defensively", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const facts = await defaultHeuristic().gatherInvestigateFacts({
      stateRoot,
      repoRoot,
    })
    // non-git → git_head undefined, git_status_paths empty (or error recorded)
    expect(facts.git_status_paths).toEqual([])
    rmSync(repoRoot, { recursive: true, force: true })
  })
})

describe("analyzeCorpus", () => {
  test("returns corpus hits ranked by overlap_score desc", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const solutionsDir = join(stateRoot, "solutions", "other")
    mkdirSync(solutionsDir, { recursive: true })

    writeFileSync(
      join(solutionsDir, "timeout-plan-handler.md"),
      `---
intent: plan handler timeout under load
category: other
tags: [timeout, plan]
signature: "timeout in plan dispatcher"
problem: dispatcher hangs on plan command
dedup_stamp: aaa
prevention: "wrap planner.eng spawn in 30s timeout per F robustness"
---

Body.
`,
    )

    writeFileSync(
      join(solutionsDir, "unrelated-canary-network.md"),
      `---
intent: canary network flake
category: other
tags: [network]
signature: "ECONNRESET during npm install"
problem: network blip
dedup_stamp: bbb
prevention: "retry npm install with backoff"
---

Body.
`,
    )

    const hits = await defaultHeuristic().analyzeCorpus({
      stateRoot,
      symptom: "plan dispatcher timeout",
    })

    expect(hits.length).toBeGreaterThanOrEqual(1)
    expect(hits[0].solution_ref).toContain("timeout-plan-handler")
    expect(hits[0].prevention_excerpt).toContain("wrap planner.eng spawn")
    expect(hits[0].overlap_score).toBeGreaterThan(0)
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("returns empty array when no solutions dir exists", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const hits = await defaultHeuristic().analyzeCorpus({
      stateRoot,
      symptom: "anything",
    })
    expect(hits).toEqual([])
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("caps results at top-N=5", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const solutionsDir = join(stateRoot, "solutions", "other")
    mkdirSync(solutionsDir, { recursive: true })
    for (let i = 0; i < 8; i++) {
      writeFileSync(
        join(solutionsDir, `timeout-${i}.md`),
        `---
intent: timeout symptom variant ${i}
category: other
tags: [timeout]
signature: "timeout in plan dispatcher ${i}"
problem: dispatcher hangs
dedup_stamp: stamp${i}
prevention: "mitigation for timeout case ${i}"
---

Body.
`,
      )
    }
    const hits = await defaultHeuristic().analyzeCorpus({
      stateRoot,
      symptom: "plan dispatcher timeout",
    })
    expect(hits.length).toBe(5)
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("drops corpus entries with empty/missing prevention field", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const solutionsDir = join(stateRoot, "solutions", "other")
    mkdirSync(solutionsDir, { recursive: true })

    // Has prevention → should be included.
    writeFileSync(
      join(solutionsDir, "with-prevention.md"),
      `---
intent: plan dispatcher timeout under load
category: other
tags: [timeout, plan]
signature: "plan dispatcher timeout"
problem: hangs
dedup_stamp: aaa
prevention: "wrap planner in timeout"
---

Body.
`,
    )

    // Missing prevention key entirely → should be dropped.
    writeFileSync(
      join(solutionsDir, "missing-prevention.md"),
      `---
intent: plan dispatcher timeout retry
category: other
tags: [timeout, plan]
signature: "plan dispatcher timeout retry"
problem: hangs
dedup_stamp: bbb
---

Body.
`,
    )

    // Present but empty-string prevention → should be dropped.
    writeFileSync(
      join(solutionsDir, "empty-prevention.md"),
      `---
intent: plan dispatcher timeout flake
category: other
tags: [timeout, plan]
signature: "plan dispatcher timeout flake"
problem: hangs
dedup_stamp: ccc
prevention: "   "
---

Body.
`,
    )

    const hits = await defaultHeuristic().analyzeCorpus({
      stateRoot,
      symptom: "plan dispatcher timeout",
    })

    expect(hits).toHaveLength(1)
    expect(hits[0].solution_ref).toBe("other/with-prevention.md")
    rmSync(repoRoot, { recursive: true, force: true })
  })
})

describe("detectThreeStrike", () => {
  test("flags signature with count >= 3", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const sig = (cls: string, msg: string, ts: string) =>
      JSON.stringify({
        schema_version: 1,
        ts,
        event_type: "llm.response",
        agent: "planner.eng",
        payload: { error_class: cls, error_message: msg },
      })
    // All three messages are identical → same signature
    const lines = [
      sig("Error", "Timeout exceeded for foo", "2026-05-27T10:00:00Z"),
      sig("Error", "Timeout exceeded for foo", "2026-05-27T10:00:01Z"),
      sig("Error", "Timeout exceeded for foo", "2026-05-27T10:00:02Z"),
      sig("TypeError", "unrelated", "2026-05-27T10:00:03Z"),
    ]
    writeFileSync(join(stateRoot, "progress", "events.ndjson"), lines.join("\n") + "\n")
    const strikes = await defaultHeuristic().detectThreeStrike({ stateRoot })
    expect(strikes).toHaveLength(1)
    expect(strikes[0].signature).toBe("Error: Timeout exceeded for foo")
    expect(strikes[0].count).toBe(3)
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("returns empty when no signature reaches 3", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    writeFileSync(
      join(stateRoot, "progress", "events.ndjson"),
      `{"schema_version":1,"ts":"2026-05-27T10:00:00Z","event_type":"llm.response","payload":{"error_class":"X","error_message":"once"}}\n`,
    )
    const strikes = await defaultHeuristic().detectThreeStrike({ stateRoot })
    expect(strikes).toEqual([])
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("returns empty defensively when events.ndjson missing", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const strikes = await defaultHeuristic().detectThreeStrike({ stateRoot })
    expect(strikes).toEqual([])
    rmSync(repoRoot, { recursive: true, force: true })
  })
})

describe("scanHistoricalSignatures", () => {
  test("matches ship-failures and canaries by symptom-prefix substring", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    mkdirSync(join(stateRoot, "ship-failures"), { recursive: true })
    mkdirSync(join(stateRoot, "canaries"), { recursive: true })

    writeFileSync(
      join(stateRoot, "ship-failures", "2026-05-25-abc1234.md"),
      `---
kind: ship-failure
commit_sha: abc1234
conclusion: failure
prevention_seed: "TODO: timeout in plan dispatcher recurs under high load"
---

# Body

The publish workflow timed out because the plan dispatcher hung waiting on
planner.eng to respond.
`,
    )

    writeFileSync(
      join(stateRoot, "canaries", "2026-05-26-foo.md"),
      `---
kind: canary
commit_sha: def5678
conclusion: failure
regression_seed: "TODO: smoke install hit ECONNRESET against registry"
---

# Body
`,
    )

    const hits = await defaultHeuristic().scanHistoricalSignatures({
      stateRoot,
      symptom: "timeout in plan dispatcher",
    })

    expect(hits.length).toBe(1)
    expect(hits[0].kind).toBe("ship-failure")
    expect(hits[0].slug).toBe("2026-05-25-abc1234")
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("returns empty when no matches", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    mkdirSync(join(stateRoot, "ship-failures"), { recursive: true })
    writeFileSync(
      join(stateRoot, "ship-failures", "x.md"),
      `---\nkind: ship-failure\n---\n\nUnrelated body about cache flushing.\n`,
    )
    const hits = await defaultHeuristic().scanHistoricalSignatures({
      stateRoot,
      symptom: "timeout",
    })
    expect(hits).toEqual([])
    rmSync(repoRoot, { recursive: true, force: true })
  })
})

import { readFileSync } from "node:fs"
import { renderInvestigationBody, writeInvestigation, runDebugStart, runDebugClose } from "../../src/dispatcher/debug"

describe("renderInvestigationBody", () => {
  test("renders 4 body sections deterministically", () => {
    const body = renderInvestigationBody({
      investigate: {
        git_head: "abc1234",
        git_status_paths: ["M src/foo.ts"],
        recent_events: [
          {
            ts: "2026-05-27T10:00Z",
            event_type: "spawn.start",
            agent: "planner.eng",
          },
        ],
        errors: [],
      },
      analyze: {
        prior_preventions: [],
        historical_signatures: [],
        three_strike: [
          { signature: "Error: X", count: 3, example_ts: "2026-05-27T10:00Z" },
        ],
        errors: [],
      },
      hypothesize: ["No prior matches. Operator-formulated hypothesis required."],
    })

    expect(body).toContain("## 1 — Investigate")
    expect(body).toContain("git_head: abc1234")
    expect(body).toContain("## 2 — Analyze")
    expect(body).toContain("⚠ three-strike: Error: X (3 occurrences; consider rollback per §6)")
    expect(body).toContain("## 3 — Hypothesize")
    expect(body).toContain("Operator-formulated hypothesis required")
    expect(body).toContain("## 4 — Implement")
  })

  test("renders empty-corpus analyze sub-sections as (none)", () => {
    const body = renderInvestigationBody({
      investigate: { git_status_paths: [], recent_events: [], errors: [] },
      analyze: {
        prior_preventions: [],
        historical_signatures: [],
        three_strike: [],
        errors: [],
      },
      hypothesize: ["No prior matches. Operator-formulated hypothesis required."],
    })
    expect(body).toMatch(/Prior preventions:\s*\n\s*- \(none\)/)
    expect(body).toMatch(/Historical signatures:\s*\n\s*- \(none\)/)
    expect(body).toMatch(/Three-strike:\s*\n\s*- \(none\)/)
  })
})

describe("writeInvestigation atomic", () => {
  test("writes frontmatter + body to .sgc/investigations/<id>.md", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const path = await writeInvestigation({
      stateRoot,
      id: "2026-05-27-1423-test",
      frontmatter: {
        id: "2026-05-27-1423-test",
        status: "in_progress",
        current_phase: "implement",
        symptom: "test symptom",
        started_at: "2026-05-27T14:23:00.000Z",
        closed_at: null,
        root_cause: null,
        fix_commit: null,
        verify_command: null,
      },
      body: "## 1 — Investigate\n(stub)\n",
    })
    expect(path).toBe(join(stateRoot, "investigations", "2026-05-27-1423-test.md"))
    const content = readFileSync(path, "utf8")
    expect(content).toMatch(/^---\nid: 2026-05-27-1423-test\n/)
    expect(content).toContain("status: in_progress")
    expect(content).toContain('symptom: "test symptom"')
    expect(content).toContain("## 1 — Investigate")
    rmSync(repoRoot, { recursive: true, force: true })
  })
})

describe("runDebugStart", () => {
  test("happy path: creates investigation + emits 4 events + exit 0", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []
    const now = new Date("2026-05-27T14:23:00.000Z")

    const result = await runDebugStart({
      symptom: "plan dispatcher hangs",
      stateRoot,
      repoRoot,
      now: () => now,
      stdoutWrite: (c) => {
        stdoutChunks.push(c)
      },
      stderrWrite: (c) => {
        stderrChunks.push(c)
      },
    })

    expect(result.exitCode).toBe(0)
    const stderr = stderrChunks.join("")
    expect(stderr).toMatch(
      /^started: .*\.sgc\/investigations\/2026-05-27-1423-plan-dispatcher-hangs\.md\n$/,
    )

    const stdout = stdoutChunks.join("")
    expect(stdout).toContain("## 3 — Hypothesize")

    const investigationPath = join(
      stateRoot,
      "investigations",
      "2026-05-27-1423-plan-dispatcher-hangs.md",
    )
    const content = readFileSync(investigationPath, "utf8")
    expect(content).toMatch(/^---\nid: 2026-05-27-1423-plan-dispatcher-hangs\n/)
    expect(content).toContain("status: in_progress")
    expect(content).toContain("current_phase: implement")

    const eventsPath = join(stateRoot, "progress", "events.ndjson")
    const eventLines = readFileSync(eventsPath, "utf8")
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l))
    const types = eventLines.map((e: { event_type: string }) => e.event_type)
    expect(types.filter((t: string) => t === "debug.start")).toHaveLength(1)
    expect(types.filter((t: string) => t === "debug.phase_complete")).toHaveLength(3)

    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("empty corpus → hypothesize fallback line", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const stdoutChunks: string[] = []
    const stderrChunks: string[] = []
    const result = await runDebugStart({
      symptom: "novel symptom",
      stateRoot,
      repoRoot,
      now: () => new Date("2026-05-27T14:23:00.000Z"),
      stdoutWrite: (c) => {
        stdoutChunks.push(c)
      },
      stderrWrite: (c) => {
        stderrChunks.push(c)
      },
    })
    expect(result.exitCode).toBe(0)
    expect(stdoutChunks.join("")).toContain(
      "No prior matches. Operator-formulated hypothesis required.",
    )
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("same-minute collision: appends -2 suffix", async () => {
    const { repoRoot, stateRoot } = makeTmpState()
    const now = new Date("2026-05-27T14:23:00.000Z")
    const stderrA: string[] = []
    const stderrB: string[] = []
    await runDebugStart({
      symptom: "x",
      stateRoot,
      repoRoot,
      now: () => now,
      stderrWrite: (c) => {
        stderrA.push(c)
      },
      stdoutWrite: () => {},
    })
    await runDebugStart({
      symptom: "x",
      stateRoot,
      repoRoot,
      now: () => now,
      stderrWrite: (c) => {
        stderrB.push(c)
      },
      stdoutWrite: () => {},
    })
    expect(stderrA.join("")).toMatch(/2026-05-27-1423-x\.md/)
    expect(stderrB.join("")).toMatch(/2026-05-27-1423-x-2\.md/)
    rmSync(repoRoot, { recursive: true, force: true })
  })
})

describe("runDebugClose Iron Law #3", () => {
  async function makeInProgress() {
    const { repoRoot, stateRoot } = makeTmpState()
    await runDebugStart({
      symptom: "test sym",
      stateRoot,
      repoRoot,
      now: () => new Date("2026-05-27T14:23:00.000Z"),
      stdoutWrite: () => {},
      stderrWrite: () => {},
    })
    return { repoRoot, stateRoot, id: "2026-05-27-1423-test-sym" }
  }

  test("refuses missing --root-cause", async () => {
    const { repoRoot, stateRoot, id } = await makeInProgress()
    const stderrChunks: string[] = []
    const result = await runDebugClose({
      id,
      rootCause: "",
      fixCommit: "abc1234",
      verifyCommand: "bun test",
      stateRoot,
      stderrWrite: (c) => { stderrChunks.push(c) },
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(stderrChunks.join("")).toContain("--root-cause required (Iron Law #3)")
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("refuses missing --fix-commit", async () => {
    const { repoRoot, stateRoot, id } = await makeInProgress()
    const stderrChunks: string[] = []
    const result = await runDebugClose({
      id,
      rootCause: "race condition in foo()",
      fixCommit: "",
      verifyCommand: "bun test",
      stateRoot,
      stderrWrite: (c) => { stderrChunks.push(c) },
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(stderrChunks.join("")).toContain("--fix-commit must be 7-40 hex chars (Iron Law #3)")
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("refuses bad SHA shape", async () => {
    const { repoRoot, stateRoot, id } = await makeInProgress()
    const stderrChunks: string[] = []
    const result = await runDebugClose({
      id,
      rootCause: "race condition",
      fixCommit: "not-a-sha",
      verifyCommand: "bun test",
      stateRoot,
      stderrWrite: (c) => { stderrChunks.push(c) },
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(stderrChunks.join("")).toContain("--fix-commit must be 7-40 hex chars")
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("refuses missing --verify-command", async () => {
    const { repoRoot, stateRoot, id } = await makeInProgress()
    const stderrChunks: string[] = []
    const result = await runDebugClose({
      id,
      rootCause: "race condition",
      fixCommit: "abc1234",
      verifyCommand: "",
      stateRoot,
      stderrWrite: (c) => { stderrChunks.push(c) },
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(1)
    expect(stderrChunks.join("")).toContain("--verify-command required (Iron Law #3)")
    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("happy path: 3 valid flags → frontmatter updated + section 5 appended + event emitted", async () => {
    const { repoRoot, stateRoot, id } = await makeInProgress()
    const stderrChunks: string[] = []
    const result = await runDebugClose({
      id,
      rootCause: "planner.eng spawn missing timeout",
      fixCommit: "deadbeef",
      verifyCommand: "SGC_FORCE_INLINE=1 bun test tests/dispatcher/spawn.test.ts",
      stateRoot,
      stderrWrite: (c) => { stderrChunks.push(c) },
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(0)
    expect(stderrChunks.join("")).toContain(`closed: ${id}`)

    const content = readFileSync(join(stateRoot, "investigations", `${id}.md`), "utf8")
    expect(content).toContain("status: closed")
    expect(content).toContain("current_phase: closed")
    expect(content).toContain("fix_commit: deadbeef")
    expect(content).toContain("## 5 — Fix evidence")
    expect(content).toContain("planner.eng spawn missing timeout")

    const eventsPath = join(stateRoot, "progress", "events.ndjson")
    const events = readFileSync(eventsPath, "utf8")
      .split("\n")
      .filter((l) => l.length > 0)
      .map((l) => JSON.parse(l))
    expect(events.some((e: { event_type: string }) => e.event_type === "debug.closed")).toBe(true)

    rmSync(repoRoot, { recursive: true, force: true })
  })

  test("accepts 40-char SHA", async () => {
    const { repoRoot, stateRoot, id } = await makeInProgress()
    const result = await runDebugClose({
      id,
      rootCause: "X",
      fixCommit: "deadbeef".repeat(5),
      verifyCommand: "Y",
      stateRoot,
      stderrWrite: () => {},
      stdoutWrite: () => {},
    })
    expect(result.exitCode).toBe(0)
    rmSync(repoRoot, { recursive: true, force: true })
  })
})
