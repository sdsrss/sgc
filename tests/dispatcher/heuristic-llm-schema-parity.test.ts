// P2-3: heuristic ↔ LLM schema parity (deterministic).
//
// The audit flagged that nothing compared the heuristic and LLM modes, so a
// heuristic that drifted from the declared output contract could diverge
// silently from what LLM-mode emits. Semantic agreement is inherently
// non-deterministic (it depends on a live model), but SCHEMA agreement is not:
// both modes' output flows through the SAME validateOutputShape gate
// (spawn.ts:793). This asserts each decision-critical LLM-backed agent's
// heuristic output satisfies its manifest output shape — so the two modes are
// schema-aligned by construction. A heuristic that drops/renames/mistypes a
// declared field trips here with no live call.

import { expect, test } from "bun:test"
import { validateOutputShape } from "../../src/dispatcher/validation"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import { classifierLevelHeuristic } from "../../src/dispatcher/agents/classifier-level"
import { plannerCeoHeuristic } from "../../src/dispatcher/agents/planner-ceo"
import { plannerEngHeuristic } from "../../src/dispatcher/agents/planner-eng"
import { reviewerCorrectnessHeuristic } from "../../src/dispatcher/agents/reviewer-correctness"

const INTENT = "## Intent\nAdd a pagination cursor to GET /orders for the support team.\n"
const DIFF = "diff --git a/orders.ts b/orders.ts\n+export const PAGE_SIZE = 50\n"

const CASES: { name: string; output: () => unknown }[] = [
  {
    name: "classifier.level",
    output: () => classifierLevelHeuristic({ user_request: "rename a local variable in the parser" }),
  },
  { name: "planner.ceo", output: () => plannerCeoHeuristic({ intent_draft: INTENT }) },
  { name: "planner.eng", output: () => plannerEngHeuristic({ intent_draft: INTENT }) },
  {
    name: "reviewer.correctness",
    output: () => reviewerCorrectnessHeuristic({ diff: DIFF, intent: INTENT }),
  },
]

for (const c of CASES) {
  test(`${c.name}: heuristic output conforms to its manifest output shape (heuristic↔LLM schema parity)`, () => {
    const manifest = getSubagentManifest(c.name)
    expect(manifest, `manifest for ${c.name}`).toBeTruthy()
    // Non-vacuous: the manifest must actually declare an output shape, else
    // validateOutputShape is a no-op and this would pass trivially.
    expect(Object.keys((manifest!.outputs ?? {}) as object).length).toBeGreaterThan(0)
    // The SAME gate LLM-mode output must pass — must not throw.
    expect(() => validateOutputShape(manifest!, c.output())).not.toThrow()
  })
}

test("parity gate is real: an undeclared field on an otherwise-valid output is rejected (§9)", () => {
  const manifest = getSubagentManifest("planner.ceo")!
  const valid = plannerCeoHeuristic({ intent_draft: INTENT }) as unknown as Record<string, unknown>
  // Proves validateOutputShape enforces (not a vacuous pass) — drift would be caught.
  expect(() => validateOutputShape(manifest, { ...valid, __undeclared__: 1 })).toThrow()
})
