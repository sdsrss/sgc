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
    expect(promptText).toContain("classifier.level")
    expect(promptText).toContain("scope_tokens")
    expect(promptText).toContain("read:progress")
  })

  test("OutputShapeMismatch when stub returns wrong shape", async () => {
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        inlineStub: () => ({ level: "L0" }),  // missing rationale + affected_readers_candidates
      }),
    ).rejects.toThrow(OutputShapeMismatch)
  })

  test("Invariant §1: reviewer.* manifest declaring read:solutions would fail", async () => {
    // The manifest as-shipped doesn't declare it (Invariant §1 enforced), so
    // computeSubagentTokens passes. We spot-check tokens are in the prompt.
    const r = await spawn("reviewer.correctness", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        verdict: "pass",
        severity: "none",
        findings: [],
      }),
    })
    const prompt = readFileSync(r.promptPath, "utf8")
    expect(prompt).not.toContain("read:solutions")
    expect(prompt).toContain("write:reviews")
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
