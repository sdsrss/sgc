import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { execFileSync } from "node:child_process"
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

  test("work --help shows verification close-gate flags (Tier 1, sp absorb)", async () => {
    const { stdout, exitCode } = await runSgc(["work", "--help"])
    expect(exitCode).toBe(0)
    // toContain (not regex) per DOG-3 — citty wraps names in backticks under CI.
    for (const flag of ["--done", "--verify-command", "--evidence"]) {
      expect(stdout).toContain(flag)
    }
    // Gate semantics surfaced so operators learn --done now requires verification.
    expect(stdout).toContain("verify")
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

  test("compound --help shows --from-ship-failure + --from-canary + --solution-slug (CE-3 + GS-1.1 promote)", async () => {
    const { stdout, exitCode } = await runSgc(["compound", "--help"])
    expect(exitCode).toBe(0)
    for (const flag of [
      "--from-ship-failure",
      "--from-canary",
      "--solution-slug",
      "--force",
    ]) {
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

  // GS-6 (v1.16.0): --template selector. toContain (not regex) per DOG-3
  // ([[feedback_citty_help_consola_ci_mode]]) — backtick wrap under CI=1.
  test("discover --help lists --template flag with valid values (GS-6)", async () => {
    const { stdout, exitCode } = await runSgc(["discover", "--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("--template")
    expect(stdout).toContain("product")
    expect(stdout).toContain("scope")
    expect(stdout).toContain("anti-pattern")
  })

  test("discover --template product end-to-end emits product wording marker (GS-6)", async () => {
    const { stdout, exitCode } = await runSgc([
      "discover",
      "side project dog walking app",
      "--template",
      "product",
    ])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("hurts today")
  })

  // GS-5 (v1.17.0): sgc cso pre-ship security review.
  test("sgc --help lists cso subcommand (GS-5)", async () => {
    const { stdout, exitCode } = await runSgc(["--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("cso")
  })

  test("cso --help describes security review semantics (GS-5)", async () => {
    const { stdout, exitCode } = await runSgc(["cso", "--help"])
    expect(exitCode).toBe(0)
    // toContain not regex per DOG-3 backtick CI wrap
    expect(stdout).toContain("cso")
    expect(stdout).toContain("security")
  })

  test("discover --template <unknown> exits non-zero with available-list (GS-6)", async () => {
    const { stderr, exitCode } = await runSgc([
      "discover",
      "any topic",
      "--template",
      "user-value",
    ])
    expect(exitCode).not.toBe(0)
    expect(stderr).toContain("unknown template")
    expect(stderr).toContain("user-value")
    expect(stderr).toContain("product")
    expect(stderr).toContain("scope")
    expect(stderr).toContain("anti-pattern")
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

  test("plan --help shows --deep flag (Phase 2b deep planning)", async () => {
    const { stdout, exitCode } = await runSgc(["plan", "--help"])
    expect(exitCode).toBe(0)
    // toContain (not regex) per DOG-3 — citty wraps names in backticks under CI.
    expect(stdout).toContain("--deep")
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

describe("sgc handoff CLI help (GS-2 T15)", () => {
  test("sgc --help lists handoff subcommand", async () => {
    const { stdout } = await runSgc(["--help"])
    expect(stdout).toContain("handoff")
  })

  test("sgc handoff --help shows --auto and --print flags", async () => {
    const { stdout } = await runSgc(["handoff", "--help"])
    expect(stdout).toContain("--auto")
    expect(stdout).toContain("--print")
  })
})

describe("sgc debug CLI help (GS-4 T14)", () => {
  test("sgc --help lists debug subcommand", async () => {
    const r = await runSgc(["--help"])
    // Use multiple toContain to dodge citty-under-consola-CI-mode backtick trap
    // per feedback_citty_help_consola_ci_mode (GS-7 DOG-3 lesson).
    expect(r.stdout).toContain("debug")
    expect(r.stdout).toContain("4-phase systematic-debugging walker")
    expect(r.stdout).toContain("Iron Law #3")
  })

  test("sgc debug --help shows start/close/runs/status surface", async () => {
    const r = await runSgc(["debug", "--help"])
    // Multiple toContain — same backtick trap defense.
    expect(r.stdout.toLowerCase()).toContain("start")
    expect(r.stdout.toLowerCase()).toContain("close")
    expect(r.stdout.toLowerCase()).toContain("--root-cause")
    expect(r.stdout.toLowerCase()).toContain("--fix-commit")
    expect(r.stdout.toLowerCase()).toContain("--verify-command")
  })
})

describe("sgc land CLI help (GS-7 T11)", () => {
  test("sgc --help lists land subcommand", async () => {
    const { stdout, exitCode } = await runSgc(["--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toContain("land")
    // GS-7 DOG-3 fix: citty wraps cmd names in backticks under consola CI-mode
    // (`land`) but uses plain text locally (land). Assert the description text
    // appears separately instead of a tight one-line regex that breaks on the
    // backtick separator.
    expect(stdout).toContain("Post-publish ship chain")
    expect(stdout).toContain("watch-ci-failure")
    expect(stdout).toContain("canary")
  })

  test("sgc land --help shows --package and --version flags", async () => {
    const { stdout, exitCode } = await runSgc(["land", "--help"])
    expect(exitCode).toBe(0)
    expect(stdout).toMatch(/--package/i)
    expect(stdout).toMatch(/--version/i)
  })
})

// A V8 stack-frame line ("    at fn (file:line:col)") — the noise that citty's
// default runMain dumps for every thrown error, making expected failures read
// like crashes. The entrypoint now suppresses it unless SGC_DEBUG is set.
const STACK_FRAME_RE = /\n\s+at\s/

describe("sgc CLI error presentation", () => {
  test("an expected thrown error prints a single clean 'error:' line, no stack", async () => {
    // unknown --template is a plain thrown Error (not a citty CLIError).
    const { stderr, exitCode } = await runSgc([
      "discover",
      "add OAuth refresh",
      "--template",
      "does-not-exist",
    ])
    expect(exitCode).toBe(1)
    expect(stderr).toContain("error:")
    expect(stderr).toContain("unknown template")
    expect(stderr).not.toMatch(STACK_FRAME_RE)
  })

  test("SGC_DEBUG=1 restores the full stack trace for diagnosis", async () => {
    const { stderr, exitCode } = await runSgc(
      ["discover", "add OAuth refresh", "--template", "does-not-exist"],
      { SGC_DEBUG: "1" },
    )
    expect(exitCode).toBe(1)
    expect(stderr).toMatch(STACK_FRAME_RE)
  })
})

describe("sgc auto-gitignores its default .sgc/ state dir (README contract)", () => {
  // Spawn with cwd=temp git repo and NO SGC_STATE_ROOT, so the default `.sgc`
  // location is used and the gitignore guard fires. SGC_FORCE_INLINE avoids LLM.
  function planInRepo(repo: string): void {
    const env: Record<string, string | undefined> = {
      ...process.env,
      SGC_FORCE_INLINE: "1",
    }
    delete env["NODE_ENV"]
    delete env["SGC_STATE_ROOT"]
    execFileSync("bun", [cli, "plan", "fix typo in readme"], {
      cwd: repo,
      env,
      stdio: "ignore",
    })
  }

  test("creates .gitignore with .sgc/ when planning in a repo without one", () => {
    const repo = mkdtempSync(join(tmpdir(), "sgc-gi-new-"))
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo })
      planInRepo(repo)
      const gi = join(repo, ".gitignore")
      expect(existsSync(gi)).toBe(true)
      expect(readFileSync(gi, "utf8")).toContain(".sgc/")
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test("appends without clobbering an existing .gitignore, and never duplicates", () => {
    const repo = mkdtempSync(join(tmpdir(), "sgc-gi-append-"))
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo })
      writeFileSync(join(repo, ".gitignore"), "node_modules/\n")
      planInRepo(repo)
      // run a second time — must not add a second .sgc/ rule
      execFileSync("git", ["init", "-q"], { cwd: repo })
      const content = readFileSync(join(repo, ".gitignore"), "utf8")
      expect(content).toContain("node_modules/")
      const sgcRules = content
        .split(/\r?\n/)
        .filter((l) => l.trim() === ".sgc/").length
      expect(sgcRules).toBe(1)
    } finally {
      rmSync(repo, { recursive: true, force: true })
    }
  })

  test("does not touch .gitignore when SGC_STATE_ROOT points elsewhere", () => {
    const repo = mkdtempSync(join(tmpdir(), "sgc-gi-custom-"))
    const stateRoot = mkdtempSync(join(tmpdir(), "sgc-gi-state-"))
    try {
      execFileSync("git", ["init", "-q"], { cwd: repo })
      const env: Record<string, string | undefined> = {
        ...process.env,
        SGC_FORCE_INLINE: "1",
        SGC_STATE_ROOT: stateRoot,
      }
      delete env["NODE_ENV"]
      execFileSync("bun", [cli, "plan", "fix typo in readme"], {
        cwd: repo,
        env,
        stdio: "ignore",
      })
      expect(existsSync(join(repo, ".gitignore"))).toBe(false)
    } finally {
      rmSync(repo, { recursive: true, force: true })
      rmSync(stateRoot, { recursive: true, force: true })
    }
  })
})
