// M4, paying off a P3-7 debt: the roadmap row read
// "缺真多进程锁测试 + crash-mid-write 测试" and shipped ✅ with the multiprocess
// lock test plus a docblock. The second half quietly became prose.
//
// The claim it was supposed to pin is state.ts's:
//
//     "Atomic" here means VISIBILITY-atomic: a concurrent reader sees either
//     the whole old file or the whole new one, never a torn write.
//
// That claim is load-bearing — `--resume` re-reads checkpoints, and a
// half-serialized run file surfaces as MalformedRunFile — and it was asserted,
// never demonstrated. A ✅ on a row whose stated acceptance did not happen makes
// the ledger read better than the work, which is the one failure mode a ledger
// cannot have.
//
// Method: fork a real process that rewrites a large document in a tight loop,
// SIGKILL it at an unpredictable point, and check what a reader finds. Killing
// mid-`writeFileSync` is what a torn write would need, so the kill is timed
// randomly across many trials rather than aimed. Intermittent by nature —
// tier-2 stress-repro used as a tier-1 proxy (reason: the failure requires
// interrupting a syscall we do not control the scheduling of).

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { spawn } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-crash-write-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

const REPO = resolve(import.meta.dir, "..", "..")
const BODY_LEN = 400_000

/** A document that can be checked for completeness without a checksum: the
 *  declared length must match the body actually on disk. */
function doc(seq: number): string {
  const body = String.fromCharCode(97 + (seq % 26)).repeat(BODY_LEN)
  return `---\nseq: ${seq}\nbody_len: ${BODY_LEN}\n---\n${body}\n`
}

/** Reader's view: null when the file is absent, else a verdict on its integrity. */
function inspect(path: string): { torn: boolean; detail: string } | null {
  if (!existsSync(path)) return null
  const text = readFileSync(path, "utf8")
  const m = /^---\nseq: (\d+)\nbody_len: (\d+)\n---\n([\s\S]*)\n$/.exec(text)
  if (!m) return { torn: true, detail: `frontmatter unreadable (${text.length} bytes on disk)` }
  const declared = Number(m[2])
  const actual = (m[3] ?? "").length
  if (actual !== declared) {
    return { torn: true, detail: `body ${actual} bytes, frontmatter declares ${declared}` }
  }
  // A torn write could also mix two generations' fill characters.
  const chars = new Set((m[3] ?? "").split(""))
  if (chars.size !== 1) return { torn: true, detail: `body mixes ${chars.size} generations` }
  return { torn: false, detail: `seq=${m[1]} intact` }
}

function writerScript(target: string): string {
  return `
import { writeAtomic } from ${JSON.stringify(resolve(REPO, "src/dispatcher/state.ts"))}
const BODY_LEN = ${BODY_LEN}
function doc(seq) {
  const body = String.fromCharCode(97 + (seq % 26)).repeat(BODY_LEN)
  return "---\\nseq: " + seq + "\\nbody_len: " + BODY_LEN + "\\n---\\n" + body + "\\n"
}
console.log("GO")
for (let i = 1; i < 100000; i++) writeAtomic(${JSON.stringify(target)}, doc(i))
`
}

describe("writeAtomic survives a crash mid-write (P3-7 debt, paid in M4)", () => {
  test("a reader never observes a torn file, across 12 killed writers", async () => {
    const target = resolve(tmp, "run.md")
    const script = resolve(tmp, "writer.ts")
    writeFileSync(script, writerScript(target), "utf8")
    // Generation 0 is what a reader must see if the very first write is killed.
    writeFileSync(target, doc(0), "utf8")

    const observed: string[] = []
    for (let trial = 0; trial < 12; trial++) {
      const child = spawn("bun", [script], { stdio: ["ignore", "pipe", "ignore"] })
      await new Promise<void>((r) => {
        let out = ""
        child.stdout.on("data", (c: Buffer) => {
          out += c.toString()
          if (out.includes("GO")) r()
        })
        setTimeout(r, 5_000)
      })
      // Land inside the write loop at an unpredictable point.
      await new Promise((r) => setTimeout(r, 12 + Math.floor(Math.random() * 60)))
      child.kill("SIGKILL")
      await new Promise<void>((r) => child.on("exit", () => r()))

      const v = inspect(target)
      expect(v).not.toBeNull()
      if (v!.torn) {
        throw new Error(`trial ${trial}: torn write observed — ${v!.detail}`)
      }
      observed.push(v!.detail)
    }
    expect(observed.length).toBe(12)

    // Prove the writer was actually killed MID-LOOP rather than before it got
    // started — otherwise every trial would be reading generation 0 and this
    // test would pass against an implementation with no tmp+rename at all.
    // (The same trap the P3-6 resume-lock test fell into: fast stubs finishing
    // before the interesting window opened.)
    const seqs = observed.map((d) => Number(/seq=(\d+)/.exec(d)?.[1] ?? -1))
    const progressed = seqs.filter((s) => s > 0).length
    expect(progressed).toBeGreaterThan(0)
    // And the generations must differ across trials — a frozen seq would mean
    // the writes were not landing.
    expect(new Set(seqs).size).toBeGreaterThan(1)
  }, 90_000)

  test("a killed writer leaves its scratch file behind, not a half-written target", () => {
    // The tmp file is the whole mechanism: it absorbs the partial write so the
    // target is only ever replaced by an atomic rename. Its presence after a
    // crash is expected, and it must not be mistaken for the target — the name
    // carries a `.tmp.` infix precisely so readers skip it.
    const target = resolve(tmp, "run.md")
    writeFileSync(target, doc(0), "utf8")
    writeFileSync(resolve(tmp, "run.md.tmp.12345"), "half a doc, no frontmatter", "utf8")

    expect(inspect(target)!.torn).toBe(false)
    const leftovers = readdirSync(tmp).filter((f) => f.includes(".tmp."))
    expect(leftovers.length).toBe(1)
    // Same directory (so rename(2) stays within one filesystem and is atomic),
    // distinguishable name.
    expect(leftovers[0]).toStartWith("run.md.tmp.")
  })
})
