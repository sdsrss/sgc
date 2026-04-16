import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import {
  OutputShapeMismatch,
  SpawnTimeout,
  spawn,
} from "../../src/dispatcher/spawn"
import {
  ensureSgcStructure,
  parseFrontmatter,
  serializeFrontmatter,
} from "../../src/dispatcher/state"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-spawn-"))
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("spawn — inline-stub mode", () => {
  test("classifier.level: writes prompt, executes stub, persists result", async () => {
    const r = await spawn("classifier.level", { user_request: "fix typo" }, {
      stateRoot: tmp,
      ulid: "01TESTULID0000000000000000",
      inlineStub: () => ({
        level: "L0",
        rationale: "test stub",
        affected_readers_candidates: ["alice"],
      }),
    })
    expect(r.spawnId).toBe("01TESTULID0000000000000000-classifier.level")
    expect(r.output).toEqual({
      level: "L0",
      rationale: "test stub",
      affected_readers_candidates: ["alice"],
    })
    expect(existsSync(r.promptPath)).toBe(true)
    expect(existsSync(r.resultPath)).toBe(true)
    const promptText = readFileSync(r.promptPath, "utf8")
    // classifier.level uses prompt_path → prompt file is the external
    // template with <input_yaml/> substituted. Expect template markers +
    // the substituted input YAML.
    expect(promptText).toContain("# Purpose")
    expect(promptText).toContain("## Input")
    expect(promptText).toContain("user_request: fix typo")
    expect(promptText).toContain("read:progress")  // template lists it under "Token scope:"
  })

  test("OutputShapeMismatch when stub returns wrong shape (missing field)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({ level: "L0" }),  // missing rationale + affected_readers_candidates
      }),
    ).rejects.toThrow(OutputShapeMismatch)
  })

  test("OutputShapeMismatch on undeclared field (audit C1 fix)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "ok",
          affected_readers_candidates: ["alice"],
          surprise: "I am a sneaky extra field",
        }),
      }),
    ).rejects.toThrow(/undeclared output fields/)
  })

  test("OutputShapeMismatch when enum value is invalid (audit C1 fix)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L99",  // not in enum[L0, L1, L2, L3]
          rationale: "ok",
          affected_readers_candidates: ["alice"],
        }),
      }),
    ).rejects.toThrow(/expected one of/)
  })

  test("OutputShapeMismatch when array field is not an array (audit C1 fix)", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({
          level: "L0",
          rationale: "ok",
          affected_readers_candidates: "not an array",
        }),
      }),
    ).rejects.toThrow(/expected array/)
  })

  test("forceError fault injection throws after prompt written, before result", async () => {
    // §10 transaction test harness: ensures the prompt audit file is
    // on disk (the spawn REQUEST was made) but no result file exists
    // (the spawn did NOT complete). runCompound relies on this property
    // to roll back — if a mid-cluster agent throws, writeSolution is
    // never called and solutions/ is untouched.
    const err = new Error("injected failure for §10 test")
    await expect(
      spawn("classifier.level", { user_request: "x" }, {
        stateRoot: tmp,
        ulid: "01FAULT0000000000000000000",
        forceError: err,
        inlineStub: () => ({ level: "L0", rationale: "x", affected_readers_candidates: [] }),
      }),
    ).rejects.toBe(err)
    // Prompt file WAS written (we saw the spawn request in the audit)
    const { existsSync } = require("node:fs")
    const pp = resolve(tmp, "progress/agent-prompts", "01FAULT0000000000000000000-classifier.level.md")
    const rp = resolve(tmp, "progress/agent-results", "01FAULT0000000000000000000-classifier.level.md")
    expect(existsSync(pp)).toBe(true)
    expect(existsSync(rp)).toBe(false)
  })

  test("valid stub output passes all type checks", async () => {
    const r = await spawn("reviewer.correctness", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        verdict: "pass",
        severity: "none",
        findings: [],
      }),
    })
    expect((r.output as { verdict: string }).verdict).toBe("pass")
  })

  test("Invariant §1: reviewer prompt pins no read:solutions + lists it as forbidden", async () => {
    // The manifest as-shipped doesn't declare read:solutions (Invariant §1
    // enforced at manifest load). The prompt format (D-1.1) now explicitly
    // lists forbidden tokens as a defense-in-depth reminder to the agent.
    const r = await spawn("reviewer.correctness", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        verdict: "pass",
        severity: "none",
        findings: [],
      }),
    })
    const prompt = readFileSync(r.promptPath, "utf8")
    // Pinned tokens block (under `scope_tokens:` key) must NOT have read:solutions
    const pinnedBlock = prompt.match(/scope_tokens:\n((?:  - .+\n)+)/)?.[1] ?? ""
    expect(pinnedBlock).not.toContain("read:solutions")
    expect(pinnedBlock).toContain("write:reviews")
    // Forbidden list must INCLUDE read:solutions (new in D-1.1)
    expect(prompt).toContain("forbidden_tokens")
    expect(prompt).toMatch(/FORBIDDEN from:.*read:solutions/)
  })
})

describe("spawn — file-poll mode (SGC_USE_FILE_AGENTS=1)", () => {
  test("polls until result file appears", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    try {
      ensureSgcStructure(tmp)
      const ulid = "01POLLULID0000000000000000"
      const spawnId = `${ulid}-classifier.level`
      const resultPath = resolve(tmp, "progress/agent-results", `${spawnId}.md`)

      // Start spawn (will poll); race against scheduled writeFile after 50ms.
      // ensureSgcStructure already made progress/ but not progress/agent-results/;
      // mkdir it first.
      setTimeout(() => {
        const { mkdirSync } = require("node:fs")
        const { dirname } = require("node:path")
        mkdirSync(dirname(resultPath), { recursive: true })
        writeFileSync(
          resultPath,
          serializeFrontmatter({
            level: "L1",
            rationale: "from external",
            affected_readers_candidates: ["bob"],
          }),
          "utf8",
        )
      }, 50)

      const r = await spawn("classifier.level", {}, {
        stateRoot: tmp,
        ulid,
        timeoutMs: 5000,
        pollIntervalMs: 25,
      })
      expect(r.output).toEqual({
        level: "L1",
        rationale: "from external",
        affected_readers_candidates: ["bob"],
      })
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
    }
  })

  test("times out when no result appears", async () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    try {
      await expect(
        spawn("classifier.level", {}, {
          stateRoot: tmp,
          timeoutMs: 100,
          pollIntervalMs: 30,
        }),
      ).rejects.toThrow(SpawnTimeout)
    } finally {
      delete process.env["SGC_USE_FILE_AGENTS"]
    }
  })
})
