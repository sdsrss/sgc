// GS-3 plan-fusion — unit tests.
// Spec: tasks/specs/gs-3-plan-fusion.md (r1).

import { describe, expect, test } from "bun:test"
import { worstPlanVerdict, fusePlan, renderFusedSection } from "../../src/dispatcher/fuse-plan"
import type { PlannerCeoOutput } from "../../src/dispatcher/agents/planner-ceo"
import type { PlannerEngOutput } from "../../src/dispatcher/agents/planner-eng"
import type { PlannerAdversarialOutput, FailureMode } from "../../src/dispatcher/agents/planner-adversarial"

const ceo = (v: PlannerCeoOutput["verdict"]): PlannerCeoOutput => ({
  verdict: v, concerns: [], rewrite_hints: [],
})
const eng = (v: PlannerEngOutput["verdict"]): PlannerEngOutput => ({
  verdict: v, concerns: [], structural_risks: [],
})
const fm = (probability: FailureMode["probability"], impact: FailureMode["impact"]): FailureMode => ({
  scenario: "s", probability, impact, early_signal: "sig",
})
const adv = (modes: FailureMode[]): PlannerAdversarialOutput => ({ failure_modes: modes })

describe("worstPlanVerdict", () => {
  test("reject beats revise beats approve", () => {
    expect(worstPlanVerdict("approve", "revise")).toBe("revise")
    expect(worstPlanVerdict("revise", "reject")).toBe("reject")
    expect(worstPlanVerdict("approve", "reject")).toBe("reject")
  })
  test("equal verdicts return the same", () => {
    expect(worstPlanVerdict("approve", "approve")).toBe("approve")
    expect(worstPlanVerdict("reject", "reject")).toBe("reject")
  })
  test("order-independent", () => {
    expect(worstPlanVerdict("reject", "approve")).toBe("reject")
    expect(worstPlanVerdict("revise", "approve")).toBe("revise")
  })
})

describe("fusePlan verdict", () => {
  test("worst of ceo+eng wins", () => {
    expect(fusePlan({ ceo: ceo("approve"), eng: eng("revise") }).fused_verdict).toBe("revise")
    expect(fusePlan({ ceo: ceo("reject"), eng: eng("approve") }).fused_verdict).toBe("reject")
  })
  test("absent ceo falls back to eng", () => {
    expect(fusePlan({ eng: eng("revise") }).fused_verdict).toBe("revise")
  })
  test("high/high adversarial floors approve to revise", () => {
    const d = fusePlan({ ceo: ceo("approve"), eng: eng("approve"), adversarial: adv([fm("high", "high")]) })
    expect(d.fused_verdict).toBe("revise")
    expect(d.decision_basis).toContain("floors approve")
  })
  test("high/high does NOT escalate revise to reject", () => {
    const d = fusePlan({ ceo: ceo("revise"), eng: eng("revise"), adversarial: adv([fm("high", "high")]) })
    expect(d.fused_verdict).toBe("revise")
  })
  test("non-high/high adversarial leaves approve intact", () => {
    const d = fusePlan({ ceo: ceo("approve"), eng: eng("approve"), adversarial: adv([fm("low", "high"), fm("high", "medium")]) })
    expect(d.fused_verdict).toBe("approve")
  })
  test("conflict surfaced when ceo and eng differ", () => {
    const d = fusePlan({ ceo: ceo("approve"), eng: eng("reject") })
    expect(d.conflicts).toContain("ceo=approve vs eng=reject")
  })
  test("adversarial override of unanimous approve is a conflict", () => {
    const d = fusePlan({ ceo: ceo("approve"), eng: eng("approve"), adversarial: adv([fm("high", "high")]) })
    expect(d.conflicts.some((c) => c.includes("overrode unanimous approve"))).toBe(true)
  })
  test("absent ceo + high/high floor: verdict revise, non-unanimous conflict msg", () => {
    const d = fusePlan({ eng: eng("approve"), adversarial: adv([fm("high", "high")]) })
    expect(d.fused_verdict).toBe("revise")
    expect(d.conflicts.some((c) => c.includes("overrode eng=approve"))).toBe(true)
  })
})

describe("fusePlan concerns", () => {
  test("collects from all four sources with severity", () => {
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: ["ceo worry alpha"], rewrite_hints: [] },
      eng: {
        verdict: "revise",
        concerns: ["eng worry beta"],
        structural_risks: [{ area: "db", risk: "lock contention", mitigation: "index" }],
      },
      adversarial: adv([fm("medium", "high")]),
    })
    const sources = d.ranked_concerns.map((c) => c.source)
    expect(sources).toContain("ceo")
    expect(sources).toContain("eng")
    expect(sources).toContain("eng.structural_risk")
    expect(sources).toContain("adversarial")
  })
  test("structural_risk ranks high above medium ceo/eng concerns", () => {
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: ["ceo medium worry"], rewrite_hints: [] },
      eng: { verdict: "revise", concerns: [], structural_risks: [{ area: "api", risk: "breaking change", mitigation: "version" }] },
    })
    expect(d.ranked_concerns[0]!.severity).toBe("high")
    expect(d.ranked_concerns[0]!.source).toBe("eng.structural_risk")
  })
  test("near-duplicate concerns merge, higher severity kept, source recorded", () => {
    const shared = "migration script may corrupt production data on apply"
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: [shared], rewrite_hints: [] },
      eng: {
        verdict: "revise",
        concerns: [],
        structural_risks: [{ area: "data", risk: shared, mitigation: "dry run" }],
      },
    })
    const matches = d.ranked_concerns.filter((c) => c.text.includes("corrupt production data"))
    expect(matches.length).toBe(1)
    expect(matches[0]!.severity).toBe("high")
    expect(matches[0]!.also_flagged_by?.length).toBe(1)
  })
  test("near-duplicate (not identical) merges; distinct concern stays separate", () => {
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: ["the migration may corrupt production data on apply"], rewrite_hints: [] },
      eng: { verdict: "revise", concerns: ["the migration may corrupt production data on apply now"], structural_risks: [] },
      adversarial: adv([fm("low", "low")]),  // scenario "s" — unrelated to migration text
    })
    const migrationConcerns = d.ranked_concerns.filter((c) => c.text.includes("corrupt production data"))
    expect(migrationConcerns.length).toBe(1)            // the two near-dups merged
    expect(migrationConcerns[0]!.also_flagged_by?.length).toBe(1)
    expect(d.ranked_concerns.some((c) => c.text.includes("early signal"))).toBe(true)  // adversarial concern NOT merged away
  })
  test("empty cluster yields empty concern list", () => {
    const d = fusePlan({ ceo: ceo("approve"), eng: eng("approve") })
    expect(d.ranked_concerns).toEqual([])
  })
  test("empty-token concern keys do not falsely merge (ALG-1 audit fix)", () => {
    // Both _keys tokenize to ∅ (all stopwords / sub-floor words). Pre-fix
    // jaccard(∅,∅)=1 ≥ DEDUP_THRESHOLD merged these unrelated,
    // information-free concerns into one. featureOverlap returns 0 for the
    // no-signal pair so they stay distinct.
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: ["the is of"], rewrite_hints: [] },
      eng: { verdict: "revise", concerns: ["a an to"], structural_risks: [] },
    })
    expect(d.ranked_concerns.length).toBe(2)
  })
})

describe("renderFusedSection", () => {
  test("renders heading, verdict, basis, conflicts, concerns", () => {
    const d = fusePlan({
      ceo: { verdict: "approve", concerns: [], rewrite_hints: [] },
      eng: { verdict: "approve", concerns: [], structural_risks: [{ area: "api", risk: "breaking change", mitigation: "version it" }] },
      adversarial: adv([fm("high", "high")]),
    })
    const md = renderFusedSection(d)
    expect(md).toContain("## Fused decision")
    expect(md).toContain("**Verdict:** revise")
    expect(md).toContain("floors approve")
    expect(md).toContain("### Ranked concerns")
    expect(md).toContain("breaking change")
    expect(md).toContain("### Conflicts")
  })
  test("omits empty sections", () => {
    const md = renderFusedSection(fusePlan({ ceo: ceo("approve"), eng: eng("approve") }))
    expect(md).toContain("## Fused decision")
    expect(md).not.toContain("### Ranked concerns")
    expect(md).not.toContain("### Conflicts")
  })
  test("shows also_flagged_by annotation", () => {
    const shared = "migration may corrupt production data on apply now"
    const d = fusePlan({
      ceo: { verdict: "revise", concerns: [shared], rewrite_hints: [] },
      eng: { verdict: "revise", concerns: [], structural_risks: [{ area: "data", risk: shared, mitigation: "dry run" }] },
    })
    expect(renderFusedSection(d)).toContain("also flagged by")
  })
})
