import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  StateError,
  deleteSolution,
  ensureSgcStructure,
  listSolutions,
  readSolution,
  solutionPath,
  writeSolution,
} from "../../src/dispatcher/state"
import type { SolutionEntry } from "../../src/dispatcher/types"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-solutions-"))
  ensureSgcStructure(tmp)
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function makeEntry(overrides: Partial<SolutionEntry> = {}): SolutionEntry {
  return {
    id: "01HSOLUTION0000000000000000",
    signature: "a".repeat(64),
    category: "runtime",
    problem: "Null pointer when user logs in with empty password",
    symptoms: ["500 error on /login", "stack trace points to auth.ts:42"],
    what_didnt_work: [
      {
        approach: "catching all exceptions at the router",
        reason_failed: "hid the real bug and produced opaque logs",
      },
    ],
    solution: "Validate password presence before calling authenticate()",
    prevention: "Add integration test that asserts empty-password → 400, not 500",
    tags: ["auth", "null-check"],
    first_seen: "2026-04-15T10:00:00Z",
    last_updated: "2026-04-15T10:00:00Z",
    times_referenced: 0,
    source_task_ids: ["01HTASK0000000000000000000"],
    ...overrides,
  }
}

describe("writeSolution — new write", () => {
  test("writes path + returns entry", () => {
    const r = writeSolution(makeEntry(), "empty-password-500", "", tmp)
    expect(existsSync(r.path)).toBe(true)
    expect(r.entry.source_task_ids.length).toBe(1)
    expect(r.path).toMatch(/solutions\/runtime\/empty-password-500\.md$/)
  })
  test("readSolution round-trip", () => {
    writeSolution(makeEntry(), "foo", "# Body", tmp)
    const back = readSolution("runtime", "foo", tmp)
    expect(back?.entry.signature).toBe("a".repeat(64))
    expect(back?.body).toBe("# Body")
  })
})

describe("writeSolution — schema validation", () => {
  test("missing required field throws", () => {
    expect(() =>
      writeSolution(
        { ...makeEntry(), problem: undefined as unknown as string },
        "x",
        "",
        tmp,
      ),
    ).toThrow(/missing required field: problem/)
  })
  test("invalid category throws", () => {
    expect(() =>
      writeSolution(
        { ...makeEntry(), category: "nope" as unknown as SolutionEntry["category"] },
        "x",
        "",
        tmp,
      ),
    ).toThrow(/not in/)
  })
  test("empty tags throws", () => {
    expect(() => writeSolution(makeEntry({ tags: [] }), "x", "", tmp)).toThrow(
      /non-empty array/,
    )
  })
  test("empty source_task_ids throws", () => {
    expect(() =>
      writeSolution(makeEntry({ source_task_ids: [] }), "x", "", tmp),
    ).toThrow(/source_task_ids/)
  })
})

describe("writeSolution — update-existing semantics (Invariant §3)", () => {
  test("second write appends source_task_ids (deduplicated)", () => {
    writeSolution(makeEntry({ source_task_ids: ["T1"] }), "dup", "", tmp)
    const r = writeSolution(
      makeEntry({ source_task_ids: ["T2"] }),
      "dup",
      "",
      tmp,
    )
    expect(r.entry.source_task_ids).toEqual(["T1", "T2"])
    // Re-apply T1 — should not duplicate
    const r2 = writeSolution(
      makeEntry({ source_task_ids: ["T1"] }),
      "dup",
      "",
      tmp,
    )
    expect(r2.entry.source_task_ids).toEqual(["T1", "T2"])
  })

  test("solution and prevention are NOT overwritten on update", () => {
    writeSolution(
      makeEntry({ solution: "ORIGINAL sol", prevention: "ORIGINAL prev" }),
      "preserve",
      "",
      tmp,
    )
    const r = writeSolution(
      makeEntry({ solution: "NEW sol", prevention: "NEW prev" }),
      "preserve",
      "",
      tmp,
    )
    expect(r.entry.solution).toBe("ORIGINAL sol")
    expect(r.entry.prevention).toBe("ORIGINAL prev")
  })

  test("what_didnt_work entries merge (deduplicated by approach)", () => {
    writeSolution(
      makeEntry({
        what_didnt_work: [{ approach: "A", reason_failed: "a" }],
      }),
      "wdw",
      "",
      tmp,
    )
    const r = writeSolution(
      makeEntry({
        what_didnt_work: [
          { approach: "A", reason_failed: "a (different reason text)" },
          { approach: "B", reason_failed: "b" },
        ],
      }),
      "wdw",
      "",
      tmp,
    )
    expect(r.entry.what_didnt_work.length).toBe(2)
    const approaches = r.entry.what_didnt_work.map((w) => w.approach).sort()
    expect(approaches).toEqual(["A", "B"])
  })

  test("times_referenced bumps on update", () => {
    writeSolution(makeEntry({ times_referenced: 0 }), "counter", "", tmp)
    const r2 = writeSolution(makeEntry({ times_referenced: 0 }), "counter", "", tmp)
    expect(r2.entry.times_referenced).toBe(1)
    const r3 = writeSolution(makeEntry({ times_referenced: 0 }), "counter", "", tmp)
    expect(r3.entry.times_referenced).toBe(2)
  })

  test("last_updated refreshes on update", () => {
    writeSolution(
      makeEntry({ last_updated: "2026-04-01T00:00:00Z" }),
      "ts",
      "",
      tmp,
    )
    const r = writeSolution(
      makeEntry({ last_updated: "2026-05-01T00:00:00Z" }),
      "ts",
      "",
      tmp,
    )
    expect(r.entry.last_updated).toBe("2026-05-01T00:00:00Z")
  })
})

describe("listSolutions + solutionPath + deleteSolution", () => {
  test("empty solutions dir → []", () => {
    expect(listSolutions(tmp)).toEqual([])
  })
  test("returns written entries with category/slug/path", () => {
    writeSolution(makeEntry({ category: "auth" }), "login-500", "", tmp)
    writeSolution(makeEntry({ category: "perf", id: "01HX2" }), "slow-query", "", tmp)
    const all = listSolutions(tmp)
    expect(all.length).toBe(2)
    const cats = all.map((s) => s.category).sort()
    expect(cats).toEqual(["auth", "perf"])
  })
  test("skips non-whitelist categories silently", () => {
    // Manually create a rogue category folder
    const { mkdirSync, writeFileSync } = require("node:fs")
    mkdirSync(join(tmp, "solutions", "nope"), { recursive: true })
    writeFileSync(join(tmp, "solutions", "nope", "x.md"), "---\nid: x\n---\n")
    expect(listSolutions(tmp)).toEqual([])
  })
  test("solutionPath shape", () => {
    expect(solutionPath("runtime", "foo", tmp)).toMatch(
      /solutions\/runtime\/foo\.md$/,
    )
  })
  test("deleteSolution throws (Invariant §3 delete-forbidden)", () => {
    expect(() => deleteSolution("runtime", "foo", tmp)).toThrow(StateError)
    expect(() => deleteSolution("runtime", "foo", tmp)).toThrow(/delete-forbidden/)
  })
})
