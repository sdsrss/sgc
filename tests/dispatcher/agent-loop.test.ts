import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"

function writePromptFile(path: string, content: string): void {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, "utf8")
}
import { runAgentLoop } from "../../src/commands/agent-loop"
import {
  listAllSpawns,
  listPendingSpawns,
  parseSpawnId,
} from "../../src/dispatcher/spawn-protocol"
import { spawn } from "../../src/dispatcher/spawn"
import { ensureSgcStructure } from "../../src/dispatcher/state"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-agent-loop-"))
  ensureSgcStructure(tmp)
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

describe("parseSpawnId", () => {
  test("splits ulid and agent name at first dash", () => {
    const { ulid, agentName } = parseSpawnId("01ABC123-reviewer.correctness")
    expect(ulid).toBe("01ABC123")
    expect(agentName).toBe("reviewer.correctness")
  })
  test("agent name with dot preserved", () => {
    const { agentName } = parseSpawnId("01X-compound.related")
    expect(agentName).toBe("compound.related")
  })
  test("invalid spawn_id throws", () => {
    expect(() => parseSpawnId("nodashhere")).toThrow(/no dash/)
  })
})

describe("listAllSpawns / listPendingSpawns", () => {
  async function stubSpawn() {
    return spawn("classifier.level", { user_request: "fix typo" }, {
      stateRoot: tmp,
      inlineStub: () => ({
        level: "L0",
        rationale: "heuristic hit typo keyword",
        affected_readers_candidates: ["alice"],
      }),
    })
  }

  test("empty when no spawns", () => {
    expect(listAllSpawns(tmp)).toEqual([])
    expect(listPendingSpawns(tmp)).toEqual([])
  })

  test("lists inline-stub spawn with hasResult=true", async () => {
    await stubSpawn()
    const all = listAllSpawns(tmp)
    expect(all.length).toBe(1)
    expect(all[0]?.hasResult).toBe(true)
    // inline-stub writes the result, so pending is empty
    expect(listPendingSpawns(tmp).length).toBe(0)
  })

  test("file-poll spawn shows as pending until result is written", () => {
    // Manually create a prompt file without a result (simulating mid-flight)
    const spawnId = "01PENDING0000000000000000-classifier.level"
    const promptPath = resolve(tmp, "progress/agent-prompts", `${spawnId}.md`)
    writePromptFile(promptPath, "---\nspawn_id: " + spawnId + "\n---\n")
    expect(listPendingSpawns(tmp).length).toBe(1)
    expect(listPendingSpawns(tmp)[0]?.spawnId).toBe(spawnId)
  })
})

describe("runAgentLoop — --list", () => {
  test("empty dir prints 'no spawns'", async () => {
    const logs: string[] = []
    const r = await runAgentLoop({ stateRoot: tmp, list: true, log: (m) => logs.push(m) })
    expect(r.action).toBe("list")
    expect(logs.join("\n")).toMatch(/no spawns/)
  })
  test("prints marker + id for each spawn", async () => {
    await spawn("classifier.level", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        level: "L0",
        rationale: "ok",
        affected_readers_candidates: ["x"],
      }),
    })
    const logs: string[] = []
    await runAgentLoop({ stateRoot: tmp, list: true, log: (m) => logs.push(m) })
    const out = logs.join("\n")
    expect(out).toContain("1 spawn(s)")
    expect(out).toContain("classifier.level")
    expect(out).toMatch(/\[x\]/)
  })
})

describe("runAgentLoop — --show", () => {
  test("prints prompt file content", async () => {
    // Use reviewer.correctness (no prompt_path) so the prompt file carries
    // the synthesized frontmatter (spawn_id, scope_tokens) being asserted
    // here. classifier.level now uses an external template (prompt_path)
    // where those markers don't appear — covered by the prompt-path tests.
    const spawnRes = await spawn("reviewer.correctness", {}, {
      stateRoot: tmp,
      inlineStub: () => ({
        verdict: "pass",
        severity: "none",
        findings: [],
      }),
    })
    const logs: string[] = []
    await runAgentLoop({
      stateRoot: tmp,
      show: spawnRes.spawnId,
      log: (m) => logs.push(m),
    })
    const out = logs.join("\n")
    expect(out).toContain("spawn_id:")
    expect(out).toContain("reviewer.correctness")
    expect(out).toContain("scope_tokens:")
  })
  test("throws on unknown spawn_id", async () => {
    await expect(
      runAgentLoop({
        stateRoot: tmp,
        show: "01NOPENOPE-classifier.level",
        log: () => {},
      }),
    ).rejects.toThrow(/not found/)
  })
})

describe("runAgentLoop — --submit", () => {
  async function createPendingSpawn(): Promise<string> {
    // Create a prompt without result (simulating external-spawn flow)
    const spawnId = "01SUBMITTEST0000000000000-classifier.level"
    const promptPath = resolve(tmp, "progress/agent-prompts", `${spawnId}.md`)
    writePromptFile(promptPath, "---\nspawn_id: " + spawnId + "\n---\n")
    return spawnId
  }

  test("writes result from --from file", async () => {
    const spawnId = await createPendingSpawn()
    const yamlFile = resolve(tmp, "my-reply.yaml")
    writeFileSync(
      yamlFile,
      "level: L1\nrationale: checked the file\naffected_readers_candidates:\n  - alice\n",
      "utf8",
    )
    const logs: string[] = []
    const r = await runAgentLoop({
      stateRoot: tmp,
      submit: spawnId,
      fromFile: yamlFile,
      log: (m) => logs.push(m),
    })
    expect(r.action).toBe("submit")
    const resultPath = resolve(tmp, "progress/agent-results", `${spawnId}.md`)
    expect(existsSync(resultPath)).toBe(true)
    const content = readFileSync(resultPath, "utf8")
    expect(content).toContain("level: L1")
    expect(content).toContain("alice")
  })

  test("rejects submission with undeclared field (Invariant §9)", async () => {
    const spawnId = await createPendingSpawn()
    const yamlFile = resolve(tmp, "bad-reply.yaml")
    writeFileSync(
      yamlFile,
      "level: L0\nrationale: ok\naffected_readers_candidates: [x]\nsurprise: extra\n",
      "utf8",
    )
    await expect(
      runAgentLoop({
        stateRoot: tmp,
        submit: spawnId,
        fromFile: yamlFile,
        log: () => {},
      }),
    ).rejects.toThrow(/undeclared output fields/)
  })

  test("rejects submission with missing field", async () => {
    const spawnId = await createPendingSpawn()
    const yamlFile = resolve(tmp, "short-reply.yaml")
    writeFileSync(yamlFile, "level: L0\n", "utf8")  // missing rationale + affected_readers
    await expect(
      runAgentLoop({
        stateRoot: tmp,
        submit: spawnId,
        fromFile: yamlFile,
        log: () => {},
      }),
    ).rejects.toThrow()
  })

  test("rejects enum-invalid value", async () => {
    const spawnId = await createPendingSpawn()
    const yamlFile = resolve(tmp, "bad-enum.yaml")
    writeFileSync(
      yamlFile,
      "level: L99\nrationale: ok\naffected_readers_candidates: [x]\n",
      "utf8",
    )
    await expect(
      runAgentLoop({
        stateRoot: tmp,
        submit: spawnId,
        fromFile: yamlFile,
        log: () => {},
      }),
    ).rejects.toThrow(/expected one of/)
  })

  test("refuses second submit (result file already exists)", async () => {
    const spawnId = await createPendingSpawn()
    const yamlFile = resolve(tmp, "good-reply.yaml")
    writeFileSync(
      yamlFile,
      "level: L0\nrationale: ok\naffected_readers_candidates: [x]\n",
      "utf8",
    )
    await runAgentLoop({ stateRoot: tmp, submit: spawnId, fromFile: yamlFile, log: () => {} })
    await expect(
      runAgentLoop({ stateRoot: tmp, submit: spawnId, fromFile: yamlFile, log: () => {} }),
    ).rejects.toThrow(/already written/)
  })

  test("accepts frontmatter-wrapped YAML (strips fences)", async () => {
    const spawnId = await createPendingSpawn()
    const yamlFile = resolve(tmp, "fenced.yaml")
    writeFileSync(
      yamlFile,
      "---\nlevel: L0\nrationale: ok\naffected_readers_candidates: [x]\n---\n# body\n",
      "utf8",
    )
    await expect(
      runAgentLoop({ stateRoot: tmp, submit: spawnId, fromFile: yamlFile, log: () => {} }),
    ).resolves.toBeDefined()
  })

  test("reads from injected stdin provider", async () => {
    const spawnId = await createPendingSpawn()
    await runAgentLoop({
      stateRoot: tmp,
      submit: spawnId,
      readStdin: async () =>
        "level: L0\nrationale: ok\naffected_readers_candidates: [x]\n",
      log: () => {},
    })
    const resultPath = resolve(tmp, "progress/agent-results", `${spawnId}.md`)
    expect(existsSync(resultPath)).toBe(true)
  })

  test("throws on unknown agent", async () => {
    const badId = "01FAKE-not.an.agent"
    writePromptFile(
      resolve(tmp, "progress/agent-prompts", `${badId}.md`),
      "---\n---\n",
    )
    await expect(
      runAgentLoop({
        stateRoot: tmp,
        submit: badId,
        readStdin: async () => "{}",
        log: () => {},
      }),
    ).rejects.toThrow(/unknown agent/)
  })
})

describe("runAgentLoop — interactive (no args)", () => {
  test("empty state → 'no pending spawns'", async () => {
    const logs: string[] = []
    const r = await runAgentLoop({ stateRoot: tmp, log: (m) => logs.push(m) })
    expect(r.action).toBe("interactive")
    expect(logs.join("\n")).toMatch(/no pending/)
  })

  test("pending spawn → prints paths and submit commands", async () => {
    const spawnId = "01TESTINGINTERACTIVE00000-classifier.level"
    writePromptFile(
      resolve(tmp, "progress/agent-prompts", `${spawnId}.md`),
      "---\nspawn_id: " + spawnId + "\n---\n",
    )
    const logs: string[] = []
    await runAgentLoop({ stateRoot: tmp, log: (m) => logs.push(m) })
    const out = logs.join("\n")
    expect(out).toContain(spawnId)
    expect(out).toContain("Prompt:")
    expect(out).toContain("Reply:")
    expect(out).toContain("sgc agent-loop --submit")
  })
})
