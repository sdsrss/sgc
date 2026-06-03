import { test, expect } from "bun:test"
import {
  plannerDecomposeHeuristic,
  type DecomposeInput,
} from "../../src/dispatcher/agents/planner-decompose"

test("heuristic returns one coarse task with the canonical TDD steps", () => {
  const out = plannerDecomposeHeuristic({ intent_draft: "add cursor pagination to GET /orders" })
  expect(out.tasks).toHaveLength(1)
  const t = out.tasks[0]!
  expect(t.id).toBe("f1")
  expect(t.title).toContain("cursor pagination")
  const kinds = t.steps.map((s) => s.kind)
  expect(kinds).toEqual(["test", "verify-red", "implement", "verify-green", "commit"])
})

test("reuse-in: each failure mode adds a guard step before commit", () => {
  const input: DecomposeInput = {
    intent_draft: "migrate the orders table",
    failure_modes: [
      { scenario: "data loss on migration", probability: "medium", impact: "high", early_signal: "row count drops" },
    ],
  }
  const out = plannerDecomposeHeuristic(input)
  const steps = out.tasks[0]!.steps
  const guards = steps.filter((s) => s.kind === "guard")
  expect(guards).toHaveLength(1)
  expect(guards[0]!.text).toContain("data loss on migration")
  expect(steps[steps.length - 1]!.kind).toBe("commit")
})

test("reuse-in: prior_art solution_refs flow into prior_art_refs", () => {
  const out = plannerDecomposeHeuristic({
    intent_draft: "add pagination",
    prior_art: [
      { solution_ref: "perf/pagination-cursor", relevance_score: 0.8, excerpt: "..." },
      { solution_ref: "api/orders-list", relevance_score: 0.6, excerpt: "..." },
    ],
  })
  expect(out.tasks[0]!.prior_art_refs).toEqual(["perf/pagination-cursor", "api/orders-list"])
})

test("empty intent does not throw and yields a placeholder title", () => {
  const out = plannerDecomposeHeuristic({ intent_draft: "" })
  expect(out.tasks[0]!.title.length).toBeGreaterThan(0)
})
