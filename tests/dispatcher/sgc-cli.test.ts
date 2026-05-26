import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

const cli = resolve(import.meta.dir, "..", "..", "src", "sgc.ts")

async function runSgc(
  args: string[],
  env: Record<string, string> = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  // Strip NODE_ENV=test (set by `bun test`); when it propagates to the
  // child bun process, citty silences stdout. Doesn't affect the child's
  // actual behavior — sgc CLI doesn't read NODE_ENV.
  const childEnv = { ...process.env, ...env }
  delete childEnv["NODE_ENV"]
  const proc = Bun.spawn(["bun", cli, ...args], {
    env: childEnv,
    stdout: "pipe",
    stderr: "pipe",
  })
  const stdout = await new Response(proc.stdout).text()
  const stderr = await new Response(proc.stderr).text()
  const exitCode = await proc.exited
  return { stdout, stderr, exitCode }
}

describe("sgc CLI smoke", () => {
  test("--help lists registered subcommands incl. reflect (CE-2) + watch-ci-failure (CE-3) + canary (GS-1)", async () => {
    const { stdout, exitCode } = await runSgc(["--help"])
    expect(exitCode).toBe(0)
    for (const cmd of [
      "discover",
      "plan",
      "work",
      "review",
      "qa",
      "ship",
      "compound",
      "reflect",
      "watch-ci-failure",
      "canary",
      "status",
    ]) {
      expect(stdout).toContain(cmd)
    }
  })

  test("watch-ci-failure --help shows all 5 flags (CE-3)", async () => {
    const { stdout, exitCode } = await runSgc(["watch-ci-failure", "--help"])
    expect(exitCode).toBe(0)
    for (const flag of ["--workflow", "--branch", "--run-id", "--interval", "--timeout"]) {
      expect(stdout).toContain(flag)
    }
  })

  test("canary --help shows all 8 flags incl. --bin (GS-1 + GS-1.1 PATH-shadow fix)", async () => {
    const { stdout, exitCode } = await runSgc(["canary", "--help"])
    expect(exitCode).toBe(0)
    for (const flag of [
      "--package",
      "--version",
      "--phases",
      "--health-url",
      "--health-regex",
      "--bin",
      "--interval",
      "--timeout",
    ]) {
      expect(stdout).toContain(flag)
    }
  })

  test("compound --help shows --from-ship-failure + --solution-slug (CE-3 promote)", async () => {
    const { stdout, exitCode } = await runSgc(["compound", "--help"])
    expect(exitCode).toBe(0)
    for (const flag of ["--from-ship-failure", "--solution-slug", "--force"]) {
      expect(stdout).toContain(flag)
    }
  })

  test("--version prints the package version", async () => {
    const { stdout, exitCode } = await runSgc(["--version"])
    expect(exitCode).toBe(0)
    // Match the shape; exact version is tracked in package.json and bumps per release.
    // Tolerant of consola's CI-mode "[log] " prefix (citty's --version uses
    // consola.log, which prepends a level tag when is-ci detects any of ~10
    // CI env vars on the runner). Strip an optional leading "[log] " before
    // matching so the test is hermetic to runner env.
    expect(stdout.trim().replace(/^\[log\] /, "")).toMatch(/^\d+\.\d+\.\d+$/)
  })

  test("discover runs end-to-end and prints forcing questions", async () => {
    const { stdout, exitCode } = await runSgc(["discover", "add OAuth refresh"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("topic: add OAuth refresh")
    expect(stdout).toContain("Goal:")
    expect(stdout).toContain("Next:")
    expect(stdout).toContain(`sgc plan "add OAuth refresh"`)
  })

  test("discover without topic fails with usage hint", async () => {
    const { stderr, exitCode } = await runSgc(["discover"])
    expect(exitCode).not.toBe(0)
    expect(stderr).toMatch(/topic/i)
  })

  test("plan --help shows positional task arg", async () => {
    const { stdout, exitCode } = await runSgc(["plan", "--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("TASK")
  })

  test("plan --help lists --async / --jobs / --status / --log (CE-4)", async () => {
    const { stdout, exitCode } = await runSgc(["plan", "--help"])
    expect(exitCode).toBe(0)
    for (const flag of ["--async", "--jobs", "--status", "--log"]) {
      expect(stdout).toContain(flag)
    }
  })

  test("loop --help lists --resume / --runs / --status (CE-5)", async () => {
    const { stdout, exitCode } = await runSgc(["loop", "--help"])
    expect(exitCode).toBe(0)
    for (const flag of ["--resume", "--runs", "--status"]) {
      expect(stdout).toContain(flag)
    }
  })

  test("--help lists loop subcommand (CE-5)", async () => {
    const { stdout, exitCode } = await runSgc(["--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("loop")
  })
})

describe("sgc status (implemented)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-cli-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  test("missing state dir → friendly hint", async () => {
    const missing = join(tmp, "no-such")
    const { stdout, exitCode } = await runSgc(["status"], { SGC_STATE_ROOT: missing })
    expect(exitCode).toBe(0)
    expect(stdout).toContain("No .sgc/ state directory")
    expect(stdout).toContain("sgc plan")
  })

  test("state dir exists but no task → exits 0 with hint", async () => {
    for (const layer of ["decisions", "progress", "solutions", "reviews"]) {
      mkdirSync(join(tmp, layer), { recursive: true })
    }
    const { stdout, exitCode } = await runSgc(["status"], { SGC_STATE_ROOT: tmp })
    expect(exitCode).toBe(0)
    expect(stdout).toContain("no active task")
  })

  test("active task → prints task fields", async () => {
    const { writeCurrentTask, ensureSgcStructure } = await import(
      "../../src/dispatcher/state"
    )
    ensureSgcStructure(tmp)
    writeCurrentTask(
      {
        task_id: "01HABCDEFG",
        level: "L1",
        active_feature: "f1",
        session_start: "2026-04-15T10:00:00Z",
        last_activity: "2026-04-15T10:30:00Z",
      },
      "",
      tmp,
    )
    const { stdout, exitCode } = await runSgc(["status"], { SGC_STATE_ROOT: tmp })
    expect(exitCode).toBe(0)
    expect(stdout).toContain("01HABCDEFG")
    expect(stdout).toContain("L1")
    expect(stdout).toContain("f1")
  })
})

describe("sgc reflect (CE-2 f3)", () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "sgc-cli-reflect-"))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  function seedFixture(): void {
    const decDir = join(tmp, "decisions", "T1")
    const solDir = join(tmp, "solutions", "data")
    mkdirSync(decDir, { recursive: true })
    mkdirSync(solDir, { recursive: true })
    const fs = require("node:fs") as typeof import("node:fs")
    fs.writeFileSync(
      join(decDir, "intent.md"),
      `---\ntask_id: "T1"\ntitle: "orders migration"\nmotivation: "Add archived_at column to orders table for analytics"\ncreated_at: "2026-05-22T00:00:00.000Z"\n---\n\n## Pre-mortem\n\nEarly signal: unrelated typo risk in column name\n`,
    )
    fs.writeFileSync(
      join(solDir, "migration-lock.md"),
      `---\ncategory: "data"\nintent: "lock avoidance"\nprevention: "Chunked backfill on huge orders tables avoids long migration locks under concurrent writes."\n---\n\nbody\n`,
    )
  }

  test("--task on seeded fixture → human-readable output with [silent] marker", async () => {
    seedFixture()
    const { stdout, exitCode } = await runSgc(["reflect", "--task", "T1"], {
      SGC_STATE_ROOT: tmp,
    })
    expect(exitCode).toBe(0)
    expect(stdout).toContain("# Reflect: T1")
    expect(stdout).toContain("[silent]")
    expect(stdout).toContain("data/migration-lock")
  })

  test("--json emits parseable ReflectReport[]", async () => {
    seedFixture()
    const { stdout, exitCode } = await runSgc(["reflect", "--task", "T1", "--json"], {
      SGC_STATE_ROOT: tmp,
    })
    expect(exitCode).toBe(0)
    // Strip optional consola CI-mode "[log] " prefix (see --version test).
    const jsonText = stdout.trim().replace(/^\[log\] /, "")
    const reports = JSON.parse(jsonText)
    expect(Array.isArray(reports)).toBe(true)
    expect(reports.length).toBe(1)
    expect(reports[0].task_id).toBe("T1")
    expect(Array.isArray(reports[0].candidates)).toBe(true)
    expect(reports[0].candidates[0].solution_ref).toBe("data/migration-lock")
    expect(reports[0].candidates[0].discussed).toBe(false)
  })
})
