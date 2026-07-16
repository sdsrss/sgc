// C1 / audit v1.37.0 ALG-3: the §11 concreteness gate false-accepted generic
// prose. FILE_EXT_RE (/\.[a-zA-Z0-9]{1,8}\b/) matched any word.word, so "e.g."
// and "U.S." and "end.Word" satisfied "references a concrete feature";
// LINE_NUM_RE (/:\d+\b/) matched clock times like "12:30". So "looks simple,
// e.g. nothing risky" — the exact bare rationale the gate exists to reject —
// passed. Fix: FILE_EXT requires a real code/doc extension (or a path with a
// slash); LINE_NUM requires a filename-like non-digit char before the colon.

import { describe, expect, test } from "bun:test"
import { rationaleIsConcrete } from "../../src/dispatcher/rationale"

describe("rationaleIsConcrete (C1/ALG-3: no false-concrete via punctuation)", () => {
  test("rejects generic prose that only 'matched' via a stray dot or clock", () => {
    expect(rationaleIsConcrete("looks simple, e.g. nothing risky")).toBe(false)
    expect(rationaleIsConcrete("U.S. English wording, no big deal")).toBe(false)
    expect(rationaleIsConcrete("end of the sentence.Then more prose")).toBe(false)
    expect(rationaleIsConcrete("trivial change, see the 12:30 standup")).toBe(false)
  })

  test("still accepts a genuine filename / line / path", () => {
    expect(rationaleIsConcrete("guards the null branch in scripts/audit.ts")).toBe(true)
    expect(rationaleIsConcrete("fixes the crash at review.ts:199")).toBe(true)
    expect(rationaleIsConcrete("edits plugins/sgc/bin/sgc.mjs")).toBe(true)
    expect(rationaleIsConcrete("updates SKILL.md wording")).toBe(true)
  })

  test("still accepts the other concrete signals (keyword / level / count)", () => {
    expect(rationaleIsConcrete("touches the auth schema")).toBe(true)
    expect(rationaleIsConcrete("minimum L2 per escalation rule")).toBe(true)
    expect(rationaleIsConcrete("changes 3 files across the dispatcher")).toBe(true)
  })
})
