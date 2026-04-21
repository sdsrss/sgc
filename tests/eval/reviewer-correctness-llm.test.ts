// Eval: reviewer.correctness heuristic limits + LLM routing readiness.
//
// Demonstrates the heuristic reviewer's semantic blind spot and verifies the
// infrastructure (manifest prompt_path, template structure) is wired so the
// LLM path will work when ANTHROPIC_API_KEY is set.
//
// Two complementary perspectives:
//   1. Heuristic coverage gaps — inputs where marker scanning passes but an
//      LLM would catch the semantic bug (e.g. null deref with no TODO marker).
//   2. LLM routing readiness — manifest has prompt_path, template has the
//      required ## Input heading and <input_yaml/> placeholder.

import { describe, expect, test } from "bun:test"
import { reviewerCorrectnessHeuristic, reviewerCorrectness } from "../../src/dispatcher/agents/reviewer-correctness"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("reviewer.correctness: heuristic vs LLM (eval)", () => {
  // ── Heuristic blind spots ──────────────────────────────────────────────

  test("heuristic passes a diff with a subtle null deref (no TODO marker)", () => {
    // Diff adds code that dereferences potentially null value — a real semantic
    // reviewer would catch this, but the heuristic only looks for TODO/FIXME/XXX
    const diff = [
      "diff --git a/src/api.ts b/src/api.ts",
      "--- a/src/api.ts",
      "+++ b/src/api.ts",
      "@@ -10,6 +10,8 @@",
      "+function getUser(id: string) {",
      "+  const user = db.find(id)",
      "+  return user.name // potential null deref if user not found",
      "+}",
    ].join("\n")

    const result = reviewerCorrectnessHeuristic({ diff, intent: "add getUser function" })
    // Heuristic sees no TODO/FIXME markers → pass
    expect(result.verdict).toBe("pass")
    expect(result.severity).toBe("none")
    expect(result.findings).toHaveLength(0)
    // A real LLM reviewer would flag "user.name" potential null deref as concern
  })

  // ── Heuristic correct detections ──────────────────────────────────────

  test("heuristic catches TODO marker in added lines", () => {
    const diff = [
      "diff --git a/src/api.ts b/src/api.ts",
      "+++ b/src/api.ts",
      "@@ -1,3 +1,5 @@",
      "+// TODO: handle error case",
      "+function getUser() { return null }",
    ].join("\n")

    const result = reviewerCorrectnessHeuristic({ diff, intent: "add getUser" })
    expect(result.verdict).toBe("concern")
    expect(result.findings.length).toBeGreaterThan(0)
    expect(result.findings[0].description).toMatch(/TODO/)
  })

  test("heuristic flags empty diff as concern", () => {
    const result = reviewerCorrectnessHeuristic({ diff: "", intent: "do something" })
    expect(result.verdict).toBe("concern")
    expect(result.findings[0].description).toMatch(/empty/)
  })

  // ── Backward-compat alias ─────────────────────────────────────────────

  test("reviewerCorrectness alias points at reviewerCorrectnessHeuristic", () => {
    expect(reviewerCorrectness).toBe(reviewerCorrectnessHeuristic)
  })

  // ── LLM routing readiness ─────────────────────────────────────────────

  test("prompt_path is set for reviewer.correctness manifest (LLM routing ready)", () => {
    const manifest = getSubagentManifest("reviewer.correctness")
    expect(manifest).toBeDefined()
    expect(manifest!.prompt_path).toBe("prompts/reviewer-correctness.md")
  })

  test("prompt template contains required structure for cache-stable split", () => {
    const template = readFileSync(
      resolve(process.cwd(), "prompts/reviewer-correctness.md"),
      "utf8",
    )
    // Must contain ## Input heading for splitPrompt cache stability
    expect(template).toMatch(/\n## Input\n/)
    // Must contain <input_yaml/> placeholder
    expect(template).toContain("<input_yaml/>")
    // Must contain verdict and severity (reviewer-specific)
    expect(template).toContain("verdict")
    expect(template).toContain("severity")
  })
})
