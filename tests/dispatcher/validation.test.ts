import { describe, expect, test } from "bun:test"
import {
  OutputShapeMismatch,
  composeArrayObjectValidator,
  type ArrayObjectShape,
} from "../../src/dispatcher/validation"

// Test fixture builder — minimal shape with one of each FieldSpec kind so
// each test can override one field without rebuilding the whole shape.
function makeShape(over: Partial<ArrayObjectShape> = {}): ArrayObjectShape {
  return {
    agentName: "test.agent",
    topField: "items",
    fields: {
      name: { kind: "string" },
    },
    ...over,
  }
}

describe("composeArrayObjectValidator — outer-shape guards", () => {
  test("O1: raw is null / string / undefined / number → throws", () => {
    const validate = composeArrayObjectValidator(makeShape())
    for (const raw of [null, "string", undefined, 42, true]) {
      expect(() => validate(raw as unknown)).toThrow(OutputShapeMismatch)
    }
  })

  test("O2: topField missing or not array → throws", () => {
    const validate = composeArrayObjectValidator(makeShape())
    expect(() => validate({})).toThrow(OutputShapeMismatch)
    expect(() => validate({ items: "string" })).toThrow(OutputShapeMismatch)
    expect(() => validate({ items: { not: "array" } })).toThrow(OutputShapeMismatch)
  })

  test("O3: entry not object (string / null / number) → throws", () => {
    const validate = composeArrayObjectValidator(makeShape())
    expect(() => validate({ items: ["string"] })).toThrow(OutputShapeMismatch)
    expect(() => validate({ items: [null] })).toThrow(OutputShapeMismatch)
    expect(() => validate({ items: [{ name: "ok" }, 42] })).toThrow(OutputShapeMismatch)
  })

  test("O4: empty array is valid; entries=[] returned", () => {
    const validate = composeArrayObjectValidator(makeShape())
    expect(validate({ items: [], warnings: [] })).toEqual({ entries: [], warnings: [] })
  })
})

describe("composeArrayObjectValidator — field specs", () => {
  test("F1: 'string' rejects non-string, accepts string", () => {
    const validate = composeArrayObjectValidator(makeShape())
    expect(() => validate({ items: [{ name: 42 }] })).toThrow(OutputShapeMismatch)
    expect(validate({ items: [{ name: "ok" }] }).entries.length).toBe(1)
  })

  test("F2: 'string-in-set' rejects unknown values + non-strings", () => {
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: { name: { kind: "string-in-set", set: new Set(["alpha", "beta"]) } },
      }),
    )
    expect(() => validate({ items: [{ name: "gamma" }] })).toThrow(OutputShapeMismatch)
    expect(() => validate({ items: [{ name: 42 }] })).toThrow(OutputShapeMismatch)
    expect(validate({ items: [{ name: "alpha" }] }).entries.length).toBe(1)
  })

  test("F3: 'finite-number-range' rejects NaN / Infinity / out-of-range", () => {
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: { score: { kind: "finite-number-range", min: 0, max: 1 } },
      }),
    )
    for (const score of [NaN, Infinity, -Infinity, -0.5, 1.5, "0.5"]) {
      expect(() => validate({ items: [{ score }] })).toThrow(OutputShapeMismatch)
    }
    expect(validate({ items: [{ score: 0.5 }] }).entries.length).toBe(1)
    // Boundary values: min / max inclusive.
    expect(validate({ items: [{ score: 0 }, { score: 1 }] }).entries.length).toBe(2)
  })

  test("F4: 'optional-non-empty-string' — undefined OK, empty / whitespace-only reject, non-string reject", () => {
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: { reason: { kind: "optional-non-empty-string" } },
      }),
    )
    // Field omitted — undefined → OK.
    expect(validate({ items: [{}] }).entries.length).toBe(1)
    // Empty string + whitespace-only → reject.
    expect(() => validate({ items: [{ reason: "" }] })).toThrow(OutputShapeMismatch)
    expect(() => validate({ items: [{ reason: "   " }] })).toThrow(OutputShapeMismatch)
    // Non-string when present → reject.
    expect(() => validate({ items: [{ reason: 42 }] })).toThrow(OutputShapeMismatch)
    // Non-empty present → OK.
    expect(validate({ items: [{ reason: "ok" }] }).entries.length).toBe(1)
  })

  test("F5: 'custom' check delegates to caller — returned string = error", () => {
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: {
          payload: {
            kind: "custom",
            check: (v) =>
              typeof v === "string" && v.startsWith("ok:") ? null : "must start with 'ok:'",
          },
        },
      }),
    )
    expect(() => validate({ items: [{ payload: "fail" }] })).toThrow(OutputShapeMismatch)
    expect(validate({ items: [{ payload: "ok:thing" }] }).entries.length).toBe(1)
  })
})

describe("composeArrayObjectValidator — cross-field validateEntry", () => {
  test("V1: validateEntry runs after fields pass; returned string = throw", () => {
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: {
          score: { kind: "finite-number-range", min: 0, max: 1 },
          reason: { kind: "optional-non-empty-string" },
        },
        validateEntry: (e) => {
          if (e["reason"] !== undefined && (e["score"] as number) < 0.3) {
            return `score must be ≥ 0.3 when reason present, got ${e["score"]}`
          }
          return null
        },
      }),
    )
    // score=0.5 + no reason → OK (validateEntry returns null)
    expect(validate({ items: [{ score: 0.5 }] }).entries.length).toBe(1)
    // score=0.5 + reason → OK
    expect(validate({ items: [{ score: 0.5, reason: "ok" }] }).entries.length).toBe(1)
    // score=0.2 + reason → throw via validateEntry
    expect(() => validate({ items: [{ score: 0.2, reason: "low" }] })).toThrow(
      OutputShapeMismatch,
    )
    // score=0.2 + no reason → OK (no cross-field violation; finite-range allows)
    expect(validate({ items: [{ score: 0.2 }] }).entries.length).toBe(1)
  })

  test("V2: validateEntry sees the entry index it was passed", () => {
    let lastIndex = -1
    const validate = composeArrayObjectValidator(
      makeShape({
        validateEntry: (_e, i) => {
          lastIndex = i
          return null
        },
      }),
    )
    validate({ items: [{ name: "a" }, { name: "b" }, { name: "c" }] })
    expect(lastIndex).toBe(2)
  })
})

describe("composeArrayObjectValidator — dedup + truncate", () => {
  test("D1: dedupBy first-wins + count warning", () => {
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: { name: { kind: "string" }, n: { kind: "finite-number-range", min: 0, max: 10 } },
        dedupBy: "name",
      }),
    )
    const out = validate({
      items: [
        { name: "a", n: 1 },
        { name: "a", n: 2 },  // dup — dropped
        { name: "a", n: 3 },  // dup — dropped
        { name: "b", n: 4 },
      ],
      warnings: [],
    })
    expect(out.entries.length).toBe(2)
    expect(out.entries[0]?.["n"]).toBe(1)  // first wins
    expect(out.entries[1]?.["n"]).toBe(4)
    expect(out.warnings.length).toBe(1)
    expect(out.warnings[0]).toMatch(/duplicate/i)
    expect(out.warnings[0]).toContain("2")  // 2 dedups
    expect(out.warnings[0]).toContain("name")  // field name
  })

  test("D2: maxLength truncates silently after entries collected", () => {
    const validate = composeArrayObjectValidator(makeShape({ maxLength: 3 }))
    const out = validate({
      items: [
        { name: "a" },
        { name: "b" },
        { name: "c" },
        { name: "d" },
        { name: "e" },
      ],
      warnings: [],
    })
    expect(out.entries.length).toBe(3)
    expect(out.entries[0]?.["name"]).toBe("a")
    expect(out.entries[2]?.["name"]).toBe("c")
    expect(out.warnings).toEqual([])
  })

  test("D3: maxLength + dedup interact correctly — truncate counts unique", () => {
    // 6 entries with 3 unique refs (a, b, c, d, e, f); maxLength=3 + dedup-by-name.
    // Pre-fix to L5 in researcher-history: pre-slice(0, maxLength) would drop
    // valid uniques when first N had dups. Post-fix: iterate full input until
    // maxLength unique entries collected.
    const validate = composeArrayObjectValidator(
      makeShape({
        fields: { name: { kind: "string" }, idx: { kind: "finite-number-range", min: 0, max: 10 } },
        dedupBy: "name",
        maxLength: 3,
      }),
    )
    const out = validate({
      items: [
        { name: "a", idx: 0 },
        { name: "a", idx: 1 },  // dup
        { name: "a", idx: 2 },  // dup
        { name: "b", idx: 3 },
        { name: "c", idx: 4 },
        { name: "d", idx: 5 },  // would push past maxLength=3
      ],
      warnings: [],
    })
    expect(out.entries.length).toBe(3)
    expect(out.entries.map((e) => e["name"])).toEqual(["a", "b", "c"])
    expect(out.warnings.length).toBe(1)
    expect(out.warnings[0]).toContain("2")  // 2 dups dropped before "d" was reached
  })

  test("D4: dedup singular noun for count=1", () => {
    const validate = composeArrayObjectValidator(
      makeShape({ dedupBy: "name" }),
    )
    const out = validate({
      items: [{ name: "a" }, { name: "a" }],
      warnings: [],
    })
    expect(out.entries.length).toBe(1)
    expect(out.warnings[0]).toContain("1 duplicate name entry")  // singular
  })
})

describe("composeArrayObjectValidator — warnings passthrough", () => {
  test("W1: LLM warnings passthrough as-is", () => {
    const validate = composeArrayObjectValidator(makeShape())
    const out = validate({
      items: [],
      warnings: ["llm note A", "llm note B"],
    })
    expect(out.warnings).toEqual(["llm note A", "llm note B"])
  })

  test("W2: warnings field non-array or missing → ignored gracefully", () => {
    const validate = composeArrayObjectValidator(makeShape())
    expect(validate({ items: [] }).warnings).toEqual([])
    expect(validate({ items: [], warnings: "not an array" }).warnings).toEqual([])
    expect(validate({ items: [], warnings: null }).warnings).toEqual([])
  })

  test("W3: LLM warning + DSL dedup warning coexist (LLM first, DSL appended)", () => {
    const validate = composeArrayObjectValidator(
      makeShape({ dedupBy: "name" }),
    )
    const out = validate({
      items: [{ name: "a" }, { name: "a" }],
      warnings: ["llm note"],
    })
    expect(out.warnings.length).toBe(2)
    expect(out.warnings[0]).toBe("llm note")
    expect(out.warnings[1]).toMatch(/duplicate/i)
  })

  test("W4: warnings filters non-strings out (defensive)", () => {
    const validate = composeArrayObjectValidator(makeShape())
    const out = validate({
      items: [],
      warnings: ["ok", 42, null, "another"],
    })
    expect(out.warnings).toEqual(["ok", "another"])
  })
})
