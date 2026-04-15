import { describe, expect, test } from "bun:test"
import {
  ClassifierRationaleTooGeneric,
  rationaleIsConcrete,
  validateClassifierRationale,
} from "../../src/dispatcher/rationale"

describe("rationaleIsConcrete — positive cases", () => {
  test("file extension", () => {
    expect(rationaleIsConcrete("change in src/foo.ts")).toBe(true)
    expect(rationaleIsConcrete("edit plan/SKILL.md section")).toBe(true)
  })
  test("line number", () => {
    expect(rationaleIsConcrete("foo:42 is broken")).toBe(true)
  })
  test("level reference", () => {
    expect(rationaleIsConcrete("fits L1 profile")).toBe(true)
    expect(rationaleIsConcrete("downstream of L2 change")).toBe(true)
  })
  test("blast-radius count", () => {
    expect(rationaleIsConcrete("touches 3 files across the module")).toBe(true)
    expect(rationaleIsConcrete("adds 2 tests to the suite")).toBe(true)
  })
  test("keyword: code surface", () => {
    expect(rationaleIsConcrete("modifies the classifier function")).toBe(true)
    expect(rationaleIsConcrete("adds a new config flag")).toBe(true)
  })
  test("keyword: change category", () => {
    expect(rationaleIsConcrete("just a typo fix in the README")).toBe(true)
    expect(rationaleIsConcrete("formatting and comment cleanup")).toBe(true)
  })
  test("keyword: risk", () => {
    expect(rationaleIsConcrete("affects auth flow")).toBe(true)
    expect(rationaleIsConcrete("adds a migration for the users table")).toBe(true)
    expect(rationaleIsConcrete("public API surface change")).toBe(true)
  })
  test("case insensitive", () => {
    expect(rationaleIsConcrete("updates AUTH handler")).toBe(true)
    expect(rationaleIsConcrete("adjusts Api response")).toBe(true)
  })
})

describe("rationaleIsConcrete — negative cases", () => {
  test("empty or whitespace", () => {
    expect(rationaleIsConcrete("")).toBe(false)
    expect(rationaleIsConcrete("   ")).toBe(false)
  })
  test("generic prose without concrete ref", () => {
    expect(rationaleIsConcrete("looks simple")).toBe(false)
    expect(rationaleIsConcrete("should be quick")).toBe(false)
    expect(rationaleIsConcrete("seems fine to me")).toBe(false)
    expect(rationaleIsConcrete("minor change")).toBe(false)
  })
  test("non-string input", () => {
    expect(rationaleIsConcrete(null as unknown as string)).toBe(false)
    expect(rationaleIsConcrete(undefined as unknown as string)).toBe(false)
  })
})

describe("validateClassifierRationale", () => {
  test("throws ClassifierRationaleTooGeneric on bare 'looks simple'", () => {
    expect(() => validateClassifierRationale("looks simple")).toThrow(ClassifierRationaleTooGeneric)
  })
  test("throws with helpful suggestion list", () => {
    try {
      validateClassifierRationale("vague")
      throw new Error("should have thrown")
    } catch (e) {
      expect((e as Error).message).toMatch(/Invariant §11/)
      expect((e as Error).message).toMatch(/filename/)
      expect((e as Error).message).toMatch(/level/)
    }
  })
  test("passes on concrete reference", () => {
    expect(() =>
      validateClassifierRationale("adds a new function in foo.ts:25"),
    ).not.toThrow()
  })
  test("truncates long rationale in error message", () => {
    const long = "x".repeat(500)
    try {
      validateClassifierRationale(long)
      throw new Error("should have thrown")
    } catch (e) {
      // Error should contain just the first ~120 chars of the input
      expect((e as Error).message.length).toBeLessThan(500)
    }
  })
})

describe("validateClassifierRationale against classifier-level stub outputs", () => {
  // All stub rationales from src/dispatcher/agents/classifier-level.ts must
  // pass the strict check. If any fails, either update the stub or extend
  // the keyword list — but don't silently weaken the validator.
  const stubRationales = [
    "request mentions architecture/migration/infra keywords; minimum L3 per HARD escalation rule",
    "request involves public API/auth/payment surface; minimum L2 per HARD escalation rule",
    "request is a trivial text-only change (typo/format/comment); fast-path",
    "default classification — single-file or simple change with no keyword hits for L0/L2/L3",
  ]
  for (const r of stubRationales) {
    test(`stub rationale passes: "${r.slice(0, 50)}..."`, () => {
      expect(() => validateClassifierRationale(r)).not.toThrow()
    })
  }
})
