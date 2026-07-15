import { describe, expect, test } from "bun:test"
import { buildPattern, displayList, type Term } from "../../src/dispatcher/agents/terms"

describe("buildPattern", () => {
  test("word-bounded terms are wrapped in a single \\b(...)\\b group", () => {
    const terms: Term[] = [
      { display: "cache", re: "cache", wordBounded: true },
      { display: "index", re: "index", wordBounded: true },
    ]
    expect(buildPattern(terms).source).toBe("\\b(cache|index)\\b")
  })

  test("unbounded terms alternate OUTSIDE the group", () => {
    // This is the M5 shape. A \b after a literal ')' only matches when the next
    // char is a word char, so "O(n)" never matched while being advertised.
    const terms: Term[] = [
      { display: "cache", re: "cache", wordBounded: true },
      { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false },
    ]
    const re = buildPattern(terms)
    expect(re.source).toBe("\\b(cache)\\b|O\\(n\\^?\\d*\\)")
    expect(re.test("// O(n^2) hot loop")).toBe(true)
    expect(re.test("const x = O(n)")).toBe(true)
    expect(re.test("indexOf(y)")).toBe(false)
  })

  test("all-unbounded produces no \\b group at all", () => {
    const terms: Term[] = [
      { display: "Dockerfile", re: "Dockerfile", wordBounded: false },
      { display: "FROM <x>", re: String.raw`FROM\s+\w`, wordBounded: false },
    ]
    expect(buildPattern(terms).source).toBe("Dockerfile|FROM\\s+\\w")
  })

  test("is case-insensitive by default and honours an explicit flag string", () => {
    const terms: Term[] = [{ display: "auth", re: "auth", wordBounded: false }]
    expect(buildPattern(terms).flags).toBe("i")
    expect(buildPattern(terms, "gi").flags).toBe("gi")
  })

  test("displayList joins the display names, not the regex sources", () => {
    const terms: Term[] = [
      { display: "O(n…)", re: String.raw`O\(n\^?\d*\)`, wordBounded: false },
      { display: "n+1", re: String.raw`n\+1`, wordBounded: true },
    ]
    expect(displayList(terms)).toBe("O(n…)|n+1")
  })

  test("an empty term list throws rather than building a regex matching everything", () => {
    expect(() => buildPattern([])).toThrow(/at least one term/)
  })
})
