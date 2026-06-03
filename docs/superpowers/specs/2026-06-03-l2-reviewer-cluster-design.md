# L2 Reviewer Cluster — Design Spec (Phase 2c)

**Date:** 2026-06-03
**Phase:** 2c (native capability closure — `docs/ROADMAP.md`)
**Status:** approved (brainstorming), pending implementation plan

## Goal

`sgc review` today spawns `reviewer.correctness` unconditionally and, **only at
L3**, a set of diff-conditional domain specialists (`reviewer.security` /
`reviewer.migration` / `reviewer.performance` / `reviewer.infra`). At **L2** the
review is identical to L1 — correctness only — even though `README.md:125`
already advertises L2 as running a "Reviewer cluster". That claim is currently
false.

Phase 2c makes it true: at **L2+**, `sgc review` runs an always-on quality trio
(`reviewer.correctness` + `reviewer.tests` + `reviewer.maintainability`) plus the
diff-conditional domain specialists (gate lowered from `level === "L3"` to
`level >= L2`). This wires the manifested-but-dormant reviewers and closes the
honesty gap in the README/POSITIONING.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| L2 cluster composition | **Full cluster**: always-on quality trio (correctness + tests + maintainability) at L2+, plus diff-conditional domain specialists (security/migration/perf/infra) with the gate lowered L3→L2+. |
| CE-loop closure | **Evaluator gate** — the reviewer cluster's CE role IS the generator/evaluator separation. review → pass → ship → compound captures the solution (system-level closure, already wired). Reviewers stay amnesiac per Invariant §1; **no new CE capture code**. |
| Reviewer prompts | `reviewer.tests` / `reviewer.maintainability` keep `prompt_path: null` and use the **synthesized prompt** derived from the `reviewer.correctness` anchor — exactly like the existing 4 domain specialists. **No new prompt files.** |

## Non-goals (explicit not-doing)

- **NOT** implementing `reviewer.adversarial` or `reviewer.spec` (stay
  `status: slot-only`).
- **NOT** adding a review-findings → prevention CE capture path (CE closure is
  the evaluator gate; reviewers never read/write `solutions/`).
- **NOT** changing L1 behavior (L1 stays `reviewer.correctness` only — L1 is
  "single file, < 50 lines, no behavior change").
- **NOT** changing L3 behavior (it already runs everything; lowering the
  specialist gate to L2+ leaves L3 a superset, unchanged).

## Architecture

### Components (new units)

| Unit | File | Responsibility |
|---|---|---|
| `reviewer.tests` | `src/dispatcher/agents/reviewer-quality.ts` (new) | Test-coverage review. Heuristic: classify each changed file from the diff's `+++ b/<path>` headers as test (path matches `/(^|\/)(test\|tests\|spec)\b/` or basename contains `.test.`/`.spec.`/`_test.`) vs source. If ≥1 source file changed AND 0 test files changed → `concern` ("source/behavior change without test additions"); else `pass`. |
| `reviewer.maintainability` | same `reviewer-quality.ts` | Readability/complexity review. Heuristic over added lines (`+` not `+++`): flag (a) lines > 120 chars, (b) lines containing `TODO`/`FIXME`/`@ts-ignore`/`eslint-disable`/`as any`. Any hit → `concern` (severity `low`); else `pass`. Advisory by design. |

Both reuse `ReviewerSpecialistInput` / `ReviewerSpecialistOutput` from
`reviewer-specialists.ts` (`{ diff, intent }` → `{ verdict, severity, findings }`).
They live in a **new** `reviewer-quality.ts` (clear boundary: quality reviewers
run always-on at L2+; domain specialists in `reviewer-specialists.ts` run
diff-conditionally). `reviewer.tests` needs file-level diff analysis, so it does
not fit the added-line `reviewBy` helper; `reviewer.maintainability` could reuse
it but lives beside its sibling for cohesion.

### Wiring (`src/commands/review.ts`)

```
L0 → no review
L1 → reviewer.correctness only            (unchanged)
L2 → correctness + tests + maintainability (always)
     + matchSpecialists(diff)              (0–4, diff-conditional)
L3 → same as L2                            (gate >= L2 includes L3; unchanged behavior)
```

- `reviewer.correctness` spawn stays unconditional (all levels).
- Add a guard `const isL2Plus = level === "L2" || level === "L3"` (review.ts
  currently string-compares `level === "L3"`; no `LEVEL_RANK` map needed). When `isL2Plus`:
  1. Spawn `reviewer.tests` and `reviewer.maintainability` (always), each via the
     same `spawn(...)` + `appendReview(...)` pattern as the existing specialists.
  2. Spawn `matchSpecialists(diff)` results — moving the existing block's gate
     from `level === "L3"` to `isL2Plus`.
- All new reviewers receive `intentForReviewer` (already stripped of the
  prior-art / pre-mortem back-channel blocks — Invariant §1) and inherit the
  `<<: *reviewer_base` scope tokens (which deny `read:solutions`).
- All reports `appendReview` (append-only, Invariant §6) and feed `worstVerdict`.


### Manifest (`contracts/sgc-capabilities.yaml`)

Flip two lines from `status: slot-only, roadmap: "..."` to `status: implemented`,
keeping `prompt_path: null` (synthesized prompt, like the 4 domain specialists):

```yaml
  reviewer.tests:           { <<: *reviewer_base, prompt_path: null, status: implemented }
  reviewer.maintainability: { <<: *reviewer_base, prompt_path: null, status: implemented }
```

Subagent count is unchanged (both already manifested as slots → no 22→23-style
count regression).

### CE loop closure + invariants

- **CE = evaluator gate.** review verdict gates the work; pass → ship → the
  compound janitor captures a solution; `planner.adversarial`/`researcher.history`
  consume it next plan. The reviewer cluster contributes the *evaluator* half of
  the generator/evaluator separation. No new CE code.
- **Invariant §1** (reviewers amnesiac): preserved. New reviewers go through the
  same `stripBackChannelSections(intent.body)` and hold no `read:solutions`
  (inherited `reviewer_base` scope tokens; `/review.solutions: []` manifest
  permission unchanged).
- **Invariant §6** (append-only reports): each reviewer writes its own
  `reviews/{task_id}/code/<reviewer>.md` via `appendReview`.
- **Invariant §8** (pinned scope tokens at spawn): inherited from `reviewer_base`.

## Testing strategy

- `reviewer-quality.test.ts` —
  - tests: source-file-changed-without-test → `concern`; source + test changed →
    `pass`; test/docs-only diff → `pass`; empty diff → `pass`.
  - maintainability: long line (>120) → `concern`; `TODO`/`@ts-ignore`/`as any`
    added → `concern`; clean diff → `pass`.
- `review.ts` integration (dispatcher lane) —
  - L1 review spawns ONLY `reviewer.correctness` (no tests/maintainability/specialists).
  - L2 review spawns correctness + tests + maintainability; with a security-keyword
    diff, also `reviewer.security`. `worstVerdict` aggregates.
  - L3 review still spawns the full set (regression guard — behavior unchanged).
- Update any existing review tests that assert "L2 runs only correctness" or
  that specialists are "L3-only" to the new behavior.
- **Test-lane divergence guard** (`feedback_sgc_test_lane_divergence`): run
  `bun test tests/dispatcher tests/eval` before ship; grep both dirs for
  `runReview(` callers + any reviewer-count / level-gate assertions. The
  `tests/eval/` reviewer-isolation scenario must still pass (§1 amnesia).

## Acceptance criteria

1. L2 `sgc review` runs `reviewer.correctness` + `reviewer.tests` +
   `reviewer.maintainability` always, plus diff-matched domain specialists; L1
   runs correctness only; L3 unchanged (full set).
2. `reviewer.tests` + `reviewer.maintainability` implemented (heuristic +
   manifest `status: implemented`), deterministic-green inline.
3. Invariant §1 preserved: new reviewers receive the stripped intent and hold no
   `read:solutions` (test asserts the reviewer-isolation scenario still passes).
4. `sgc doctor` + both CI lanes (dispatcher + eval) green; subagent count
   unchanged (no count regression).
5. `README.md:125` "Reviewer cluster" claim is now true (enumerate the L2
   cluster); `docs/POSITIONING.md` "Independent review" row notes the native L2
   cluster.

## Release reminders (per ROADMAP)

- main-direct, no PR; bump `package.json` + `plugin.json` in lockstep.
- `src/` changed → `npm run build:cli` + commit `plugins/sgc/bin/sgc.mjs` with
  mode `100755` (`git add --chmod=+x`); CLI entry stays bare `runMain(main)` —
  do NOT add an `import.meta.main` guard (breaks the Bun bundle, see
  `feedback_import_meta_main_breaks_bun_bundle`).
- Verify the rebuilt bundle runs under node (`node plugins/sgc/bin/sgc.mjs --help`)
  — doctor SHA-parity is a false green for runtime crashes.
- `npm publish --provenance` E403 double-PUT false-negative — verify via
  `npm view @sdsrs/sgc@<ver> dist.shasum`.
