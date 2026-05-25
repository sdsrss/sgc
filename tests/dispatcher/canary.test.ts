// GS-1 (f8) — runCanaryChecks + captureCanaryFailure tests.
//
// Spec: tasks/specs/gs-1-canary.md (status: draft, r1).
// Heuristic-only: no LLM, no agent spawn, no events emitted in v0.
// Test injection hooks parallel CE-3 (ship-failure.test.ts):
// each phase has its own injectable (npmView / npxSmoke / httpFetch) plus
// a deterministic clock + sleep so no real wall time elapses.

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  captureCanaryFailure,
  type CanaryFailure,
  PHASE_OUTPUT_MAX_CHARS,
  runCanaryChecks,
  TRUNCATION_SENTINEL,
} from "../../src/dispatcher/canary"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-canary-"))
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

// ── helpers ────────────────────────────────────────────────────────────────

function makeClock(initialMs: number): {
  now: () => number
  sleep: (ms: number) => Promise<void>
} {
  let cur = initialMs
  return {
    now: () => cur,
    sleep: async (ms: number) => {
      cur += ms
    },
  }
}

// ── runCanaryChecks — happy path ───────────────────────────────────────────

describe("runCanaryChecks happy path (GS-1 T1)", () => {
  it("returns success when npm shows expected version and npx exits 0 with matching stdout", async () => {
    const clock = makeClock(0)
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      npmView: async () => JSON.stringify("1.11.0"),
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("success")
    expect(result.failedPhase).toBeUndefined()
  })
})

// ── runCanaryChecks — npm_propagation ──────────────────────────────────────

describe("runCanaryChecks npm_propagation (GS-1 T2)", () => {
  it("polls until npm reports expected version (pending then ready)", async () => {
    const clock = makeClock(0)
    let calls = 0
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      npmView: async () => {
        calls++
        return calls < 2 ? JSON.stringify("1.10.0") : JSON.stringify("1.11.0")
      },
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("success")
    expect(calls).toBe(2)
  })

  it("returns timeout when npm never reports expected version", async () => {
    const clock = makeClock(0)
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      npmView: async () => JSON.stringify("1.10.0"),
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
      now: clock.now,
      sleep: clock.sleep,
      timeoutSec: 60, // clamped to MIN_TIMEOUT_SEC
      intervalSec: 15,
    })
    expect(result.status).toBe("timeout")
  })

  it("treats malformed npm view JSON as 'not yet propagated' (continues polling)", async () => {
    const clock = makeClock(0)
    let calls = 0
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      npmView: async () => {
        calls++
        return calls < 2 ? "<html>npm registry error</html>" : JSON.stringify("1.11.0")
      },
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("success")
    expect(calls).toBe(2)
  })
})

// ── runCanaryChecks — smoke_install ────────────────────────────────────────

describe("runCanaryChecks smoke_install (GS-1 T3)", () => {
  it("returns failure when npx exits non-zero", async () => {
    const clock = makeClock(0)
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      npmView: async () => JSON.stringify("1.11.0"),
      npxSmoke: async () => ({
        exitCode: 127,
        stdout: "",
        stderr: "command not found: sgc",
      }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("failure")
    expect(result.failedPhase).toBe("smoke_install")
    expect(result.phaseOutputs.smoke_install).toContain("command not found")
  })

  it("returns failure when npx exits 0 but stdout omits expected version", async () => {
    const clock = makeClock(0)
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      npmView: async () => JSON.stringify("1.11.0"),
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.9.0\n", stderr: "" }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("failure")
    expect(result.failedPhase).toBe("smoke_install")
    expect(result.phaseOutputs.smoke_install).toContain("1.9.0")
  })
})

// ── runCanaryChecks — phase short-circuit ──────────────────────────────────

describe("runCanaryChecks phase short-circuit (GS-1 T4)", () => {
  it("does not invoke later phases when an earlier phase fails", async () => {
    const clock = makeClock(0)
    let npxCalls = 0
    let fetchCalls = 0
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      phases: ["npm_propagation", "smoke_install", "health_url"],
      healthUrl: "https://example.com/health",
      npmView: async () => JSON.stringify("1.11.0"),
      npxSmoke: async () => {
        npxCalls++
        return { exitCode: 1, stdout: "", stderr: "boom" }
      },
      httpFetch: async () => {
        fetchCalls++
        return { status: 200, body: "ok" }
      },
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("failure")
    expect(result.failedPhase).toBe("smoke_install")
    expect(npxCalls).toBe(1)
    expect(fetchCalls).toBe(0)
  })
})

// ── runCanaryChecks — health_url ───────────────────────────────────────────

describe("runCanaryChecks health_url (GS-1 T5)", () => {
  it("returns success when fetch returns 2xx", async () => {
    const clock = makeClock(0)
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      phases: ["npm_propagation", "smoke_install", "health_url"],
      healthUrl: "https://example.com/health",
      npmView: async () => JSON.stringify("1.11.0"),
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
      httpFetch: async () => ({ status: 200, body: '{"ok":true}' }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("success")
  })

  it("returns failure when fetch body does not match healthRegex", async () => {
    const clock = makeClock(0)
    const result = await runCanaryChecks({
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      phases: ["npm_propagation", "smoke_install", "health_url"],
      healthUrl: "https://example.com/health",
      healthRegex: '"status"\\s*:\\s*"ok"',
      npmView: async () => JSON.stringify("1.11.0"),
      npxSmoke: async () => ({ exitCode: 0, stdout: "1.11.0\n", stderr: "" }),
      httpFetch: async () => ({ status: 200, body: '{"status":"degraded"}' }),
      now: clock.now,
      sleep: clock.sleep,
    })
    expect(result.status).toBe("failure")
    expect(result.failedPhase).toBe("health_url")
    expect(result.phaseOutputs.health_url).toContain("degraded")
  })

  it("throws UnsafeUrlScheme when health-url uses file:// or javascript:", async () => {
    const clock = makeClock(0)
    await expect(
      runCanaryChecks({
        packageName: "@sdsrs/sgc",
        expectedVersion: "1.11.0",
        phases: ["health_url"],
        healthUrl: "file:///etc/passwd",
        httpFetch: async () => ({ status: 200, body: "" }),
        now: clock.now,
        sleep: clock.sleep,
      }),
    ).rejects.toThrow(/UnsafeUrlScheme/)
  })
})

// ── captureCanaryFailure ───────────────────────────────────────────────────

describe("captureCanaryFailure (GS-1 T6)", () => {
  const fixedClock = (): { now: () => number } => ({
    now: () => Date.parse("2026-05-25T12:00:00Z"),
  })

  function baseFailure(over: Partial<CanaryFailure> = {}): CanaryFailure {
    return {
      commitSha: "abc1234567890abcdef1234567890abcdef12345",
      tag: "v1.11.0",
      packageName: "@sdsrs/sgc",
      expectedVersion: "1.11.0",
      failedPhase: "smoke_install",
      healthUrl: null,
      phaseOutputs: { smoke_install: "command not found: sgc" },
      ...over,
    }
  }

  it("first call writes a templated record with all frontmatter keys", async () => {
    const r = await captureCanaryFailure(baseFailure(), stateRoot, fixedClock())
    expect(r.action).toBe("captured")
    expect(r.path).toContain("/canaries/2026-05-25-abc1234-smoke_install.md")
    expect(existsSync(r.path)).toBe(true)
    const body = readFileSync(r.path, "utf8")
    expect(body).toMatch(/^---\n/)
    expect(body).toContain("kind: canary-failure")
    expect(body).toContain("commit_sha: abc1234567890abcdef")
    // js-yaml quotes @-leading strings with single quotes (YAML reserved char).
    expect(body).toContain("package_name: '@sdsrs/sgc'")
    // js-yaml quotes multi-dot version strings to disambiguate from floats.
    expect(body).toMatch(/expected_version: ['"]?1\.11\.0['"]?/)
    expect(body).toContain("failed_phase: smoke_install")
    expect(body).toContain("regression_seed:")
    expect(body).toContain("## Failure context")
    expect(body).toContain("## Phase output excerpt")
    expect(body).toContain("## Next steps for operator")
    expect(body).toContain("command not found: sgc")
  })

  it("second call same (sha, phase) → action=deduped, body untouched", async () => {
    const r1 = await captureCanaryFailure(baseFailure(), stateRoot, fixedClock())
    const before = readFileSync(r1.path, "utf8")
    const r2 = await captureCanaryFailure(
      baseFailure({ phaseOutputs: { smoke_install: "DIFFERENT" } }),
      stateRoot,
      fixedClock(),
    )
    expect(r2.action).toBe("deduped")
    expect(r2.path).toBe(r1.path)
    const after = readFileSync(r1.path, "utf8")
    expect(after).toBe(before)
    expect(after).not.toContain("DIFFERENT")
  })

  it("different phase same SHA writes a separate record", async () => {
    const r1 = await captureCanaryFailure(baseFailure(), stateRoot, fixedClock())
    const r2 = await captureCanaryFailure(
      baseFailure({
        failedPhase: "health_url",
        healthUrl: "https://example.com/health",
        phaseOutputs: { health_url: "503 Service Unavailable" },
      }),
      stateRoot,
      fixedClock(),
    )
    expect(r2.action).toBe("captured")
    expect(r2.path).not.toBe(r1.path)
    expect(r2.path).toContain("health_url.md")
    expect(existsSync(r1.path)).toBe(true)
    expect(existsSync(r2.path)).toBe(true)
  })

  it("phase output > PHASE_OUTPUT_MAX_CHARS truncated with ... sentinel", async () => {
    const huge = "x".repeat(PHASE_OUTPUT_MAX_CHARS + 500)
    const r = await captureCanaryFailure(
      baseFailure({ phaseOutputs: { smoke_install: huge } }),
      stateRoot,
      fixedClock(),
    )
    const body = readFileSync(r.path, "utf8")
    const longestRun = (body.match(/x+/g) ?? []).reduce(
      (acc, s) => Math.max(acc, s.length),
      0,
    )
    expect(longestRun).toBe(PHASE_OUTPUT_MAX_CHARS)
    expect(body).toContain(
      `${"x".repeat(PHASE_OUTPUT_MAX_CHARS)}${TRUNCATION_SENTINEL}`,
    )
    expect(body).not.toContain("x".repeat(PHASE_OUTPUT_MAX_CHARS + 1))
  })
})
