// CE-1 (task 94913CB45F9D4C3E906B3C2C8E#f2) — extractPreventions tests.

import { describe, expect, it, beforeEach, afterEach } from "bun:test"
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  walkSolutionsCorpus,
  type SolutionScan,
} from "../../src/dispatcher/agents/researcher-history"

describe("walkSolutionsCorpus export sanity (CE-1 T1)", () => {
  it("is a callable async function returning an array", async () => {
    const out: SolutionScan[] = await walkSolutionsCorpus(
      "/nonexistent-state-root-for-ce1",
      ["foo"],
    )
    expect(Array.isArray(out)).toBe(true)
    expect(out.length).toBe(0)
  })
})
