// prompt_path integration: formatPrompt should load external templates
// when manifest.prompt_path is set, substitute <input_yaml/>, and preserve
// cache-stability (system block byte-identical across calls for the same
// agent).

import { describe, expect, test } from "bun:test"
import { formatPrompt, SpawnError } from "../../src/dispatcher/spawn"
import { splitPrompt } from "../../src/dispatcher/anthropic-sdk-agent"
import { getSubagentManifest } from "../../src/dispatcher/schema"
import {
  classifierLevel,
  classifierLevelHeuristic,
} from "../../src/dispatcher/agents/classifier-level"
import type { SubagentManifest } from "../../src/dispatcher/types"

describe("formatPrompt with prompt_path", () => {
  test("loads template and substitutes <input_yaml/>", () => {
    const manifest: SubagentManifest = {
      name: "classifier.level",
      version: "0.1",
      prompt_path: "prompts/classifier-level.md",
      purpose: "classify",
      outputs: { level: "string" },
      scope_tokens: ["read:progress"],
      token_budget: 2000,
      timeout_s: 30,
    }
    const prompt = formatPrompt(
      "01SPAWN-classifier.level",
      manifest,
      { user_request: "rename variable foo to bar" },
      ["read:progress"],
      "/tmp/result.yaml",
    )

    // Template content must appear
    expect(prompt).toContain("# Purpose")
    expect(prompt).toContain("Classify a user's engineering request")
    expect(prompt).toContain("## Level definitions")
    // Input substituted
    expect(prompt).toContain("user_request:")
    expect(prompt).toContain("rename variable foo to bar")
    // Placeholder gone
    expect(prompt).not.toContain("<input_yaml/>")
  })

  test("throws when template file missing", () => {
    const manifest: SubagentManifest = {
      name: "bogus.agent",
      version: "0.1",
      prompt_path: "prompts/nonexistent.md",
      purpose: "x",
      outputs: {},
      scope_tokens: [],
      token_budget: 1000,
      timeout_s: 10,
    }
    expect(() =>
      formatPrompt(
        "01SPAWN-bogus.agent",
        manifest,
        {},
        [],
        "/tmp/r.yaml",
      ),
    ).toThrow(SpawnError)
    expect(() =>
      formatPrompt(
        "01SPAWN-bogus.agent",
        manifest,
        {},
        [],
        "/tmp/r.yaml",
      ),
    ).toThrow(/prompt_path.*does not exist|nonexistent/i)
  })

  test("classifier.level template preserves cache-stability (system part identical across inputs)", () => {
    const manifest = getSubagentManifest("classifier.level")!
    expect(manifest.prompt_path).toBe("prompts/classifier-level.md")

    const p1 = formatPrompt(
      "01SPAWN-A-classifier.level",
      manifest,
      { user_request: "task A" },
      ["read:progress"],
      "/tmp/a.yaml",
    )
    const p2 = formatPrompt(
      "01SPAWN-B-classifier.level",
      manifest,
      { user_request: "task B" },
      ["read:progress"],
      "/tmp/b.yaml",
    )

    // Critical cache invariant: system prefix byte-identical across calls.
    expect(splitPrompt(p1).systemPart).toBe(splitPrompt(p2).systemPart)
    // User parts diverge — the per-call input lives there.
    expect(splitPrompt(p1).userPart).not.toBe(splitPrompt(p2).userPart)
    expect(splitPrompt(p1).userPart).toContain("task A")
    expect(splitPrompt(p2).userPart).toContain("task B")
    // System part MUST NOT contain the per-call input.
    expect(splitPrompt(p1).systemPart).not.toContain("task A")
    expect(splitPrompt(p2).systemPart).not.toContain("task B")
  })

  test("throws when template is missing <input_yaml/> placeholder", () => {
    // Uses a committed fixture (tests/fixtures/prompt-path/) to avoid
    // per-run file churn. manifest.prompt_path is resolved against cwd.
    const manifest: SubagentManifest = {
      name: "broken.agent",
      version: "0.1",
      prompt_path: "tests/fixtures/prompt-path/no-placeholder.md",
      purpose: "x",
      outputs: {},
      scope_tokens: [],
      token_budget: 100,
      timeout_s: 10,
    }
    expect(() =>
      formatPrompt(
        "01SPAWN-broken.agent",
        manifest,
        {},
        [],
        "/tmp/r.yaml",
      ),
    ).toThrow(/missing <input_yaml\/> placeholder/)
  })

  test("throws when template is missing '## Input' heading", () => {
    const manifest: SubagentManifest = {
      name: "broken.agent",
      version: "0.1",
      prompt_path: "tests/fixtures/prompt-path/no-input-heading.md",
      purpose: "x",
      outputs: {},
      scope_tokens: [],
      token_budget: 100,
      timeout_s: 10,
    }
    expect(() =>
      formatPrompt(
        "01SPAWN-broken.agent",
        manifest,
        {},
        [],
        "/tmp/r.yaml",
      ),
    ).toThrow(/missing '## Input' heading/)
  })
})

describe("classifier-level heuristic (backward compat)", () => {
  test("classifierLevel alias points at classifierLevelHeuristic", () => {
    expect(classifierLevel).toBe(classifierLevelHeuristic)
  })

  test("classifierLevelHeuristic returns L3 on migration keyword", () => {
    const result = classifierLevelHeuristic({
      user_request: "add a migration for users table",
    })
    expect(result.level).toBe("L3")
  })

  test("classifierLevelHeuristic returns L1 on generic request (no LLM semantic catch)", () => {
    // This demonstrates the heuristic's limit — why the LLM path exists.
    // "2FA" is semantically auth but has no keyword match in the fallback.
    const result = classifierLevelHeuristic({
      user_request: "add 2FA column to 5M-row users table",
    })
    expect(result.level).toBe("L1")
  })
})
