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
