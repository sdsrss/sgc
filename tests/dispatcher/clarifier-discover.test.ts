import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import {
  clarifierDiscover,
  clarifierDiscoverHeuristic,
} from "../../src/dispatcher/agents/clarifier-discover"
import { getSubagentManifest } from "../../src/dispatcher/schema"

describe("clarifier.discover stub", () => {
  test("empty topic → throws", () => {
    expect(() =>
      clarifierDiscover({ topic: "", current_task_summary: "" }),
    ).toThrow(/topic is required/)
  })

  test("generic topic: produces one goal + baseline constraint/scope/edge/acceptance sets", () => {
    const r = clarifierDiscover({
      topic: "improve the search page",
      current_task_summary: "",
    })
    expect(r.topic).toBe("improve the search page")
    expect(r.goal_question).toMatch(/improve the search page/)
    expect(r.constraint_questions.length).toBeGreaterThanOrEqual(3)
    expect(r.scope_questions.length).toBeGreaterThanOrEqual(2)
    expect(r.edge_case_questions.length).toBeGreaterThanOrEqual(3)
    expect(r.acceptance_questions.length).toBeGreaterThanOrEqual(2)
    expect(r.suggested_next).toContain(`sgc plan "improve the search page"`)
    expect(r.suggested_next).toContain("--motivation")
  })

  test("auth keyword: adds threat-model constraint + token-lifecycle edge", () => {
    const r = clarifierDiscover({
      topic: "add OAuth token refresh for API callers",
      current_task_summary: "",
    })
    const joined = [...r.constraint_questions, ...r.edge_case_questions].join(" ")
    expect(joined).toMatch(/threat model/i)
    expect(joined).toMatch(/expired|revoked|forged/i)
  })

  test("data/migration keyword: adds rollback constraint", () => {
    const r = clarifierDiscover({
      topic: "add migration to rename column in orders table",
      current_task_summary: "",
    })
    const joined = r.constraint_questions.join(" ")
    expect(joined).toMatch(/rollback plan/i)
  })

  test("perf keyword: adds baseline/target constraint", () => {
    const r = clarifierDiscover({
      topic: "optimize the slow dashboard query",
      current_task_summary: "",
    })
    const joined = r.constraint_questions.join(" ")
    expect(joined).toMatch(/baseline/i)
  })

  test("api keyword: adds breaking-change scope question", () => {
    const r = clarifierDiscover({
      topic: "add new field to /users/{id} API response",
      current_task_summary: "",
    })
    const joined = r.scope_questions.join(" ")
    expect(joined).toMatch(/breaking change|consumer|additive/i)
  })

  test("ui keyword: adds entry-point scope + screenshot acceptance", () => {
    const r = clarifierDiscover({
      topic: "add a modal to the settings page",
      current_task_summary: "",
    })
    const scope = r.scope_questions.join(" ")
    const acc = r.acceptance_questions.join(" ")
    expect(scope).toMatch(/entry point|route|existing screen/i)
    expect(acc).toMatch(/screenshot|curl|integration test/i)
  })

  test("current_task_summary: appears in suggested_next as context hint", () => {
    const r = clarifierDiscover({
      topic: "add dashboards",
      current_task_summary: "01HXK9 (L2)",
    })
    expect(r.suggested_next).toContain("01HXK9 (L2)")
  })

  test("topic is trimmed", () => {
    const r = clarifierDiscover({
      topic: "   migrate users to orgs   ",
      current_task_summary: "",
    })
    expect(r.topic).toBe("migrate users to orgs")
  })

  test("U4: clarifierDiscover alias === clarifierDiscoverHeuristic (G.2.a pattern)", () => {
    expect(clarifierDiscover).toBe(clarifierDiscoverHeuristic)
  })
})

describe("prompts/clarifier-discover.md — template structure (P2#7c)", () => {
  const promptPath = resolve(process.cwd(), "prompts/clarifier-discover.md")
  const tmpl = readFileSync(promptPath, "utf8")

  test("U1: required structural markers (Input heading, input_yaml, Anti-patterns)", () => {
    expect(tmpl).toMatch(/(^|\r?\n)##[ \t]+Input[ \t]*\r?\n/)
    expect(tmpl).toContain("<input_yaml/>")
    expect(tmpl).toContain("## Anti-patterns")
    // Delegate boundary — clarifier sits BEFORE planner; must not propose answers
    expect(tmpl).toMatch(/NOT.*answer|NOT.*design|NOT.*implementation/i)
  })

  test("U2: all 6 output fields named in the template", () => {
    for (const field of [
      "topic",
      "goal_question",
      "constraint_questions",
      "scope_questions",
      "edge_case_questions",
      "acceptance_questions",
      "suggested_next",
    ]) {
      expect(tmpl).toContain(field)
    }
    // suggested_next literal shape preserved
    expect(tmpl).toContain('sgc plan')
    expect(tmpl).toContain('--motivation')
  })

  test("U3: banned-vocab list synced (15 terms; 'may break' exempt per lesson #18)", () => {
    for (const term of [
      "could potentially",
      "might affect",
      "various concerns",
      "several issues",
      "generally",
      "overall",
      "seems to",
      "production-ready",
      "comprehensive",
      "robust",
    ]) {
      expect(tmpl).toContain(term)
    }
    for (const term of ["显著", "大幅", "基本上", "大部分情况", "相当不错"]) {
      expect(tmpl).toContain(term)
    }
    expect(tmpl).not.toMatch(/banned.*may break|may break.*banned/i)
  })

  test("U5: hard caps on question-category fan-out named", () => {
    // Anti-pattern #4 — verify each cap phrase exists. Use literal substrings
    // (toContain) to avoid Unicode-comparison quirks in regex matchers.
    expect(tmpl).toContain("Caps are HARD")
    expect(tmpl).toContain("5 constraint")
    expect(tmpl).toContain("3 scope")
    expect(tmpl).toContain("4 edge")
    expect(tmpl).toContain("3 acceptance")
  })
})

describe("clarifier.discover manifest (P2#7c)", () => {
  test("M1: prompt_path declares prompts/clarifier-discover.md", () => {
    const m = getSubagentManifest("clarifier.discover")
    expect(m).toBeDefined()
    expect(m!.prompt_path).toBe("prompts/clarifier-discover.md")
  })

  test("M2: outputs include all 6 question fields with correct DSL forms", () => {
    const m = getSubagentManifest("clarifier.discover")
    expect(m).toBeDefined()
    const outputs = m!.outputs as Record<string, string>
    expect(outputs.topic).toBe("string")
    expect(outputs.goal_question).toBe("string")
    expect(outputs.constraint_questions).toBe("array[string]")
    expect(outputs.scope_questions).toBe("array[string]")
    expect(outputs.edge_case_questions).toBe("array[string]")
    expect(outputs.acceptance_questions).toBe("array[string]")
    expect(outputs.suggested_next).toBe("string")
  })
})
