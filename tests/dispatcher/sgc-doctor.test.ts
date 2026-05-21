import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { _resetCachesForTest } from "../../src/dispatcher/schema"
import { runDoctor } from "../../src/commands/doctor"

let tmp: string
let savedDir: string | undefined

beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-doctor-"))
  savedDir = process.env["SGC_CONTRACTS_DIR"]
  process.env["SGC_CONTRACTS_DIR"] = join(tmp, "contracts")
  _resetCachesForTest()
})

afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  if (savedDir === undefined) delete process.env["SGC_CONTRACTS_DIR"]
  else process.env["SGC_CONTRACTS_DIR"] = savedDir
  _resetCachesForTest()
})

function seed(manifestBody: string, promptFiles: string[]): void {
  const cdir = join(tmp, "contracts")
  mkdirSync(cdir, { recursive: true })
  const yaml = `schema_version: "0.1"\nscope_tokens: {}\npermissions: {}\nsubagents:\n${manifestBody}`
  writeFileSync(join(cdir, "sgc-capabilities.yaml"), yaml, "utf8")
  const pdir = join(tmp, "prompts")
  mkdirSync(pdir, { recursive: true })
  for (const f of promptFiles) writeFileSync(join(pdir, f), "# stub\n", "utf8")
}

describe("sgc doctor", () => {
  test("D1: all prompt_path files present + no orphans + slot-only clean → fail=0", async () => {
    seed(
      `  alpha.test:\n` +
        `    purpose: smoke\n` +
        `    prompt_path: prompts/alpha.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
      ["alpha.md"],
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(r.ok).toBeGreaterThan(0)
  })

  test("D2: declared prompt_path file missing → fail >= 1", async () => {
    seed(
      `  beta.test:\n` +
        `    purpose: missing\n` +
        `    prompt_path: prompts/beta-missing.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
      [],
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(
      r.rows.some(
        (row) =>
          row.severity === "fail" &&
          row.msg.includes("beta.test") &&
          row.msg.includes("FILE MISSING"),
      ),
    ).toBe(true)
  })

  test("D3: orphan prompts/*.md → warn (no manifest references it)", async () => {
    seed(
      `  gamma.test:\n` +
        `    purpose: no prompt_path\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
      ["orphan.md"],
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.warn).toBeGreaterThanOrEqual(1)
    expect(r.fail).toBe(0)
    expect(
      r.rows.some((row) => row.severity === "warn" && row.msg.includes("orphan.md")),
    ).toBe(true)
  })

  test("D4: status=slot-only WITH prompt_path → fail (slots must be null)", async () => {
    seed(
      `  delta.test:\n` +
        `    purpose: bad slot\n` +
        `    prompt_path: prompts/delta.md\n` +
        `    status: slot-only\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
      ["delta.md"],
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(
      r.rows.some(
        (row) =>
          row.severity === "fail" &&
          row.msg.includes("delta.test") &&
          row.msg.includes("slot-only"),
      ),
    ).toBe(true)
  })

  test("D5: status=slot-only with prompt_path: null → ok (canonical pattern)", async () => {
    seed(
      `  epsilon.test:\n` +
        `    purpose: slot-only canonical\n` +
        `    prompt_path: null\n` +
        `    status: slot-only\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
      [],
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(
      r.rows.some(
        (row) =>
          row.severity === "ok" &&
          row.msg.includes("epsilon.test") &&
          row.msg.includes("slot-only"),
      ),
    ).toBe(true)
  })
})
