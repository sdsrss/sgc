// B6 / audit v1.37.0 Q-2 + Q-3: the async capture accumulators decoded each
// chunk independently (`stdout += c.toString()`), so a multibyte UTF-8 sequence
// split across two `data` events emitted U+FFFD — corrupting e.g. a claude-cli
// Chinese review YAML before yamlLoad (Q-2). They also had no byte cap, so a
// runaway child could grow a JS string toward the ~512 MB limit and OOM (Q-3).
//
// Fix: accumulate Buffers, decode once via Buffer.concat (chunk-boundary safe),
// with an injectable byte cap that fails the capture (exitCode -1) rather than
// growing unbounded.

import { describe, expect, test } from "bun:test"
import { spawnCapture } from "../../src/dispatcher/subprocess"

describe("spawnCapture (B6/Q-2: multibyte decode across chunk boundaries)", () => {
  test("a UTF-8 char split across two writes decodes intact (no U+FFFD)", async () => {
    // 锁 = E9 94 81. Emit the first byte, then the rest in a separate flush, so
    // they arrive as distinct `data` events. Per-chunk toString() would yield
    // replacement chars; concat-then-decode yields the intact character.
    const script =
      "process.stdout.write(Buffer.from([0xE9]));" +
      "setTimeout(()=>{process.stdout.write(Buffer.from([0x94,0x81]));process.exit(0)},50)"
    const r = await spawnCapture([process.execPath, "-e", script])
    expect(r.exitCode).toBe(0)
    expect(r.stdout).toBe("锁")
    expect(r.stdout).not.toContain("�")
  })
})

describe("spawnCapture (B6/Q-3: byte cap on runaway output)", () => {
  test("output beyond the cap fails the capture (exitCode -1), does not grow unbounded", async () => {
    const r = await spawnCapture(
      [process.execPath, "-e", "process.stdout.write('x'.repeat(1_000_000))"],
      { maxBuffer: 4096 },
    )
    expect(r.exitCode).toBe(-1)
    expect(r.stdout.length).toBeLessThanOrEqual(4096)
  })
})
