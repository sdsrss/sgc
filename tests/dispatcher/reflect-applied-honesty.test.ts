// P2-7 regression: `applied` must not be advertised as validated reuse.
//
// The pipeline is circular by construction. preventions.ts feeds
// `prior_preventions` (each with a solution_ref) INTO planner.adversarial's
// prompt; extractAppliedSolutionRefs then scans that same agent's
// failure_modes[].early_signal for those same refs. Output matched against the
// input that produced it. An adversarial model that dutifully cites every
// prevention it was handed drives applied_count up forever, with no evidence
// that anything was ever prevented.
//
// reflect.ts nonetheless labelled it "applied = L3-validated reuse (strongest
// reuse signal)" — and ranked it ABOVE `surfaced`, which is epistemically the
// same class of signal (a keyword match). The label inverted the real strength
// ordering and made a prompt-echo look like proof that the knowledge engine
// pays off — the product's central claim.
//
// The honest fix is the label, not a fake independent signal: say what is
// actually counted, and say where it is weak, at the place users read it.

import { describe, expect, test } from "bun:test"
import { formatReport } from "../../src/dispatcher/reflect"
import type { ReflectReport } from "../../src/dispatcher/reflect"

const report: ReflectReport = {
  task_id: "01HTASK000000000000000000",
  decision_path: "decisions/01HTASK000000000000000000/intent.md",
  candidates: [
    {
      solution_ref: "runtime/alpha",
      keyword_overlap: 3,
      applied_count: 7,
      surfaced_count: 2,
      discussed: true,
      discussed_evidence: "cited in early_signal",
      prevention_text: "add a regression test for the empty-input path",
    },
  ],
} as ReflectReport

describe("reflect legend honesty (P2-7)", () => {
  const out = formatReport(report)

  test("does not claim `applied` is validated reuse", () => {
    expect(out).not.toMatch(/L3-validated/)
    expect(out).not.toMatch(/validated reuse/)
  })

  test("does not claim `applied` is the strongest signal", () => {
    expect(out.toLowerCase()).not.toContain("strongest")
  })

  test("says what applied actually counts (a citation in the pre-mortem)", () => {
    expect(out.toLowerCase()).toMatch(/cite|referenc|echo/)
  })

  test("discloses the circularity where the number is read", () => {
    // The reader must be able to see that the adversarial agent was handed the
    // very refs it is being credited for citing.
    expect(out.toLowerCase()).toMatch(/circular|was given|fed|handed|its own input/)
  })

  test("still prints the counts (honesty ≠ hiding the metric)", () => {
    expect(out).toContain("applied: 7")
    expect(out).toContain("surfaced: 2")
  })
})
