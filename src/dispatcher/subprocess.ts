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

/** Max bytes captured from a child's stdout/stderr before the capture is
 *  treated as FAILED (exitCode -1) rather than silently truncated.
 *
 *  Node's spawnSync defaults maxBuffer to 1 MiB. A `git diff` past that set
 *  `error` (ENOBUFS) and truncated, and captureDiff's soft-null mapped the
 *  failure to "" — so the largest changesets reached the reviewers as an EMPTY
 *  diff and the gate passed on exactly the changes that most needed review
 *  (audit v1.37.0 Q-1). Raised to a generous ceiling; overflow past it is a
 *  hard failure, not a truncation. B6 will reuse this cap for the async
 *  accumulators in spawnCapture / claude-cli-agent. */
export const MAX_CAPTURE_BYTES = 64 * 1024 * 1024

/**
 * B6 (audit v1.37.0 Q-2/Q-3): accumulate a child stream's bytes and decode ONCE
 * at the end. Two bugs the old `stdout += chunk.toString()` pattern had:
 *   Q-2 — a UTF-8 sequence split across two `data` events was decoded per chunk,
 *         each half → U+FFFD (e.g. a claude-cli Chinese YAML corrupted before
 *         yamlLoad). Buffer.concat then decode is chunk-boundary safe.
 *   Q-3 — no byte cap, so a runaway child grew a JS string toward the ~512 MB
 *         limit and OOM'd. `push` refuses bytes past `cap` and flags overflow so
 *         the caller can kill the child and fail the capture.
 */
export class CappedStreamBuffer {
  private chunks: Buffer[] = []
  private bytes = 0
  overflowed = false
  constructor(private readonly cap: number = MAX_CAPTURE_BYTES) {}
  /** Returns false once the cap is hit (caller should kill the child). */
  push(c: Buffer): boolean {
    if (this.overflowed) return false
    if (this.bytes + c.length > this.cap) {
      this.overflowed = true
      return false
    }
    this.bytes += c.length
    this.chunks.push(c)
    return true
  }
  toString(): string {
    return Buffer.concat(this.chunks).toString("utf8")
  }
}

/** Async spawn + capture. Never rejects: a spawn error (e.g. missing binary)
 *  resolves exitCode -1 with the error text in stderr, matching the old
 *  Bun.spawn-based call sites that treated nonzero/failed as a soft null. */
export function spawnCapture(
  argv: string[],
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {},
): Promise<CaptureResult> {
  if (!argv[0]) return Promise.resolve({ stdout: "", stderr: "empty argv", exitCode: -1 })
  return new Promise((resolveP) => {
    const child = spawn(argv[0]!, argv.slice(1), {
      cwd: opts.cwd,
      env: opts.env,
      stdio: ["ignore", "pipe", "pipe"],
    })
    // B6: buffer bytes and decode once (Q-2), with a cap that kills a runaway
    // child rather than growing an unbounded string (Q-3).
    const out = new CappedStreamBuffer(opts.maxBuffer)
    const err = new CappedStreamBuffer(opts.maxBuffer)
    let errored = false
    child.stdout?.on("data", (c: Buffer) => {
      if (!out.push(c)) child.kill()
    })
    child.stderr?.on("data", (c: Buffer) => {
      if (!err.push(c)) child.kill()
    })
    child.on("error", (e) => {
      errored = true
      resolveP({ stdout: out.toString(), stderr: err.toString() + String(e), exitCode: -1 })
    })
    child.on("close", (code) => {
      if (errored) return
      const overflowed = out.overflowed || err.overflowed
      resolveP({
        stdout: out.toString(),
        stderr: overflowed ? "output exceeded the capture byte cap" : err.toString(),
        // Overflow → the capture is truncated and untrustworthy; -1 mirrors
        // spawnCaptureSync's ENOBUFS contract so callers keying on exitCode===0
        // don't treat a truncated stream as a complete one.
        exitCode: overflowed ? -1 : code ?? -1,
      })
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
  opts: { cwd?: string; env?: NodeJS.ProcessEnv; maxBuffer?: number } = {},
): CaptureResult {
  if (!argv[0]) return { stdout: "", stderr: "empty argv", exitCode: -1 }
  const r = spawnSync(argv[0]!, argv.slice(1), {
    cwd: opts.cwd,
    env: opts.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: opts.maxBuffer ?? MAX_CAPTURE_BYTES,
  })
  // `r.error` is set on any failure to complete the capture: ENOENT (missing
  // binary), ENOBUFS (stdout exceeded maxBuffer — the child is killed and the
  // buffer truncated), or a signal. All three are exitCode -1, distinct from a
  // binary that ran and exited non-zero (r.status). Callers that must not treat
  // a truncated capture as "no output" key on the -1 (see captureDiff).
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
