// Eval: classifier.level heuristic limits + LLM routing readiness.
//
// Demonstrates the keyword classifier's semantic blind spot and verifies the
// infrastructure (manifest prompt_path, template structure) is wired so the
// LLM path will work when ANTHROPIC_API_KEY is set.
//
// Two complementary perspectives:
//   1. Heuristic coverage gaps — inputs where keyword matching fails but an
//      LLM would catch the semantic intent (e.g. "add 2FA column to 5M-row
//      users table" → L1 heuristic vs L3 semantic).
//   2. LLM routing readiness — manifest has prompt_path, template has the
//      required ## Input heading and <input_yaml/> placeholder.

import { describe, expect, test } from "bun:test"
import { classifierLevelHeuristic } from "../../src/dispatcher/agents/classifier-level"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("classifier.level: LLM vs heuristic (eval)", () => {
  // ── Heuristic blind spots ──────────────────────────────────────────────

  test("heuristic returns L1 on semantic migration input (no keyword match)", () => {
    // "add 2FA column to 5M-row users table" has NO migration/schema/infra keywords.
    // Heuristic falls through to L1 default.
    const result = classifierLevelHeuristic({
      user_request: "add 2FA column to 5M-row users table",
    })
    expect(result.level).toBe("L1")
    // This demonstrates the heuristic's blind spot — a real LLM would catch
    // the "column to table" semantic as schema migration → L3.
  })

  // ── Heuristic correct classifications ──────────────────────────────────

  test("heuristic correctly escalates explicit migration keyword to L3", () => {
    const result = classifierLevelHeuristic({
      user_request: "run a database migration to add 2FA column",
    })
    expect(result.level).toBe("L3")
    expect(result.rationale).toMatch(/migration|infra/i)
  })

  test("heuristic correctly classifies typo as L0", () => {
    const result = classifierLevelHeuristic({
      user_request: "fix a typo in the README",
    })
    expect(result.level).toBe("L0")
  })

  test("heuristic correctly escalates auth keyword to L2", () => {
    const result = classifierLevelHeuristic({
      user_request: "add JWT authentication to the API endpoint",
    })
    expect(result.level).toBe("L2")
    expect(result.rationale).toMatch(/auth|API/i)
  })

  // ── LLM routing readiness ─────────────────────────────────────────────

  test("prompt_path is set for classifier.level manifest (LLM routing ready)", () => {
    // Verify the manifest has prompt_path so when ANTHROPIC_API_KEY is set,
    // spawn.ts will load the template instead of using synthesized prompt.
    const manifest = getSubagentManifest("classifier.level")
    expect(manifest).toBeDefined()
    expect(manifest!.prompt_path).toBe("prompts/classifier-level.md")
  })

  test("prompt template contains required structure for cache-stable split", () => {
    const template = readFileSync(
      resolve(process.cwd(), "prompts/classifier-level.md"),
      "utf8",
    )
    // Must contain ## Input heading for splitPrompt cache stability
    expect(template).toMatch(/\n## Input\n/)
    // Must contain <input_yaml/> placeholder
    expect(template).toContain("<input_yaml/>")
    // Must contain level definitions
    expect(template).toContain("L0")
    expect(template).toContain("L1")
    expect(template).toContain("L2")
    expect(template).toContain("L3")
  })
})
