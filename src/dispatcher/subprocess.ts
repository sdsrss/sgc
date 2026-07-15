// src/dispatcher/subprocess.ts
//
// node:child_process subprocess adapter. Replaces all Bun.spawn / Bun.which
// so the shipped bundle runs under plain `node` (no bun runtime). Works
// identically under bun (dev/test) and node (bundle) — both implement
// node:child_process.
import { spawn, spawnSync } from "node:child_process"

export interface CaptureResult {
  stdout: string
  stderr: string
  exitCode: number
}

/** Async spawn + capture. Never rejects: a spawn error (e.g. missing binary)
 *  resolves exitCode -1 with the error text in stderr, matching the old
 *  Bun.spawn-based call sites that treated nonzero/failed as a soft null. */
export function spawnCapture(
  argv: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): Promise<CaptureResult> {
  if (!argv[0]) return Promise.resolve({ stdout: "", stderr: "empty argv", exitCode: -1 })
  return new Promise((resolveP) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    let stdout = ""
    let stderr = ""
    let errored = false
    child.stdout?.on("data", (c: Buffer) => (stdout += c.toString()))
    child.stderr?.on("data", (c: Buffer) => (stderr += c.toString()))
    child.on("error", (e) => {
      errored = true
      resolveP({ stdout, stderr: stderr + String(e), exitCode: -1 })
    })
    child.on("close", (code) => {
      if (!errored) resolveP({ stdout, stderr, exitCode: code ?? -1 })
    })
  })
}

/** Sync spawn + capture, argv form (never a shell). Mirrors spawnCapture's
 *  soft-null contract: a spawn error or non-zero exit resolves to the captured
 *  streams plus an exitCode, never throws. Use this instead of `execSync` with
 *  an interpolated string whenever any component of the command is caller- or
 *  operator-supplied — argv arrays cannot be broken out of with `;`, `$()`,
 *  backticks, or `&&`. */
export function spawnCaptureSync(
  argv: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv } = {},
): CaptureResult {
  if (!argv[0]) return { stdout: "", stderr: "empty argv", exitCode: -1 }
  const r = spawnSync(argv[0]!, argv.slice(1), {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  })
  if (r.error) return { stdout: r.stdout ?? "", stderr: String(r.error), exitCode: -1 }
  return { stdout: r.stdout ?? "", stderr: r.stderr ?? "", exitCode: r.status ?? -1 }
}

/** Resolve an executable on PATH. Replaces Bun.which. */
export function whichSync(bin: string): string | null {
  const cmd = process.platform === "win32" ? "where" : "which"
  const r = spawnSync(cmd, [bin], { encoding: "utf8" })
  if (r.status !== 0) return null
  const line = (r.stdout || "").split("\n")[0]?.trim()
  return line && line.length > 0 ? line : null
}
