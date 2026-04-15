import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import {
  ClaudeCliError,
  extractYamlBody,
  runClaudeCliAgent,
  type SubprocessRunner,
} from "../../src/dispatcher/claude-cli-agent"
import { spawn } from "../../src/dispatcher/spawn"
import { ensureSgcStructure } from "../../src/dispatcher/state"
import { getSubagentManifest } from "../../src/dispatcher/schema"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-claude-cli-"))
  ensureSgcStructure(tmp)
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function writePrompt(content = "ignored prompt content"): string {
  const path = resolve(tmp, "progress/agent-prompts/01TEST-classifier.level.md")
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, "utf8")
  return path
}

function fakeJson(overrides: Record<string, unknown>): string {
  return JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    duration_ms: 1234,
    result: "",
    stop_reason: "end_turn",
    ...overrides,
  })
}

describe("extractYamlBody", () => {
  test("strips ```yaml fence", () => {
    expect(extractYamlBody("```yaml\nfoo: 1\n```")).toBe("foo: 1")
    expect(extractYamlBody("\n\n```yaml\nfoo: 1\nbar: 2\n```\n")).toBe("foo: 1\nbar: 2")
  })
  test("strips bare ``` fence", () => {
    expect(extractYamlBody("```\nfoo: 1\n```")).toBe("foo: 1")
  })
  test("strips frontmatter fence", () => {
    expect(extractYamlBody("---\nfoo: 1\n---")).toBe("foo: 1")
  })
  test("returns bare text when no fence", () => {
    expect(extractYamlBody("foo: 1\nbar: 2")).toBe("foo: 1\nbar: 2")
  })
  test("trims whitespace", () => {
    expect(extractYamlBody("  \n\nfoo: 1\n\n  ")).toBe("foo: 1")
  })
})

describe("runClaudeCliAgent — success paths", () => {
  test("parses YAML from fenced result", async () => {
    const manifest = getSubagentManifest("classifier.level")!
    const runner: SubprocessRunner = async () => ({
      stdout: fakeJson({
        result: "```yaml\nlevel: L0\nrationale: matched typo keyword in request\naffected_readers_candidates:\n  - alice\n```",
      }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    const out = (await runClaudeCliAgent(writePrompt(), manifest, runner)) as Record<string, unknown>
    expect(out.level).toBe("L0")
    expect(out.rationale).toContain("typo")
    expect(out.affected_readers_candidates).toEqual(["alice"])
  })

  test("parses bare YAML without fence", async () => {
    const manifest = getSubagentManifest("classifier.level")!
    const runner: SubprocessRunner = async () => ({
      stdout: fakeJson({
        result: "level: L1\nrationale: default single-file change to foo.ts\naffected_readers_candidates: [bob]",
      }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    const out = (await runClaudeCliAgent(writePrompt(), manifest, runner)) as Record<string, unknown>
    expect(out.level).toBe("L1")
  })

  test("passes prompt text as argv (inspectable via runner)", async () => {
    const manifest = getSubagentManifest("classifier.level")!
    const recorded: { argv?: string[] } = {}
    const runner: SubprocessRunner = async (argv) => {
      recorded.argv = argv
      return {
        stdout: fakeJson({ result: "level: L0\nrationale: typo fix\naffected_readers_candidates: [x]" }),
        stderr: "",
        exitCode: 0,
        timedOut: false,
      }
    }
    const promptText = "specific prompt text for inspection"
    const ppath = writePrompt(promptText)
    await runClaudeCliAgent(ppath, manifest, runner)
    expect(recorded.argv?.slice(0, 4)).toEqual(["claude", "-p", "--output-format", "json"])
    expect(recorded.argv?.[4]).toBe(promptText)
  })
})

describe("runClaudeCliAgent — error paths", () => {
  const manifest = () => getSubagentManifest("classifier.level")!

  test("non-zero exit code", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: "",
      stderr: "auth failed; run `claude login`",
      exitCode: 2,
      timedOut: false,
    })
    await expect(runClaudeCliAgent(writePrompt(), manifest(), runner)).rejects.toThrow(ClaudeCliError)
  })

  test("timeout surfaces as ClaudeCliError", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: "",
      stderr: "aborted",
      exitCode: -1,
      timedOut: true,
    })
    await expect(runClaudeCliAgent(writePrompt(), manifest(), runner)).rejects.toThrow(/exceeded/)
  })

  test("non-JSON stdout", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: "not json at all",
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    await expect(runClaudeCliAgent(writePrompt(), manifest(), runner)).rejects.toThrow(/non-JSON/)
  })

  test("is_error=true surfaces", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: fakeJson({ is_error: true, result: "rate limited" }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    await expect(runClaudeCliAgent(writePrompt(), manifest(), runner)).rejects.toThrow(/reported error/)
  })

  test("missing .result field", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: JSON.stringify({ type: "result", is_error: false }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    await expect(runClaudeCliAgent(writePrompt(), manifest(), runner)).rejects.toThrow(/missing \.result/)
  })

  test("YAML that parses to non-object (e.g. a scalar)", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: fakeJson({ result: "just a string response\nno yaml here" }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    await expect(runClaudeCliAgent(writePrompt(), manifest(), runner)).rejects.toThrow(/not a YAML object/)
  })
})

describe("spawn integration — mode=claude-cli", () => {
  test("routes through claude-cli runner when opts.mode='claude-cli'", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: fakeJson({
        result: "```yaml\nlevel: L2\nrationale: API change in src/handler.ts\naffected_readers_candidates: [alice]\n```",
      }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    const r = await spawn("classifier.level", {}, {
      stateRoot: tmp,
      mode: "claude-cli",
      claudeCliRunner: runner,
    })
    expect((r.output as { level: string }).level).toBe("L2")
  })

  test("schema validation still applies (undeclared field rejected)", async () => {
    const runner: SubprocessRunner = async () => ({
      stdout: fakeJson({
        result: "```yaml\nlevel: L0\nrationale: typo fix\naffected_readers_candidates: [x]\nsneaky: true\n```",
      }),
      stderr: "",
      exitCode: 0,
      timedOut: false,
    })
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        mode: "claude-cli",
        claudeCliRunner: runner,
      }),
    ).rejects.toThrow(/undeclared output fields/)
  })

  test("SGC_AGENT_MODE=claude-cli env triggers mode selection", async () => {
    process.env["SGC_AGENT_MODE"] = "claude-cli"
    try {
      const runner: SubprocessRunner = async () => ({
        stdout: fakeJson({
          result: "```yaml\nlevel: L0\nrationale: fix typo in README.md\naffected_readers_candidates: [x]\n```",
        }),
        stderr: "",
        exitCode: 0,
        timedOut: false,
      })
      const r = await spawn("classifier.level", {}, {
        stateRoot: tmp,
        claudeCliRunner: runner,
        // no inlineStub — previously would have defaulted to file-poll
      })
      expect((r.output as { level: string }).level).toBe("L0")
    } finally {
      delete process.env["SGC_AGENT_MODE"]
    }
  })
})
