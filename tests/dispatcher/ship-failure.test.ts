// CE-3 (task 94913CB45F9D4C3E906B3C2C8E#f4) — watchPublishWorkflow +
// captureShipFailure tests.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  captureShipFailure,
  EMPTY_SUMMARY_FALLBACK,
  type RunResult,
  type ShipFailure,
  SUMMARY_MAX_CHARS,
  TRUNCATION_SENTINEL,
  watchPublishWorkflow,
} from "../../src/dispatcher/ship-failure"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-ship-failure-"))
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

// ── helpers ────────────────────────────────────────────────────────────────

interface ScriptedResponse {
  /** Predicate on the gh argv (after the leading "gh" token). */
  match: (args: string[]) => boolean
  result: RunResult
}

function makeRunCommand(script: ScriptedResponse[]): (args: string[]) => Promise<RunResult> {
  return async (args: string[]) => {
    const tail = args[0] === "gh" ? args.slice(1) : args
    for (const s of script) {
      if (s.match(tail)) return s.result
    }
    return { stdout: "", stderr: `no scripted response for: ${args.join(" ")}`, exitCode: 1 }
  }
}

function jsonResult(payload: unknown): RunResult {
  return { stdout: JSON.stringify(payload), stderr: "", exitCode: 0 }
}

function listMatcher(): (a: string[]) => boolean {
  return (a) => a[0] === "run" && a[1] === "list"
}
function viewJsonMatcher(): (a: string[]) => boolean {
  return (a) => a[0] === "run" && a[1] === "view" && a.includes("--json")
}
function viewLogFailedMatcher(): (a: string[]) => boolean {
  return (a) => a[0] === "run" && a[1] === "view" && a.includes("--log-failed")
}

// Mutable clock + sleep that advances the clock deterministically so we
// never actually wait. Each call to sleep(ms) bumps the clock.
function makeClock(initialMs: number): {
  now: () => number
  sleep: (ms: number) => Promise<void>
  setNow: (ms: number) => void
} {
  let cur = initialMs
  return {
    now: () => cur,
    sleep: async (ms: number) => {
      cur += ms
    },
    setNow: (ms: number) => {
      cur = ms
    },
  }
}

// ── watchPublishWorkflow ────────────────────────────────────────────────────

describe("watchPublishWorkflow (CE-3 T2)", () => {
  it("returns success when the run lands completed/success on first poll", async () => {
    const clock = makeClock(0)
    const runCommand = makeRunCommand([
      {
        match: listMatcher(),
        result: jsonResult([
          {
            databaseId: 12345,
            status: "completed",
            conclusion: "success",
            name: "publish-npm",
            headSha: "9c8bc57aabbccdd",
            headBranch: "main",
            url: "https://github.com/sdsrss/sgc/actions/runs/12345",
          },
        ]),
      },
    ])
    const result = await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
      branch: "main",
    })
    expect(result.status).toBe("success")
    expect(result.run?.id).toBe("12345")
    expect(result.summaryExcerpt).toBeUndefined()
  })

  it("returns failure with summaryExcerpt when conclusion is failure", async () => {
    const clock = makeClock(0)
    const failingLog = "FAIL tests/dispatcher/foo.test.ts > bar\nAssertionError: expected 1 to be 2"
    const runCommand = makeRunCommand([
      {
        match: listMatcher(),
        result: jsonResult([
          {
            databaseId: 99,
            status: "completed",
            conclusion: "failure",
            name: "publish-npm",
            headSha: "abcdef0",
            headBranch: "main",
            url: "https://github.com/sdsrss/sgc/actions/runs/99",
          },
        ]),
      },
      {
        match: viewLogFailedMatcher(),
        result: { stdout: failingLog, stderr: "", exitCode: 0 },
      },
    ])
    const result = await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
      branch: "main",
    })
    expect(result.status).toBe("failure")
    expect(result.run?.id).toBe("99")
    expect(result.summaryExcerpt).toBe(failingLog)
  })

  it("returns timeout when the run never reaches completed", async () => {
    const clock = makeClock(0)
    // Discovery succeeds (returns in_progress); every subsequent view-poll
    // also returns in_progress. Clock-driven sleep advances past timeoutSec.
    const runCommand = makeRunCommand([
      {
        match: listMatcher(),
        result: jsonResult([
          {
            databaseId: 5,
            status: "in_progress",
            conclusion: null,
            name: "publish-npm",
            headSha: "deadbeef",
            headBranch: "main",
            url: "https://github.com/sdsrss/sgc/actions/runs/5",
          },
        ]),
      },
      {
        match: viewJsonMatcher(),
        result: jsonResult({
          databaseId: 5,
          status: "in_progress",
          conclusion: null,
          name: "publish-npm",
          headSha: "deadbeef",
          headBranch: "main",
          url: "https://github.com/sdsrss/sgc/actions/runs/5",
        }),
      },
    ])
    const result = await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
      branch: "main",
      // The smallest timeout the impl will honor (it clamps to MIN_TIMEOUT_SEC=60).
      timeoutSec: 60,
      intervalSec: 15,
    })
    expect(result.status).toBe("timeout")
    expect(result.run?.id).toBe("5")
  })

  it("discovery filters by expectedSha when gh returns multiple runs (DOG-2 regression)", async () => {
    // Reproducer for the v1.6.0 dogfood bug: tag-triggered workflows
    // (publish.yml fires on `on: push: tags: [v*]`) yield runs whose
    // `headBranch` is the TAG name, not the branch. gh's --branch
    // filter therefore silently excludes them. Watch must filter
    // client-side by expectedSha instead.
    const clock = makeClock(0)
    const runCommand = makeRunCommand([
      {
        match: listMatcher(),
        result: jsonResult([
          // Most-recent first (gh's natural order).
          {
            databaseId: 999,
            status: "completed",
            conclusion: "success",
            name: "publish-npm",
            headSha: "e663e3eaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            headBranch: "v1.6.0",  // ← tag, not main
            url: "https://github.com/sdsrss/sgc/actions/runs/999",
          },
          {
            databaseId: 888,
            status: "completed",
            conclusion: "success",
            name: "publish-npm",
            headSha: "9c8bc57aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            headBranch: "v1.5.0",
            url: "https://github.com/sdsrss/sgc/actions/runs/888",
          },
        ]),
      },
    ])
    const result = await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
      expectedSha: "9c8bc57aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    })
    expect(result.status).toBe("success")
    expect(result.run?.id).toBe("888")
    expect(result.run?.headSha).toBe("9c8bc57aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa")
  })

  it("discovery does NOT pass --branch to gh (DOG-2 regression)", async () => {
    // The --branch filter is broken for tag-triggered workflows
    // because headBranch is the tag. Watch must not include
    // --branch in its `gh run list` call.
    const clock = makeClock(0)
    let observedArgs: string[] | null = null
    const runCommand = async (args: string[]): Promise<RunResult> => {
      const tail = args[0] === "gh" ? args.slice(1) : args
      if (tail[0] === "run" && tail[1] === "list") {
        observedArgs = tail
        return jsonResult([
          {
            databaseId: 1,
            status: "completed",
            conclusion: "success",
            name: "publish-npm",
            headSha: "abc",
            headBranch: "v0",
            url: "u",
          },
        ])
      }
      return { stdout: "", stderr: "unmatched", exitCode: 1 }
    }
    await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
      branch: "main",  // explicitly set; impl should still NOT pass it to gh
    })
    expect(observedArgs).not.toBeNull()
    expect(observedArgs!.includes("--branch")).toBe(false)
  })

  it("default workflowName is publish-npm (DOG-1 regression)", async () => {
    // `gh run list --workflow publish.yml` returns [] silently
    // because gh's --workflow flag wants the display name
    // (`publish-npm`) or filename basename (`publish`), not the
    // path-style `publish.yml`. Default must be the display name.
    const clock = makeClock(0)
    let observedArgs: string[] | null = null
    const runCommand = async (args: string[]): Promise<RunResult> => {
      const tail = args[0] === "gh" ? args.slice(1) : args
      if (tail[0] === "run" && tail[1] === "list") {
        observedArgs = tail
        return jsonResult([
          {
            databaseId: 7,
            status: "completed",
            conclusion: "success",
            name: "publish-npm",
            headSha: "x",
            headBranch: "v0",
            url: "u",
          },
        ])
      }
      return { stdout: "", stderr: "", exitCode: 1 }
    }
    await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(observedArgs).not.toBeNull()
    const i = observedArgs!.indexOf("--workflow")
    expect(i).toBeGreaterThan(-1)
    expect(observedArgs![i + 1]).toBe("publish-npm")
  })

  it("attaches directly via --run-id, skipping discovery", async () => {
    const clock = makeClock(0)
    let listCalls = 0
    const runCommand = async (args: string[]): Promise<RunResult> => {
      const tail = args[0] === "gh" ? args.slice(1) : args
      if (tail[0] === "run" && tail[1] === "list") {
        listCalls++
        return { stdout: "", stderr: "should not have been called", exitCode: 1 }
      }
      if (tail[0] === "run" && tail[1] === "view" && tail.includes("--json")) {
        return jsonResult({
          databaseId: 777,
          status: "completed",
          conclusion: "success",
          name: "publish-npm",
          headSha: "feedbee",
          headBranch: "main",
          url: "https://github.com/sdsrss/sgc/actions/runs/777",
        })
      }
      return { stdout: "", stderr: "unmatched", exitCode: 1 }
    }
    const result = await watchPublishWorkflow({
      runCommand,
      now: clock.now,
      sleep: clock.sleep,
      runId: "777",
    })
    expect(listCalls).toBe(0)
    expect(result.status).toBe("success")
    expect(result.run?.id).toBe("777")
  })
})

// ── captureShipFailure ──────────────────────────────────────────────────────

describe("captureShipFailure (CE-3 T3)", () => {
  const fixedClock = (): { now: () => number } => ({
    now: () => Date.parse("2026-05-22T12:00:00Z"),
  })

  function baseFailure(over: Partial<ShipFailure> = {}): ShipFailure {
    return {
      commitSha: "9c8bc57aabbccddeeff112233445566778899aabb",
      tag: "v1.5.0",
      workflowName: "publish-npm",
      workflowRunId: "26273501194",
      workflowRunUrl: "https://github.com/sdsrss/sgc/actions/runs/26273501194",
      summaryExcerpt: "FAIL tests/foo > bar\nAssertion error: expected 1 to be 2",
      ...over,
    }
  }

  it("first call writes a templated record with all frontmatter keys", async () => {
    const r = await captureShipFailure(baseFailure(), stateRoot, fixedClock())
    expect(r.action).toBe("captured")
    expect(r.path).toContain("/ship-failures/2026-05-22-9c8bc57.md")
    expect(existsSync(r.path)).toBe(true)
    const body = readFileSync(r.path, "utf8")
    expect(body).toMatch(/^---\n/)
    expect(body).toContain("kind: ship-failure")
    expect(body).toContain("commit_sha: 9c8bc57aabbccdd")
    expect(body).toContain("tag: v1.5.0")
    expect(body).toContain("workflow_run_id: '26273501194'")
    expect(body).toContain("conclusion: failure")
    expect(body).toContain("prevention_seed:")
    expect(body).toContain("## Failure context")
    expect(body).toContain("## $GITHUB_STEP_SUMMARY excerpt")
    expect(body).toContain("## Next steps for operator")
    expect(body).toContain("FAIL tests/foo > bar")
  })

  it("second call same SHA → action=deduped, body untouched", async () => {
    const r1 = await captureShipFailure(baseFailure(), stateRoot, fixedClock())
    const before = readFileSync(r1.path, "utf8")
    const r2 = await captureShipFailure(
      baseFailure({ summaryExcerpt: "DIFFERENT" }),
      stateRoot,
      fixedClock(),
    )
    expect(r2.action).toBe("deduped")
    expect(r2.path).toBe(r1.path)
    const after = readFileSync(r1.path, "utf8")
    expect(after).toBe(before)
    expect(after).not.toContain("DIFFERENT")
  })

  it("empty summaryExcerpt → body substitutes the fallback marker", async () => {
    const r = await captureShipFailure(
      baseFailure({ summaryExcerpt: "" }),
      stateRoot,
      fixedClock(),
    )
    const body = readFileSync(r.path, "utf8")
    expect(body).toContain(EMPTY_SUMMARY_FALLBACK)
  })

  it("summaryExcerpt > 2000 chars truncated with ... sentinel", async () => {
    const huge = "x".repeat(SUMMARY_MAX_CHARS + 500)
    const r = await captureShipFailure(
      baseFailure({ summaryExcerpt: huge }),
      stateRoot,
      fixedClock(),
    )
    const body = readFileSync(r.path, "utf8")
    // Longest contiguous run of x's must equal SUMMARY_MAX_CHARS. The
    // body prose ("context", "excerpt", "next") contributes scattered
    // single x's outside the excerpt block, so a total-x-count
    // assertion would over-count.
    const longestRun = (body.match(/x+/g) ?? []).reduce(
      (acc, s) => Math.max(acc, s.length),
      0,
    )
    expect(longestRun).toBe(SUMMARY_MAX_CHARS)
    // Sentinel appears at end of the truncated run.
    expect(body).toContain(`${"x".repeat(SUMMARY_MAX_CHARS)}${TRUNCATION_SENTINEL}`)
    // And we have NOT preserved the un-truncated input.
    expect(body).not.toContain("x".repeat(SUMMARY_MAX_CHARS + 1))
  })

  it("null tag → '(none)' in frontmatter + body", async () => {
    const r = await captureShipFailure(
      baseFailure({ tag: null }),
      stateRoot,
      fixedClock(),
    )
    const body = readFileSync(r.path, "utf8")
    // js-yaml emits the parenthesized literal unquoted: `tag: (none)`.
    // The body line uses the same value verbatim.
    expect(body).toContain("\ntag: (none)\n")
    expect(body).toContain("- tag:      (none)")
  })
})
