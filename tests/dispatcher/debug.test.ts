import { describe, expect, test } from "bun:test"
import { deriveInvestigationId } from "../../src/dispatcher/debug"

describe("deriveInvestigationId", () => {
  test("kebabizes symptom + prefixes YYYY-MM-DD-HHMM", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    const id = deriveInvestigationId("Timeout in plan handler!", now)
    expect(id).toBe("2026-05-27-1423-timeout-in-plan-handler")
  })

  test("truncates kebab body to 30 chars + trims trailing dash", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    const id = deriveInvestigationId(
      "An overly long symptom about plan dispatcher and its many timeouts",
      now,
    )
    // body cap 30, then strip trailing -
    expect(id).toMatch(/^2026-05-27-1423-[a-z0-9-]{1,30}$/)
    expect(id).not.toMatch(/-$/)
  })

  test("strips NFD diacritics", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    expect(deriveInvestigationId("Café résumé crash", now)).toBe(
      "2026-05-27-1423-cafe-resume-crash",
    )
  })

  test("falls back to <YYYY-MM-DD>-<HHMM>-debug when kebab empty", () => {
    const now = new Date("2026-05-27T14:23:00.000Z")
    expect(deriveInvestigationId("。。。", now)).toBe("2026-05-27-1423-debug")
    expect(deriveInvestigationId("   !!! ", now)).toBe("2026-05-27-1423-debug")
  })

  test("UTC date parts (deterministic across host TZ)", () => {
    const now = new Date("2026-05-27T23:59:00.000Z")
    expect(deriveInvestigationId("x", now)).toBe("2026-05-27-2359-x")
  })
})
