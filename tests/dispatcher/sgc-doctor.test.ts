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

  // ── Repo-hygiene checks (D/E/F/G) — guard R0-class regressions ─────────
  // seedHygiene writes valid versions of all four artifacts under tmp; each
  // test overrides one to its broken form and asserts the check fails.
  function seedHygiene(o: {
    bunfig?: string
    files?: string[]
    vendored?: string
    invariants?: string
  } = {}): void {
    writeFileSync(join(tmp, "bunfig.toml"), o.bunfig ?? '[test]\nroot = "tests"\n', "utf8")
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ name: "x", files: o.files ?? ["src/", "contracts/"] }),
      "utf8",
    )
    // valid vendored component → a real dir under tmp
    mkdirSync(join(tmp, "vendored-x"), { recursive: true })
    const validVendored =
      'schema_version: "0.1"\ncomponents:\n' +
      "  - path: vendored-x\n    upstream: up\n    upstream_ref: unknown\n    vendored_at: abc123\n"
    writeFileSync(join(tmp, "contracts", "vendored-components.yaml"), o.vendored ?? validVendored, "utf8")
    // valid invariant map: cite a test file that exists under tmp
    mkdirSync(join(tmp, "tests", "dispatcher"), { recursive: true })
    writeFileSync(join(tmp, "tests", "dispatcher", "inv.test.ts"), "// stub\n", "utf8")
    let map = 'schema_version: "0.1"\ninvariants:\n'
    for (let n = 1; n <= 13; n++) {
      if (n === 12) {
        map += `  "12":\n    title: procedural one\n    machine_enforced: false\n    tests: []\n`
      } else {
        map += `  "${n}":\n    title: inv ${n}\n    machine_enforced: true\n    tests: ["tests/dispatcher/inv.test.ts"]\n`
      }
    }
    writeFileSync(join(tmp, "contracts", "invariant-enforcement.yaml"), o.invariants ?? map, "utf8")
  }

  const baseManifest =
    `  alpha.test:\n` +
    `    purpose: smoke\n` +
    `    prompt_path: prompts/alpha.md\n` +
    `    inputs:\n      x: string\n` +
    `    outputs:\n      y: string\n` +
    `    scope_tokens: []\n`

  test("H1: all hygiene artifacts valid → hygiene rows ok, no hygiene fail", async () => {
    seed(baseManifest, ["alpha.md"])
    seedHygiene()
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes('root="tests"'))).toBe(true)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes("machine-enforced invariants: 12/13"))).toBe(true)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes("vendored vendored-x"))).toBe(true)
  })

  test("D-fail: bunfig root!=tests → fail (R0 regression guard)", async () => {
    seed(baseManifest, ["alpha.md"])
    seedHygiene({ bunfig: '[test]\nroot = "."\n' })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("bunfig.toml"))).toBe(true)
  })

  test("E-fail: package.json files includes plugins/ → fail", async () => {
    seed(baseManifest, ["alpha.md"])
    seedHygiene({ files: ["src/", "plugins/"] })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("vendored path"))).toBe(true)
  })

  test("F-fail: vendored component missing required field → fail", async () => {
    seed(baseManifest, ["alpha.md"])
    seedHygiene({
      vendored:
        'schema_version: "0.1"\ncomponents:\n  - path: vendored-x\n    upstream: up\n',
    })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("missing field"))).toBe(true)
  })

  test("G-fail: invariant map missing a section → fail", async () => {
    seed(baseManifest, ["alpha.md"])
    seedHygiene({
      invariants: 'schema_version: "0.1"\ninvariants:\n  "1":\n    title: only one\n    machine_enforced: false\n    tests: []\n',
    })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("invariant map missing"))).toBe(true)
  })
})
