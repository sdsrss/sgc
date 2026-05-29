# GS-3 Plan-Fusion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic fusion layer to `sgc plan` that synthesizes the planner cluster's three independent verdicts (ceo/eng/adversarial) into one `FusedDecision` written to `intent.md`.

**Architecture:** A new pure function `fusePlan()` in `src/dispatcher/fuse-plan.ts` reads the three already-frozen planner outputs (no LLM, no IO, no `solutions/` access → Invariant §1 untouched), computes a fused verdict (`approve|revise|reject`) by explicit precedence rules with an adversarial high/high floor, dedupes+ranks all concerns reusing `dedup.ts`, and renders a `## Fused decision` section. `plan.ts` calls it at L2/L3 before `writeIntent`; a new optional `fused_verdict` frontmatter field carries the machine-readable result.

**Tech Stack:** TypeScript, Bun runtime, `bun:test`, citty CLI. Tests run via `SGC_FORCE_INLINE=1 bun test tests/`.

**Spec:** `tasks/specs/gs-3-plan-fusion.md` (r1). **Level:** L3 / §4.FULL-lite rigor. **SemVer:** minor `v1.18.0`.

---

## File Structure

- **Create** `src/dispatcher/fuse-plan.ts` — the pure fusion function + render helper. Single responsibility: turn three planner outputs into one `FusedDecision` and its markdown rendering.
- **Create** `tests/dispatcher/fuse-plan.test.ts` — unit tests for `fusePlan` + `worstPlanVerdict` + `renderFusedSection`.
- **Modify** `src/dispatcher/types.ts` — add `PlanVerdict` type; add `fused_verdict?` to `IntentDoc`.
- **Modify** `src/dispatcher/state.ts` — `validateIntent` enum check for `fused_verdict`.
- **Modify** `contracts/sgc-state.schema.yaml` — add `fused_verdict` to intent `optional_fields`.
- **Modify** `src/commands/plan.ts` — call `fusePlan` at L2/L3; prepend section; set frontmatter; add L3-summary line.
- **Modify** `tests/dispatcher/plan-*.test.ts` (integration) — assert section + frontmatter at L2/L3, L1 unchanged.
- **Modify** `CHANGELOG.md`, `package.json`, `plugin.json` — released-artifact: version bump + migration note.

---

## Task 1: `PlanVerdict` type + verdict-precedence helper

**Files:**
- Modify: `src/dispatcher/types.ts` (add `PlanVerdict`)
- Create: `src/dispatcher/fuse-plan.ts`
- Test: `tests/dispatcher/fuse-plan.test.ts`

- [ ] **Step 1: Add `PlanVerdict` to types.ts**

In `src/dispatcher/types.ts`, add near the other shared type aliases (e.g. next to `Verdict`):

```ts
/** Plan-cluster verdict vocabulary (planner.ceo / planner.eng / fused).
 *  DISTINCT from the review-cluster `Verdict` (pass|concern|fail). Do not
 *  conflate — see tasks/specs/gs-3-plan-fusion.md Constraint 5. */
export type PlanVerdict = "approve" | "revise" | "reject"
```

- [ ] **Step 2: Write the failing test for `worstPlanVerdict`**

Create `tests/dispatcher/fuse-plan.test.ts`:

```ts
// GS-3 plan-fusion — unit tests.
// Spec: tasks/specs/gs-3-plan-fusion.md (r1).

import { describe, expect, test } from "bun:test"
import { worstPlanVerdict } from "../../src/dispatcher/fuse-plan"

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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: FAIL — `Cannot find module '../../src/dispatcher/fuse-plan'`.

- [ ] **Step 4: Create fuse-plan.ts with the helper**

Create `src/dispatcher/fuse-plan.ts`:

```ts
// GS-3 — deterministic multi-perspective plan-decision fusion.
// Spec: tasks/specs/gs-3-plan-fusion.md
//
// Pure function: reads the three FROZEN planner-cluster outputs and
// synthesizes one FusedDecision. No LLM, no IO, no solutions access —
// Invariant §1 is untouched (fusion runs after the planners freeze and
// never reads solutions/).

import type { PlanVerdict } from "./types"

const PLAN_VERDICT_RANK: Record<PlanVerdict, number> = {
  approve: 0,
  revise: 1,
  reject: 2,
}

/** Worse of two plan verdicts by precedence reject > revise > approve. */
export function worstPlanVerdict(a: PlanVerdict, b: PlanVerdict): PlanVerdict {
  return PLAN_VERDICT_RANK[a] >= PLAN_VERDICT_RANK[b] ? a : b
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/dispatcher/types.ts src/dispatcher/fuse-plan.ts tests/dispatcher/fuse-plan.test.ts
git commit -m "feat(GS-3): PlanVerdict type + worstPlanVerdict precedence helper"
```

---

## Task 2: `fusePlan` verdict + basis + conflicts (no concerns yet)

**Files:**
- Modify: `src/dispatcher/fuse-plan.ts`
- Test: `tests/dispatcher/fuse-plan.test.ts`

- [ ] **Step 1: Write the failing tests for verdict fusion**

Append to `tests/dispatcher/fuse-plan.test.ts`:

```ts
import { fusePlan } from "../../src/dispatcher/fuse-plan"
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
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: FAIL — `fusePlan is not a function`.

- [ ] **Step 3: Implement verdict fusion in fuse-plan.ts**

Add imports at the top of `src/dispatcher/fuse-plan.ts` (below the existing `PlanVerdict` import):

```ts
import type { PlannerCeoOutput } from "./agents/planner-ceo"
import type { PlannerEngOutput } from "./agents/planner-eng"
import type { PlannerAdversarialOutput } from "./agents/planner-adversarial"
```

Then append:

```ts
export type ConcernSource = "ceo" | "eng" | "eng.structural_risk" | "adversarial"
export type ConcernSeverity = "high" | "medium" | "low"

export interface FusedConcern {
  source: ConcernSource
  text: string
  severity: ConcernSeverity
  also_flagged_by?: ConcernSource[]
}

export interface FusedDecision {
  fused_verdict: PlanVerdict
  decision_basis: string
  ranked_concerns: FusedConcern[]
  conflicts: string[]
}

export interface FusePlanInput {
  ceo?: PlannerCeoOutput | null
  eng: PlannerEngOutput
  adversarial?: PlannerAdversarialOutput | null
}

function hasHighHighFailure(adversarial?: PlannerAdversarialOutput | null): boolean {
  if (!adversarial) return false
  return adversarial.failure_modes.some(
    (m) => m.probability === "high" && m.impact === "high",
  )
}

export function fusePlan(input: FusePlanInput): FusedDecision {
  const ceoV = input.ceo?.verdict
  const engV = input.eng.verdict
  let base: PlanVerdict = ceoV ? worstPlanVerdict(ceoV, engV) : engV

  const conflicts: string[] = []
  if (ceoV && ceoV !== engV) conflicts.push(`ceo=${ceoV} vs eng=${engV}`)

  let basis: string
  if (hasHighHighFailure(input.adversarial) && base === "approve") {
    base = "revise"
    basis = "high/high pre-mortem risk floors approve → revise"
    conflicts.push("adversarial high/high risk overrode unanimous approve")
  } else if (ceoV && ceoV !== engV) {
    basis = `${base} dominates (ceo=${ceoV}, eng=${engV})`
  } else {
    basis = base === "approve" ? "all perspectives approve" : `consensus ${base}`
  }

  return { fused_verdict: base, decision_basis: basis, ranked_concerns: [], conflicts }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: PASS (all verdict tests + Task 1 tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/fuse-plan.ts tests/dispatcher/fuse-plan.test.ts
git commit -m "feat(GS-3): fusePlan verdict fusion + adversarial floor + conflict detection"
```

---

## Task 3: Concern collection + dedup + rank

**Files:**
- Modify: `src/dispatcher/fuse-plan.ts`
- Test: `tests/dispatcher/fuse-plan.test.ts`

- [ ] **Step 1: Write the failing tests for concern fusion**

Append to `tests/dispatcher/fuse-plan.test.ts`:

```ts
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
    // ceo(medium) + eng.structural_risk(high) describe the same risk → 1 entry, high
    const matches = d.ranked_concerns.filter((c) => c.text.includes("corrupt production data"))
    expect(matches.length).toBe(1)
    expect(matches[0]!.severity).toBe("high")
    expect(matches[0]!.also_flagged_by?.length).toBe(1)
  })
  test("empty cluster yields empty concern list", () => {
    const d = fusePlan({ ceo: ceo("approve"), eng: eng("approve") })
    expect(d.ranked_concerns).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: FAIL — `ranked_concerns` is `[]` (collection not implemented).

- [ ] **Step 3: Implement concern collection/dedup/rank**

Add the dedup import at the top of `src/dispatcher/fuse-plan.ts`:

```ts
import { tokenize, jaccard } from "./dedup"
```

Add the threshold constant next to `PLAN_VERDICT_RANK`:

```ts
// Invariant §3 corpus similarity threshold, reused for concern dedup.
const DEDUP_THRESHOLD = 0.85

const SEVERITY_RANK: Record<ConcernSeverity, number> = { high: 2, medium: 1, low: 0 }
const SOURCE_ORDER: Record<ConcernSource, number> = {
  "eng.structural_risk": 0,
  adversarial: 1,
  eng: 2,
  ceo: 3,
}
```

Add these helpers (above `fusePlan`):

```ts
function collectConcerns(input: FusePlanInput): FusedConcern[] {
  const out: FusedConcern[] = []
  if (input.ceo) {
    for (const c of input.ceo.concerns) out.push({ source: "ceo", text: c, severity: "medium" })
  }
  for (const c of input.eng.concerns) out.push({ source: "eng", text: c, severity: "medium" })
  for (const r of input.eng.structural_risks) {
    out.push({
      source: "eng.structural_risk",
      text: `${r.area}: ${r.risk} (mitigation: ${r.mitigation})`,
      severity: "high",
    })
  }
  if (input.adversarial) {
    for (const m of input.adversarial.failure_modes) {
      out.push({
        source: "adversarial",
        text: `[${m.probability}/${m.impact}] ${m.scenario} — early signal: ${m.early_signal}`,
        severity: m.impact,
      })
    }
  }
  return out
}

function dedupeConcerns(concerns: FusedConcern[]): FusedConcern[] {
  const kept: FusedConcern[] = []
  for (const c of concerns) {
    const cTokens = tokenize(c.text)
    let merged = false
    for (const k of kept) {
      if (jaccard(cTokens, tokenize(k.text)) >= DEDUP_THRESHOLD) {
        if (SEVERITY_RANK[c.severity] > SEVERITY_RANK[k.severity]) k.severity = c.severity
        k.also_flagged_by = [...(k.also_flagged_by ?? []), c.source]
        merged = true
        break
      }
    }
    if (!merged) kept.push({ ...c })
  }
  return kept
}

function rankConcerns(concerns: FusedConcern[]): FusedConcern[] {
  return [...concerns].sort((a, b) => {
    const sev = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]
    if (sev !== 0) return sev
    return SOURCE_ORDER[a.source] - SOURCE_ORDER[b.source]
  })
}
```

Then replace the `ranked_concerns: []` line in `fusePlan`'s return with:

```ts
  const ranked = rankConcerns(dedupeConcerns(collectConcerns(input)))

  return { fused_verdict: base, decision_basis: basis, ranked_concerns: ranked, conflicts }
```

(Delete the old `return { ... ranked_concerns: [], ... }` statement.)

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: PASS (all fuse-plan tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/fuse-plan.ts tests/dispatcher/fuse-plan.test.ts
git commit -m "feat(GS-3): concern collection + jaccard dedup + severity rank"
```

---

## Task 4: `renderFusedSection` markdown renderer

**Files:**
- Modify: `src/dispatcher/fuse-plan.ts`
- Test: `tests/dispatcher/fuse-plan.test.ts`

- [ ] **Step 1: Write the failing test for the renderer**

Append to `tests/dispatcher/fuse-plan.test.ts`:

```ts
import { renderFusedSection } from "../../src/dispatcher/fuse-plan"

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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: FAIL — `renderFusedSection is not a function`.

- [ ] **Step 3: Implement the renderer**

Append to `src/dispatcher/fuse-plan.ts`:

```ts
/** Render a FusedDecision as the `## Fused decision` intent.md section.
 *  Plain synthesis text — carries no solution_ref / sentinel content, so it
 *  is not a back-channel surface (spec §Design). */
export function renderFusedSection(d: FusedDecision): string {
  const lines: string[] = ["## Fused decision", ""]
  lines.push(`**Verdict:** ${d.fused_verdict}`)
  lines.push(`**Basis:** ${d.decision_basis}`)
  lines.push("")
  if (d.conflicts.length > 0) {
    lines.push("### Conflicts", "")
    for (const c of d.conflicts) lines.push(`- ${c}`)
    lines.push("")
  }
  if (d.ranked_concerns.length > 0) {
    lines.push("### Ranked concerns", "")
    for (const c of d.ranked_concerns) {
      const also = c.also_flagged_by?.length
        ? ` (also flagged by ${c.also_flagged_by.join(", ")})`
        : ""
      lines.push(`- [${c.severity}] (${c.source}) ${c.text}${also}`)
    }
    lines.push("")
  }
  return lines.join("\n")
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/fuse-plan.test.ts`
Expected: PASS (all fuse-plan tests).

- [ ] **Step 5: Commit**

```bash
git add src/dispatcher/fuse-plan.ts tests/dispatcher/fuse-plan.test.ts
git commit -m "feat(GS-3): renderFusedSection markdown renderer"
```

---

## Task 5: `fused_verdict` on IntentDoc + schema + validation

**Files:**
- Modify: `src/dispatcher/types.ts` (add field to `IntentDoc`)
- Modify: `src/dispatcher/state.ts` (`validateIntent`)
- Modify: `contracts/sgc-state.schema.yaml`
- Test: `tests/dispatcher/state.test.ts` (or the file already covering `writeIntent`/`validateIntent`)

- [ ] **Step 1: Locate the intent validation test file**

Run: `grep -rln "validateIntent\|writeIntent\|IntentImmutable" tests/`
Use the file that already exercises intent writing (likely `tests/dispatcher/state.test.ts`). Add tests there; if none exists, create `tests/dispatcher/state-intent-fused.test.ts` with the same import style as `tests/dispatcher/applied-tracker.test.ts` (uses `mkdtempSync(tmpdir())` for `stateRoot`).

- [ ] **Step 2: Write the failing tests**

Append to the chosen test file (shown standalone; adjust imports to match the file):

```ts
import { describe, expect, test } from "bun:test"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { writeIntent, readIntent } from "../../src/dispatcher/state"
import type { IntentDoc } from "../../src/dispatcher/types"

function baseIntent(overrides: Partial<IntentDoc> = {}): IntentDoc {
  return {
    task_id: "01HZZZZZZZZZZZZZZZZZZZZZZZZ" as IntentDoc["task_id"],
    level: "L2",
    created_at: "2026-05-29T00:00:00.000Z",
    title: "test intent",
    motivation: "this motivation is deliberately at least twenty words long so that the schema min word count validation rule does not reject it during the test",
    affected_readers: ["dev"],
    scope_tokens: [],
    body: "## x\n",
    ...overrides,
  }
}

describe("intent fused_verdict field", () => {
  test("accepts a valid fused_verdict and round-trips it", () => {
    const root = mkdtempSync(`${tmpdir()}/sgc-fused-`)
    const intent = baseIntent({ fused_verdict: "revise" })
    writeIntent(intent, root)
    expect(readIntent(intent.task_id, root).fused_verdict).toBe("revise")
  })
  test("rejects an out-of-enum fused_verdict", () => {
    const root = mkdtempSync(`${tmpdir()}/sgc-fused-`)
    const intent = baseIntent({ fused_verdict: "maybe" as unknown as IntentDoc["fused_verdict"] })
    expect(() => writeIntent(intent, root)).toThrow(/fused_verdict/)
  })
  test("pre-GS-3 intent without fused_verdict still validates", () => {
    const root = mkdtempSync(`${tmpdir()}/sgc-fused-`)
    const intent = baseIntent()
    expect(intent.fused_verdict).toBeUndefined()
    expect(() => writeIntent(intent, root)).not.toThrow()
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test <chosen test file>`
Expected: FAIL — `fused_verdict` not on `IntentDoc` type (TS error) and/or out-of-enum value not rejected.

- [ ] **Step 4: Add the field to `IntentDoc`**

In `src/dispatcher/types.ts`, add to the `IntentDoc` interface (after `user_signature`, before `body`):

```ts
  /** GS-3: deterministic fused plan verdict (planner cluster synthesis).
   *  Optional + additive — pre-GS-3 intents omit it. */
  fused_verdict?: PlanVerdict
```

- [ ] **Step 5: Add enum validation to `validateIntent`**

In `src/dispatcher/state.ts`, inside `validateIntent`, after the L3 `user_signature` check and before the closing brace, add:

```ts
  if (intent.fused_verdict !== undefined &&
      !["approve", "revise", "reject"].includes(intent.fused_verdict)) {
    throw new StateError(
      "SchemaViolation",
      `fused_verdict must be one of approve|revise|reject (got '${intent.fused_verdict}')`,
    )
  }
```

- [ ] **Step 6: Add the field to the schema**

In `contracts/sgc-state.schema.yaml`, under intent `optional_fields` (after the `user_signature` block, ~line 66), add:

```yaml
        fused_verdict:
          type: enum
          values: [approve, revise, reject]
          note: "GS-3 — deterministic planner-cluster fusion verdict; additive/optional"
```

- [ ] **Step 7: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test <chosen test file>`
Expected: PASS (3 tests).

- [ ] **Step 8: Commit**

```bash
git add src/dispatcher/types.ts src/dispatcher/state.ts contracts/sgc-state.schema.yaml <chosen test file>
git commit -m "feat(GS-3): fused_verdict optional intent field + enum validation + schema"
```

---

## Task 6: Wire `fusePlan` into `plan.ts` (L2/L3 only)

**Files:**
- Modify: `src/commands/plan.ts`
- Test: integration test (locate via Step 1)

**Context for the implementer:** In `src/commands/plan.ts` the L2/L3 branch assigns `plannerCeoOut`, `plannerEngOut`, and (L3 only) `adversarialOut` before the intent body is assembled (around lines 588-645, the `if (level !== "L0")` block). The body is built by string concatenation into `IntentDoc.body`. `writeIntent` serializes all non-`body` fields to frontmatter, so setting `intent.fused_verdict` is enough to persist it.

- [ ] **Step 1: Locate the plan integration test file**

Run: `grep -rln "runPlan\|plannerCeoOut\|## Planner.ceo\|fused" tests/`
Use the file already exercising L2/L3 `runPlan` end-to-end (e.g. `tests/dispatcher/plan-*.test.ts`). Note its `stateRoot` + `readIntent` pattern; you will assert on the written `intent.md`.

- [ ] **Step 2: Write the failing integration tests**

Add to that file (adapt helper names to the file's existing harness — it already constructs `runPlan` calls with `SGC_FORCE_INLINE`):

```ts
test("L2 plan writes a Fused decision section and fused_verdict frontmatter", async () => {
  const root = mkdtempSync(`${tmpdir()}/sgc-fuse-l2-`)
  const res = await runPlan({
    task: "add an optional cursor param to GET /orders for pagination",
    stateRoot: root,
    motivation: "downstream API consumers need stable pagination to avoid timeouts on large order pages and this matters for callers",
  })
  const intent = readIntent(res.taskId, root)
  expect(intent.fused_verdict).toBeDefined()
  expect(intent.body).toContain("## Fused decision")
  // synthesis section appears BEFORE the per-agent verdict sections
  expect(intent.body!.indexOf("## Fused decision"))
    .toBeLessThan(intent.body!.indexOf("## Planner.eng verdict"))
})

test("L1 plan writes NO fusion (regression lock)", async () => {
  const root = mkdtempSync(`${tmpdir()}/sgc-fuse-l1-`)
  const res = await runPlan({
    task: "fix typo in README install command",
    stateRoot: root,
    motivation: "the README install command has a typo that breaks copy-paste onboarding for new users which we want smooth",
    forceLevel: "L1",
  })
  const intent = readIntent(res.taskId, root)
  expect(intent.fused_verdict).toBeUndefined()
  expect(intent.body).not.toContain("## Fused decision")
})
```

Note: match `runPlan`'s actual option names from the file (e.g. `forceLevel` vs `level`; the file's existing tests are the source of truth — copy their call shape).

- [ ] **Step 3: Run test to verify it fails**

Run: `SGC_FORCE_INLINE=1 bun test <plan integration test file>`
Expected: FAIL — no `## Fused decision` in body; `fused_verdict` undefined at L2.

- [ ] **Step 4: Import fusePlan in plan.ts**

At the top of `src/commands/plan.ts`, add:

```ts
import { fusePlan, renderFusedSection } from "../dispatcher/fuse-plan"
```

- [ ] **Step 5: Compute the fused decision before building the intent body**

In the `if (level !== "L0")` block, immediately before `const intent: IntentDoc = {`, add:

```ts
    // GS-3: deterministic fusion of the planner cluster (L2/L3 only —
    // L1 is eng-only, nothing to fuse). Reads frozen outputs; §1 untouched.
    let fusedSection = ""
    let fusedVerdict: PlanVerdict | undefined
    if (plannerCeoOut && plannerEngOut) {
      const fused = fusePlan({
        ceo: plannerCeoOut,
        eng: plannerEngOut,
        adversarial: adversarialOut,
      })
      fusedVerdict = fused.fused_verdict
      fusedSection = renderFusedSection(fused) + "\n\n"
    }
```

Add the `PlanVerdict` import to the existing type import from `../dispatcher/types` in plan.ts (or add a new `import type { PlanVerdict } from "../dispatcher/types"`).

- [ ] **Step 6: Set the frontmatter field and prepend the section**

In the `const intent: IntentDoc = { ... }` literal, add `fused_verdict: fusedVerdict,` alongside the other fields (e.g. after `user_signature: opts.userSignature,`).

Then prepend `fusedSection` to the body. Change the body assembly's first line from:

```ts
      body:
        `## Classifier rationale\n\n${classRes.output.rationale}\n\n` +
```

to:

```ts
      body:
        fusedSection +
        `## Classifier rationale\n\n${classRes.output.rationale}\n\n` +
```

- [ ] **Step 7: Add the advisory line to the L3 confirm summary**

In the `if (level === "L3")` confirm-summary block (after the `pre-mortem:` log line, ~line 561), add:

```ts
    if (plannerCeoOut && plannerEngOut) {
      const fusedPreview = fusePlan({ ceo: plannerCeoOut, eng: plannerEngOut, adversarial: adversarialOut })
      log(`  fused:      ${fusedPreview.fused_verdict} — ${fusedPreview.decision_basis} (advisory; human signature still required)`)
    }
```

- [ ] **Step 8: Run test to verify it passes**

Run: `SGC_FORCE_INLINE=1 bun test <plan integration test file>`
Expected: PASS (L2 has section + frontmatter before per-agent sections; L1 has neither).

- [ ] **Step 9: Run the full dispatcher suite for regressions**

Run: `SGC_FORCE_INLINE=1 bun test tests/`
Expected: PASS, test count = prior baseline + new tests. Record the before/after count for the REPORT.

- [ ] **Step 10: Commit**

```bash
git add src/commands/plan.ts <plan integration test file>
git commit -m "feat(GS-3): wire fusePlan into sgc plan (L2/L3 fused decision + advisory L3 summary)"
```

---

## Task 7: Released-artifact — CHANGELOG + version bump

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `package.json`
- Modify: `plugin.json`

**Context:** sgc is npm-published and `package.json` + `plugin.json` versions are kept in lockstep (memory: sgc ship workflow). This is the additive user-visible default-behavior change (`sgc plan` now emits a fused decision) → minor bump. The actual push/tag/publish is the gs:/ship flow, NOT this task.

- [ ] **Step 1: Confirm current version**

Run: `node -p "require('./package.json').version"` and `node -p "require('./plugin.json').version"`
Expected: both `1.17.4`. Target: `1.18.0`.

- [ ] **Step 2: Bump both manifests in lockstep**

Set `"version": "1.18.0"` in both `package.json` and `plugin.json`.

- [ ] **Step 3: Add the CHANGELOG migration note**

At the top of `CHANGELOG.md`, add:

```markdown
## v1.18.0 — GS-3 plan decision fusion

`sgc plan` now emits a **Fused decision** synthesizing the planner cluster
(ceo / eng / adversarial) at L2 and L3: a single `fused_verdict`
(`approve | revise | reject`), a deduped + severity-ranked concern list, and
explicit conflict callouts. The verdict is advisory — the L3 human signature
and stdin confirmation gates (Invariant §4) are unchanged.

- **Additive, backward-compatible.** L1/L0 plans are unchanged. Existing
  `intent.md` files (without `fused_verdict`) still validate.
- **New optional frontmatter field** `fused_verdict` on `decisions/{id}/intent.md`.
- **No revert flag needed** — fusion only adds output; to ignore it, read the
  per-agent verdict sections as before. Pin `@sdsrs/sgc@1.17.4` to opt out.
- Deterministic, no LLM, no new `read:solutions` — Invariant §1 untouched.
```

- [ ] **Step 4: Verify nothing else references the old version**

Run: `grep -rn "1.17.4" package.json plugin.json README.md 2>/dev/null`
Expected: no stale references except intended history. Fix any user-facing version string.

- [ ] **Step 5: Run the full suite once more**

Run: `SGC_FORCE_INLINE=1 bun test tests/`
Expected: PASS (same count as Task 6 Step 9).

- [ ] **Step 6: Commit**

```bash
git add CHANGELOG.md package.json plugin.json
git commit -m "chore(GS-3): bump v1.18.0 + CHANGELOG migration note (plan fusion)"
```

---

## Post-implementation (NOT part of task execution)

- **Pre-ship review:** `gs:/review` over the branch diff (§4.FULL-lite step 7).
- **Ship:** `gs:/ship` → main-direct + `v1.18.0` tag → publish.yml → npm (sgc ship workflow). Verify CI green via `sgc watch-ci-failure` self-dogfood.
- **Self-dogfood:** after publish, run `sgc plan` at L2 against a real task and confirm the Fused decision section renders from the published build.
- **Follow-up task (separate):** fix the `review.ts:14` §6 citation drift (spec Known findings).

---

## Self-Review

**1. Spec coverage:**
- Module `fuse-plan.ts` pure fn → Tasks 1-4. ✓
- Verdict rule + adversarial floor → Task 2. ✓
- Concern dedup (jaccard 0.85) + rank → Task 3. ✓
- `## Fused decision` section, placed before per-agent sections → Tasks 4, 6. ✓
- `fused_verdict` frontmatter + schema + validation → Task 5. ✓
- L2 2-way / L3 3-way / L1 unchanged → Task 6 (integration + regression). ✓
- §1/§2/§4 posture → enforced by design (no read:solutions; written once; advisory line only). ✓
- Released-artifact (minor bump + CHANGELOG + opt-out pin) → Task 7. ✓
- Known finding (§6 drift) → Post-implementation follow-up. ✓
- Success criteria 1-8 → Tasks 2/3/5/6 + Task 6 Step 9 (CI green) cover all. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases". Task 5 Step 1 / Task 6 Step 1 ask the implementer to *locate* the existing test file (a real discovery action, not a placeholder) and give exact import patterns to copy.

**3. Type consistency:** `PlanVerdict` (types.ts) used in `fuse-plan.ts`, `IntentDoc`, plan.ts. `FusedDecision` / `FusedConcern` / `ConcernSource` / `ConcernSeverity` consistent across Tasks 2-4. `fusePlan` signature `{ceo?, eng, adversarial?}` identical in Tasks 2, 3, 6. `renderFusedSection(d: FusedDecision)` consistent Tasks 4, 6. `worstPlanVerdict` consistent Tasks 1-2. ✓
