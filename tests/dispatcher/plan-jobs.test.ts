// CE-4 (f5) — plan-jobs unit tests. RED-first: all of these fail
// before src/dispatcher/plan-jobs.ts exists; they pin the
// single-active-job semantics + stale-detect + paired-event
// emission + frontmatter shape.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  forkAsyncPlanJob,
  completePlanJob,
  failPlanJob,
  listJobs,
  showJob,
  PlanJobError,
  type PlanJob,
} from "../../src/dispatcher/plan-jobs"
import {
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
} from "../../src/dispatcher/state"
import { createLogger, type EventRecord } from "../../src/dispatcher/logger"

let stateRoot: string

beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-plan-jobs-"))
  ensureSgcStructure(stateRoot)
})

afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

// ── helpers ────────────────────────────────────────────────────────────────

/**
 * Fixed clock (returns specific ms). Test isolation; production uses Date.now.
 */
function fixedNow(iso: string): () => number {
  const ms = Date.parse(iso)
  return () => ms
}

/**
 * Fake spawn — records argv + env + returns a synthetic pid. Doesn't
 * actually fork. The real implementation uses node:child_process spawn
 * with detached:true; tests verify forkAsyncPlanJob hands the right
 * argv + env + logFd to spawnImpl. Child-mode is signaled via
 * `SGC_PLAN_ASYNC_CHILD=<job-id>` env var (cleaner than hidden CLI flag
 * — citty can't hide a defined arg from --help).
 */
function fakeSpawn(pid = 99999): {
  spawn: (
    argv: string[],
    opts: { logFd: number; env: Record<string, string> },
  ) => { pid: number }
  calls: {
    argv: string[]
    logFd: number
    env: Record<string, string>
  }[]
} {
  const calls: {
    argv: string[]
    logFd: number
    env: Record<string, string>
  }[] = []
  const spawn = (
    argv: string[],
    opts: { logFd: number; env: Record<string, string> },
  ) => {
    calls.push({ argv, logFd: opts.logFd, env: opts.env })
    return { pid }
  }
  return { spawn, calls }
}

/**
 * Write an existing job file fixture (simulates a prior --async run
 * that may or may not still be alive).
 */
function seedJobFile(over: Partial<PlanJob> = {}): { path: string; job: PlanJob } {
  const job: PlanJob = {
    job_id: "01HEXISTING000000000000000",
    task: "prior task",
    started_at: "2026-05-22T00:00:00.000Z",
    pid: 11111,
    log_path: join(stateRoot, "plan-jobs", "01HEXISTING000000000000000.log"),
    status: "running",
    ...over,
  }
  mkdirSync(join(stateRoot, "plan-jobs"), { recursive: true })
  const path = join(stateRoot, "plan-jobs", `${job.job_id}.md`)
  writeFileSync(
    path,
    serializeFrontmatter(job as unknown as Record<string, unknown>, ""),
    "utf8",
  )
  return { path, job }
}

// ── tests ────────────────────────────────────────────────────────────────

describe("forkAsyncPlanJob — happy path", () => {
  it("writes a job file + invokes spawnImpl with --async-child argv", async () => {
    const fake = fakeSpawn(54321)
    const result = await forkAsyncPlanJob("fix typo in README", {
      stateRoot,
      spawnImpl: fake.spawn,
      now: fixedNow("2026-05-22T13:00:00Z"),
      ulid: () => "01HJOBFRESH00000000000000",
      isAlive: () => false, // no prior jobs anyway
    })
    expect(result.job.job_id).toBe("01HJOBFRESH00000000000000")
    expect(result.job.status).toBe("running")
    expect(result.job.task).toBe("fix typo in README")
    expect(result.job.pid).toBe(54321)
    expect(result.job.started_at).toBe("2026-05-22T13:00:00.000Z")
    expect(existsSync(result.jobPath)).toBe(true)
    // No completion sentinels at fork time.
    expect(existsSync(join(stateRoot, "plan-jobs", `${result.job.job_id}.done`))).toBe(false)
    expect(existsSync(join(stateRoot, "plan-jobs", `${result.job.job_id}.failed`))).toBe(false)
    // spawn invoked with task in argv + SGC_PLAN_ASYNC_CHILD env signal.
    expect(fake.calls.length).toBe(1)
    const call = fake.calls[0]!
    expect(call.argv).toContain("plan")
    expect(call.argv).toContain("fix typo in README")
    expect(call.env["SGC_PLAN_ASYNC_CHILD"]).toBe("01HJOBFRESH00000000000000")
  })
})

describe("forkAsyncPlanJob — concurrency guard", () => {
  it("refuses when an existing job has status:running AND pid is alive", async () => {
    seedJobFile({ status: "running", pid: 22222 })
    const fake = fakeSpawn()
    await expect(
      forkAsyncPlanJob("new task", {
        stateRoot,
        spawnImpl: fake.spawn,
        isAlive: (pid) => pid === 22222, // existing prior is alive
        ulid: () => "01HSHOULDNOTRUN00000000000",
      }),
    ).rejects.toMatchObject({ code: "ConcurrentJobActive" })
    expect(fake.calls.length).toBe(0) // never reached spawn
    // No new job file written.
    expect(
      existsSync(join(stateRoot, "plan-jobs", "01HSHOULDNOTRUN00000000000.md")),
    ).toBe(false)
  })

  it("proceeds when prior job's pid is dead (stale lock cleared)", async () => {
    const prior = seedJobFile({ status: "running", pid: 33333 })
    const fake = fakeSpawn()
    const result = await forkAsyncPlanJob("new task after crash", {
      stateRoot,
      spawnImpl: fake.spawn,
      isAlive: () => false, // prior pid is gone
      ulid: () => "01HJOBAFTERCRASH000000000",
      now: fixedNow("2026-05-22T13:30:00Z"),
    })
    expect(result.job.job_id).toBe("01HJOBAFTERCRASH000000000")
    expect(result.job.status).toBe("running")
    expect(fake.calls.length).toBe(1)
    // Prior job file gets marked stale lazily.
    const priorAfter = parseFrontmatter<PlanJob>(readFileSync(prior.path, "utf8"))
    expect(priorAfter.data.status).toBe("stale")
  })

  it("STAB-1: refuses to fork while the fork lock is held by a live holder", async () => {
    // Simulate a concurrent invocation mid-critical-section: a live-holder
    // lock file exists. The new fork must reject and never spawn — this is
    // the TOCTOU window the lock closes.
    mkdirSync(join(stateRoot, "plan-jobs"), { recursive: true })
    writeFileSync(join(stateRoot, "plan-jobs", ".fork.lock"), `${process.pid}\n${Date.now()}\n`)
    const fake = fakeSpawn()
    await expect(
      forkAsyncPlanJob("racing task", {
        stateRoot,
        spawnImpl: fake.spawn,
        isAlive: () => true, // lock holder is alive
        ulid: () => "01HSHOULDNOTRUN00000000000",
      }),
    ).rejects.toMatchObject({ code: "ConcurrentJobActive" })
    expect(fake.calls.length).toBe(0) // never reached spawn
  })
})

describe("completePlanJob / failPlanJob — terminal transitions", () => {
  it("completePlanJob mutates frontmatter + touches .done + emits plan.async_complete", async () => {
    const fake = fakeSpawn()
    const fork = await forkAsyncPlanJob("classify task", {
      stateRoot,
      spawnImpl: fake.spawn,
      ulid: () => "01HJOBCOMPLETE00000000000",
      now: fixedNow("2026-05-22T14:00:00Z"),
    })

    const events: EventRecord[] = []
    const logger = createLogger({
      stateRoot,
      eventSink: (e) => events.push(e),
    })
    await completePlanJob(
      fork.job.job_id,
      {
        taskId: "01HTASKID00000000000000000",
        level: "L3",
        intentPath: join(stateRoot, "decisions/01HTASKID00000000000000000/intent.md"),
      },
      { stateRoot, now: fixedNow("2026-05-22T14:05:00Z"), logger },
    )

    const after = parseFrontmatter<PlanJob>(readFileSync(fork.jobPath, "utf8"))
    expect(after.data.status).toBe("done")
    expect(after.data.completed_at).toBe("2026-05-22T14:05:00.000Z")
    expect(after.data.level).toBe("L3")
    expect(after.data.intent_path).toContain("intent.md")
    expect(
      existsSync(join(stateRoot, "plan-jobs", `${fork.job.job_id}.done`)),
    ).toBe(true)
    expect(
      existsSync(join(stateRoot, "plan-jobs", `${fork.job.job_id}.failed`)),
    ).toBe(false)

    // Paired event emitted.
    const complete = events.find((e) => e.event_type === "plan.async_complete")
    expect(complete).toBeDefined()
    expect(complete!.payload["job_id"]).toBe(fork.job.job_id)
    expect(complete!.payload["task_id"]).toBe("01HTASKID00000000000000000")
    expect(complete!.payload["level"]).toBe("L3")
  })

  it("failPlanJob mutates frontmatter + touches .failed + emits plan.async_failed", async () => {
    const fake = fakeSpawn()
    const fork = await forkAsyncPlanJob("doomed task", {
      stateRoot,
      spawnImpl: fake.spawn,
      ulid: () => "01HJOBFAIL00000000000000",
      now: fixedNow("2026-05-22T15:00:00Z"),
    })

    const events: EventRecord[] = []
    const logger = createLogger({
      stateRoot,
      eventSink: (e) => events.push(e),
    })
    await failPlanJob(
      fork.job.job_id,
      "OpenRouter 429 rate-limited after 3 retries",
      { stateRoot, now: fixedNow("2026-05-22T15:00:42Z"), logger },
    )

    const after = parseFrontmatter<PlanJob>(readFileSync(fork.jobPath, "utf8"))
    expect(after.data.status).toBe("failed")
    expect(after.data.error).toContain("429 rate-limited")
    expect(
      existsSync(join(stateRoot, "plan-jobs", `${fork.job.job_id}.failed`)),
    ).toBe(true)
    expect(
      existsSync(join(stateRoot, "plan-jobs", `${fork.job.job_id}.done`)),
    ).toBe(false)

    const failed = events.find((e) => e.event_type === "plan.async_failed")
    expect(failed).toBeDefined()
    expect(failed!.payload["job_id"]).toBe(fork.job.job_id)
    expect(failed!.payload["error"]).toContain("429")
  })

  it("UX-3: readJob wraps a malformed job file as PlanJobError(MalformedJobFile)", async () => {
    // File exists (passes completePlanJob's existsSync guard) but has no YAML
    // frontmatter → parseFrontmatter throws; readJob must rethrow as a domain
    // PlanJobError carrying the path, not a bare StateError.
    mkdirSync(join(stateRoot, "plan-jobs"), { recursive: true })
    const id = "01HMALFORMED00000000000000"
    writeFileSync(
      join(stateRoot, "plan-jobs", `${id}.md`),
      "not a job file\n",
      "utf8",
    )
    await expect(
      completePlanJob(id, { taskId: "01HTASKID00000000000000000" }, { stateRoot }),
    ).rejects.toMatchObject({ name: "PlanJobError", code: "MalformedJobFile" })
  })
})

describe("listJobs", () => {
  it("returns [] on empty corpus (no plan-jobs/ dir)", async () => {
    const fresh = mkdtempSync(join(tmpdir(), "sgc-empty-"))
    try {
      const r = await listJobs({ stateRoot: fresh })
      expect(r).toEqual([])
    } finally {
      rmSync(fresh, { recursive: true, force: true })
    }
  })

  it("returns all jobs sorted by started_at descending; applies stale probe", async () => {
    seedJobFile({
      job_id: "01HJOB001",
      task: "older",
      started_at: "2026-05-22T10:00:00Z",
      status: "done",
      pid: 1,
    })
    seedJobFile({
      job_id: "01HJOB002",
      task: "middle (zombie running)",
      started_at: "2026-05-22T11:00:00Z",
      status: "running",
      pid: 2,
    })
    seedJobFile({
      job_id: "01HJOB003",
      task: "newest",
      started_at: "2026-05-22T12:00:00Z",
      status: "running",
      pid: 3,
    })
    const r = await listJobs({
      stateRoot,
      isAlive: (pid) => pid === 3, // only pid 3 alive; pid 2 is zombie
    })
    expect(r.length).toBe(3)
    expect(r.map((j) => j.job_id)).toEqual(["01HJOB003", "01HJOB002", "01HJOB001"])
    // Zombie running → stale.
    expect(r[1]!.status).toBe("stale")
    // Alive running → still running.
    expect(r[0]!.status).toBe("running")
  })
})

describe("showJob", () => {
  it("returns frontmatter + tail log when present", async () => {
    const fake = fakeSpawn()
    const fork = await forkAsyncPlanJob("log-bearing task", {
      stateRoot,
      spawnImpl: fake.spawn,
      ulid: () => "01HJOBLOG00000000000000000",
    })
    // Seed a fake log file (the real impl would have the child writing here).
    const lines = Array.from({ length: 250 }, (_, i) => `line ${i + 1}`)
    writeFileSync(fork.job.log_path, lines.join("\n") + "\n", "utf8")

    const r = await showJob(fork.job.job_id, { stateRoot, logTailLines: 50 })
    expect(r.job.job_id).toBe(fork.job.job_id)
    const tailLines = r.logTail.trim().split("\n")
    expect(tailLines.length).toBe(50)
    expect(tailLines[0]).toBe("line 201")
    expect(tailLines[49]).toBe("line 250")
  })

  it("throws JobNotFound when slug doesn't exist", async () => {
    await expect(
      showJob("01HDOESNOTEXIST000000000", { stateRoot }),
    ).rejects.toMatchObject({ code: "JobNotFound" })
  })

  it("lazy stale-detects: running-but-dead pid → status:stale mutation persisted", async () => {
    const prior = seedJobFile({
      job_id: "01HJOBSTALE000000000000000",
      pid: 44444,
      status: "running",
    })
    const r = await showJob("01HJOBSTALE000000000000000", {
      stateRoot,
      isAlive: () => false, // pid gone
    })
    expect(r.job.status).toBe("stale")
    // Persisted on disk so subsequent reads see stale without re-probing.
    const reread = parseFrontmatter<PlanJob>(readFileSync(prior.path, "utf8"))
    expect(reread.data.status).toBe("stale")
  })
})

describe("PlanJobError shape", () => {
  it("is an Error subclass with readonly .code", async () => {
    try {
      await showJob("01HNONE000", { stateRoot })
      throw new Error("expected showJob to throw")
    } catch (err) {
      expect(err).toBeInstanceOf(PlanJobError)
      expect(err).toBeInstanceOf(Error)
      expect((err as PlanJobError).code).toBe("JobNotFound")
    }
  })
})
