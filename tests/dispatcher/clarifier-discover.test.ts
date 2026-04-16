import { describe, expect, test } from "bun:test"
import { clarifierDiscover } from "../../src/dispatcher/agents/clarifier-discover"

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
})
