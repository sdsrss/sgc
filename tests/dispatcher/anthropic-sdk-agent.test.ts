import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import Anthropic from "@anthropic-ai/sdk"
import {
  AnthropicSdkError,
  runAnthropicSdkAgent,
  splitPrompt,
  type AnthropicClientFactory,
} from "../../src/dispatcher/anthropic-sdk-agent"
import { formatPrompt, spawn, resolveMode } from "../../src/dispatcher/spawn"
import { ensureSgcStructure } from "../../src/dispatcher/state"
import { getSubagentManifest } from "../../src/dispatcher/schema"

let tmp: string
beforeEach(() => {
  tmp = mkdtempSync(join(tmpdir(), "sgc-anthropic-"))
  ensureSgcStructure(tmp)
})
afterEach(() => {
  rmSync(tmp, { recursive: true, force: true })
})

function writePrompt(content = "test prompt"): string {
  const path = resolve(tmp, "progress/agent-prompts/01TEST-classifier.level.md")
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, content, "utf8")
  return path
}

/**
 * Build a fake client factory whose messages.create resolves to `response`
 * (or rejects with `error` if provided).
 */
function fakeClient(params: {
  response?: { content: unknown[] }
  error?: unknown
  recordCall?: (args: { body: unknown; opts: unknown }) => void
}): AnthropicClientFactory {
  return () => ({
    messages: {
      create: async (body: unknown, opts: unknown) => {
        params.recordCall?.({ body, opts })
        if (params.error) throw params.error
        return params.response as Anthropic.Message
      },
    },
  }) as unknown as Pick<Anthropic, "messages">
}

describe("runAnthropicSdkAgent — success paths", () => {
  test("parses YAML from text block", async () => {
    const manifest = getSubagentManifest("classifier.level")!
    const client = fakeClient({
      response: {
        content: [
          {
            type: "text",
            text: "```yaml\nlevel: L1\nrationale: fits the file scope\naffected_readers_candidates:\n  - alice\n```",
          },
        ],
      },
    })
    const out = (await runAnthropicSdkAgent(
      writePrompt(),
      manifest,
      client,
    )) as Record<string, unknown>
    expect(out.level).toBe("L1")
    expect(out.rationale).toContain("file")
    expect(out.affected_readers_candidates).toEqual(["alice"])
  })

  test("sends adaptive thinking + bounded max_tokens + system-block caching", async () => {
    const manifest = getSubagentManifest("reviewer.correctness")!
    let recorded: { body: unknown; opts: unknown } | null = null
    const client = fakeClient({
      response: {
        content: [{ type: "text", text: "verdict: pass\nseverity: none\nfindings: []" }],
      },
      recordCall: (c) => { recorded = c },
    })
    const structuredPrompt = [
      "# Purpose",
      "review correctness",
      "",
      "## Scope",
      "diff-only",
      "",
      "## Input",
      "diff: here",
    ].join("\n")
    await runAnthropicSdkAgent(writePrompt(structuredPrompt), manifest, client)
    expect(recorded).not.toBeNull()
    const body = recorded!.body as {
      model: string
      max_tokens: number
      thinking: { type: string }
      system?: Array<{ type: string; text: string; cache_control?: unknown }>
      messages: Array<{ role: string; content: Array<{ type: string; cache_control?: unknown }> }>
    }
    expect(body.model).toBe("claude-opus-4-6")
    expect(body.thinking).toEqual({ type: "adaptive" })
    expect(body.max_tokens).toBeLessThanOrEqual(8192)  // capped
    expect(body.max_tokens).toBeGreaterThan(0)
    // cache_control lives on the system block (stable prefix), NOT on the user block.
    expect(body.system).toBeDefined()
    expect(body.system![0]?.cache_control).toEqual({ type: "ephemeral" })
    expect(body.messages[0]?.content[0]?.cache_control).toBeUndefined()
    // timeout passed to SDK
    const opts = recorded!.opts as { timeout: number }
    expect(opts.timeout).toBe((manifest.timeout_s ?? 60) * 1000)
  })
})

describe("splitPrompt", () => {
  test("separates system and user at ## Input heading", () => {
    const prompt = [
      "# Purpose",
      "classify task",
      "",
      "## Scope",
      "foo",
      "",
      "## Input",
      "yaml:",
      "  here: true",
      "",
      "## Reply",
    ].join("\n")

    const { systemPart, userPart } = splitPrompt(prompt)
    expect(systemPart).toContain("# Purpose")
    expect(systemPart).toContain("## Scope")
    expect(systemPart).not.toContain("## Input")
    expect(userPart).toContain("## Input")
    expect(userPart).toContain("yaml:")
  })

  test("fallback when no Input heading — whole prompt is user", () => {
    const prompt = "simple prompt with no structure"
    const { systemPart, userPart } = splitPrompt(prompt)
    expect(systemPart).toBe("")
    expect(userPart).toBe(prompt)
  })

  test("Input heading must be at line start (## Input at start of line)", () => {
    const prompt = "This mentions ## Input in the middle but doesn't start a section"
    const { systemPart, userPart } = splitPrompt(prompt)
    // No leading \n before ## Input, so not matched
    expect(systemPart).toBe("")
    expect(userPart).toBe(prompt)
  })

  test("tolerates CRLF line endings", () => {
    const prompt = ["# Purpose", "x", "", "## Input", "y"].join("\r\n")
    const { systemPart, userPart } = splitPrompt(prompt)
    expect(systemPart).toContain("# Purpose")
    expect(systemPart).not.toContain("## Input")
    expect(userPart).toContain("## Input")
  })

  test("tolerates trailing whitespace after 'Input' heading", () => {
    const prompt = "# Purpose\nx\n\n## Input   \ny"
    const { systemPart, userPart } = splitPrompt(prompt)
    expect(systemPart).toContain("# Purpose")
    expect(userPart).toContain("## Input")
  })

  test("does not match '### Input' (level-3 heading)", () => {
    const prompt = "# Purpose\nx\n\n### Input\ny"
    const { systemPart, userPart } = splitPrompt(prompt)
    // Only '## Input' is the marker; '### Input' stays on the user side
    // via fallback (whole prompt in user part).
    expect(systemPart).toBe("")
    expect(userPart).toBe(prompt)
  })
})

describe("prompt caching — byte-identical system block across calls", () => {
  // This is the direct proof that cache_control=ephemeral on the system
  // block will actually hit. formatPrompt must produce identical pre-`##
  // Input` text for two calls of the same agent with different inputs /
  // spawn_ids / scope_tokens. If this test regresses, the cache is dead.
  //
  // Uses reviewer.security (no prompt_path) — exercises the SYNTHESIZED
  // prefix path (manifest.purpose + manifest.outputs → stable prefix). The
  // companion template-path cache-stability test lives in prompt-path.test.ts.
  // (reviewer.correctness now uses prompt_path; reviewer.security still uses
  // synthesized prompts and has the same output schema.)
  test("two calls, same agent, different inputs → byte-identical systemPart", () => {
    const manifest = getSubagentManifest("reviewer.security")!
    const prompt1 = formatPrompt(
      "01SPAWN111111111111111111-reviewer.security",
      manifest,
      { diff: "task A", unrelated: "alpha" },
      ["read:progress"],
      "/tmp/.sgc/progress/agent-results/01SPAWN111111111111111111-reviewer.security.md",
    )
    const prompt2 = formatPrompt(
      "01SPAWN222222222222222222-reviewer.security",
      manifest,
      { diff: "task B — completely different", unrelated: "beta" },
      ["read:progress"],
      "/tmp/.sgc/progress/agent-results/01SPAWN222222222222222222-reviewer.security.md",
    )

    const sys1 = splitPrompt(prompt1).systemPart
    const sys2 = splitPrompt(prompt2).systemPart
    const user1 = splitPrompt(prompt1).userPart
    const user2 = splitPrompt(prompt2).userPart

    expect(sys1.length).toBeGreaterThan(0)
    // The critical invariant — cache key is keyed on system text bytes.
    expect(sys1).toBe(sys2)

    // Per-call varying content lives in the user block only.
    expect(user1).toContain("01SPAWN111111111111111111")
    expect(user2).toContain("01SPAWN222222222222222222")
    expect(user1).not.toBe(user2)
    // Spawn ids must NOT leak into the system block.
    expect(sys1).not.toContain("01SPAWN")
    expect(sys1).not.toContain("/tmp/.sgc/progress")
    // Input payload must NOT leak into the system block.
    expect(sys1).not.toContain("task A")
    expect(sys1).not.toContain("alpha")
  })

  test("different scope_tokens still produce identical systemPart (scope lives in user block)", () => {
    // Even if a future capability shift changes the pinned tokens for the
    // same agent name, the cached system prefix stays stable because the
    // scope reminder is below `## Input`.
    const manifest = getSubagentManifest("reviewer.security")!
    const prompt1 = formatPrompt(
      "01SAME-reviewer.security",
      manifest,
      { x: 1 },
      ["read:progress"],
      "/tmp/r1.md",
    )
    const prompt2 = formatPrompt(
      "01SAME-reviewer.security",
      manifest,
      { x: 1 },
      ["read:progress", "read:decisions"],
      "/tmp/r1.md",
    )
    expect(splitPrompt(prompt1).systemPart).toBe(splitPrompt(prompt2).systemPart)
    expect(splitPrompt(prompt1).userPart).not.toBe(splitPrompt(prompt2).userPart)
  })
})

describe("runAnthropicSdkAgent cache_control placement", () => {
  test("system block gets cache_control=ephemeral; user block does not", async () => {
    const manifest = getSubagentManifest("classifier.level")!
    let recorded: { body: unknown; opts: unknown } | null = null
    const client = fakeClient({
      response: {
        content: [
          {
            type: "text",
            text: "level: L1\nrationale: structured prompt path\naffected_readers_candidates: []",
          },
        ],
      },
      recordCall: (c) => { recorded = c },
    })

    const structuredPrompt = [
      "# Purpose",
      "classify",
      "",
      "## Scope",
      "foo",
      "",
      "## Input",
      "task: bar",
      "",
      "## Reply",
      "yaml",
    ].join("\n")

    await runAnthropicSdkAgent(writePrompt(structuredPrompt), manifest, client)

    const body = recorded!.body as {
      system?: Array<{ type: string; text: string; cache_control?: unknown }>
      messages: Array<{ role: string; content: Array<{ type: string; text: string; cache_control?: unknown }> }>
    }

    expect(body.system).toBeDefined()
    expect(body.system![0]?.cache_control).toEqual({ type: "ephemeral" })
    expect(body.system![0]?.text).toContain("# Purpose")
    expect(body.system![0]?.text).toContain("## Scope")
    expect(body.system![0]?.text).not.toContain("## Input")

    // user block: no cache_control
    expect(body.messages[0]?.content[0]?.cache_control).toBeUndefined()
    expect(body.messages[0]?.content[0]?.text).toContain("## Input")
  })

  test("fallback: no Input heading → no system block, whole prompt in user", async () => {
    const manifest = getSubagentManifest("classifier.level")!
    let recorded: { body: unknown; opts: unknown } | null = null
    const client = fakeClient({
      response: {
        content: [
          {
            type: "text",
            text: "level: L0\nrationale: fallback\naffected_readers_candidates: []",
          },
        ],
      },
      recordCall: (c) => { recorded = c },
    })

    await runAnthropicSdkAgent(writePrompt("just a simple prompt"), manifest, client)

    const body = recorded!.body as {
      system?: unknown
      messages: Array<{ role: string; content: Array<{ type: string; text: string; cache_control?: unknown }> }>
    }
    // system param must be OMITTED (not empty array, not null) when no stable prefix
    expect(body.system).toBeUndefined()
    expect(body.messages[0]?.content[0]?.text).toBe("just a simple prompt")
    expect(body.messages[0]?.content[0]?.cache_control).toBeUndefined()
  })
})

describe("runAnthropicSdkAgent — error paths", () => {
  const manifest = () => getSubagentManifest("classifier.level")!

  test("non-text content block", async () => {
    const client = fakeClient({
      response: { content: [{ type: "tool_use", name: "x", input: {} }] },
    })
    await expect(runAnthropicSdkAgent(writePrompt(), manifest(), client)).rejects.toThrow(
      /no text block/,
    )
  })

  test("unparseable YAML", async () => {
    const client = fakeClient({
      response: {
        content: [
          { type: "text", text: "```yaml\n: : : malformed\n```" },
        ],
      },
    })
    await expect(runAnthropicSdkAgent(writePrompt(), manifest(), client)).rejects.toThrow(
      AnthropicSdkError,
    )
  })

  test("YAML that is a scalar, not an object", async () => {
    const client = fakeClient({
      response: { content: [{ type: "text", text: "just a string reply" }] },
    })
    await expect(runAnthropicSdkAgent(writePrompt(), manifest(), client)).rejects.toThrow(
      /not an object/,
    )
  })

  test("APIError is wrapped with status code", async () => {
    const apiError = new Anthropic.APIError(
      429,
      { type: "error", error: { type: "rate_limit_error", message: "slow down" } } as unknown as object,
      "slow down",
      new Headers(),
    )
    const client = fakeClient({ error: apiError })
    try {
      await runAnthropicSdkAgent(writePrompt(), manifest(), client)
      throw new Error("should have thrown")
    } catch (e) {
      expect(e).toBeInstanceOf(AnthropicSdkError)
      expect((e as AnthropicSdkError).status).toBe(429)
      expect((e as Error).message).toContain("429")
    }
  })
})

describe("spawn integration — mode=anthropic-sdk", () => {
  test("routes through Anthropic SDK when opts.mode='anthropic-sdk'", async () => {
    const factory = fakeClient({
      response: {
        content: [
          {
            type: "text",
            text: "level: L2\nrationale: API change in src/handler.ts\naffected_readers_candidates:\n  - bob",
          },
        ],
      },
    })
    const r = await spawn("classifier.level", {}, {
      stateRoot: tmp,
      mode: "anthropic-sdk",
      anthropicClientFactory: factory,
    })
    expect((r.output as { level: string }).level).toBe("L2")
  })

  test("schema validation still applies (unknown field rejected)", async () => {
    const factory = fakeClient({
      response: {
        content: [
          {
            type: "text",
            text: "level: L0\nrationale: typo fix\naffected_readers_candidates: [x]\nsneaky: true",
          },
        ],
      },
    })
    await expect(
      spawn("classifier.level", {}, {
        stateRoot: tmp,
        mode: "anthropic-sdk",
        anthropicClientFactory: factory,
      }),
    ).rejects.toThrow(/undeclared output fields/)
  })
})

describe("resolveMode — auto-detect priority", () => {
  // Save + restore env per test
  let savedEnv: Record<string, string | undefined>
  beforeEach(() => {
    savedEnv = {
      ANTHROPIC_API_KEY: process.env["ANTHROPIC_API_KEY"],
      SGC_AGENT_MODE: process.env["SGC_AGENT_MODE"],
      SGC_USE_FILE_AGENTS: process.env["SGC_USE_FILE_AGENTS"],
      OPENROUTER_API_KEY: process.env["OPENROUTER_API_KEY"],
      SGC_FORCE_INLINE: process.env["SGC_FORCE_INLINE"],
    }
    delete process.env["ANTHROPIC_API_KEY"]
    delete process.env["SGC_AGENT_MODE"]
    delete process.env["SGC_USE_FILE_AGENTS"]
    delete process.env["OPENROUTER_API_KEY"]
    delete process.env["SGC_FORCE_INLINE"]
  })
  afterEach(() => {
    for (const [k, v] of Object.entries(savedEnv)) {
      if (v === undefined) delete process.env[k]
      else process.env[k] = v
    }
  })

  const noClaudeCli = () => false
  const hasClaudeCli = () => true

  test("opts.mode wins over everything", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-xxx"
    process.env["SGC_AGENT_MODE"] = "file-poll"
    expect(resolveMode({ mode: "inline", inlineStub: () => ({}) })).toBe("inline")
  })
  test("SGC_AGENT_MODE wins over ANTHROPIC_API_KEY", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-xxx"
    process.env["SGC_AGENT_MODE"] = "file-poll"
    expect(resolveMode({})).toBe("file-poll")
  })
  test("legacy SGC_USE_FILE_AGENTS=1 respected", () => {
    process.env["SGC_USE_FILE_AGENTS"] = "1"
    expect(resolveMode({})).toBe("file-poll")
  })
  test("inlineStub with no env → inline", () => {
    expect(resolveMode({ inlineStub: () => ({}), hasClaudeCli: noClaudeCli })).toBe("inline")
  })
  test("ANTHROPIC_API_KEY → anthropic-sdk (no stub)", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-xxx"
    expect(resolveMode({ hasClaudeCli: noClaudeCli })).toBe("anthropic-sdk")
  })
  test("OPENROUTER_API_KEY → openrouter (no ANTHROPIC_API_KEY)", () => {
    process.env["OPENROUTER_API_KEY"] = "sk-or-xxx"
    expect(resolveMode({ hasClaudeCli: noClaudeCli })).toBe("openrouter")
  })
  test("ANTHROPIC_API_KEY wins over OPENROUTER_API_KEY", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-xxx"
    process.env["OPENROUTER_API_KEY"] = "sk-or-xxx"
    expect(resolveMode({ hasClaudeCli: noClaudeCli })).toBe("anthropic-sdk")
  })
  test("claude CLI present → claude-cli (no key, no stub)", () => {
    expect(resolveMode({ hasClaudeCli })).toBe("claude-cli")
  })
  test("nothing set + no claude CLI → file-poll", () => {
    expect(resolveMode({ hasClaudeCli: noClaudeCli })).toBe("file-poll")
  })
  test("inlineStub beats ANTHROPIC_API_KEY when no prompt_path (no manifest)", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-xxx"
    // Without manifest.prompt_path, inlineStub wins — agents without templates use heuristic
    expect(resolveMode({ inlineStub: () => ({}), hasClaudeCli })).toBe("inline")
  })
  test("ANTHROPIC_API_KEY beats inlineStub when manifest has prompt_path", () => {
    process.env["ANTHROPIC_API_KEY"] = "sk-xxx"
    const manifest = { name: "test", prompt_path: "prompts/test.md" } as any
    expect(resolveMode({ inlineStub: () => ({}), hasClaudeCli }, manifest)).toBe("anthropic-sdk")
  })
  test("OPENROUTER beats inlineStub when manifest has prompt_path", () => {
    process.env["OPENROUTER_API_KEY"] = "sk-or-xxx"
    const manifest = { name: "test", prompt_path: "prompts/test.md" } as any
    expect(resolveMode({ inlineStub: () => ({}), hasClaudeCli: noClaudeCli }, manifest)).toBe("openrouter")
  })
})
