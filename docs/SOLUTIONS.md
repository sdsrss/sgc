# Solutions (repo-tracked knowledge)

The live knowledge base lives in `.sgc/solutions/` and is **git-ignored** by
design — it carries machine-local, sgc-mutated state (`times_referenced`,
`last_updated`) that would churn the repo. (`times_referenced` counts dedup
write-merges of the same problem — it is **not** a reuse metric; reuse is
tracked by `surfaced_in` / `applied_in` and surfaced via `sgc reflect`.) This
file is the curated,
version-controlled complement: solution/prevention pairs worth carrying with
the repo so other clones, CI, and collaborators can read them. Entries here are
hand-curated for accuracy (the `.sgc/solutions/` originals are LLM-generated and
can idealize the implementation — see the close-gate entry below).

---

## verification close-gate on `sgc work --done` (Tier 1, v1.19.0)

**Source task:** `C2722B1F412C4D419F9A0379E0` · category `other` · sp absorb
(`sp:verification-before-completion`)

### Problem

sgc had an internal contract asymmetry around completion: `sgc debug close`
hard-gates on Iron Law #3 (`root_cause`, `fix_commit`, `verify_command`), but
`sgc work --done` flipped feature status with zero evidence required. Features
could be marked complete without a reproducible verification step, leaving the
capture→promote CE-1 loop with nothing to learn from.

### Solution (as shipped — actual shape)

Added a verification close-gate **inside** `sgc work --done`
(`src/commands/work.ts` done-transition branch) that mirrors the `sgc debug
close` Iron Law #3 predicate: a feature cannot flip to `done` without a
non-empty `--verify-command` (operator responsibility — recorded, **not**
executed by sgc), plus an optional `--evidence` string. Both persist onto the
`Feature` record in `progress/feature-list.md` (new optional schema fields
`verify_command` / `evidence`).

Implementation facts (no idealization):

- The work gate **independently mirrors** debug close's check — it is **not** a
  shared helper, and there is **no** loop-terminator gate.
- `sgc loop` inherits the gate **transitively**: its work step pauses
  (`terminal_reason: paused_work`) and hands off to the operator, who then runs
  `sgc work --done`.
- Already-done features are **grandfathered** (idempotent no-op, no flag
  required); only new `pending`/`in_progress` → `done` transitions are gated.

**Future optional refactor (not done in v1.19.0):** extract the Iron Law #3
evidence check into one shared completion-gate helper that both `debug close`
and `work --done` call, so the two evidence contracts cannot drift. Today they
duplicate the small predicate rather than share code.

### Prevention

- Ship RED-first **per-path** tests against the `sgc work` CLI surface: bare
  `--done` is refused; with `--verify-command` the feature flips to done and the
  fields persist; an already-done feature grandfathers; a `work --help` surface
  test asserts the new flags (3-tier `toContain` to survive CI backtick wrapping
  — see `feedback_citty_help_consola_ci_mode`).
- **Tightening a required flag on a shared CLI option breaks every caller that
  drove it as setup.** Grep **all** `runWork({done})` call sites BEFORE
  implementing (here: 11 integration/eval test files) and list them in the
  feature scope — don't discover the blast radius from a post-hoc full-suite
  failure.
- These tests are per-path (work-specific), not a cross-path comparison through
  a shared function — that stronger guarantee needs the optional shared
  completion-gate helper above. If that refactor lands, add a contract test
  comparing work / loop / debug-close evidence requirements through the shared
  predicate so they cannot diverge.

---

## CE-6 surfaced_in: observe prevention reuse at L2 (not just L3)

**Source task:** CE-6 L2 extension · category `other`

### Problem

`sgc reflect` showed relevant preventions as `applied: 0` even when an operator
had followed them. Initial diagnosis (in a retrospective) blamed intent.md
immutability — **that was wrong**. Actual root cause (verified in
`src/commands/plan.ts`): CE-6 `applied_in` is written **only at L3**, inside
`if (level === "L3")`, driven by `planner.adversarial` echoing a prevention's
`solution_ref` in a `failure_mode.early_signal`. L2 tasks run
`researcher.history` (which surfaces prior solutions) but never
`planner.adversarial`, and `capturedPriorPreventions` stays `[]` at L2 — so
`recordApplied` is never called. `applied: 0` on an L2 task is **working as
designed**, but it left L2 prevention reuse completely unobservable.

### Solution (as shipped)

Added a **separate** `surfaced_in: TaskId[]` field rather than overloading
`applied_in` (which would conflate "surfaced into a plan" with the stronger
"L3 adversarially validated"). New `recordSurfaced` in `applied-tracker.ts`
(a thin sibling of `recordApplied` via a shared parameterized `recordOne` —
same metadata-only §3 carve-out). `plan.ts` wires it for **L2+**: after the
planner cluster, every `researcher.history.prior_art[].solution_ref` is
recorded into that solution's `surfaced_in`. `sgc reflect` now prints
`(overlap, applied, surfaced)`. `applied_in` semantics are unchanged, so
historical L3 scores stay comparable.

### Prevention

- When a "score is always 0" symptom appears, verify whether the writeback path
  even runs for that code path BEFORE calling it a bug — here the path was
  L3-gated by design. A retrospective that asserts a root cause is an
  assumption until checked against the code (§8.V1).
- Keep distinct signals in distinct fields. Overloading `applied_in` with L2
  surfacings would have silently changed the meaning of every historical score.
- The two CE-6 fields are mutated outside `writeSolution()` (metadata-only) so
  they never enter the dedup signature — preserve that carve-out for any future
  score field.

### Related robustness fix: L3 applied_in slug-fallback

`applied_in` depends on `planner.adversarial` echoing a prevention's full
`category/slug` solution_ref into a `failure_mode.early_signal` (the prompt
asks for it — `prompts/planner-adversarial.md`), which `extractAppliedSolutionRefs`
detects by substring. This is a **designed contract, not a bug**, but it is
fragile to LLM non-compliance — the agent commonly emits just the distinctive
slug and drops the `category/` prefix, silently missing the match. Hardened the
matcher to also match the slug alone, gated by `MIN_SLUG_MATCH_LEN = 8` so short,
common-word slugs cannot match coincidentally. Stronger-but-heavier alternative
(not done, L3 — touches LLM-visible prompt + eval): require a delimited
`[prevention: <ref>]` token in early_signal and parse it exactly.
