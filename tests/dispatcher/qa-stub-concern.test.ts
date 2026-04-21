import { describe, expect, test } from "bun:test"
import { qaBrowser } from "../../src/dispatcher/agents/qa-browser"

describe("qa.browser stub default verdict", () => {
  test("stub without browseRunner returns concern (not pass)", async () => {
    const result = await qaBrowser(
      { target_url: "http://localhost:3000", user_flows: ["home", "login"] },
      {},
    )
    expect(result.verdict).toBe("concern")
    expect(result.failed_flows).toHaveLength(1)
    expect(result.failed_flows[0].observed).toMatch(/no browser runner|stub|QA skipped/i)
  })

  test("empty target still returns fail (higher priority)", async () => {
    const result = await qaBrowser({ target_url: "", user_flows: ["home"] }, {})
    expect(result.verdict).toBe("fail")
  })

  test("empty flows still returns concern", async () => {
    const result = await qaBrowser({ target_url: "http://localhost:3000", user_flows: [] }, {})
    expect(result.verdict).toBe("concern")
  })

  test("injected browseRunner returns whatever runner says", async () => {
    const result = await qaBrowser(
      { target_url: "http://localhost:3000", user_flows: ["home"] },
      { browseRunner: async () => ({ verdict: "pass", evidence_refs: ["/s.png"], failed_flows: [] }) },
    )
    expect(result.verdict).toBe("pass")
  })
})
