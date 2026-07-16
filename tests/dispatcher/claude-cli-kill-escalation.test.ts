// C6 · Q-5 — a child that ignores SIGTERM must be SIGKILLed after the grace.
//
// Real-process test (not a mock): the child writes its pid, traps SIGTERM, and
// loops forever. The runner resolves quickly (the timeout abort fires an error
// event), but the child keeps running — before the fix, the timeout's SIGTERM
// was the only signal sent, so the wedged child leaked. With SIGKILL escalation
// the child is reaped KILL_GRACE_MS after SIGTERM. We prove that by polling the
// pid for death.

import { describe, expect, it } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { defaultRunner } from "../../src/dispatcher/claude-cli-agent"
import { KILL_GRACE_MS } from "../../src/dispatcher/subprocess"

const isAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0) // signal 0 = existence probe; throws ESRCH when gone
    return true
  } catch {
    return false
  }
}

describe("C6/Q-5: SIGTERM-ignoring child", () => {
  it("is SIGKILLed after the grace window, not leaked", async () => {
    const dir = mkdtempSync(join(tmpdir(), "sgc-c6-"))
    const pidFile = join(dir, "child.pid")
    // Trap SIGTERM (do nothing) and stay alive; only SIGKILL can reap it.
    const script =
      `require('fs').writeFileSync(${JSON.stringify(pidFile)}, String(process.pid));` +
      `process.on('SIGTERM', () => {}); setInterval(() => {}, 100000)`

    try {
      const res = await defaultRunner([process.execPath, "-e", script], 200, undefined, undefined)
      expect(res.timedOut).toBe(true)

      const pid = Number(readFileSync(pidFile, "utf8"))
      expect(Number.isInteger(pid)).toBe(true)
      expect(isAlive(pid)).toBe(true) // survived SIGTERM

      // Poll for death up to grace + generous margin.
      const deadline = Date.now() + KILL_GRACE_MS + 3000
      while (isAlive(pid) && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50))
      }
      expect(isAlive(pid)).toBe(false) // SIGKILL escalation reaped it
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 12000)
})
