// M4 (code-review follow-up to P3-9 / P3-5): two gates that record less than
// they promise.
//
// 1. Rotation kept "exactly one generation" only for a single writer. Each sink
//    counts its OWN writes but renames a SHARED file, and the byte counter is
//    seeded once at sink creation and never re-read. So a writer whose counter
//    is stale-high rotates a file that another writer just rotated — renaming a
//    now-tiny live file over the generation the other writer preserved. The
//    stream stays bounded (the 2× cap claim survives), but "keep one
//    generation" silently becomes "keep almost nothing".
//
// 2. The §1 leak scan on `--submit` fails closed correctly, but throws without
//    emitting anything. The spawn path surfaces the same rejection as
//    spawn.end{outcome:"error"}, so `sgc tail` shows it. `--submit` exists
//    precisely for the case with no live poller — so a §1 violation arriving
//    through the one path nobody is watching left no trace at all. A security
//    gate whose trips aren't recorded cannot be shown to be working.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { createLogger, type EventRecord } from "../../src/dispatcher/logger"

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "sgc-m4-obs-"))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
  delete process.env.SGC_EVENTS_MAX_BYTES
})

function eventsPath(): string {
  return resolve(root, "progress/events.ndjson")
}

/** Every event still readable across the live stream and its one generation. */
function readableEvents(): number {
  let n = 0
  for (const p of [`${eventsPath()}.1`, eventsPath()]) {
    if (!existsSync(p)) continue
    n += readFileSync(p, "utf8")
      .split("\n")
      .filter((l) => l.trim().length > 0).length
  }
  return n
}

/** ~200 bytes/event so a 2000-byte cap rotates partway through a run. */
function emit(sink: { event: (e: Parameters<ReturnType<typeof createLogger>["event"]>[0]) => void }, i: number): void {
  sink.event({
    task_id: null,
    spawn_id: null,
    agent: null,
    event_type: "test.emitted",
    level: "info",
    payload: { seq: i, filler: "x".repeat(150) },
  })
}

// ─── D1: concurrent sinks must not destroy each other's generation ────────

describe("M4/D1 · two live sinks keep the generation rotation exists to keep", () => {
  test("a sink with a stale counter does not clobber the generation another just wrote", () => {
    // The ordering is what makes this bite, and an earlier version of this test
    // missed it by creating both sinks against an empty file — then neither
    // counter ever reaches the cap and no rotation happens at all, so the test
    // passes against the broken code. The real sequence:
    //   1. A writes the stream up to the cap    (bytes_A ≈ cap)
    //   2. B is created, seeding bytes_B ≈ cap from the file on disk
    //   3. B writes  → B rotates the FULL stream to .1, appends, bytes_B = 0
    //   4. A writes  → bytes_A is still stale-high, so A renames the now-tiny
    //                  live file over .1, destroying what B preserved
    // Reachable whenever two sgc PROCESSES write near the cap — the loop and
    // plan-jobs guards prevent two runs, not two commands.
    const CAP = 4000
    const a = createLogger({ stateRoot: root, maxBytes: CAP, say: () => {} })
    // Drive to just under the cap by measuring, not by estimating event size.
    let n = 0
    emit(a, n++)
    while (statSync(eventsPath()).size + 400 < CAP) emit(a, n++)
    expect(existsSync(`${eventsPath()}.1`)).toBe(false)

    const b = createLogger({ stateRoot: root, maxBytes: CAP, say: () => {} }) // seeds ≈ cap
    emit(b, 100) // B rotates the full stream to .1, then appends
    expect(existsSync(`${eventsPath()}.1`)).toBe(true)
    const preservedByB = readFileSync(`${eventsPath()}.1`, "utf8").split("\n").filter((l) => l.trim()).length
    expect(preservedByB).toBe(n)

    emit(a, 200) // A's counter is stale-high — it must NOT rotate a tiny file
    const stillThere = readFileSync(`${eventsPath()}.1`, "utf8").split("\n").filter((l) => l.trim()).length
    expect(stillThere).toBe(n) // the generation B preserved must survive
    expect(readableEvents()).toBe(n + 2)
  })

  test("a single sink still rotates and stays bounded (no regression)", () => {
    const a = createLogger({ stateRoot: root, maxBytes: 2000, say: () => {} })
    for (let i = 0; i < 40; i++) {
      emit(a, i)
    }
    expect(existsSync(`${eventsPath()}.1`)).toBe(true)
    const live = readFileSync(eventsPath(), "utf8").length
    const rotated = readFileSync(`${eventsPath()}.1`, "utf8").length
    expect(live).toBeLessThanOrEqual(2000 + 300)
    expect(live + rotated).toBeLessThanOrEqual(2 * 2000 + 300)
  })

  test("the newest events are the ones kept when the stream overflows", () => {
    const a = createLogger({ stateRoot: root, maxBytes: 2000, say: () => {} })
    for (let i = 0; i < 40; i++) {
      emit(a, i)
    }
    const live = readFileSync(eventsPath(), "utf8")
    const last = JSON.parse(live.trim().split("\n").pop() as string) as EventRecord
    expect(last.payload.seq).toBe(39)
  })
})

// ─── D2: operator override ────────────────────────────────────────────────

describe("M4/D2 · SGC_EVENTS_MAX_BYTES lets an operator size the stream", () => {
  test("a raised cap defers rotation", () => {
    process.env.SGC_EVENTS_MAX_BYTES = "1000000"
    const a = createLogger({ stateRoot: root, say: () => {} })
    for (let i = 0; i < 40; i++) {
      emit(a, i)
    }
    expect(existsSync(`${eventsPath()}.1`)).toBe(false)
    expect(readableEvents()).toBe(40)
  })

  test("a lowered cap rotates sooner", () => {
    process.env.SGC_EVENTS_MAX_BYTES = "600"
    const a = createLogger({ stateRoot: root, say: () => {} })
    for (let i = 0; i < 10; i++) {
      emit(a, i)
    }
    expect(existsSync(`${eventsPath()}.1`)).toBe(true)
  })

  test("a malformed override falls back to the default rather than throwing", () => {
    process.env.SGC_EVENTS_MAX_BYTES = "not-a-number"
    const a = createLogger({ stateRoot: root, say: () => {} })
    expect(() => emit(a, 0)).not.toThrow()
    expect(readableEvents()).toBe(1)
  })

  test("an explicit maxBytes argument still wins over the env var", () => {
    process.env.SGC_EVENTS_MAX_BYTES = "1000000"
    const a = createLogger({ stateRoot: root, maxBytes: 600, say: () => {} })
    for (let i = 0; i < 10; i++) {
      emit(a, i)
    }
    expect(existsSync(`${eventsPath()}.1`)).toBe(true)
  })
})
