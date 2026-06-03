import { test, expect, describe } from "bun:test"
import {
  reviewerTests,
  reviewerMaintainability,
} from "../../src/dispatcher/agents/reviewer-quality"

describe("reviewer.tests heuristic", () => {
  test("source file changed with no test file → concern", () => {
    const diff = "diff --git a/src/foo.ts b/src/foo.ts\n+++ b/src/foo.ts\n+export function foo() { return 1 }\n"
    const r = reviewerTests({ diff, intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.findings.length).toBe(1)
  })
  test("source + test file both changed → pass", () => {
    const diff =
      "diff --git a/src/foo.ts b/src/foo.ts\n+++ b/src/foo.ts\n+export function foo() { return 1 }\n" +
      "diff --git a/tests/foo.test.ts b/tests/foo.test.ts\n+++ b/tests/foo.test.ts\n+test('foo', () => {})\n"
    expect(reviewerTests({ diff, intent: "" }).verdict).toBe("pass")
  })
  test("test-only diff → pass", () => {
    const diff = "diff --git a/tests/foo.test.ts b/tests/foo.test.ts\n+++ b/tests/foo.test.ts\n+test('x', () => {})\n"
    expect(reviewerTests({ diff, intent: "" }).verdict).toBe("pass")
  })
  test("empty diff → pass", () => {
    expect(reviewerTests({ diff: "", intent: "" }).verdict).toBe("pass")
  })
  test("docs-only diff (no source) → pass", () => {
    const diff = "diff --git a/README.md b/README.md\n+++ b/README.md\n+# heading\n"
    expect(reviewerTests({ diff, intent: "" }).verdict).toBe("pass")
  })
})

describe("reviewer.maintainability heuristic", () => {
  test("added line > 120 chars → concern", () => {
    const longLine = "+const x = " + "a".repeat(130)
    const r = reviewerMaintainability({ diff: longLine + "\n", intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.severity).toBe("low")
    expect(r.findings.length).toBeGreaterThan(0)
  })
  test("added TODO / @ts-ignore / as any → concern", () => {
    const diff = "+  // TODO fix this\n+  const y = z as any\n+  // @ts-ignore\n"
    const r = reviewerMaintainability({ diff, intent: "" })
    expect(r.verdict).toBe("concern")
    expect(r.findings.length).toBe(3)
  })
  test("clean short diff → pass", () => {
    const diff = "+const a = 1\n+const b = 2\n"
    expect(reviewerMaintainability({ diff, intent: "" }).verdict).toBe("pass")
  })
  test("markers on removed lines are not flagged", () => {
    const diff = "-// TODO old\n+const clean = 1\n"
    expect(reviewerMaintainability({ diff, intent: "" }).verdict).toBe("pass")
  })
})
