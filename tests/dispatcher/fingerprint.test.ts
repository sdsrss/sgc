import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  clearFingerprintCache,
  loadSolutionsFingerprints,
  scanOutputForLeak,
} from "../../src/dispatcher/fingerprint"
import { spawn, SpawnError } from "../../src/dispatcher/spawn"
import { ensureSgcStructure } from "../../src/dispatcher/state"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-fp-"))
  clearFingerprintCache()
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
  clearFingerprintCache()
})

function seedSolution(stateRoot: string, category: string, slug: string, body: string): void {
  const dir = join(stateRoot, "solutions", category)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${slug}.md`), body, "utf8")
}

describe("loadSolutionsFingerprints", () => {
  test("F1: missing solutions/ → empty set", () => {
    expect(loadSolutionsFingerprints(tmp).size).toBe(0)
  })

  test("F2: solutions/ with one file → fingerprints non-empty", () => {
    seedSolution(
      tmp,
      "runtime",
      "leaky",
      "# Title\n\nA detailed paragraph that documents a specific failure mode and its root cause.\n\nAnother prose line that should be fingerprintable here too.\n",
    )
    const fp = loadSolutionsFingerprints(tmp)
    expect(fp.size).toBeGreaterThanOrEqual(2)
  })

  test("F3: short / markdown-structure lines are filtered out", () => {
    seedSolution(
      tmp,
      "runtime",
      "structure",
      "# Heading\n## Subheading\n- bullet\n> quote\n| col1 | col2 |\nshort\n",
    )
    expect(loadSolutionsFingerprints(tmp).size).toBe(0)
  })
})

describe("scanOutputForLeak", () => {
  const distinctive =
    "A detailed paragraph that documents a specific failure mode and its root cause."

  beforeEach(() => {
    seedSolution(tmp, "runtime", "leaky", `# Title\n\n${distinctive}\n`)
  })

  test("S1: reviewer.correctness output with leaked line → hit", () => {
    const fp = loadSolutionsFingerprints(tmp)
    const out = {
      verdict: "concern",
      severity: "medium",
      findings: [{ location: "x.ts:1", description: distinctive }],
    }
    const r = scanOutputForLeak("reviewer.correctness", out, fp)
    expect(r.hit).toBe(true)
    expect(r.count).toBe(1)
    expect(r.samples[0]).toContain("documents a specific failure mode")
  })

  test("S2: planner.eng with same output → NO hit (planner not gated)", () => {
    const fp = loadSolutionsFingerprints(tmp)
    const r = scanOutputForLeak("planner.eng", { concerns: [distinctive] }, fp)
    expect(r.hit).toBe(false)
  })

  test("S3: reviewer.correctness with clean output → no hit", () => {
    const fp = loadSolutionsFingerprints(tmp)
    const r = scanOutputForLeak(
      "reviewer.correctness",
      {
        verdict: "pass",
        severity: "none",
        findings: [{ location: "x.ts:1", description: "looks fine to me" }],
      },
      fp,
    )
    expect(r.hit).toBe(false)
  })

  test("S4: empty fingerprints → no hit even with leaky reviewer output", () => {
    const r = scanOutputForLeak(
      "reviewer.correctness",
      { findings: [{ description: distinctive }] },
      new Set(),
    )
    expect(r.hit).toBe(false)
  })

  test("S5: qa.browser with leaked line → hit (qa.* also gated)", () => {
    const fp = loadSolutionsFingerprints(tmp)
    const r = scanOutputForLeak(
      "qa.browser",
      {
        verdict: "fail",
        evidence_refs: [],
        failed_flows: [{ flow: "checkout", step: "submit", observed: distinctive }],
      },
      fp,
    )
    expect(r.hit).toBe(true)
  })

  test("S6: case/whitespace-normalized match (LLM might recase or re-space)", () => {
    const fp = loadSolutionsFingerprints(tmp)
    const recased =
      "A DETAILED PARAGRAPH    that documents a SPECIFIC failure mode and its root cause."
    const r = scanOutputForLeak(
      "reviewer.correctness",
      { findings: [{ description: recased }] },
      fp,
    )
    expect(r.hit).toBe(true)
  })
})

describe("spawn — P2 output leak integration", () => {
  test("S7: reviewer.correctness inline stub emitting solutions content → throws SpawnError", async () => {
    const distinctive =
      "Another distinctive prose sentence with enough characters to fingerprint."
    seedSolution(tmp, "runtime", "leaky", `# Title\n\n${distinctive}\n`)
    ensureSgcStructure(tmp)
    await expect(
      spawn(
        "reviewer.correctness",
        { diff: "+ const x = 1", intent: "# Title\n\nMotivation." },
        {
          stateRoot: tmp,
          inlineStub: () => ({
            verdict: "concern",
            severity: "medium",
            findings: [{ location: "x.ts:1", description: distinctive }],
          }),
        },
      ),
    ).rejects.toThrow(SpawnError)
    await expect(
      spawn(
        "reviewer.correctness",
        { diff: "+ const x = 1", intent: "# Title\n\nMotivation." },
        {
          stateRoot: tmp,
          inlineStub: () => ({
            verdict: "concern",
            severity: "medium",
            findings: [{ location: "x.ts:1", description: distinctive }],
          }),
        },
      ),
    ).rejects.toThrow(/output leak/)
  })

  test("S8: planner.eng inline stub emitting solutions content → does NOT throw", async () => {
    const distinctive =
      "Yet another distinctive line that would trigger the gate for reviewers."
    seedSolution(tmp, "runtime", "leaky", `# Title\n\n${distinctive}\n`)
    ensureSgcStructure(tmp)
    const r = await spawn(
      "planner.eng",
      { intent_draft: "title" },
      {
        stateRoot: tmp,
        inlineStub: () => ({
          verdict: "approve",
          concerns: [distinctive],
          structural_risks: [],
        }),
      },
    )
    expect(r.output).toBeDefined()
  })
})
