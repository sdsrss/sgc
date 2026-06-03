# Native Deep Planning — Design Spec (Phase 2b)

**Date:** 2026-06-03
**Phase:** 2b (native capability closure — `docs/ROADMAP.md`)
**Status:** approved (brainstorming), pending implementation plan

## Goal

`sgc plan` today produces a *decision-level* artifact (`intent.md`: classifier
rationale + planner.{eng,ceo,adversarial} verdicts + researcher prior-art +
fused verdict) but its `feature-list.md` is a single placeholder `f1`
(`src/commands/plan.ts` writes one feature; the code comment states "the
dispatcher does not infer fine-grained features in MVP").

This is the honest native gap recorded in `docs/POSITIONING.md` ("Deep plan
authoring — light (planner cluster) — `sp:writing-plans` ← thinnest native
gap"). Phase 2b closes it: under L2/L3 (and L1 with `--deep`), `sgc plan`
natively authors a **file-level task decomposition with bite-sized TDD steps**,
writes it to `feature-list.md` (single source of truth), derives an
`sp:writing-plans`-style markdown document from it, and closes the CE loop by
letting prior-art / pre-mortem / prior-preventions shape the decomposition.

This is **absorption of the `sp:writing-plans` pattern, not vendoring** — sgc
re-authors the concept natively (per the ROADMAP guiding constraint).

## Non-goals (explicit not-doing)

- **NOT** re-implementing `sp:writing-plans` verbatim or vendoring its source.
- **NOT** rewriting `sgc work` into a step-by-step interactive execution loop.
  `work` gains only a light read adaptation (see §6). The per-step execution
  loop is deferred to a follow-on.
- **NOT** CE capture-out (promoting a "plan decomposition pattern" into
  `solutions/`). A plan-pattern as reusable knowledge is too vague to be honest
  reuse today; deferred to Phase 3 if a concrete signal emerges. Phase 2b's CE
  closure is **reuse-in only**.
- **NOT** changing L0/L1-default behavior. Non-deep paths keep the current
  single-placeholder feature-list → zero behavior regression.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Product shape | **Double-write**: enriched `feature-list.md` (SoT) drives `sgc work` **and** a derived sp-style markdown doc for humans/subagents. |
| Trigger | **Level-gated**: L2/L3 auto-decompose; L1 opt-in via `--deep`; L0 N/A. Mirrors the existing planner-cluster level gating. |
| Authoring agent | **New agent `planner.decompose`**, isomorphic with the existing cluster (own prompt / pinned scope tokens / inline heuristic fallback). Runs serially after fusion (needs eng risks + prior inputs). |
| CE closure | **reuse-in**: prior-art / pre-mortem / prior-preventions map into tasks & steps. capture-out deferred. |
| Scope boundary | **Authoring + `work` reads it** (light). Per-step execution loop out. |

## Architecture

### Components (new units)

| Unit | File | Responsibility | Depends on |
|---|---|---|---|
| `planner.decompose` agent | `src/dispatcher/agents/planner-decompose.ts` + `prompts/planner-decompose.md` | Input: intent + eng `structural_risks` + researcher `prior_art` + adversarial `failure_modes` + CE-1 `prior_preventions`. Output: `tasks[] → steps[]` (file-level). Heuristic fallback = one coarse task (keeps inline/tests runnable without an API key). | spawn protocol, types |
| plan markdown renderer | `src/dispatcher/plan-render.ts` | Pure function `renderPlanMarkdown(featureList, intent) → string` in sp:writing-plans format (header + `Task N` + bite-sized checkbox steps). **Derived, never hand-maintained.** | types only |

`planner.decompose` follows the exact pattern of `planner-adversarial.ts`:
a `*Heuristic` fallback export + an LLM prompt path routed by `spawn.ts` when the
manifest `prompt_path` is set. Tests run with `SGC_FORCE_INLINE=1`.

### Data shapes (schema-Δ — additive, backward compatible)

Extend `Feature` (`src/dispatcher/types.ts`) with optional fields. The existing
single-placeholder feature stays valid → 2a TDD-ledger fields untouched.

```ts
interface Feature {
  // ...existing id / title / status / depends_on / blocked_by /
  //    verify_command / evidence / prior_red / red_output / waived_red
  files?: { create: string[]; modify: string[]; test: string[] }
  steps?: PlanStep[]
  prior_art_refs?: string[]   // CE reuse-in: drives applied/surfaced writeback
}

interface PlanStep {
  kind: "test" | "verify-red" | "implement" | "verify-green" | "commit" | "guard"
  text: string                // complete content, NO placeholders
  run?: string                // exact command (verify-* / commit)
  expect?: string             // expected output (verify-*)
}
```

`kind` enumerates sp's canonical 5-step TDD cycle (test → verify-red →
implement → verify-green → commit) plus `guard` — a step derived from a
prior failure-mode / prevention (a defensive test or check). The schema doc
`contracts/sgc-state.schema.yaml` is updated in lockstep.

### Flow (plan.ts, level-gated)

```
classify → planner cluster (eng/ceo/adversarial/researcher) → fusePlan
   │  deep = (level ∈ {L2,L3}) OR (level == L1 AND opts.deep)
   ▼  if deep:
planner.decompose(intent, structural_risks, prior_art,
                  failure_modes, prior_preventions)   ── serial, after fusion
   ▼
feature-list.md  ←  tasks mapped 1:1 to features[]    (single source of truth)
   ▼  derive
docs/superpowers/plans/<YYYY-MM-DD>-<slug>.md         (sp-style markdown)
```

Non-deep paths (L1 default, L0) keep the current single-placeholder
`writeFeatureList` call → zero behavior regression.

`opts.deep` is wired from a new `--deep` CLI flag in `src/sgc.ts`. At L2/L3
deep is implied regardless of the flag; at L1 the flag is required; at L0
the flag is a no-op (L0 skips `intent.md` per schema and keeps its
single-placeholder feature-list — there is nothing to decompose).

### CE loop closure (reuse-in) + invariants

- `failure_modes` / `prior_preventions` → `guard` steps / defensive tests in
  the decomposition (**prior failures shape the new plan**).
- `prior_art` entries that seed a task → that task carries `prior_art_refs` →
  reuses the existing `recordSurfaced` / `recordApplied` writeback in
  `plan.ts` (the reuse signal is tracked in `surfaced_in` / `applied_in`).
- **Invariant §1 (trust boundary):** `planner.decompose` receives prior data
  as *input*, exactly like `planner.adversarial` under CE-1 — it does NOT hold
  `read:solutions` itself. The pre-fetch happens in `plan.ts`.
- **Invariant §3 (write-gate):** untouched. `planner.decompose` never calls
  `writeSolution` (no capture-out this phase).
- **Invariant §8 (scope tokens):** the new agent gets its own pinned scope
  tokens in the manifest; `sgc doctor` slash↔CLI + invariant-source parity
  checks stay green (new flag → `--help` / docs parity as needed).

### Double-write, no drift

`feature-list.md` is the **single source of truth**. The markdown document is
regenerated from it by `renderPlanMarkdown` on every plan. There is never a
second hand-maintained representation → the drift risk inherent in
"double-write" is eliminated by construction. A test asserts
`renderPlanMarkdown(parse(feature-list))` round-trips the task/step structure.

### `sgc work` light adaptation (§6)

`work` already iterates multiple features (`nextActiveId` picks the first
`pending`/`in_progress`; `--done` advances). Producing N features instead of 1
mostly "just works". Changes are minimal:

- `printList` surfaces per-task `files` summary + step count.
- `--done` continues to run the 2a TDD-ledger close-gate per feature.
- Honor `depends_on` ordering when present (already a field; confirm
  `nextActiveId` respects it, add if not).

No execution-loop rewrite.

## Testing strategy

- `planner-decompose.test.ts` — heuristic fallback shape (one coarse task);
  reuse-in mapping (a `failure_mode` produces a `guard` step; a `prior_art`
  entry produces `prior_art_refs`). `SGC_FORCE_INLINE=1`.
- `plan-render.test.ts` — renderer emits sp-format header + `Task N` +
  checkbox steps; no-drift round-trip assertion.
- `plan.ts` integration (dispatcher lane) — L2 auto-decomposes (>1 step,
  file-level); L1 default does NOT (placeholder preserved); L1 `--deep` does;
  prior_art_refs trigger `recordSurfaced` writeback.
- `work.ts` — reads a multi-task feature-list; `printList` shows files/steps;
  per-task `--done` close-gate still fires.
- **Test-lane divergence guard** (`feedback_sgc_test_lane_divergence`): run
  `bun test tests/dispatcher tests/eval` locally before ship; grep both dirs
  for `runWork(` / `runPlan(` setup callers that the schema change may touch.

## Acceptance criteria

1. L2/L3 `sgc plan` produces ≥1 file-level task, each with `files` +
   bite-sized `steps` (including failure-mode-derived `guard` steps).
2. The markdown doc is derived from `feature-list.md`; a test asserts no drift.
3. prior-art reuse: a task's `prior_art_refs` triggers surfaced/applied
   writeback (test asserts the event).
4. Heuristic fallback = one task; inline/CI deterministic-green.
5. `sgc doctor` + both CI lanes (dispatcher + eval) green; `docs/POSITIONING.md`
   "Deep plan authoring" row updated light → native.

## Release reminders (per ROADMAP)

- main-direct, no PR; bump `package.json` + `plugin.json` in lockstep.
- `src/` changed → `npm run build:cli` + commit `plugins/sgc/bin/sgc.mjs` with
  mode `100755` (`git add --chmod=+x`).
- `npm publish --provenance` may throw a false-negative E403 on a double-PUT —
  verify via `npm view @sdsrs/sgc@<ver> dist.shasum`, don't blindly re-run.
