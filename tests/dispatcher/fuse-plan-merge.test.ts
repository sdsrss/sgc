// C2 · ALG-4 — dedupeConcerns must not discard the upgrading party's content.
//
// Before the fix, when a higher-severity concern merged into an already-kept
// lower-severity one, only `severity` was raised: the kept concern kept its
// low-severity text and source, mislabeled as high, and the informative
// high-severity text was dropped.

import { describe, expect, test } from "bun:test"
import { fusePlan } from "../../src/dispatcher/fuse-plan"

describe("C2/ALG-4: concern merge adopts the upgrading party", () => {
  test("a high structural risk merging into a medium ceo concern becomes the representative", () => {
    // ceo concern and eng structural risk share a dedup key ("breaking change")
    // so they merge. collectConcerns pushes the ceo concern first (medium), then
    // the structural risk (high) — so the medium one is kept first and the high
    // one merges in.
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: ["breaking change"], rewrite_hints: [] },
      eng: {
        verdict: "revise",
        concerns: [],
        structural_risks: [{ area: "api", risk: "breaking change", mitigation: "version" }],
      },
    })

    expect(d.ranked_concerns.length).toBe(1)
    const c = d.ranked_concerns[0]!
    expect(c.severity).toBe("high")
    // representative is the high-severity party, not the medium one it merged into
    expect(c.source).toBe("eng.structural_risk")
    expect(c.text).toContain("mitigation: version")
    // the displaced lower-severity party is recorded, not silently dropped
    expect(c.also_flagged_by).toContain("ceo")
    // and the representative never lists itself
    expect(c.also_flagged_by ?? []).not.toContain("eng.structural_risk")
  })

  test("a lower-severity concern merging into a higher-kept one leaves the representative intact", () => {
    // The structural risk (high) is collected before the adversarial mode (low),
    // so it is kept first and the low one merges in — the non-upgrade branch.
    // Representative stays the structural risk; the adversarial source is recorded.
    const d = fusePlan({
      eng: {
        verdict: "revise",
        concerns: [],
        structural_risks: [{ area: "deploy", risk: "rollback risk", mitigation: "canary" }],
      },
      adversarial: {
        failure_modes: [
          { scenario: "rollback risk", probability: "low", impact: "low", early_signal: "x" },
        ],
      },
    })

    expect(d.ranked_concerns.length).toBe(1)
    const c = d.ranked_concerns[0]!
    expect(c.severity).toBe("high")
    expect(c.source).toBe("eng.structural_risk")
    expect(c.text).toContain("mitigation: canary")
    expect(c.also_flagged_by).toContain("adversarial")
    expect(c.also_flagged_by ?? []).not.toContain("eng.structural_risk")
  })
})
