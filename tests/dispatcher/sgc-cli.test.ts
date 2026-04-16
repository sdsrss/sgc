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
  //
  // Strip CI=true (set by GitHub Actions runners): when set, bun prefixes
  // `console.log` stdout with "[log] ", breaking exact-match assertions on
  // --version. Hermetic test env > preserving CI detection inside the
  // child. (The workflow itself still runs under CI=true — only the
  // child bun subprocess is shielded.)
  const childEnv = { ...process.env, ...env }
  delete childEnv["NODE_ENV"]
  delete childEnv["CI"]
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
  test("--help lists 8 subcommands", async () => {
    const { stdout, exitCode } = await runSgc(["--help"])
    expect(exitCode).toBe(0)
    for (const cmd of ["discover", "plan", "work", "review", "qa", "ship", "compound", "status"]) {
      expect(stdout).toContain(cmd)
    }
  })

  test("--version prints the package version", async () => {
    const { stdout, exitCode } = await runSgc(["--version"])
    expect(exitCode).toBe(0)
    // Match the shape; exact version is tracked in package.json and bumps per release
    expect(stdout.trim()).toMatch(/^\d+\.\d+\.\d+$/)
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
