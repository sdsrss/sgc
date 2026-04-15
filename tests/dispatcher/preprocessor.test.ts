import { describe, test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { preprocess, loadSpec } from "../../src/dispatcher/preprocessor"
import type { CapabilitiesSpec, StateSchemaSpec } from "../../src/dispatcher/types"

const root = join(import.meta.dir, "..", "..")
const capsYaml = readFileSync(join(root, "contracts/sgc-capabilities.yaml"), "utf8")
const stateYaml = readFileSync(join(root, "contracts/sgc-state.schema.yaml"), "utf8")

describe("preprocess — array[T] quoting", () => {
  test("simple array[string]", () => {
    const out = preprocess("x: { type: array[string], min_items: 1 }")
    expect(out).toBe('x: { type: "array[string]", min_items: 1 }')
  })

  test("nested array[{...}]", () => {
    const out = preprocess("x: array[{a, b, c}]")
    expect(out).toBe('x: "array[{a, b, c}]"')
  })

  test("does not match `barray[`", () => {
    const out = preprocess("x: { type: barray[string] }")
    expect(out).toBe("x: { type: barray[string] }")
  })

  test("idempotent on clean YAML", () => {
    const clean = "x:\n  - a\n  - b\nplain: value\n"
    expect(preprocess(clean)).toBe(clean)
  })

  test("idempotent (double-pass)", () => {
    const input = "x: array[string]\ny: { items: [a, b, c?] }"
    const once = preprocess(input)
    const twice = preprocess(once)
    expect(twice).toBe(once)
  })
})

describe("preprocess — optional ? marker in flow-sequence", () => {
  test("solution_ref? inside items list", () => {
    const out = preprocess("items: [source, excerpt, solution_ref?]")
    expect(out).toBe('items: [source, excerpt, "solution_ref?"]')
  })

  test("multiple ? tokens in same sequence", () => {
    const out = preprocess("items: [a?, b, c?]")
    expect(out).toBe('items: ["a?", b, "c?"]')
  })

  test("does not touch ? inside quoted strings", () => {
    const out = preprocess(`purpose: "is this worth doing?"`)
    expect(out).toBe(`purpose: "is this worth doing?"`)
  })

  test("does not touch ? in markdown prose", () => {
    const out = preprocess("description: |\n  Why does this fail?\n")
    expect(out).toBe("description: |\n  Why does this fail?\n")
  })
})

describe("loadSpec — full contract files", () => {
  test("sgc-capabilities.yaml parses", () => {
    const spec = loadSpec<CapabilitiesSpec>(capsYaml)
    expect(spec.schema_version).toBe("0.1")
    expect(spec.scope_tokens).toBeDefined()
    expect(spec.permissions).toBeDefined()
    expect(spec.subagents).toBeDefined()
  })

  test("sgc-capabilities.yaml has expected subagents", () => {
    const spec = loadSpec<CapabilitiesSpec>(capsYaml)
    const names = Object.keys(spec.subagents)
    // 19 subagents per scaffold: 1 classifier + 3 planners + 1 researcher
    // + 7 reviewers + 1 qa + 4 compound + 2 janitors
    expect(names).toContain("classifier.level")
    expect(names).toContain("planner.eng")
    expect(names).toContain("reviewer.correctness")
    expect(names).toContain("reviewer.performance")  // not "perf" — A-phase fix
    expect(names).toContain("janitor.compound")
    expect(names.length).toBe(19)
  })

  test("sgc-capabilities.yaml has expected commands", () => {
    const spec = loadSpec<CapabilitiesSpec>(capsYaml)
    const cmds = Object.keys(spec.permissions)
    expect(cmds).toContain("/plan")
    expect(cmds).toContain("/review")
    expect(cmds).toContain("/qa")
    // /review and /qa must NOT have read:solutions per Invariant §1
    expect(spec.permissions["/review"].solutions ?? []).toEqual([])
    expect(spec.permissions["/qa"].solutions ?? []).toEqual([])
  })

  test("sgc-state.schema.yaml parses", () => {
    const spec = loadSpec<StateSchemaSpec>(stateYaml)
    expect(spec.schema_version).toBe("0.1")
    expect(spec.decisions).toBeDefined()
    expect(spec.progress).toBeDefined()
    expect(spec.solutions).toBeDefined()
    expect(spec.reviews).toBeDefined()
  })
})
