// C5 · ALG-7 — infra report matcher must not fire on substring collisions.
//
// INFRA_TERMS were all unbounded, so the REPORT matcher (def.pattern) flagged
// any added line containing "argo" or "helm" as a substring: `const cargo`
// (car-GO... no: c-ARGO) and `overwhelm` (over-w-HELM) both produced infra
// findings. The spawn TRIGGER stays loose by design (so `argocd` still spawns
// the reviewer); only the report side gets word boundaries.

import { describe, expect, test } from "bun:test"
import {
  reviewerInfra,
  INFRA,
  DIFF_CONDITIONAL_SPECIALISTS,
} from "../../src/dispatcher/agents/reviewer-specialists"

describe("C5/ALG-7: infra report word boundaries", () => {
  test("'cargo' and 'overwhelm' do not produce infra findings", () => {
    const out = reviewerInfra({
      diff: "+ const cargo = () => overwhelm(queue)\n",
      intent: "",
    })
    expect(out.findings.length).toBe(0)
    expect(out.verdict).toBe("pass")
  })

  test("real infra terms are still flagged", () => {
    expect(reviewerInfra({ diff: "+ helm upgrade release ./chart\n", intent: "" }).verdict).toBe(
      "concern",
    )
    expect(reviewerInfra({ diff: "+   argo-cd sync my-app\n", intent: "" }).verdict).toBe("concern")
    expect(reviewerInfra({ diff: "+ FROM node:20-alpine\n", intent: "" }).verdict).toBe("concern")
  })

  test("the report matcher rejects the collision but the spawn trigger still fires on argocd", () => {
    // report side: no finding for a bare `argocd` line (\bargo\b misses it)…
    expect(reviewerInfra({ diff: "+ run argocd apply\n", intent: "" }).findings.length).toBe(0)
    // …but the loose trigger still spawns the infra reviewer on it.
    const infra = DIFF_CONDITIONAL_SPECIALISTS.find((d) => d.name === "reviewer.infra")!
    expect(infra.trigger.test("+ run argocd apply")).toBe(true)
    // (INFRA export referenced so the matcher def stays under test import.)
    expect(INFRA.name).toBe("reviewer.infra")
  })
})
