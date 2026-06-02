import { test, expect } from "bun:test"
import {
  EMBEDDED_CONTRACTS,
  EMBEDDED_PROMPTS,
  readContract,
  readPrompt,
  listEmbeddedPromptKeys,
} from "../../src/dispatcher/embedded-data"

test("contracts are inlined and non-empty", () => {
  expect(EMBEDDED_CONTRACTS["sgc-capabilities.yaml"]?.length).toBeGreaterThan(100)
  expect(EMBEDDED_CONTRACTS["sgc-state.schema.yaml"]?.length).toBeGreaterThan(100)
})

test("all 10 prompts are inlined", () => {
  expect(listEmbeddedPromptKeys().length).toBe(10)
  expect(EMBEDDED_PROMPTS["prompts/planner-eng.md"]?.length).toBeGreaterThan(50)
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
