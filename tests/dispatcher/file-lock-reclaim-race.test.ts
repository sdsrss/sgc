// P2-5 regression: stale-reclaim must not delete a competitor's VALID lock.
//
// The reclaim path decided "this lock is stale" from content it read, then ran
// `unlinkSync(lockPath)` — targeting a PATH, not the inode it inspected. Two
// processes racing one crashed-holder remnant interleave like this:
//
//   A: read L1 (dead holder)          B: read L1 (dead holder)
//   A: unlink L1
//   A: openSync(wx) → creates L2  ✓ A holds
//                                     B: unlink(lockPath) → deletes L2 (!)
//                                     B: openSync(wx) → creates L3  ✓ B holds
//
// Both hold; A's release() then unlinks L3, B's lock. That defeats the whole
// point of the primitive — and STAB-1 exists because losing mutual exclusion
// here forks duplicate `detached: true` planners, i.e. real orphan processes.
//
// `isAlive` is the injection point: it is called inside the decision window,
// so a competitor's reclaim+create can be simulated at exactly the right
// instant, deterministically and with no threads.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireFileLock, LockHeldError } from "../../src/dispatcher/file-lock"

let tmp: string
let lockPath: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-lock-race-"))
  lockPath = join(tmp, "plan.lock")
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const DEAD_PID = 999_001
const COMPETITOR_PID = 999_002

/** A crashed holder's remnant: dead pid, old timestamp. */
function writeStaleLock(): void {
  writeFileSync(lockPath, `${DEAD_PID}\n${Date.now() - 60_000}\n`, "utf8")
}

describe("acquireFileLock stale-reclaim race (P2-5)", () => {
  test("does not delete a competitor's fresh lock that appears mid-decision", () => {
    writeStaleLock()
    let raced = false
    // Simulate competitor A finishing its own reclaim + acquire inside our
    // decision window: the stale L1 we read is gone, a VALID lock now sits at
    // the path.
    const isAlive = (pid: number): boolean => {
      if (!raced) {
        raced = true
        rmSync(lockPath, { force: true })
        writeFileSync(lockPath, `${COMPETITOR_PID}\n${Date.now()}\n`, "utf8")
      }
      // The pid we were asked about is the crashed holder — genuinely dead.
      // The competitor (COMPETITOR_PID) is alive.
      return pid === COMPETITOR_PID
    }

    // We must NOT end up holding the lock: a live competitor owns it now.
    expect(() => acquireFileLock(lockPath, { isAlive })).toThrow(LockHeldError)

    // And the competitor's lock must still be on disk, untouched.
    expect(existsSync(lockPath)).toBe(true)
    expect(readFileSync(lockPath, "utf8").split("\n")[0]).toBe(String(COMPETITOR_PID))
  })

  test("still reclaims a genuinely stale lock when no competitor intervenes", () => {
    writeStaleLock()
    const release = acquireFileLock(lockPath, { isAlive: () => false })
    // We hold it now: the file records OUR pid.
    expect(readFileSync(lockPath, "utf8").split("\n")[0]).toBe(String(process.pid))
    release()
    expect(existsSync(lockPath)).toBe(false)
  })

  test("release() does not delete a lock that is no longer ours", () => {
    // Defense in depth for the same class of bug: if our lock was reclaimed out
    // from under us, releasing must not take the new holder's lock with it.
    const release = acquireFileLock(lockPath, { isAlive: () => false })
    rmSync(lockPath, { force: true })
    writeFileSync(lockPath, `${COMPETITOR_PID}\n${Date.now()}\n`, "utf8")
    release()
    expect(existsSync(lockPath)).toBe(true)
    expect(readFileSync(lockPath, "utf8").split("\n")[0]).toBe(String(COMPETITOR_PID))
  })

  test("a live holder with a fresh lock is never reclaimed", () => {
    writeFileSync(lockPath, `${COMPETITOR_PID}\n${Date.now()}\n`, "utf8")
    expect(() => acquireFileLock(lockPath, { isAlive: () => true })).toThrow(LockHeldError)
    expect(readFileSync(lockPath, "utf8").split("\n")[0]).toBe(String(COMPETITOR_PID))
  })
})
