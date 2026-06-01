// STAB-1 (audit fix): atomic exclusive file lock.
//
// The plan-jobs and loop "single-active" concurrency guards were
// read-then-write (scan for a running+alive job → fork → write the job
// file). Two concurrent invocations both pass the scan before either writes,
// so both fork — and because the async plan child is `detached:true`, the
// race produces real orphan planner processes. There is no filesystem locking
// anywhere else in the codebase.
//
// This primitive closes the window with an O_EXCL create (`openSync(path,
// "wx")` fails atomically if the file exists). Callers wrap their
// check-and-claim critical section in acquire → … → release. The lock records
// the holder pid + acquisition timestamp so a crashed holder's lock can be
// reclaimed: a dead pid (liveness probe) is reclaimed immediately; an
// unparseable lock older than `staleMs` is reclaimed as a fallback. A live
// holder with a fresh lock throws LockHeldError.

import { closeSync, openSync, readFileSync, unlinkSync, writeSync } from "node:fs"

export class LockHeldError extends Error {
  constructor(
    readonly holderPid: number,
    readonly lockPath: string,
  ) {
    super(`lock held by pid=${holderPid} at ${lockPath}`)
    this.name = "LockHeldError"
  }
}

export interface FileLockOptions {
  /** Clock injection (tests). Defaults to Date.now. */
  now?: () => number
  /** Liveness probe injection (tests). Defaults to `process.kill(pid, 0)`. */
  isAlive?: (pid: number) => boolean
  /** Fallback staleness window for locks with an unparseable pid. */
  staleMs?: number
}

// A fork/claim critical section is sub-second; a lock older than this with no
// parseable live holder is a crashed-holder remnant whose pid may be recycled.
const DEFAULT_STALE_MS = 30_000

function defaultIsAlive(pid: number): boolean {
  if (!Number.isFinite(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (err) {
    // EPERM → process exists but not signalable by us → alive.
    return (err as NodeJS.ErrnoException).code === "EPERM"
  }
}

/**
 * Atomically acquire an exclusive on-disk lock. Returns an idempotent release
 * function. Throws LockHeldError when a live holder owns a fresh lock.
 */
export function acquireFileLock(lockPath: string, opts: FileLockOptions = {}): () => void {
  const now = opts.now ?? Date.now
  const isAlive = opts.isAlive ?? defaultIsAlive
  const staleMs = opts.staleMs ?? DEFAULT_STALE_MS

  // At most one stale-reclaim retry: if we lose the reclaim race twice, a
  // competitor is actively holding/claiming → treat as held.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(lockPath, "wx")
      try {
        writeSync(fd, `${process.pid}\n${now()}\n`)
      } finally {
        closeSync(fd)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        try {
          unlinkSync(lockPath)
        } catch {
          // Already removed (reclaimed by a stale-probe elsewhere) — fine.
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err

      let holderPid = Number.NaN
      let ts = Number.NaN
      try {
        const parts = readFileSync(lockPath, "utf8").split("\n")
        holderPid = Number.parseInt(parts[0] ?? "", 10)
        ts = Number.parseInt(parts[1] ?? "", 10)
      } catch {
        // Unreadable lock — fall through to staleness fallback.
      }

      // Trust pid liveness primarily (avoids falsely reclaiming a live
      // holder). Only fall back to age when the pid is unparseable.
      const holderDead = Number.isFinite(holderPid) ? !isAlive(holderPid) : null
      const ageStale = Number.isFinite(ts) ? now() - ts > staleMs : true
      const reclaim = holderDead === true || (holderDead === null && ageStale)

      if (reclaim) {
        try {
          unlinkSync(lockPath)
        } catch {
          // Lost the reclaim race — retry will re-evaluate.
        }
        continue
      }
      throw new LockHeldError(holderPid, lockPath)
    }
  }
  throw new LockHeldError(Number.NaN, lockPath)
}
