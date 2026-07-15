// CE-3 (audit fix): end-to-end Compound-Engineering loop contract test.
//
// Each CE link was unit-tested in isolation with hand-built fixtures, but the
// CONTRACT BETWEEN links — that the solution_ref written by writeSolution is
// the same ref recalled by extractPreventions / researcher.history, the same
// ref extracted for application, and the same on-disk file recordApplied /
// recordSurfaced mutate — was untested. A divergence there (e.g. the
// surfaced/applied counters drifting from the corpus) would pass every unit
// suite. This test drives all links against ONE tmp corpus, no LLM
// (SGC_FORCE_INLINE heuristics), and asserts the refs line up at every hop.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  ensureSgcStructure,
  parseFrontmatter,
  solutionPath,
  writeSolution,
} from "../../src/dispatcher/state"
import type { DedupStamp, SolutionEntry } from "../../src/dispatcher/types"
import { extractPreventions } from "../../src/dispatcher/preventions"
import { researcherHistoryHeuristic } from "../../src/dispatcher/agents/researcher-history"
import {
  extractAppliedSolutionRefs,
  recordApplied,
  recordSurfaced,
  selectSurfacedRefs,
} from "../../src/dispatcher/applied-tracker"
import type { FailureMode } from "../../src/dispatcher/agents/planner-adversarial"
import { seedRelatedSpawn } from "../fixtures/related-spawn"

const STAMP: DedupStamp = {
  compound_related_spawn_id: "01CE3STAMP000000000000-compound.related",
  threshold_met_or_forced: true,
  reason: "new_entry",
}

const CATEGORY = "runtime"
const SLUG = "npe-login-auth"
const REF = `${CATEGORY}/${SLUG}`
const TASK_ID = "01HCE3CONSUMER000000000000"

// Solution problem deliberately shares ≥5 keywords with the new task so the
// heuristic recall scores it well above the 0.3 floor (and the 0.5 surfacing
// floor).
const SOLUTION_PROBLEM = "null pointer crash on login authentication flow"
const NEW_TASK = "null pointer crash on login authentication"

function makeEntry(): SolutionEntry {
  return {
    id: "01HCE3SOLUTION00000000000000",
    signature: "c".repeat(64),
    category: CATEGORY,
    problem: SOLUTION_PROBLEM,
    symptoms: ["500 on /login", "stack points to auth.ts:42"],
    what_didnt_work: [
      { approach: "catch-all at router", reason_failed: "hid the real bug" },
    ],
    solution: "Validate password presence before authenticate()",
    prevention: "Add an integration test asserting empty-password returns 400 not 500",
    tags: ["authentication", "null-pointer"],
    first_seen: "2026-04-15T10:00:00Z",
    last_updated: "2026-04-15T10:00:00Z",
    times_referenced: 0,
    source_task_ids: ["01HORIGINTASK0000000000000"],
  }
}

let stateRoot: string
beforeEach(() => {
  stateRoot = mkdtempSync(join(tmpdir(), "sgc-ce3-"))
  ensureSgcStructure(stateRoot)
  // §3 (P2-6): STAMP's cited compound.related spawn must exist on disk.
  seedRelatedSpawn(stateRoot, STAMP.compound_related_spawn_id)
})
afterEach(() => {
  rmSync(stateRoot, { recursive: true, force: true })
})

describe("CE loop end-to-end contract (CE-3 audit fix)", () => {
  test("write → recall → reuse → measure refs line up on one corpus", async () => {
    // ── WRITE ──────────────────────────────────────────────────────────
    const written = writeSolution(makeEntry(), SLUG, STAMP, "", stateRoot)
    expect(written.path).toBe(solutionPath(CATEGORY, SLUG, stateRoot))

    // ── RECALL (preventions → planner.adversarial input) ───────────────
    const preventions = await extractPreventions(NEW_TASK, stateRoot)
    const recalledRefs = preventions.map((p) => p.solution_ref)
    // Contract link 1: the ref recalled is the ref written.
    expect(recalledRefs).toContain(REF)

    // ── RECALL (researcher.history → prior_art, surfaced path) ─────────
    const research = await researcherHistoryHeuristic({ intent_draft: NEW_TASK }, { stateRoot })
    const surfacedRefs = selectSurfacedRefs(research.prior_art)
    // Contract link 2: a strong keyword match clears the 0.5 surfacing floor.
    expect(surfacedRefs).toContain(REF)

    // ── REUSE (adversarial echoes the ref in early_signal) ─────────────
    const failureModes: FailureMode[] = [
      {
        scenario: "regression of the prior null-pointer login crash",
        probability: "medium",
        impact: "high",
        early_signal: `watch for recurrence of ${REF} on the auth path`,
      },
    ]
    const appliedRefs = extractAppliedSolutionRefs(failureModes, preventions)
    // Contract link 3: the ref extracted for application is the recalled ref.
    expect(appliedRefs).toEqual([REF])

    // ── MEASURE (applied_in + surfaced_in writeback) ───────────────────
    const appliedResult = recordApplied(stateRoot, appliedRefs, TASK_ID)
    expect(appliedResult.updated).toEqual([REF])
    const surfacedResult = recordSurfaced(stateRoot, surfacedRefs, TASK_ID)
    expect(surfacedResult.updated).toEqual([REF])

    // Contract link 4: both counters mutated the SAME on-disk file the write
    // created — read it back and confirm the consuming task is recorded once
    // in each array, and content fields are preserved.
    const onDisk = parseFrontmatter<SolutionEntry>(
      readFileSync(solutionPath(CATEGORY, SLUG, stateRoot), "utf8"),
    ).data
    expect(onDisk.applied_in).toEqual([TASK_ID])
    expect(onDisk.surfaced_in).toEqual([TASK_ID])
    expect(onDisk.problem).toBe(SOLUTION_PROBLEM) // content preserved
    expect(onDisk.prevention).toContain("integration test")
  })

  test("a weak (sub-0.5) keyword match recalls but is NOT counted as surfaced", async () => {
    writeSolution(makeEntry(), SLUG, STAMP, "", stateRoot)
    // Only one of the solution's ~5 keywords overlaps → relevance below the
    // 0.5 surfacing floor. researcher recall may still see it (≥0.3), but it
    // must not inflate surfaced_in.
    const research = await researcherHistoryHeuristic(
      { intent_draft: "authentication retry backoff policy and jitter tuning knobs" },
      { stateRoot },
    )
    const surfacedRefs = selectSurfacedRefs(research.prior_art)
    expect(surfacedRefs).not.toContain(REF)
  })
})
