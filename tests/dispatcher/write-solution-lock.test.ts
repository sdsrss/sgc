// A4 / audit v1.37.0 ARCH-1: writeSolution's read-merge-write is unlocked, so
// two concurrent writers to the same solutions/{cat}/{slug}.md (e.g. a manual
// `sgc compound` and an automated canary-promotion CI job) lost-update — the
// second writer's merge silently discards the first's source_task_ids /
// what_didnt_work.
//
// The lock primitive (file-lock.ts, O_EXCL, cross-process) already exists; A4
// routes the concurrent solution writers through it via writeSolutionLocked.
//
// The lost update is a CROSS-PROCESS hazard: writeSolution is synchronous, so
// two calls in ONE process can't interleave. So one test forks real processes
// (mirroring file-lock-multiprocess.test.ts), and another proves the lock is
// gated on the expected path so it can't be silently dropped later.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { acquireFileLock, LockHeldError } from "../../src/dispatcher/file-lock"
import {
  ensureSgcStructure,
  parseFrontmatter,
  solutionLockPath,
  solutionPath,
  writeSolutionLocked,
} from "../../src/dispatcher/state"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"
import { seedRelatedSpawn } from "../fixtures/related-spawn"

const REPO = resolve(import.meta.dir, "..", "..")
const CATEGORY = "runtime"
const SLUG = "npe-in-auth"
const SPAWN_ID = "01WSLSTAMP00000000000-compound.related"

const STAMP: DedupStamp = {
  compound_related_spawn_id: SPAWN_ID,
  threshold_met_or_forced: true,
  reason: "new_entry",
}

function entry(taskId: string): SolutionEntry {
  return {
    id: `sol-${taskId}`,
    signature: `sig-${taskId}`.padEnd(64, "0"),
    category: CATEGORY,
    problem: "null pointer crash in the auth token refresh handler",
    symptoms: ["TypeError"],
    what_didnt_work: [],
    solution: "guard the null branch",
    prevention: "add a regression test",
    tags: ["auth"],
    first_seen: "2026-07-16T00:00:00Z",
    last_updated: "2026-07-16T00:00:00Z",
    times_referenced: 0,
    source_task_ids: [taskId] as SolutionEntry["source_task_ids"],
  }
}

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-wsl-"))
  ensureSgcStructure(tmp)
  // §3: the stamp's cited compound.related spawn must exist on disk; the forked
  // children read this same state root, so seeding once in the parent is enough.
  seedRelatedSpawn(tmp, SPAWN_ID)
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

// A child process that appends its own source_task_id under the lock.
function childWriter(taskId: string): string {
  const src = `
import { writeSolutionLocked } from ${JSON.stringify(resolve(REPO, "src/dispatcher/state.ts"))}
const e = ${JSON.stringify(entry(taskId))}
await writeSolutionLocked(e, ${JSON.stringify(SLUG)}, ${JSON.stringify(STAMP)}, "", ${JSON.stringify(tmp)})
`
  const f = resolve(tmp, `child-${taskId}.ts`)
  writeFileSync(f, src, "utf8")
  return f
}

describe("writeSolutionLocked (A4/ARCH-1)", () => {
  test("blocks on the solution's own lock path (load-bearing, gated correctly)", async () => {
    // Seed the entry once so the category dir + file exist.
    await writeSolutionLocked(entry("t0"), SLUG, STAMP, "", tmp)
    // Pre-hold the exact lock writeSolutionLocked must acquire, then call it
    // with no retries: it must be refused, proving it serializes on THAT path.
    const release = acquireFileLock(solutionLockPath(CATEGORY, SLUG, tmp))
    try {
      await expect(
        writeSolutionLocked(entry("t1"), SLUG, STAMP, "", tmp, { retries: 0 }),
      ).rejects.toBeInstanceOf(LockHeldError)
    } finally {
      release()
    }
    // Once released, the same write succeeds.
    const res = await writeSolutionLocked(entry("t1"), SLUG, STAMP, "", tmp)
    expect(res.entry.source_task_ids).toContain("t1")
  })

  test("concurrent writers across REAL processes preserve every source_task_id", () => {
    // Seed so the file exists and every child takes the read-merge-write path.
    execFileSync("bun", [childWriter("t-seed")], { encoding: "utf8", timeout: 30_000 })

    const ids = ["p1", "p2", "p3", "p4", "p5", "p6"]
    const { spawn } = require("node:child_process") as typeof import("node:child_process")
    // Launch all writers truly in parallel (distinct OS processes), then join.
    const children = ids.map((id) =>
      spawn("bun", [childWriter(id)], { stdio: ["ignore", "pipe", "pipe"] }),
    )
    const exits = children.map(
      (c) =>
        new Promise<number>((res) => c.on("close", (code) => res(code ?? -1))),
    )
    return Promise.all(exits).then((codes) => {
      for (const code of codes) expect(code).toBe(0)
      const path = solutionPath(CATEGORY, SLUG, tmp)
      const { data } = parseFrontmatter<SolutionEntry>(readFileSync(path, "utf8"))
      const got = new Set(data.source_task_ids as unknown as string[])
      for (const id of ids) expect(got.has(id)).toBe(true)
    })
  })
})
