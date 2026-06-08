// STAB-1 (audit fix) — atomic O_EXCL file lock that closes the TOCTOU window
// in the plan-jobs / loop "single-active" concurrency guards.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireFileLock, LockHeldError, withFileLock } from "../../src/dispatcher/file-lock"

let dir: string
let lockPath: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sgc-lock-"))
  lockPath = join(dir, ".lock")
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe("acquireFileLock", () => {
  it("grants the lock and creates the lock file", () => {
    const release = acquireFileLock(lockPath)
    expect(existsSync(lockPath)).toBe(true)
    release()
    expect(existsSync(lockPath)).toBe(false)
  })

  it("rejects a second acquire while a live holder owns the lock (TOCTOU close)", () => {
    const release = acquireFileLock(lockPath, { isAlive: () => true })
    expect(() => acquireFileLock(lockPath, { isAlive: () => true })).toThrow(LockHeldError)
    release()
  })

  it("re-acquires after release", () => {
    acquireFileLock(lockPath)() // acquire + immediately release
    const release2 = acquireFileLock(lockPath)
    expect(existsSync(lockPath)).toBe(true)
    release2()
  })

  it("withFileLock serializes contending critical sections (no interleave)", async () => {
    const order: string[] = []
    // Two tasks each: append "start", await a tick, append "end". Without the
    // lock the two would interleave (start,start,end,end); with it they run
    // strictly one-after-another (start,end,start,end).
    const crit = (tag: string) => async () => {
      order.push(`${tag}:start`)
      await new Promise((r) => setTimeout(r, 10))
      order.push(`${tag}:end`)
    }
    await Promise.all([
      withFileLock(lockPath, crit("A"), { retryDelayMs: 2 }),
      withFileLock(lockPath, crit("B"), { retryDelayMs: 2 }),
    ])
    // Whichever ran first, its start+end are adjacent (no interleave).
    expect(order.length).toBe(4)
    expect(order[0]!.endsWith(":start")).toBe(true)
    expect(order[1]).toBe(`${order[0]!.split(":")[0]}:end`)
  })

  it("withFileLock always releases (lock file gone after success)", async () => {
    await withFileLock(lockPath, () => 42, { retryDelayMs: 2 })
    expect(existsSync(lockPath)).toBe(false)
  })

  it("withFileLock releases even when fn throws", async () => {
    await expect(
      withFileLock(lockPath, () => {
        throw new Error("boom")
      }, { retryDelayMs: 2 }),
    ).rejects.toThrow("boom")
    expect(existsSync(lockPath)).toBe(false)
  })

  it("reclaims a lock whose recorded holder pid is dead", () => {
    writeFileSync(lockPath, "999999\n1\n") // bogus pid, ancient ts
    const release = acquireFileLock(lockPath, { isAlive: () => false })
    expect(existsSync(lockPath)).toBe(true)
    release()
  })

  it("reclaims an unreadable/empty lock older than staleMs", () => {
    writeFileSync(lockPath, "garbage-no-pid\n")
    const release = acquireFileLock(lockPath, {
      isAlive: () => true,
      now: () => 10_000,
      staleMs: 1,
    })
    expect(existsSync(lockPath)).toBe(true)
    release()
  })

  it("release is idempotent", () => {
    const release = acquireFileLock(lockPath)
    release()
    expect(() => release()).not.toThrow()
    expect(existsSync(lockPath)).toBe(false)
  })
})
