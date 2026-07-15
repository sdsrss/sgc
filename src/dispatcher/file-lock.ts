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

import { randomBytes } from "node:crypto"
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
      // P2-5: a per-acquisition nonce makes the lock's identity checkable.
      // pid alone can't: pids recycle, and a reclaimer that re-took the path
      // may legitimately be this same process.
      const nonce = randomBytes(8).toString("hex")
      const ours = `${process.pid}\n${now()}\n${nonce}\n`
      try {
        writeSync(fd, ours)
      } finally {
        closeSync(fd)
      }
      let released = false
      return () => {
        if (released) return
        released = true
        try {
          // P2-5: only unlink while it is STILL our lock. If ours was reclaimed
          // out from under us, the path now holds someone else's lock and an
          // unconditional unlink would silently strip a live holder — turning
          // one lost lock into a cascade.
          if (readFileSync(lockPath, "utf8") !== ours) return
          unlinkSync(lockPath)
        } catch {
          // Already removed (reclaimed by a stale-probe elsewhere) — fine.
        }
      }
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "EEXIST") throw err

      let holderPid = Number.NaN
      let ts = Number.NaN
      // P2-5: remember the exact bytes the reclaim decision is based on, so the
      // unlink below can confirm it is still removing THAT lock.
      let inspected: string | null = null
      try {
        inspected = readFileSync(lockPath, "utf8")
        const parts = inspected.split("\n")
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
          // P2-5: re-read and confirm this is STILL the stale lock we judged.
          //
          // The old code ran a bare `unlinkSync(lockPath)` — a path, not the
          // inode it had inspected. Two racers on one crashed-holder remnant
          // could both decide "stale", the first reclaim + acquire, and the
          // second then unlink the FIRST's valid lock and acquire too: two
          // holders, and the first's release() would strip the second's lock.
          // Mutual exclusion gone, which for plan-jobs/loop means duplicate
          // `detached: true` planners — the exact orphan-process outcome STAB-1
          // was built to prevent.
          //
          // Re-reading collapses that window from "read + parse + isAlive
          // probe" (a process.kill syscall wide) to two adjacent syscalls, and
          // any competitor that got in first is now visible as different bytes.
          // Residual: a reclaim landing between this read and the unlink is
          // still possible in principle. It is not closed here on purpose — the
          // alternative (a second-level reclaim lock) trades this sliver for a
          // crashed-reclaimer deadlock plus another staleness heuristic to
          // paper over it. Nonce-verified release (above) bounds the damage if
          // it ever does happen: a stripped holder no longer strips its
          // successor in turn.
          if (inspected !== null && readFileSync(lockPath, "utf8") !== inspected) {
            continue // changed under us → re-evaluate against the new holder
          }
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

/**
 * Acquire `lockPath`, run `fn`, then always release. Unlike a bare
 * acquireFileLock (fail-fast), this WAITS on live contention with bounded
 * retry, so a read-modify-write critical section serializes instead of the
 * loser silently overwriting the winner. Non-contention errors propagate
 * immediately. Default budget: 50 × 40ms = 2s before giving up (then the
 * LockHeldError throws).
 */
export async function withFileLock<T>(
  lockPath: string,
  fn: () => T | Promise<T>,
  opts: FileLockOptions & { retries?: number; retryDelayMs?: number } = {},
): Promise<T> {
  const retries = opts.retries ?? 50
  const retryDelayMs = opts.retryDelayMs ?? 40
  let release: (() => void) | undefined
  for (let attempt = 0; ; attempt++) {
    try {
      release = acquireFileLock(lockPath, opts)
      break
    } catch (err) {
      if (err instanceof LockHeldError && attempt < retries) {
        await new Promise((r) => setTimeout(r, retryDelayMs))
        continue
      }
      throw err
    }
  }
  try {
    return await fn()
  } finally {
    release()
  }
}
