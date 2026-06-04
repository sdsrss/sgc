import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { _resetCachesForTest } from "../../src/dispatcher/schema"
import { runDoctor } from "../../src/commands/doctor"
import { computeMetricsLive, serializeBaseline } from "../../src/dispatcher/metrics"

// Write a metrics baseline that matches the just-seeded source so the doctor
// (K) drift check stays green — mirrors how each source-only check (D-J) gets a
// valid artifact in roots that assert fail===0. computeMetricsLive needs
// package.json + invariant-enforcement.yaml + sgc-capabilities.yaml; backfill
// the first two when a caller (e.g. seedParity) didn't write them.
function seedMetricsBaseline(root: string): void {
  if (!existsSync(join(root, "package.json"))) {
    writeFileSync(join(root, "package.json"), JSON.stringify({ name: "x", engines: { node: ">=18" } }), "utf8")
  }
  const iePath = join(root, "contracts", "invariant-enforcement.yaml")
  if (!existsSync(iePath)) {
    mkdirSync(join(root, "contracts"), { recursive: true })
    // Cite a real stub test file so check (G) sees machine-enforced invariants
    // as covered (tests: []) on a machine_enforced invariant is a (G) fail).
    mkdirSync(join(root, "tests", "dispatcher"), { recursive: true })
    writeFileSync(join(root, "tests", "dispatcher", "inv.test.ts"), "// stub\n", "utf8")
    let map = 'schema_version: "0.1"\ninvariants:\n'
    for (let n = 1; n <= 13; n++) {
      if (n === 12) {
        map += `  "12":\n    title: inv 12\n    machine_enforced: false\n    tests: []\n`
      } else {
        map += `  "${n}":\n    title: inv ${n}\n    machine_enforced: true\n    tests: ["tests/dispatcher/inv.test.ts"]\n`
      }
    }
    writeFileSync(iePath, map, "utf8")
  }
  mkdirSync(join(root, "metrics"), { recursive: true })
  writeFileSync(join(root, "metrics", "metrics-baseline.yaml"), serializeBaseline(computeMetricsLive(root)), "utf8")
}

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

function seed(manifestBody: string, _unusedPromptFiles?: string[]): void {
  const cdir = join(tmp, "contracts")
  mkdirSync(cdir, { recursive: true })
  const yaml = `schema_version: "0.1"\nscope_tokens: {}\npermissions: {}\nsubagents:\n${manifestBody}`
  writeFileSync(join(cdir, "sgc-capabilities.yaml"), yaml, "utf8")
  // Note: check (B) now iterates embedded keys, not disk files.
  // Disk prompts/ dir is no longer read by doctor — no need to create it.
}

describe("sgc doctor", () => {
  // D1-D5 use real embedded prompt keys (prompts/planner-eng.md etc.) because
  // check (A) now looks up EMBEDDED_PROMPTS, not disk files.
  test("D1: all prompt_path files present + no orphans + slot-only clean → fail=0", async () => {
    // Use a real embedded key so check (A) resolves present=true.
    // Seed ALL embedded keys as manifests so check (B) has no orphans.
    seed(
      `  alpha.test:\n` +
        `    purpose: smoke\n` +
        `    prompt_path: prompts/planner-eng.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha2.test:\n` +
        `    purpose: smoke2\n` +
        `    prompt_path: prompts/planner-adversarial.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha3.test:\n` +
        `    purpose: smoke3\n` +
        `    prompt_path: prompts/planner-ceo.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha4.test:\n` +
        `    purpose: smoke4\n` +
        `    prompt_path: prompts/clarifier-discover.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha5.test:\n` +
        `    purpose: smoke5\n` +
        `    prompt_path: prompts/classifier-level.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha6.test:\n` +
        `    purpose: smoke6\n` +
        `    prompt_path: prompts/compound-context.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha7.test:\n` +
        `    purpose: smoke7\n` +
        `    prompt_path: prompts/compound-prevention.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha8.test:\n` +
        `    purpose: smoke8\n` +
        `    prompt_path: prompts/compound-solution.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha9.test:\n` +
        `    purpose: smoke9\n` +
        `    prompt_path: prompts/researcher-history.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n` +
        `  alpha10.test:\n` +
        `    purpose: smoke10\n` +
        `    prompt_path: prompts/reviewer-correctness.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(r.ok).toBeGreaterThan(0)
  })

  test("D2: declared prompt_path NOT in embedded → fail >= 1", async () => {
    // Use a prompt_path that is NOT in EMBEDDED_PROMPTS to trigger the NOT EMBEDDED fail.
    seed(
      `  beta.test:\n` +
        `    purpose: missing\n` +
        `    prompt_path: prompts/beta-not-embedded.md\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(
      r.rows.some(
        (row) =>
          row.severity === "fail" &&
          row.msg.includes("beta.test") &&
          row.msg.includes("NOT EMBEDDED"),
      ),
    ).toBe(true)
  })

  test("D3: embedded prompt key not declared by any manifest → warn (orphan)", async () => {
    // gamma.test has no prompt_path; all embedded keys are therefore orphans.
    seed(
      `  gamma.test:\n` +
        `    purpose: no prompt_path\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.warn).toBeGreaterThanOrEqual(1)
    expect(r.fail).toBe(0)
    // planner-eng.md is an embedded key that will be orphaned (no manifest references it)
    expect(
      r.rows.some((row) => row.severity === "warn" && row.msg.includes("planner-eng.md")),
    ).toBe(true)
  })

  test("D4: status=slot-only WITH non-embedded prompt_path → fail (A and C both fail)", async () => {
    // prompt_path is not in embedded → fail from check (A); slot-only → fail from check (C)
    seed(
      `  delta.test:\n` +
        `    purpose: bad slot\n` +
        `    prompt_path: prompts/delta-not-embedded.md\n` +
        `    status: slot-only\n` +
        `    inputs:\n      x: string\n` +
        `    outputs:\n      y: string\n` +
        `    scope_tokens: []\n`,
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
    )
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    // slot-only check passes; embedded orphan warns are ok (no fail)
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
  // IMPORTANT: also creates src/sgc.ts stub so hasSource=true, enabling D/E/F/G/H/I.
  function seedHygiene(o: {
    bunfig?: string
    files?: string[]
    vendored?: string
    invariants?: string
    invariantsMd?: string
  } = {}): void {
    // Stub src/sgc.ts so hasSource=true — D/E/F/G/H/I checks run (not skipped)
    mkdirSync(join(tmp, "src"), { recursive: true })
    writeFileSync(join(tmp, "src", "sgc.ts"), "// stub\n", "utf8")
    writeFileSync(join(tmp, "bunfig.toml"), o.bunfig ?? '[test]\nroot = "tests"\n', "utf8")
    writeFileSync(
      join(tmp, "package.json"),
      JSON.stringify({ name: "x", files: o.files ?? ["plugins/sgc/bin/sgc.mjs", "src/", "contracts/"] }),
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
    let invMd = "# SGC System Invariants\n"
    for (let n = 1; n <= 13; n++) invMd += `## §${n}. inv ${n}\n\nbody\n\n`
    writeFileSync(join(tmp, "contracts", "sgc-invariants.md"), o.invariantsMd ?? invMd, "utf8")
    // Baseline written last so it matches the seeded source → (K) drift check ok.
    seedMetricsBaseline(tmp)
  }

  // baseManifest uses a real embedded key (prompts/planner-eng.md) so check (A) passes.
  // Tests that call seed(baseManifest, ...) will have exactly one declared prompt
  // while the other 9 embedded keys appear as orphan-warns (no fail).
  const baseManifest =
    `  alpha.test:\n` +
    `    purpose: smoke\n` +
    `    prompt_path: prompts/planner-eng.md\n` +
    `    inputs:\n      x: string\n` +
    `    outputs:\n      y: string\n` +
    `    scope_tokens: []\n`

  test("H1: all hygiene artifacts valid → hygiene rows ok, no hygiene fail", async () => {
    seed(baseManifest)
    seedHygiene()
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes('root="tests"'))).toBe(true)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes("machine-enforced invariants: 12/13"))).toBe(true)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes("vendored vendored-x"))).toBe(true)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes("both sources define"))).toBe(true)
  })

  test("D-fail: bunfig root!=tests → fail (R0 regression guard)", async () => {
    seed(baseManifest)
    seedHygiene({ bunfig: '[test]\nroot = "."\n' })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("bunfig.toml"))).toBe(true)
  })

  test("E-fail: package.json files includes plugins/ → fail", async () => {
    seed(baseManifest)
    seedHygiene({ files: ["src/", "plugins/"] })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("vendored path"))).toBe(true)
  })

  test("E-ok: package.json files includes explicit bundle file plugins/sgc/bin/sgc.mjs → ok", async () => {
    seed(baseManifest)
    seedHygiene({ files: ["plugins/sgc/bin/sgc.mjs", "src/", "contracts/"] })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("vendored path"))).toBe(false)
    expect(r.rows.some((row) => row.severity === "ok" && row.msg.includes("excludes plugins/"))).toBe(true)
  })

  test("E-fail: explicit browse file (extension, non-bin) plugins/sgc/browse/src/cli.ts → fail", async () => {
    seed(baseManifest)
    // Only plugins/sgc/bin/ files are whitelisted; an extensioned browse file
    // must still be flagged (the entire vendored browse tree has extensions).
    seedHygiene({ files: ["plugins/sgc/bin/sgc.mjs", "plugins/sgc/browse/src/cli.ts", "src/"] })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    const leakRow = r.rows.find((row) => row.severity === "fail" && row.msg.includes("vendored path"))
    expect(leakRow).toBeDefined()
    expect(leakRow!.msg).toContain("plugins/sgc/browse/src/cli.ts")
    expect(leakRow!.msg).not.toContain("plugins/sgc/bin/sgc.mjs")
  })

  test("F-fail: vendored component missing required field → fail", async () => {
    seed(baseManifest)
    seedHygiene({
      vendored:
        'schema_version: "0.1"\ncomponents:\n  - path: vendored-x\n    upstream: up\n',
    })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("missing field"))).toBe(true)
  })

  test("G-fail: invariant map missing a section → fail", async () => {
    seed(baseManifest)
    seedHygiene({
      invariants: 'schema_version: "0.1"\ninvariants:\n  "1":\n    title: only one\n    machine_enforced: false\n    tests: []\n',
    })
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(r.rows.some((row) => row.severity === "fail" && row.msg.includes("invariant map missing"))).toBe(true)
  })

  // ── (H) slash-command ↔ CLI-subcommand parity ─────────────────────────
  // seedParity writes a fixture src/sgc.ts (subCommands block) + the
  // plugins/sgc/commands/*.md slash files, so we can exercise the parity
  // logic without depending on the live repo layout.
  function seedParity(cliNames: string[], slashFiles: string[]): void {
    const srcDir = join(tmp, "src")
    mkdirSync(srcDir, { recursive: true })
    const block = cliNames.map((n) => `    "${n}": () => ${n.replace(/-/g, "_")},`).join("\n")
    writeFileSync(
      join(srcDir, "sgc.ts"),
      `const main = defineCommand({\n  subCommands: {\n${block}\n  },\n})\n`,
      "utf8",
    )
    const cdir = join(tmp, "plugins", "sgc", "commands")
    mkdirSync(cdir, { recursive: true })
    for (const f of slashFiles) writeFileSync(join(cdir, `${f}.md`), "# stub\n", "utf8")
    // Baseline so the (K) drift check stays ok in roots asserting fail===0.
    seedMetricsBaseline(tmp)
  }

  test("H-parity1: every non-exempt CLI subcommand has a slash .md → ok", async () => {
    seed(baseManifest)
    seedParity(["plan", "work"], ["plan", "work"])
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(
      r.rows.some((row) => row.severity === "ok" && row.msg.includes("plan") && row.msg.includes("slash")),
    ).toBe(true)
  })

  test("H-parity2: non-exempt CLI subcommand missing its slash .md → fail", async () => {
    seed(baseManifest)
    seedParity(["plan", "reflect"], ["plan"]) // reflect has no .md
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(
      r.rows.some(
        (row) => row.severity === "fail" && row.msg.includes("reflect") && row.msg.includes("slash"),
      ),
    ).toBe(true)
  })

  test("H-parity3: exempt CLI-only subcommand (canary) needs no slash .md → ok", async () => {
    seed(baseManifest)
    seedParity(["plan", "canary", "watch-ci-failure", "land"], ["plan"])
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(
      r.rows.some((row) => row.severity === "ok" && row.msg.includes("canary") && row.msg.includes("CLI-only")),
    ).toBe(true)
  })

  test("H-parity4: orphan slash .md with no CLI subcommand → warn", async () => {
    seed(baseManifest)
    seedParity(["plan"], ["plan", "ghost"]) // ghost.md has no CLI subcommand
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBe(0)
    expect(
      r.rows.some((row) => row.severity === "warn" && row.msg.includes("ghost")),
    ).toBe(true)
  })

  test("I-fail: sgc-invariants.md missing a § that the yaml map has → fail", async () => {
    seed(baseManifest)
    let md12 = "# SGC System Invariants\n"
    for (let n = 1; n <= 12; n++) md12 += `## §${n}. inv ${n}\n\nbody\n\n`
    seedHygiene({ invariantsMd: md12 }) // yaml map still defines §1–13
    const r = await runDoctor({ log: () => {}, repoRoot: tmp })
    expect(r.fail).toBeGreaterThanOrEqual(1)
    expect(
      r.rows.some((row) => row.severity === "fail" && row.msg.includes("invariant sources disagree")),
    ).toBe(true)
  })

})

// ── Bundle context: no source checkout ──────────────────────────────────────
// This test must live OUTSIDE the describe block so it is not affected by the
// describe's beforeEach which sets SGC_CONTRACTS_DIR to a nonexistent tmp dir.
// With a bogus root (no src/, no prompts/, no bunfig.toml, etc.) doctor must:
//   • resolve (A)/(B) from EMBEDDED_PROMPTS (embedded keys include planner-eng.md)
//   • skip every source-only check (D/E/F/G/H/I) with an info row
//   • report fail=0 (no hard failures from missing source)
test("doctor (B) prompts check uses embedded keys, not readdirSync", async () => {
  // The global beforeEach sets SGC_CONTRACTS_DIR to a nonexistent tmp dir so that
  // other tests can inject fixture contracts. For this test we need the embedded
  // fallback path (no env override, no disk files) — clear it here and reset cache.
  delete process.env["SGC_CONTRACTS_DIR"]
  _resetCachesForTest()

  const lines: string[] = []
  const report = await runDoctor({ log: (m) => lines.push(m), repoRoot: "/nonexistent-root-xyz" })
  expect(lines.some((l) => l.includes("planner-eng.md"))).toBe(true)
  expect(report.fail).toBe(0)

  // ── Each source-only check (D/E/F/G/H/I) MUST emit its skip row ───────────
  // A `fail===0` assertion alone wouldn't catch a deleted hasSource guard: with
  // the bogus root the unguarded check would emit a `warn` (missing file), not a
  // `fail`, so fail===0 still passes. Asserting the exact skip-row text means
  // removing ANY single guard flips that check from the skip row to a warn row,
  // failing one of these matchers.
  const skipRow = (snippet: string): boolean =>
    lines.some((l) => l.includes(snippet) && /skipped \(no source checkout/.test(l))
  expect(skipRow("bunfig.toml root")).toBe(true) // (D)
  expect(skipRow("package.json files")).toBe(true) // (E)
  expect(skipRow("vendored-components.yaml")).toBe(true) // (F)
  expect(skipRow("invariant-enforcement.yaml")).toBe(true) // (G)
  expect(skipRow("slash↔CLI parity")).toBe(true) // (H)
  expect(skipRow("invariant-source parity")).toBe(true) // (I)
  expect(skipRow("bundle-hash parity")).toBe(true) // (J)
  expect(skipRow("metrics baseline")).toBe(true) // (K)

  // All eight skips land as `ok` rows, never warn/fail — so the bogus root yields
  // zero warnings beyond embedded-prompt orphans and zero hard failures.
  const skipRowCount = lines.filter((l) => /skipped \(no source checkout/.test(l)).length
  expect(skipRowCount).toBe(8)
})
