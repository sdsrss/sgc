// GS-1.2 live-dogfood regression (v1.12.1, 2026-05-25):
// `tokenize(undefined)` crashed at `.normalize()` when findBestMatch
// iterated legacy hand-written solutions/*.md entries missing
// schema-required fields. Defensive guards in tokenize + similarity
// coerce undefined/null inputs to safe defaults so the
// compound/promote pipeline degrades to "no overlap" instead of
// throwing TypeError. Caught by `sgc compound --from-canary` dogfood
// of the v1.11.0 PATH-shadow canary record against this repo's own
// .sgc/solutions/ corpus (2 of 3 entries are legacy
// minimal-frontmatter from pre-CE-1 phases).

import { describe, expect, it } from "bun:test"
import {
  findBestMatch,
  isDuplicate,
  similarity,
  tokenize,
  type SimilarityCandidate,
} from "../../src/dispatcher/dedup"
import type { SolutionFile } from "../../src/dispatcher/state"

describe("similarity — empty-feature collision (ALG-1 audit fix)", () => {
  const empty: SimilarityCandidate = { signature: "", tags: [], problem: "" }

  it("two all-empty candidates carry no similarity signal (NOT identical)", () => {
    // Pre-fix: jaccard(∅,∅)=1 for both the tag and problem component →
    // (1+1)/2 = 1.0 → an information-free candidate falsely deduped at 0.85.
    // The J(∅,∅)=1 identity convention is wrong as a *component* of an
    // averaged similarity over independent feature vectors.
    expect(similarity(empty, empty)).toBe(0)
  })

  it("all-empty candidate is not a duplicate of an all-empty existing entry", () => {
    const corpus: SolutionFile[] = [
      {
        path: "/dev/null/empty.md",
        category: "runtime",
        slug: "empty",
        body: "",
        entry: { category: "runtime" } as unknown as SolutionFile["entry"],
      },
    ]
    const best = findBestMatch(empty, corpus)
    expect(best).not.toBeNull()
    expect(isDuplicate(best)).toBe(false)
  })

  it("empty tags on both sides do not drag down an identical-problem match", () => {
    // Regression guard against the naive (0+probScore)/2 fix: a tagless pair
    // with identical problems must still merge on the problem signal alone.
    const a: SimilarityCandidate = { signature: "", tags: [], problem: "null pointer crash in auth handler" }
    const b: SimilarityCandidate = { signature: "", tags: [], problem: "null pointer crash in auth handler" }
    expect(similarity(a, b)).toBe(1)
  })

  it("empty problem on both sides scores on the tag signal alone", () => {
    const a: SimilarityCandidate = { signature: "", tags: ["auth", "npe"], problem: "" }
    const b: SimilarityCandidate = { signature: "", tags: ["auth", "npe"], problem: "" }
    expect(similarity(a, b)).toBe(1)
  })

  it('treats the "untagged" sentinel as no-signal (candidate [] vs stored [untagged])', () => {
    // The compound write path stores ["untagged"] when no tags were produced,
    // but the dedup candidate carries the raw (empty) context.tags. Comparing
    // [] vs ["untagged"] must NOT score the tag component 0 and halve an
    // identical-problem match — "untagged" is a placeholder, not a tag.
    const candidate: SimilarityCandidate = {
      signature: "candsig",
      tags: [], // raw context.tags (no tags produced)
      problem: "null pointer crash in the auth token refresh handler",
    }
    const stored: SimilarityCandidate = {
      signature: "storedsig", // different signature → no exact-match shortcut
      tags: ["untagged"], // write-path fallback
      problem: "null pointer crash in the auth token refresh handler",
    }
    // Identical problem text + no real tags on either side → problem signal
    // alone → 1.0 (was 0.5 under the [] vs [untagged] asymmetry).
    expect(similarity(candidate, stored)).toBe(1)
  })

  it('"untagged" both sides also collapses to the problem signal', () => {
    const a: SimilarityCandidate = { signature: "", tags: ["untagged"], problem: "race in websocket reconnect" }
    const b: SimilarityCandidate = { signature: "", tags: ["untagged"], problem: "race in websocket reconnect" }
    expect(similarity(a, b)).toBe(1)
  })
})

describe("tokenize — defensive guards (GS-1.2 DOG-2 regression)", () => {
  it("returns empty Set when input is undefined (no .normalize() crash)", () => {
    expect(() => tokenize(undefined as unknown as string)).not.toThrow()
    const result = tokenize(undefined as unknown as string)
    expect(result).toBeInstanceOf(Set)
    expect(result.size).toBe(0)
  })

  it("returns empty Set when input is null (no .normalize() crash)", () => {
    expect(() => tokenize(null as unknown as string)).not.toThrow()
    const result = tokenize(null as unknown as string)
    expect(result.size).toBe(0)
  })

  it("returns empty Set on empty string (no segmenter work)", () => {
    expect(tokenize("").size).toBe(0)
  })

  it("returns normal token set on well-formed input (no behavior regression)", () => {
    const tokens = tokenize("hello world this is a test")
    // 'this'/'is'/'a' are stopwords; 'hello'/'world'/'test' survive
    expect(tokens.has("hello")).toBe(true)
    expect(tokens.has("world")).toBe(true)
    expect(tokens.has("test")).toBe(true)
    expect(tokens.has("the")).toBe(false)
    expect(tokens.has("is")).toBe(false)
  })
})

describe("similarity — defensive guards against malformed existing entries (GS-1.2 DOG-2 regression)", () => {
  it("does not throw when existing.problem is undefined (legacy frontmatter)", () => {
    const cand: SimilarityCandidate = {
      signature: "candsig",
      tags: ["foo", "bar"],
      problem: "test problem text",
    }
    const malformed: SimilarityCandidate = {
      signature: "othersig",
      tags: undefined as unknown as string[],
      problem: undefined as unknown as string,
    }
    expect(() => similarity(cand, malformed)).not.toThrow()
    // No signature match + no token overlap (both tag set + problem
    // tokens are empty) → score == 0
    expect(similarity(cand, malformed)).toBe(0)
  })

  it("does not throw when candidate.problem is undefined", () => {
    const malformedCand: SimilarityCandidate = {
      signature: "candsig",
      tags: undefined as unknown as string[],
      problem: undefined as unknown as string,
    }
    const ex: SimilarityCandidate = {
      signature: "exsig",
      tags: ["a"],
      problem: "real problem",
    }
    expect(() => similarity(malformedCand, ex)).not.toThrow()
  })

  it("signature match still returns 1.0 even when other fields malformed", () => {
    const cand: SimilarityCandidate = {
      signature: "samesig",
      tags: ["x"],
      problem: "candidate",
    }
    const malformed: SimilarityCandidate = {
      signature: "samesig",
      tags: undefined as unknown as string[],
      problem: undefined as unknown as string,
    }
    expect(similarity(cand, malformed)).toBe(1)
  })
})

describe("findBestMatch — defensive across mixed-quality corpus (GS-1.2 DOG-2 regression)", () => {
  it("iterates a mixed corpus (well-formed + legacy minimal) without throwing", () => {
    const cand: SimilarityCandidate = {
      signature: "newcand",
      tags: ["alpha"],
      problem: "new candidate problem",
    }
    // Mimic the live-dogfood corpus shape: a mix of well-formed entry
    // and two legacy entries with only intent/category fields.
    const corpus: SolutionFile[] = [
      {
        path: "/dev/null/wellformed.md",
        category: "other",
        slug: "wellformed",
        body: "",
        entry: {
          id: "01HWELL00000000000000000000",
          signature: "wellsig",
          category: "other",
          problem: "well-formed problem",
          symptoms: ["s1"],
          what_didnt_work: [],
          solution: "sol",
          prevention: "prev",
          tags: ["beta"],
          first_seen: "2026-01-01T00:00:00Z",
          last_updated: "2026-01-01T00:00:00Z",
          times_referenced: 0,
          source_task_ids: ["01HTASK0000000000000000000"],
        },
      },
      {
        path: "/dev/null/legacy-1.md",
        category: "runtime",
        slug: "legacy-1",
        body: "",
        // Legacy entry: TS thinks all fields are present, but at
        // runtime parseFrontmatter on a minimal-frontmatter file
        // yields object with only `intent` + `category` populated.
        // Cast-through-unknown emulates that shape.
        entry: {
          category: "runtime",
        } as unknown as SolutionFile["entry"],
      },
      {
        path: "/dev/null/legacy-2.md",
        category: "runtime",
        slug: "legacy-2",
        body: "",
        entry: {
          category: "runtime",
        } as unknown as SolutionFile["entry"],
      },
    ]
    expect(() => findBestMatch(cand, corpus)).not.toThrow()
    const best = findBestMatch(cand, corpus)
    expect(best).not.toBeNull()
    // The well-formed entry should score highest (legacy entries score 0
    // due to empty tag set + empty problem token set on both sides of
    // similarity). Score is small but > 0 against the well-formed one
    // only if there's overlap — here there's no shared tag/token, so
    // it lands at 0 too. The contract here is just "doesn't crash + returns
    // something deterministic"; which entry wins on a tie is impl-defined.
    expect(best!.match).toBeDefined()
  })
})
