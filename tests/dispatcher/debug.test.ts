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
