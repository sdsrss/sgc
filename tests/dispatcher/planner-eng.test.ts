// planner.eng — unit tests for heuristic + LLM-routing readiness.
//
// Five assertion classes (per spec §5.1):
//   U1 — heuristic byte-compat under SGC_FORCE_INLINE
//   U2 — alias identity (plannerEng === plannerEngHeuristic)
//   U3 — manifest declares prompt_path
//   U4 — prompt template structure (## Input, <input_yaml/>, anti-patterns)
//   U5 — LLM-branch shape + schema-violation (mock anthropicClientFactory)

import { describe, expect, test, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  plannerEng,
  plannerEngHeuristic,
  type PlannerEngOutput,
} from "../../src/dispatcher/agents/planner-eng"
import { getSubagentManifest } from "../../src/dispatcher/schema"

describe("planner.eng — unit", () => {
  test("U1a: heuristic returns approve + empty risks for short input", () => {
    const out = plannerEngHeuristic({ intent_draft: "fix bug" })
    expect(out.verdict).toBe("approve")
    expect(out.concerns).toEqual([
      "intent_draft is very short; consider clarifying motivation",
    ])
    expect(out.structural_risks).toEqual([])
  })

  test("U1b: heuristic returns approve + no concerns for long input", () => {
    const out = plannerEngHeuristic({
      intent_draft:
        "refactor the dispatcher's spawn function to add structured logging plus a retry-with-timeout outer loop, threading the logger through resolveMode and validating Invariant §13 Tier-2 emission",
    })
    expect(out.verdict).toBe("approve")
    expect(out.concerns).toEqual([])
    expect(out.structural_risks).toEqual([])
  })

  test("U2: plannerEng alias equals plannerEngHeuristic", () => {
    expect(plannerEng).toBe(plannerEngHeuristic)
  })
})
