// P3-7: prove O_EXCL mutual exclusion across REAL processes.
//
// file-lock.test.ts drives the primitive in one process with async interleaving,
// and STAB-1's regression hand-writes a lock file. Neither exercises what the
// lock exists for: `openSync(path, "wx")` failing atomically when a DIFFERENT
// process holds the file. A single-process test would pass on an implementation
// that used an in-memory Set, which would be useless against the actual hazard
// (two `sgc plan --async` invocations forking duplicate detached planners).
//
// So: fork real node processes and have them fight over one lock.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-lock-mp-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const REPO = resolve(import.meta.dir, "..", "..")

/**
 * A child that acquires the lock, reports, holds for `holdMs`, then releases.
 * Uses bun to run the TS source directly — same module the dispatcher uses.
 */
function childScript(lockPath: string, holdMs: number): string {
  return `
import { acquireFileLock, LockHeldError } from ${JSON.stringify(resolve(REPO, "src/dispatcher/file-lock.ts"))}
try {
  const release = acquireFileLock(${JSON.stringify(lockPath)})
  console.log("ACQUIRED")
  await new Promise((r) => setTimeout(r, ${holdMs}))
  release()
  console.log("RELEASED")
} catch (e) {
  if (e instanceof LockHeldError) { console.log("HELD_BY:" + e.holderPid) }
  else { console.log("ERROR:" + String(e)) }
}
`
}

function runChild(name: string, lockPath: string, holdMs: number): string {
  const f = resolve(tmp, name)
  writeFileSync(f, childScript(lockPath, holdMs), "utf8")
  return execFileSync("bun", [f], { encoding: "utf8", timeout: 20_000 })
}

describe("file-lock across real processes (P3-7)", () => {
  test("a second PROCESS cannot acquire a lock held by a live first process", async () => {
    const lockPath = resolve(tmp, "plan.lock")
    const holder = resolve(tmp, "holder.ts")
    writeFileSync(holder, childScript(lockPath, 3_000), "utf8")

    // Start the holder detached; wait for its ACQUIRED before racing it.
    const { spawn } = await import("node:child_process")
    const child = spawn("bun", [holder], { stdio: ["ignore", "pipe", "pipe"] })
    const acquired = await new Promise<boolean>((resolveP) => {
      let out = ""
      child.stdout.on("data", (c: Buffer) => {
        out += c.toString()
        if (out.includes("ACQUIRED")) resolveP(true)
      })
      setTimeout(() => resolveP(out.includes("ACQUIRED")), 10_000)
    })
    expect(acquired).toBe(true)

    // A different process must be refused — this is the whole point of O_EXCL.
    const contender = runChild("contender.ts", lockPath, 0)
    expect(contender).toContain("HELD_BY:")
    expect(contender).not.toContain("ACQUIRED")
    // And it must name the real holder pid, not a guess.
    expect(contender).toContain(`HELD_BY:${child.pid}`)

    child.kill()
  }, 30_000)

  test("the lock is reusable by another process once released", () => {
    const lockPath = resolve(tmp, "plan.lock")
    const first = runChild("a.ts", lockPath, 0)
    expect(first).toContain("ACQUIRED")
    expect(first).toContain("RELEASED")
    // A fresh process gets it cleanly — release really removed the file.
    const second = runChild("b.ts", lockPath, 0)
    expect(second).toContain("ACQUIRED")
  }, 30_000)

  test("a crashed holder's lock is reclaimed by the next process", () => {
    const lockPath = resolve(tmp, "plan.lock")
    // A dead pid + old timestamp: exactly what a SIGKILLed holder leaves.
    writeFileSync(lockPath, `999999\n${Date.now() - 120_000}\n`, "utf8")
    const out = runChild("reclaimer.ts", lockPath, 0)
    expect(out).toContain("ACQUIRED")
  }, 30_000)
})
