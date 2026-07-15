import { test, expect } from "bun:test"
import {
  EMBEDDED_CONTRACTS,
  EMBEDDED_PROMPTS,
  readContract,
  readPrompt,
  listEmbeddedPromptKeys,
} from "../../src/dispatcher/embedded-data"
import { getCapabilities } from "../../src/dispatcher/schema"

test("contracts are inlined and non-empty", () => {
  expect(EMBEDDED_CONTRACTS["sgc-capabilities.yaml"]?.length).toBeGreaterThan(100)
  expect(EMBEDDED_CONTRACTS["sgc-state.schema.yaml"]?.length).toBeGreaterThan(100)
})

// M5 derived this from the manifest instead of hardcoding a count. The old
// `toBe(11)` asserted a number nobody could check against anything: it went red
// when this batch added two prompts — correct behaviour — but it would have gone
// GREEN on the actual hazard, a manifest prompt_path with no embedded entry, so
// long as the total stayed 11. That failure ships a crash (spawn.ts:575 throws
// for every packaged user with an API key while the repo checkout works).
function declaredPromptPaths(): string[] {
  return Object.values(getCapabilities().subagents)
    .map((m) => m.prompt_path)
    .filter((p): p is string => typeof p === "string" && p.length > 0)
}

test("every prompt_path the manifest declares is inlined in the bundle", () => {
  const declared = declaredPromptPaths()
  expect(declared.length).toBeGreaterThan(0)
  for (const p of declared) {
    expect(listEmbeddedPromptKeys()).toContain(p)
    expect(EMBEDDED_PROMPTS[p]?.length ?? 0).toBeGreaterThan(50)
  }
})

test("no embedded prompt is orphaned — every inlined key is declared by some agent", () => {
  const declared = new Set(declaredPromptPaths())
  for (const key of listEmbeddedPromptKeys()) {
    expect(declared.has(key)).toBe(true)
  }
})

test("readContract returns embedded text by default", () => {
  expect(readContract("sgc-capabilities.yaml")).toBe(EMBEDDED_CONTRACTS["sgc-capabilities.yaml"]!)
})

test("readContract honors SGC_CONTRACTS_DIR override", () => {
  const prev = process.env["SGC_CONTRACTS_DIR"]
  process.env["SGC_CONTRACTS_DIR"] = process.cwd() + "/contracts"
  try {
    expect(readContract("sgc-capabilities.yaml").length).toBeGreaterThan(100)
  } finally {
    if (prev === undefined) delete process.env["SGC_CONTRACTS_DIR"]
    else process.env["SGC_CONTRACTS_DIR"] = prev
  }
})

test("readPrompt returns embedded text by default", () => {
  expect(readPrompt("prompts/planner-eng.md")).toBe(EMBEDDED_PROMPTS["prompts/planner-eng.md"]!)
})

test("planner-decompose prompt is embedded in the bundle", () => {
  expect(EMBEDDED_PROMPTS["prompts/planner-decompose.md"]).toBeDefined()
  expect(EMBEDDED_PROMPTS["prompts/planner-decompose.md"]!.length).toBeGreaterThan(100)
})
