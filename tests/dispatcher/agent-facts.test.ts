import { describe, expect, test } from "bun:test"
import { deriveCliFact, DERIVED_AGENT_IDS, CLI_FACT_MARKER } from "../../src/dispatcher/agent-facts"
import { cliFactDrift, readAgentMdFiles } from "../../src/commands/doctor"
import { resolve } from "node:path"
const ROOT = resolve(import.meta.dir, "../..")

const md = (id: string, desc: string) => ({
  id, file: `plugins/sgc/agents/${id.replace(".", "/")}.md`,
  text: `---\nname: ${id.replace(".", "-")}\ndescription: ${JSON.stringify(desc)}\n---\n\nbody\n`,
})

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

describe("doctor check (O) — the clause is asserted, not sniffed", () => {
  test("a description ending in the derived clause passes", () => {
    const good = `Does a useful thing. ${deriveCliFact("reviewer.performance")}`
    expect(cliFactDrift([md("reviewer.performance", good)])).toEqual([])
  })

  test("a stale clause fails AND the message carries the exact expected string", () => {
    const stale = `Does a useful thing. ${CLI_FACT_MARKER} something someone typed by hand.`
    const drifts = cliFactDrift([md("reviewer.performance", stale)])
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toContain(deriveCliFact("reviewer.performance"))
  })

  test("a missing clause fails", () => {
    const drifts = cliFactDrift([md("reviewer.performance", "Does a useful thing.")])
    expect(drifts).toHaveLength(1)
    expect(drifts[0]).toMatch(/no `Separate fact for sgc CLI users:` clause/)
  })

  test("a clause that LEADS fails — a routing field must not open with a disclaimer", () => {
    // M5's F1/F2: "NOT IMPLEMENTED" as the leading token is a phrase engineered to
    // stop the router in a field whose only job is to start it.
    const leads = `${deriveCliFact("reviewer.performance")} Does a useful thing.`
    const drifts = cliFactDrift([md("reviewer.performance", leads)])
    expect(drifts.length).toBeGreaterThan(0)
    expect(drifts.join(" ")).toMatch(/capability sentence must come first/)
  })

  test("out-of-scope agent files are ignored, not failed", () => {
    expect(cliFactDrift([md("planner.ceo", "Product gate reviewer.")])).toEqual([])
  })
})
