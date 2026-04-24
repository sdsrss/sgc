// Unicode dedup hotfix tests — verifies NFC normalization + Intl.Segmenter
// tokenization for CJK and accented input.
//
// Pre-hotfix behavior:
//   - normalizeText: toLowerCase + whitespace collapse (no NFC)
//   - tokenize: split(/[^a-z0-9]+/) strips all non-ASCII → empty Set for CJK
//
// Post-hotfix: NFC-normalized + Intl.Segmenter word-granularity.
// See docs/superpowers/specs/2026-04-24-phase-g-design.md Appendix A.

import { describe, expect, test } from "bun:test"
import {
  computeSignature,
  jaccard,
  normalizeText,
  tokenize,
} from "../../src/dispatcher/dedup"

describe("NFC normalization (Appendix A.4)", () => {
  test("NFD and NFC inputs produce identical computeSignature output", () => {
    const nfd = "café crash" // e + combining acute
    const nfc = "café crash" // precomposed é
    expect(computeSignature(nfd)).toBe(computeSignature(nfc))
  })

  test("normalizeText returns same string for NFD and NFC inputs", () => {
    const nfd = "café"
    const nfc = "café"
    expect(normalizeText(nfd)).toBe(normalizeText(nfc))
  })
})

describe("CJK tokenization (Appendix A.4)", () => {
  test("tokenize on CJK text returns non-empty Set", () => {
    const tokens = tokenize("修复空指针崩溃")
    expect(tokens.size).toBeGreaterThan(0)
  })

  test("tokenize is deterministic for identical CJK input", () => {
    const a = tokenize("修复启动时的空指针异常")
    const b = tokenize("修复启动时的空指针异常")
    expect([...a].sort()).toEqual([...b].sort())
  })

  test("two different CJK texts produce non-identical token sets", () => {
    const a = tokenize("修复启动时的空指针异常")
    const b = tokenize("重构认证中间件的会话管理")
    // Pre-hotfix: both return empty Set, jaccard returns 1 (trivial — both empty).
    // Post-hotfix: they segment into different tokens, jaccard < 1.
    expect(jaccard(a, b)).toBeLessThan(1)
  })

  test("CJK Jaccard self-identity — non-trivially 1 (not because both are empty)", () => {
    const t = tokenize("修复启动时的空指针异常")
    expect(t.size).toBeGreaterThan(0) // non-trivial
    expect(jaccard(t, t)).toBe(1)
  })
})

describe("English backwards compatibility (Appendix A.4)", () => {
  test("tokenize on English matches pre-hotfix golden", () => {
    const tokens = tokenize("refactor the auth middleware")
    expect(tokens).toEqual(new Set(["refactor", "auth", "middleware"]))
  })

  test("tokenize drops English stopwords", () => {
    const tokens = tokenize("a the is of in to for")
    expect(tokens.size).toBe(0)
  })

  test("tokenize keeps words longer than 2 chars", () => {
    const tokens = tokenize("ab cde fghi")
    expect(tokens.has("ab")).toBe(false) // 2 chars — filtered
    expect(tokens.has("cde")).toBe(true)
    expect(tokens.has("fghi")).toBe(true)
  })
})

describe("Mixed CN / EN (Appendix A.4)", () => {
  test("tokenize on mixed-script text yields both English and CJK tokens", () => {
    const tokens = tokenize("refactor 认证中间件 session management")
    // English tokens — should be present post-hotfix (same as before).
    expect(tokens.has("refactor")).toBe(true)
    expect(tokens.has("session")).toBe(true)
    expect(tokens.has("management")).toBe(true)
    // CJK tokens — at least one CJK segment present post-hotfix.
    const hasCjk = [...tokens].some((t) => /[一-鿿]/.test(t))
    expect(hasCjk).toBe(true)
  })
})
