import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clampTimeout,
  MIN_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  SpawnTimeout,
  spawn,
  retryWithBackoff,
  isTransientLlmError,
} from "../../src/dispatcher/spawn"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-spawn-retry-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("timeout constants", () => {
  test("MIN_TIMEOUT_MS is 30000", () => {
    expect(MIN_TIMEOUT_MS).toBe(30_000)
  })

  test("MAX_TIMEOUT_MS is 300000", () => {
    expect(MAX_TIMEOUT_MS).toBe(300_000)
  })
})

describe("clampTimeout", () => {
  test("below minimum → clamped to MIN_TIMEOUT_MS", () => {
    expect(clampTimeout(1)).toBe(30_000)
    expect(clampTimeout(0)).toBe(30_000)
    expect(clampTimeout(-100)).toBe(30_000)
    expect(clampTimeout(29_999)).toBe(30_000)
  })

  test("at minimum → unchanged", () => {
    expect(clampTimeout(30_000)).toBe(30_000)
  })

  test("in range → unchanged", () => {
    expect(clampTimeout(60_000)).toBe(60_000)
    expect(clampTimeout(150_000)).toBe(150_000)
  })

  test("at maximum → unchanged", () => {
    expect(clampTimeout(300_000)).toBe(300_000)
  })

  test("above maximum → clamped to MAX_TIMEOUT_MS", () => {
    expect(clampTimeout(300_001)).toBe(300_000)
    expect(clampTimeout(999_999)).toBe(300_000)
  })
})

describe("spawn file-poll timeout clamp", () => {
  test("tiny timeoutMs is clamped — SpawnTimeout reports clamped value", async () => {
    // file-poll with timeoutMs=1 (would be clamped to 30000).
    // We cannot wait 30s in a unit test, so we verify the clamp is applied
    // by checking the error message contains the clamped value.
    const start = Date.now()
    try {
      await spawn("classifier.level", { user_request: "test" }, {
        stateRoot: tmp,
        mode: "file-poll",
        timeoutMs: 1, // clamped to 30000
        pollIntervalMs: 5,
      })
      expect(true).toBe(false) // should not reach
    } catch (e) {
      expect(e).toBeInstanceOf(SpawnTimeout)
      const elapsed = Date.now() - start
      // Must have waited at least ~30s (clamped from 1ms)
      expect(elapsed).toBeGreaterThanOrEqual(29_000)
      expect((e as SpawnTimeout).message).toContain("30000")
    }
  }, 40_000) // 40s timeout for this test
})

describe("spawn retry on file-poll timeout", () => {
  test("maxRetries=0 (default) throws on first timeout", async () => {
    try {
      await spawn("classifier.level", { user_request: "test" }, {
        stateRoot: tmp,
        mode: "file-poll",
        timeoutMs: 30_000, // at MIN, won't be clamped further
        pollIntervalMs: 5,
        // maxRetries: 0 (default)
      })
      expect(true).toBe(false)
    } catch (e) {
      expect(e).toBeInstanceOf(SpawnTimeout)
    }
  }, 40_000)
})

describe("retryWithBackoff (STAB-6)", () => {
  const noSleep = async () => {}

  test("retries retryable errors until success", async () => {
    let n = 0
    const result = await retryWithBackoff(
      async () => {
        n++
        if (n < 3) throw new Error("transient")
        return "ok"
      },
      { maxRetries: 3, isRetryable: () => true, sleep: noSleep },
    )
    expect(result).toBe("ok")
    expect(n).toBe(3) // 2 failures + 1 success
  })

  test("does not retry a non-retryable error (single attempt)", async () => {
    let n = 0
    await expect(
      retryWithBackoff(
        async () => {
          n++
          throw new Error("fatal")
        },
        { maxRetries: 3, isRetryable: () => false, sleep: noSleep },
      ),
    ).rejects.toThrow("fatal")
    expect(n).toBe(1)
  })

  test("exhausts maxRetries then rethrows last error", async () => {
    let n = 0
    await expect(
      retryWithBackoff(
        async () => {
          n++
          throw new Error("always")
        },
        { maxRetries: 2, isRetryable: () => true, sleep: noSleep },
      ),
    ).rejects.toThrow("always")
    expect(n).toBe(3) // 1 initial + 2 retries
  })

  test("backoff schedule is exponential (rng=0.5 → zero jitter)", async () => {
    const delays: number[] = []
    await expect(
      retryWithBackoff(
        async () => {
          throw new Error("x")
        },
        {
          maxRetries: 3,
          isRetryable: () => true,
          sleep: async (ms) => {
            delays.push(ms)
          },
          rng: () => 0.5, // jitter = base*0.2*(2*0.5-1) = 0
        },
      ),
    ).rejects.toThrow("x")
    expect(delays).toEqual([1000, 2000, 4000]) // 2^0, 2^1, 2^2 seconds
  })
})

describe("isTransientLlmError (STAB-6)", () => {
  test("HTTP 408 / 409 / 429 / 5xx are transient", () => {
    for (const status of [408, 409, 429, 500, 502, 503, 504, 529]) {
      expect(isTransientLlmError({ status })).toBe(true)
    }
  })

  test("HTTP 4xx other than 408/409/429 are fatal", () => {
    for (const status of [400, 401, 403, 404, 422]) {
      expect(isTransientLlmError({ status })).toBe(false)
    }
  })

  test("AbortError (by name) is transient", () => {
    const e = new Error("The operation was aborted")
    e.name = "AbortError"
    expect(isTransientLlmError(e)).toBe(true)
  })

  test("timeout/abort messages are transient (no status)", () => {
    expect(
      isTransientLlmError(new Error("OpenRouter request timed out after 30000ms")),
    ).toBe(true)
    expect(
      isTransientLlmError(new Error("claude CLI exceeded 30000ms for x")),
    ).toBe(true)
    expect(isTransientLlmError(new Error("request was aborted"))).toBe(true)
  })

  test("ordinary errors and non-errors are fatal", () => {
    expect(isTransientLlmError(new Error("bad request shape"))).toBe(false)
    expect(isTransientLlmError(null)).toBe(false)
    expect(isTransientLlmError(undefined)).toBe(false)
    expect(isTransientLlmError("a string")).toBe(false)
  })
})

describe("spawn LLM-mode retry wiring (STAB-6)", () => {
  test("claude-cli transient timeout retries llmMaxRetries times then throws", async () => {
    let calls = 0
    const runner = async () => {
      calls++
      // timedOut:true → runClaudeCliAgent throws ClaudeCliError "exceeded Nms"
      return { stdout: "", stderr: "timeout", exitCode: -1, timedOut: true }
    }
    await expect(
      spawn("classifier.level", { user_request: "x" }, {
        stateRoot: tmp,
        mode: "claude-cli",
        claudeCliRunner: runner,
        llmMaxRetries: 2,
        sleep: async () => {},
      }),
    ).rejects.toThrow(/exceeded \d+\s*ms/)
    expect(calls).toBe(3) // 1 initial + 2 retries
  })

  test("claude-cli fatal error (non-zero exit) does NOT retry", async () => {
    let calls = 0
    const runner = async () => {
      calls++
      return { stdout: "", stderr: "boom", exitCode: 1, timedOut: false }
    }
    await expect(
      spawn("classifier.level", { user_request: "x" }, {
        stateRoot: tmp,
        mode: "claude-cli",
        claudeCliRunner: runner,
        llmMaxRetries: 2,
        sleep: async () => {},
      }),
    ).rejects.toThrow(/exit 1/)
    expect(calls).toBe(1) // no retry on fatal
  })
})
