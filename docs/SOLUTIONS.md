# Solutions (repo-tracked knowledge)

The live knowledge base lives in `.sgc/solutions/` and is **git-ignored** by
design — it carries machine-local, sgc-mutated state (`times_referenced`,
`last_updated`) that would churn the repo. This file is the curated,
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
