---
status: draft
revision: 1
slug: gs-3-plan-fusion
level: L3
flow: §4.FULL-lite
semver: minor (v1.18.0)
arc: GS-N absorb
---

# GS-3 — `sgc plan` Multi-Perspective Decision Fusion (deterministic)

sgc-native absorption of the `gs:/autoplan` capability: synthesize the
independent planner-cluster verdicts (`planner.ceo` / `planner.eng` /
`planner.adversarial`) into one coherent, deterministic plan-decision —
without any LLM, any cross-evaluator back-channel, or any change to
Invariant §1.

## Goal

Today `sgc plan` runs the planner cluster, then dumps three **independent**
verdicts as separate `## ` sections into `intent.md` (eng `{verdict, concerns,
structural_risks}`, ceo `{verdict, concerns, rewrite_hints}`, adversarial
`{failure_modes[]}`) and logs each separately at the L3 confirm gate. There is
**no synthesis** — the human eyeballs three disjoint dumps and decides.

GS-3 adds a **deterministic fusion layer** above the frozen cluster outputs
that produces a single `FusedDecision`:

- one **fused verdict** (`approve | revise | reject`) computed from the three
  perspectives by explicit rules,
- a **deduped, severity-ranked concern list** merging all four concern
  sources,
- explicit **conflict callouts** when perspectives disagree (e.g.
  ceo=approve vs eng=reject).

The fused decision is written into `intent.md` (a `## Fused decision` body
section + a `fused_verdict` frontmatter field) and surfaced at the L3 confirm
summary — **advisory only**; the §4 human signature/confirmation gate is
unchanged.

## Non-goals

- **No LLM synthesis agent** (this is model A, not B). `fusePlan` is a pure
  deterministic function. A future `planner.synthesis` LLM agent is explicitly
  out of scope.
- **No cross-reviewer deliberation / round-2 / revise-after-seeing-others**
  (model C). The three planners still run fully isolated; fusion only reads
  their already-frozen outputs.
- **No Invariant §1 amendment.** Fusion introduces no `read:solutions`, no
  back-channel between evaluators. If a future change needs §1 touched, that
  is a separate L3 task.
- **No auto-decision at L3.** `fused_verdict` never substitutes for the human
  `yes` at the §4 confirm gate. Fusion never auto-escalates to `reject` on its
  own (adversarial teeth floor at `revise`, see Constraints).
- **Not fixing the `review.ts:14` §6 citation drift** (see Known findings) —
  recorded here, repaired in a separate task.
- **No change to the code-review cluster** (`reviewer.correctness` +
  specialists). That cluster already aggregates via `worstVerdict`; GS-3 is
  plan-cluster-only.
- **No fusion at L1/L0.** L1 is eng-only (single verdict, nothing to fuse);
  L0 writes no `intent.md`.

## Constraints

1. **§1 Generator-Evaluator Separation** — untouched. `fusePlan` receives only
   the three in-memory planner outputs; it never reads `solutions/`, never
   gains `read:solutions`, and runs after all three planners have frozen their
   output, so no evaluator influences another. The §1 "controlled back-channel"
   risk from the original roadmap (which assumed model C) does not arise.
2. **§2 Decisions Are Immutable** — the `## Fused decision` section and
   `fused_verdict` frontmatter field are assembled **before** `writeIntent`
   and written once at intent creation. Never mutated afterward.
3. **§4 L3 Forbids `--auto` / requires human signature** — `fused_verdict` is
   advisory. The L3 stdin `yes` gate, `--signed-by` requirement, and `--auto`
   refusal all remain exactly as today. Fusion adds an informational line to
   the confirm summary; it does not gate or auto-confirm.
4. **§7 Schema Validation Precedes Every Write** — `fused_verdict` is added to
   `sgc-state.schema.yaml` intent `optional_fields` as an enum
   `[approve, revise, reject]`. Additive + optional: pre-GS-3 `intent.md`
   files (no `fused_verdict`) still validate. `validateIntent` enforces the
   enum when present.
5. **Verdict vocabulary** — the plan cluster uses `approve | revise | reject`;
   the review cluster's `Verdict` type is `pass | concern | fail`. `fused_verdict`
   MUST use a distinct `PlanVerdict = "approve" | "revise" | "reject"` type.
   Conflating the two vocabularies is a spec bug.
6. **Dedup reuse** — concern dedup reuses `src/dispatcher/dedup.ts`
   (`tokenize` + `jaccard`) at the fixed **0.85** threshold (the §3 corpus
   threshold constant), no new tokenizer.
7. **SemVer minor / released-artifact** — additive, backward-compatible →
   `v1.18.0` (NOT v2.0.0; major is for breaking changes only). The
   released-artifact checklist applies: CHANGELOG migration note + a one-time
   discoverability signal (first-run / release-note callout that `sgc plan`
   now emits a fused decision).

## Design

### Module: `src/dispatcher/fuse-plan.ts` (new, pure function)

```ts
export type PlanVerdict = "approve" | "revise" | "reject"

export interface FusedConcern {
  source: "ceo" | "eng" | "eng.structural_risk" | "adversarial"
  text: string
  severity: "high" | "medium" | "low"
  also_flagged_by?: FusedConcern["source"][]  // populated on dedup merge
}

export interface FusedDecision {
  fused_verdict: PlanVerdict
  decision_basis: string        // one-line: which rule won
  ranked_concerns: FusedConcern[]
  conflicts: string[]           // explicit disagreement callouts
}

export function fusePlan(input: {
  ceo?: PlannerCeoOutput | null
  eng: PlannerEngOutput
  adversarial?: PlannerAdversarialOutput | null
}): FusedDecision
```

### Verdict-fusion rule (deterministic, ordered)

Precedence: `reject (2) > revise (1) > approve (0)`.

1. `base = worst(ceo?.verdict, eng.verdict)` — when `ceo` is absent (defensive;
   at L2/L3 ceo is always present), `base = eng.verdict`.
2. **Adversarial teeth**: if any `failure_mode` has
   `probability === "high" AND impact === "high"`, floor `base` at `revise`
   (i.e. `approve → revise`; `revise`/`reject` unchanged). Fusion never raises
   to `reject` on its own.
3. `fused_verdict = base` after the floor.
4. `decision_basis` names the winning rule, e.g.
   - `"eng=revise dominates ceo=approve"`
   - `"high/high pre-mortem risk floors approve → revise"`
   - `"all perspectives approve"`.

### Conflict detection

Emit a `conflicts[]` entry whenever ceo and eng verdicts differ
(`ceo=approve vs eng=reject`), and when the adversarial floor overrode a unanimous
ceo+eng approve. These are the "taste decisions" the human should look at.

### Concern dedup + rank

1. Collect concerns from all sources with severity assignment:
   - `ceo.concerns[]` → severity `medium`
   - `eng.concerns[]` → severity `medium`
   - `eng.structural_risks[]` (`{area, risk, mitigation}`) → severity `high`;
     `text = "${area}: ${risk} (mitigation: ${mitigation})"`
   - `adversarial.failure_modes[]` → severity = the `impact` value (`high/medium/low`);
     `text = "[${probability}/${impact}] ${scenario} — early signal: ${early_signal}"`
2. **Dedup**: pairwise `jaccard(tokenize(a.text), tokenize(b.text)) >= 0.85`
   → merge into one entry; keep the higher severity; record the dropped entry's
   `source` in `also_flagged_by`.
3. **Rank**: severity desc (`high > medium > low`), stable within a tier by
   source order (`eng.structural_risk`, `adversarial`, `eng`, `ceo`).

### Integration: `src/commands/plan.ts`

Call `fusePlan` after the cluster results are assigned and **before**
`writeIntent`, only when `level` is L2 or L3 (ceo+eng present). Then:

1. Set `intent.fused_verdict = decision.fused_verdict`.
2. Prepend a `## Fused decision` section to the body (before the per-agent
   `## Planner.eng verdict` / `## Planner.ceo verdict` / pre-mortem sections).
   Section content: verdict line, `decision_basis`, ranked concern list,
   conflict callouts.
3. At the L3 confirm summary, add: `  fused:      ${verdict} — ${basis}`
   (advisory).

The `## Fused decision` section is **plain synthesis text** — it does NOT
contain the prior-art / pre-mortem sentinels and is NOT a back-channel surface;
it is downstream of the existing sentinel-wrapped sections and carries no
`solution_ref` content, so the `review.ts` strip machinery is unaffected.

### Type + schema changes

- `src/dispatcher/types.ts`: add `PlanVerdict`; add `fused_verdict?: PlanVerdict`
  to `IntentDoc`. (`writeIntent` already spreads `{body, ...frontmatter}`, so the
  field auto-serializes to frontmatter — no serializer change.)
- `src/dispatcher/state.ts` `validateIntent`: enforce the `fused_verdict` enum
  when present.
- `contracts/sgc-state.schema.yaml`: add `fused_verdict` under intent
  `optional_fields` as `{ type: enum, values: [approve, revise, reject] }`.

## Success criteria

1. `sgc plan` at **L2** emits a `## Fused decision` section and a
   `fused_verdict` frontmatter field synthesizing ceo+eng (2-way), with
   deduped ranked concerns and conflict callouts.
2. `sgc plan` at **L3** does the same with the 3-way fusion (+adversarial),
   and a high/high failure_mode floors an otherwise-`approve` fused verdict to
   `revise`, recorded in `decision_basis`.
3. `sgc plan` at **L1** is byte-for-byte unchanged (no fusion, no
   `fused_verdict` field) — regression-locked.
4. `fusePlan` is a pure function with full unit coverage of the verdict matrix,
   adversarial floor, dedup-merge, conflict detection, and empty/single-concern
   edges.
5. Pre-GS-3 `intent.md` files (no `fused_verdict`) still pass `validateIntent`
   and the schema — additive optional field, no migration.
6. The §4 L3 human gate is unchanged: `--signed-by` still required, `--auto`
   still refused, stdin `yes` still required; `fused_verdict` never
   auto-confirms.
7. No new `read:solutions` token anywhere; Invariant §1 enforcement tests
   continue to pass unchanged.
8. Dispatcher CI gate (`SGC_FORCE_INLINE=1 bun test tests/`) stays green with
   the new fusion + integration + schema + L1-regression tests added.

## Known findings (recorded, not repaired here)

- **§6 citation drift**: `src/commands/review.ts:14` comments cite "append-only
  per Invariant §6", but `contracts/sgc-invariants.md` §6 is "Every Janitor
  Decision Is Logged". The `reviews/` append-only constraint is real but lives
  elsewhere (or is an unnumbered convention). Out of GS-3 scope — file a
  separate L1 doc-fix task to either renumber the citation or add the missing
  invariant.

## Open questions

1. **`## Fused decision` placement** — spec chooses **before** the per-agent
   sections (TL;DR-first). Reversible; confirm at plan review if a different
   reading order is preferred.
2. **`also_flagged_by` rendering** — whether the body list shows
   "(also flagged by ceo)" inline or omits it for brevity. Default: show it
   (it is the cross-perspective-agreement signal). Reversible.
3. **Discoverability signal form** — release-note callout vs first-run stderr
   line. Default: CHANGELOG migration note + release-note callout (no runtime
   banner, to keep `sgc plan` output clean). Decide at ship.

# Change log

- **r1** (2026-05-29) — initial draft. Model A (deterministic, no LLM, no
  back-channel) confirmed; adversarial-teeth floor-to-revise confirmed; prose
  section + `fused_verdict` frontmatter field confirmed. Reclassified from the
  roadmap's v2.0.0/L3-breaking (which assumed model C) to additive **minor
  v1.18.0** under §4.FULL-lite rigor.
