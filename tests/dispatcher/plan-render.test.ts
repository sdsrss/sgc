import { test, expect } from "bun:test"
import { renderPlanMarkdown } from "../../src/dispatcher/plan-render"
import type { FeatureList } from "../../src/dispatcher/types"

const LIST: FeatureList = {
  features: [
    {
      id: "f1",
      title: "add cursor pagination",
      status: "pending",
      files: { create: ["src/page.ts"], modify: ["src/api.ts"], test: ["tests/page.test.ts"] },
      steps: [
        { kind: "test", text: "write failing test" },
        { kind: "verify-red", text: "run it", run: "bun test", expect: "FAIL" },
        { kind: "guard", text: "guard against off-by-one" },
        { kind: "commit", text: "commit", run: "git commit" },
      ],
      prior_art_refs: ["perf/pagination-cursor"],
    },
    { id: "f2", title: "wire the endpoint", status: "pending", steps: [{ kind: "implement", text: "wire it" }] },
  ],
}

test("renders the sp-style header + one Task block per feature", () => {
  const md = renderPlanMarkdown(LIST, { title: "Pagination", level: "L2" })
  expect(md).toContain("# Pagination Implementation Plan")
  expect(md).toContain("REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development")
  expect(md).toContain("### Task 1: add cursor pagination")
  expect(md).toContain("### Task 2: wire the endpoint")
})

test("no-drift: every task title, file path, and step text from the SoT appears in the render", () => {
  const md = renderPlanMarkdown(LIST, { title: "Pagination", level: "L2" })
  for (const f of LIST.features) {
    expect(md).toContain(f.title)
    for (const p of [...(f.files?.create ?? []), ...(f.files?.modify ?? []), ...(f.files?.test ?? [])]) {
      expect(md).toContain(p)
    }
    for (const s of f.steps ?? []) expect(md).toContain(s.text)
  }
  expect(md).toContain("perf/pagination-cursor")
  expect(md).toContain("bun test")
  expect(md).toContain("FAIL")
})

test("checkbox + kind label per step", () => {
  const md = renderPlanMarkdown(LIST, { title: "P", level: "L2" })
  expect(md).toMatch(/- \[ \] \*\*Step 1 \(test\):\*\* write failing test/)
})
