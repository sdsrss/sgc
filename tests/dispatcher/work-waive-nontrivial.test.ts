// B2 / audit v1.37.0 F2: the TDD-ledger close-gate accepted ANY non-empty
// --waive-red string, so `--waive-red "x"` (or "n/a") waved a feature done with
// no failing-test evidence and no justification — an honor system. B2 requires
// the waive reason to be non-trivial: a real explanation of WHY no RED exists,
// not a placeholder.
//
// This is a purpose-built check, NOT the §11 classifier concreteness gate:
// that gate is tuned for file/line/level references and would false-reject a
// legitimate short reason like "docs-only" while false-accepting "n/a" (which
// matches its path regex). A waive reason needs substance, not a filename.

import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { runPlan } from "../../src/commands/plan"
import { runWork } from "../../src/commands/work"

const LONG_MOTIVATION =
  "We need this change because the existing flow lacks a critical structural element that downstream readers depend on for clarity and discoverability of the underlying behavior contract."

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-waive-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

async function freshTask() {
  return runPlan("add a markdown table to the README", {
    stateRoot: tmp,
    motivation: LONG_MOTIVATION,
    log: () => {},
  })
}

const close = (waiveRed: string, log: (m: string) => void = () => {}) =>
  runWork({ stateRoot: tmp, done: "f1", verifyCommand: "tests pass", waiveRed, log })

describe("--waive-red non-triviality (B2/F2)", () => {
  test("rejects trivial waive reasons (single char + placeholders)", async () => {
    // A rejected close leaves the feature open, so several trivial reasons can
    // be tried against the same task.
    await freshTask()
    await expect(close("x")).rejects.toThrow(/trivial|placeholder|waive/i)
    await expect(close("n/a")).rejects.toThrow(/trivial|placeholder/i)
    await expect(close("todo")).rejects.toThrow(/trivial|placeholder/i)
    await expect(close("none")).rejects.toThrow(/trivial|placeholder/i)
  })

  test("accepts a substantive reason and logs the waive distinctly", async () => {
    await freshTask()
    const logs: string[] = []
    await close("docs-only feature; no failing-test path applies here", (m) => logs.push(m))
    expect(logs.join("\n")).toMatch(/waiv/i)
  })

  test("still accepts the short domain reason 'docs-only'", async () => {
    await freshTask()
    await expect(close("docs-only")).resolves.toBeDefined()
  })

  test("still accepts the short domain reason 'L0 typo'", async () => {
    await freshTask()
    await expect(close("L0 typo")).resolves.toBeDefined()
  })
})
