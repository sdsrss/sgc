// P2-1: post-spawn banned-vocab lint (warn-only). Guards the gap the
// 2026-06-08 audit found — every prompt bans vacuous hedge vocabulary but
// nothing enforced it on LLM output.

import { expect, test } from "bun:test"
import { detectBannedVocab } from "../../src/dispatcher/validation"

test("flags bare hedge adjectives", () => {
  expect(detectBannedVocab("This is a robust solution")).toContain("robust")
  expect(detectBannedVocab("a comprehensive rewrite")).toContain("comprehensive")
  expect(detectBannedVocab("now production-ready")).toContain("production-ready")
})

test("does NOT flag legitimate longer words (letter-boundary)", () => {
  // "robustness" is a fine technical noun — must not trip on the "robust" stem.
  expect(detectBannedVocab("improves robustness under load")).toEqual([])
  expect(detectBannedVocab("comprehensively documented elsewhere")).toEqual([])
})

test("is case-insensitive for EN and matches at string edges", () => {
  expect(detectBannedVocab("ROBUST.")).toContain("robust")
  expect(detectBannedVocab("Seamless")).toContain("seamless")
})

test("flags CJK hedges as substrings", () => {
  expect(detectBannedVocab("性能显著提升")).toContain("显著")
  expect(detectBannedVocab("大幅优化了查询")).toContain("大幅")
})

test("returns unique terms and empty array on clean text", () => {
  expect(detectBannedVocab("robust and robust again")).toEqual(["robust"])
  expect(detectBannedVocab("a precise, tested fix for the empty-input crash")).toEqual([])
  expect(detectBannedVocab("")).toEqual([])
})

test("scans JSON-stringified structured output (the spawn.ts call shape)", () => {
  const output = { verdict: "approve", concerns: ["ship a robust pipeline"] }
  expect(detectBannedVocab(JSON.stringify(output))).toContain("robust")
})
