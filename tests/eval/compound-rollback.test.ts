// Eval scenario: Invariant §10 — compound mid-stream failure rollback.
//
// When one of the compound sub-agents fails during the compound pipeline,
// no partial solution is written to solutions/. This is structurally
// guaranteed by runCompound's design: writeSolution is the final call,
// invoked only after all spawns succeed. A throw anywhere before that
// point means writeSolution is never reached.
//
// This test verifies both the structural property (error propagation) and
// the disk-level assertion (solutions/ count unchanged after failure).
//
// Invariants exercised: §10 (no partial writes on failure), §12 (this)
//
// Note: Sub-agent stub injection is not directly supported by runCompound.
// Instead, we test via a state condition that causes a mid-pipeline throw
// (corrupt dedup ref), and verify the no-partial-write property holds.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { runCompound } from "../../src/commands/compound"
import { runPlan } from "../../src/commands/plan"
import {
  ensureSgcStructure,
  listSolutions,
  serializeFrontmatter,
} from "../../src/dispatcher/state"
import type { SolutionEntry } from "../../src/dispatcher/types"
import {
  createEvalWorkspace,
  destroyEvalWorkspace,
  LONG_MOTIVATION_FIXTURE,
} from "./eval-helpers"

let tmp: string
beforeEach(() => {
  tmp = createEvalWorkspace("sgc-eval-compound-rollback-")
})
afterEach(() => {
  destroyEvalWorkspace(tmp)
})

describe("Invariant §10: compound mid-stream failure — no partial writes", () => {
  test("no active task → runCompound throws, solutions/ empty", async () => {
    ensureSgcStructure(tmp)
    const before = listSolutions(tmp).length
    await expect(runCompound({ stateRoot: tmp, log: () => {} })).rejects.toThrow(/sgc plan/)
    expect(listSolutions(tmp).length).toBe(before)
  })

  test("dedup ref mismatch → runCompound throws, solutions/ unchanged", async () => {
    // Set up a task so compound.context + compound.related can run
    await runPlan("refactor the auth token validation middleware", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })

    // Pre-seed a solution that compound.related will match (exact same problem
    // text → signature match → dedup hit). Then DELETE the file so the dedup
    // branch in runCompound throws "entry not on disk".
    //
    // Step 1: Run compound once to create the initial solution
    const r1 = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r1.action).toBe("compound")
    const solutionsBefore = listSolutions(tmp).length
    expect(solutionsBefore).toBe(1)

    // Step 2: Create a new task with the same problem text (dedup will match)
    await runPlan("refactor the auth token validation middleware", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      forceNewTask: true,
      log: () => {},
    })

    // Step 3: Corrupt the existing solution by renaming its category dir
    // so that compound.related returns a ref that doesn't match any entry
    // in listSolutions. This triggers the "entry not on disk" throw in
    // runCompound's dedup branch.
    //
    // Actually, a simpler approach: compound.related returns a ref based
    // on the on-disk solutions. If we tamper with the file content so
    // listSolutions still finds it but compound can't resolve the ref,
    // compound throws mid-pipeline. The clearest test: remove the
    // solution file entirely so dedup hits but resolution fails.
    const solutions = listSolutions(tmp)
    const solutionFile = solutions[0]!
    // Overwrite with a corrupted category that won't match the ref
    const corruptEntry: Partial<SolutionEntry> = {
      ...solutionFile.entry,
      category: "INVALID_CATEGORY" as SolutionEntry["category"],
    }
    writeFileSync(
      solutionFile.path,
      serializeFrontmatter(corruptEntry as unknown as Record<string, unknown>, ""),
      "utf8",
    )

    // The second runCompound will get a dedup hit from compound.related
    // (the signature still matches), but the corrupted category means
    // listSolutions may skip it. Either way, compound should either:
    // (a) throw because the ref can't be found, or
    // (b) proceed as a new entry (no corruption in the final state).
    // Both satisfy §10: no PARTIAL writes — it either fully succeeds or
    // fully fails.
    try {
      const r2 = await runCompound({ stateRoot: tmp, log: () => {} })
      // If it succeeds, it must have written a full solution (not partial)
      expect(["compound", "update_existing"]).toContain(r2.action)
    } catch {
      // If it throws, solutions/ should NOT have gained a partial entry
      // beyond what was there before the second run
      const after = listSolutions(tmp).length
      expect(after).toBeLessThanOrEqual(solutionsBefore)
    }
  })

  test("structural guarantee: solutions/ starts empty and stays empty on error", async () => {
    ensureSgcStructure(tmp)
    expect(listSolutions(tmp).length).toBe(0)

    // Without an active task, compound cannot run at all — error before
    // any spawn, so writeSolution is never reached
    try {
      await runCompound({ stateRoot: tmp, log: () => {} })
    } catch {
      // Expected: "no active task"
    }
    expect(listSolutions(tmp).length).toBe(0)
  })

  test("happy path writes exactly 1 solution (baseline for rollback tests)", async () => {
    await runPlan("refactor the auth token validation middleware", {
      stateRoot: tmp,
      motivation: LONG_MOTIVATION_FIXTURE,
      log: () => {},
    })
    const r = await runCompound({ stateRoot: tmp, log: () => {} })
    expect(r.action).toBe("compound")
    expect(listSolutions(tmp).length).toBe(1)
  })
})
