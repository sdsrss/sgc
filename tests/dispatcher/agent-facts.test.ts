import { describe, expect, test } from "bun:test"
import { deriveCliFact, DERIVED_AGENT_IDS, CLI_FACT_MARKER } from "../../src/dispatcher/agent-facts"

describe("deriveCliFact — the four shapes", () => {
  test("covers exactly the 9 in-scope ids", () => {
    expect([...DERIVED_AGENT_IDS].sort()).toEqual([
      "janitor.archive", "reviewer.adversarial", "reviewer.infra",
      "reviewer.maintainability", "reviewer.migration", "reviewer.performance",
      "reviewer.security", "reviewer.spec", "reviewer.tests",
    ])
  })

  test("every clause starts with the marker", () => {
    for (const id of DERIVED_AGENT_IDS) {
      expect(deriveCliFact(id).startsWith(CLI_FACT_MARKER)).toBe(true)
    }
  })

  test("LLM-backed with fallback (security) names the prompt AND the fallback terms", () => {
    const f = deriveCliFact("reviewer.security")
    expect(f).toContain("prompts/reviewer-security.md")
    expect(f).toContain("auth|jwt|token")
    expect(f).toContain("signature|encrypt|decrypt")   // the M4 omission
    expect(f).toContain("medium severity")
  })

  test("term-list matcher (performance) advertises exactly its terms, incl. O(n…)", () => {
    const f = deriveCliFact("reviewer.performance")
    expect(f).toContain("O(n…)")
    expect(f).toContain("debounce|throttle")
    expect(f).not.toContain("prompts/")   // no LLM path
  })

  test("threshold + marker list (maintainability) carries BOTH facts", () => {
    const f = deriveCliFact("reviewer.maintainability")
    expect(f).toContain("120")
    expect(f).toContain("@ts-ignore")
    expect(f).toContain("low severity")
  })

  test("tests names a file-path check, never a keyword matcher, and states its severity like its siblings", () => {
    const f = deriveCliFact("reviewer.tests")
    expect(f).toContain("file-path")
    expect(f).not.toMatch(/keyword/i)
    // Every other fallback clause names its severity (medium/high/low above);
    // omitting it here would be an unexplained asymmetry a reader would notice
    // and this heuristic really does report TESTS_SEVERITY when it fires.
    expect(f).toContain("medium severity")
  })

  test("CLI-never-runs (adversarial, spec, archive) says so and names no matcher", () => {
    for (const id of ["reviewer.adversarial", "reviewer.spec", "janitor.archive"]) {
      const f = deriveCliFact(id)
      expect(f).toMatch(/never (runs|produces)/i)
      expect(f).not.toContain("severity")
    }
  })

  test("an out-of-scope id throws rather than inventing a clause", () => {
    expect(() => deriveCliFact("planner.ceo")).toThrow(/not in the derived set/)
  })
})
