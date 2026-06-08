// P2-2: OpenRouter response parsing gains layered recovery so a model that
// drops the ```yaml tag or omits the closing fence does not hard-fail.

import { expect, test } from "bun:test"
import { extractYamlBlock } from "../../src/dispatcher/openrouter-agent"

test("extracts an explicitly tagged ```yaml fence, ignoring surrounding prose", () => {
  expect(extractYamlBlock("Here you go:\n```yaml\nverdict: approve\n```\nthanks")).toBe(
    "verdict: approve",
  )
})

test("recovers a generic ``` fence when the model drops the language tag", () => {
  expect(extractYamlBlock("```\nverdict: approve\n```")).toBe("verdict: approve")
})

test("recovers a mis-tagged ```json fence", () => {
  expect(extractYamlBlock("```json\nverdict: approve\nseverity: none\n```")).toBe(
    "verdict: approve\nseverity: none",
  )
})

test("recovers an unterminated fence by stripping stray fence lines", () => {
  expect(extractYamlBlock("```yaml\nverdict: approve\nseverity: none")).toBe(
    "verdict: approve\nseverity: none",
  )
})

test("returns a bare fence-less body unchanged", () => {
  expect(extractYamlBlock("verdict: approve\nseverity: none")).toBe(
    "verdict: approve\nseverity: none",
  )
})
