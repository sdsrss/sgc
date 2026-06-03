import { test, expect } from "bun:test"
import { parsePlanFlags } from "../../src/sgc"

// parsePlanFlags contract: receives the argv tokens AFTER the "plan" subcommand
// (i.e. everything that would follow "sgc plan" on the command line), and returns
// a Partial<PlanOptions>-shaped object for the fields it understands.
// Examples:
//   parsePlanFlags(["do a thing", "--deep"]) → { deep: true }
//   parsePlanFlags(["do a thing"])           → {} (deep is undefined)

test("--deep parses to deep:true", () => {
  const opts = parsePlanFlags(["do a thing", "--deep"])
  expect(opts.deep).toBe(true)
})

test("absent --deep leaves deep undefined", () => {
  const opts = parsePlanFlags(["do a thing"])
  expect(opts.deep).toBeUndefined()
})
