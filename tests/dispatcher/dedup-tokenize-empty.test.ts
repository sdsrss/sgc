// A2 / audit v1.37.0 ALG-1: a problem that is PRESENT but tokenizes to nothing
// must not be treated as an ABSENT problem.
//
// similarity() drops the problem component when both sides tokenize empty, and
// lets the tag component (renormalized to weight 1.0) decide alone. Two states
// produce an empty token set and the code conflated them:
//   (a) problem absent ("")            → tag-alone is deliberate + tested.
//   (b) problem non-empty but yields 0 tokens — all stopwords, sub-minLen, or
//       single-char CJK ("锁" / "库" — minLen=2 for CJK drops them) — the bug.
//
// In case (b) two DIFFERENT problems with identical tags scored 1.0 and merged
// through the §3 write gate, silently destroying one entry — the exact failure
// the module's rule #2 (dedup.ts:125-127) forbids. Verified with the real
// module: similarity=1.0 for both prose and single-char-CJK pairs.

import { describe, expect, test } from "bun:test"
import { similarity, DEDUP_THRESHOLD } from "../../src/dispatcher/dedup"
import type { SimilarityCandidate } from "../../src/dispatcher/dedup"

const c = (tags: string[], problem: string): SimilarityCandidate => ({
  signature: "",
  tags,
  problem,
})

describe("similarity (A2/ALG-1: present-but-untokenizable problem ≠ absent)", () => {
  test("two different stopword-only problems with identical tags do NOT merge", () => {
    // Both tokenize to ∅ (all stopwords), but the raw prose differs → they are
    // not the same problem and identical tags must not carry them over the gate.
    const s = similarity(c(["deploy"], "is a of the"), c(["deploy"], "we go to it"))
    expect(s).toBeLessThan(DEDUP_THRESHOLD)
  })

  test("two different single-char CJK problems with identical tags do NOT merge", () => {
    const s = similarity(c(["deploy"], "锁"), c(["deploy"], "库"))
    expect(s).toBeLessThan(DEDUP_THRESHOLD)
  })

  test("the SAME untokenizable problem with identical tags still merges", () => {
    // Present-but-untokenizable is not a licence to never merge — identical raw
    // problems are still duplicates.
    const s = similarity(c(["deploy"], "锁"), c(["deploy"], "锁"))
    expect(s).toBeGreaterThanOrEqual(DEDUP_THRESHOLD)
  })

  test("case (a) preserved: genuinely absent problem still scores on tags alone", () => {
    // Both problem fields are empty strings (no problem recorded) → tag signal
    // alone decides, exactly as dedup.test.ts pins today.
    expect(similarity(c(["auth", "npe"], ""), c(["auth", "npe"], ""))).toBe(1)
  })

  test("case (a) preserved: two information-free entries never merge", () => {
    expect(similarity(c([], ""), c([], ""))).toBe(0)
  })
})
