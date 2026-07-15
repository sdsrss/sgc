// M4 (code-review follow-up to P3-6): a reboot wedges the run permanently, and
// the error tells the operator to do the one thing that cannot work.
//
// The staleness model never changed when the lock's lifetime did. Age-based
// reclaim only applies when the pid is UNPARSEABLE:
//
//     reclaim = holderDead === true || (holderDead === null && ageStale)
//
// so a well-formed lock whose pid is alive-but-not-the-holder is never
// reclaimed, at any age. That was fine when the claim lock lived for
// milliseconds. P3-6 made the exec lock live for the duration of the auto steps
// — planner cluster plus LLM calls, i.e. minutes — which widens the crash window
// by orders of magnitude. And after a reboot the recorded pid is very likely
// alive again, because low pids get handed out early.
//
// Result: `--resume` says "wait for pid 1 to finish or park" (pid 1 never
// finishes) and fresh-start says "finish the paused run with --resume". The two
// messages point at each other.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { acquireFileLock, LockHeldError } from "../../src/dispatcher/file-lock"

let dir: string
let lockPath: string
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "sgc-m4-lock-"))
  lockPath = join(dir, "run.exec.lock")
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const BOOT_A = "11111111-1111-1111-1111-111111111111"
const BOOT_B = "22222222-2222-2222-2222-222222222222"

describe("M4 · a lock orphaned by a reboot is reclaimable", () => {
  test("an alive pid from a PREVIOUS boot does not hold the lock hostage", () => {
    // The exact wedge: holder recorded pid 1 an hour ago; the machine rebooted;
    // pid 1 is alive again (it is always alive) but it is not our holder.
    const release = acquireFileLock(lockPath, { bootId: () => BOOT_A })
    release()
    // Re-stage that lock as if written before the reboot, by a pid that lives.
    writeFileSync(lockPath, `1\n${Date.now() - 3_600_000}\ndeadbeefdeadbeef\n${BOOT_A}\n`, "utf8")

    // Now we are a different boot. pid 1 is alive — the old rule stops here.
    const r2 = acquireFileLock(lockPath, { bootId: () => BOOT_B, isAlive: () => true })
    expect(typeof r2).toBe("function")
    expect(readFileSync(lockPath, "utf8")).toContain(BOOT_B)
    r2()
  })

  test("a live holder on the SAME boot still holds the lock (no over-reclaim)", () => {
    // The fix must not trade a wedge for a broken mutex.
    const release = acquireFileLock(lockPath, { bootId: () => BOOT_A })
    expect(() => acquireFileLock(lockPath, { bootId: () => BOOT_A, isAlive: () => true })).toThrow(
      LockHeldError,
    )
    release()
  })

  test("a dead holder on the same boot is still reclaimed (no regression)", () => {
    writeFileSync(lockPath, `999999\n${Date.now()}\nnonce\n${BOOT_A}\n`, "utf8")
    const r = acquireFileLock(lockPath, { bootId: () => BOOT_A, isAlive: () => false })
    expect(typeof r).toBe("function")
    r()
  })

  test("a lock with no boot id recorded behaves exactly as before", () => {
    // Backward compatibility: locks written by <=v1.33.0 have three lines, and
    // platforms without a boot id keep the liveness+age rule unchanged.
    writeFileSync(lockPath, `1\n${Date.now() - 3_600_000}\nnonce\n`, "utf8")
    expect(() => acquireFileLock(lockPath, { bootId: () => BOOT_B, isAlive: () => true })).toThrow(
      LockHeldError,
    )
  })

  test("when this platform cannot report a boot id, nothing changes", () => {
    writeFileSync(lockPath, `1\n${Date.now() - 3_600_000}\nnonce\n${BOOT_A}\n`, "utf8")
    expect(() => acquireFileLock(lockPath, { bootId: () => null, isAlive: () => true })).toThrow(
      LockHeldError,
    )
  })

  test("the refusal names the lock file, so the operator can act on it", () => {
    const release = acquireFileLock(lockPath, { bootId: () => BOOT_A })
    try {
      acquireFileLock(lockPath, { bootId: () => BOOT_A, isAlive: () => true })
      throw new Error("expected LockHeldError")
    } catch (err) {
      expect(err).toBeInstanceOf(LockHeldError)
      expect((err as LockHeldError).lockPath).toBe(lockPath)
      expect((err as LockHeldError).message).toContain(lockPath)
    }
    release()
  })
})

describe("M4 · the real boot id is readable on this platform", () => {
  test("a lock records a boot id when the OS exposes one", () => {
    // Linux exposes /proc/sys/kernel/random/boot_id. This test documents which
    // behavior this platform actually gets rather than assuming.
    const release = acquireFileLock(lockPath)
    const body = readFileSync(lockPath, "utf8")
    release()
    const lines = body.split("\n")
    if (process.platform === "linux") {
      expect(lines[3]).toMatch(/^[0-9a-f-]{36}$/)
    } else {
      expect(lines[3] ?? "").toBe("")
    }
  })
})
