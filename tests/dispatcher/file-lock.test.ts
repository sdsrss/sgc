// STAB-1 (audit fix) — atomic O_EXCL file lock that closes the TOCTOU window
// in the plan-jobs / loop "single-active" concurrency guards.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireFileLock, LockHeldError } from "../../src/dispatcher/file-lock"

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
