// P2-6 regression: the Invariant §3 write gate must verify the stamp's
// provenance, not just its shape.
//
// validateDedupStamp required `compound_related_spawn_id` to be a non-empty
// string — while its own error text said the value "must reference an on-disk
// spawn" and §3 says no solutions write happens without compound.related
// running first. Neither was checked, so a hand-built
// `{compound_related_spawn_id: "x", threshold_met_or_forced: true, reason:
// "new_entry"}` walked straight through the gate that is supposed to be the
// single chokepoint for the knowledge corpus.
//
// The stamp is what makes compound.related's deterministic dedup verdict
// binding (agents/compound.ts keeps that agent permanently heuristic for
// exactly this reason). A stamp nobody has to earn is decoration.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { writeSolution } from "../../src/dispatcher/state"
import { resultPath } from "../../src/dispatcher/spawn-protocol"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-stamp-prov-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

/** Seed a completed compound.related spawn — what runCompound really leaves on disk. */
function seedRelatedSpawn(stateRoot: string, spawnId = "01REALSTAMP00000000000000-compound.related"): string {
  const p = resultPath(spawnId, stateRoot)
  mkdirSync(resolve(p, ".."), { recursive: true })
  writeFileSync(p, "---\nbest_similarity: 0.1\nverdict: new_entry\n---\n", "utf8")
  return spawnId
}

function makeEntry(): SolutionEntry {
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
  }
}

const stamp = (id: string): DedupStamp => ({
  compound_related_spawn_id: id,
  threshold_met_or_forced: true,
  reason: "new_entry",
})

describe("Invariant §3 dedup-stamp provenance (P2-6)", () => {
  test("a stamp citing a spawn that never ran is rejected", () => {
    expect(() => writeSolution(makeEntry(), "slug-a", stamp("01NEVERRAN0000000000000000-compound.related"), "", tmp)).toThrow(
      /DedupStamp|on-disk|compound\.related/i,
    )
  })

  test("the audit's exact forgery — a bare 'x' spawn id — is rejected", () => {
    expect(() => writeSolution(makeEntry(), "slug-b", stamp("x"), "", tmp)).toThrow()
  })

  test("a stamp citing a DIFFERENT agent's real spawn is rejected", () => {
    // A planner spawn is not a dedup verdict, however real its file is.
    seedRelatedSpawn(tmp, "01PLANNERSPAWN000000000000-planner.eng")
    expect(() =>
      writeSolution(makeEntry(), "slug-c", stamp("01PLANNERSPAWN000000000000-planner.eng"), "", tmp),
    ).toThrow()
  })

  test("a stamp from a real completed compound.related spawn is accepted", () => {
    const id = seedRelatedSpawn(tmp)
    const r = writeSolution(makeEntry(), "slug-d", stamp(id), "", tmp)
    expect(r.path).toContain("slug-d")
  })
})
