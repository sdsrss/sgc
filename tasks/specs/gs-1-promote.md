---
status: implemented
revision: 3
task_id: gs-1-promote
feature_id: f8-promote
parent_intent: (none — GS-1 arc is sibling to CE-N, outside any compound parent intent)
parent_spec: tasks/specs/gs-1-canary.md
---

# GS-1 promote — `sgc compound --from-canary <slug>`

## Goal

Close the second half of the GS-1 absorb arc: the operator-promotion
bridge from `<stateRoot>/canaries/<slug>.md` (capture surface, shipped
in v1.11.0/v1.11.1) into `<stateRoot>/solutions/<category>/<slug>.md`
(canonical knowledge corpus). GS-1 v0 captures raw canary-failure
material; this helper converts a captured canary-failure record
(after the operator has edited its `regression_seed:` frontmatter
into a real safeguard) into a finished `solutions/` entry through
the **same Invariant §3 write-gate** that `runCompound` +
`runCompoundPromote` (CE-3 promote) already use. Heuristic-only —
no LLM call, no agent spawn beyond the existing `compound.related`
stamp issuer (which must stay deterministic per
[[feedback_compound_related_invariant3]]).

After this lands, the operator workflow becomes:

```
git push origin main --tags
sgc watch-ci-failure                            # CE-3: capture CI red
sgc canary                                       # GS-1: capture post-publish red
$EDITOR .sgc/canaries/<date>-<sha>-<phase>.md   # operator fills regression_seed
sgc compound --from-canary <date>-<sha>-<phase> # promote → solutions/
```

`canaries/` becomes the working namespace for in-flight captures;
`solutions/` remains the canonical knowledge corpus that
`researcher.history` + `extractPreventions` (CE-1) mine. The
promoted solution's `prevention:` field then feeds CE-1's prior-
prevention injection into `planner.adversarial` on the next L3
`sgc plan` for the same category — closing the GS-1 → CE-1
hand-off (a canary failure becomes a future planner pre-mortem
input).

**Identical-shape to CE-3-promote** — fork its module structure +
swap ship-failure ↔ canary-failure shapes. Frontmatter key renames:
`prevention_seed` → `regression_seed`; `workflow_run_id` →
`package_name + expected_version + failed_phase + health_url`. All
other constraints (4 refuse guards, Invariant §3 write-gate path,
heuristic-only categorization, `promoted_to:` audit anchor)
carry across unchanged.

## Non-goals (v0)

- Do NOT change `runCompound` (the task-decision compound path) or
  `runCompoundPromote` (CE-3 promote path) semantics or signatures.
  GS-1 promote is a sibling entry point at the CLI layer, not a
  hook inside either existing path.
- Do NOT call any LLM in the promote path. The 4-agent
  `compound.context/related/solution/prevention` cluster stays for
  task-decision compound; promote uses **only `compoundRelatedHeuristic`**
  for its Invariant §3 stamp and **deterministic frontmatter mapping**
  for the SolutionEntry fields. Operator-edited `regression_seed:` is
  authoritative; no LLM rewrite.
- Do NOT auto-invoke promote from `sgc canary`. v0 is operator-driven
  (operator must edit `regression_seed:` first; no meaningful
  auto-promote without that edit). Matches CE-3-promote posture.
- Do NOT delete or move `canaries/<slug>.md` on success. Mutate in
  place by adding `promoted_to: <category>/<slug>` to its
  frontmatter (audit trail, non-destructive). Re-running promote on
  a record that has `promoted_to:` set refuses (idempotent).
  Matches CE-3-promote.
- Do NOT bypass `validateDedupStamp` / `validateSolution`. The
  promote helper produces a stamp that `writeSolution` validates by
  the same path as `runCompound` + `runCompoundPromote`. A bug here
  cannot corrupt the corpus more than those two already can.
- Do NOT introduce `compound.canary_failure` / `compound.from-canary`
  / similar new agents. Manifest stays at the 4 compound agents
  (and CE-3 promote already proved no new agent is needed for
  per-source-namespace promote variants).
- Do NOT add a `--phases` filter to the promote path. The captured
  record already encodes one (and only one) `failed_phase:` — promote
  operates per-record, not per-phase. Multi-phase capture is the
  capture-side's concern (dedup by (sha, phase) at capture time).
- Do NOT modify `sgc ship`, `sgc watch-ci-failure`, `sgc canary`,
  any `prompts/*.md`, `contracts/sgc-capabilities.yaml`, or any
  Invariant §1 / §3 / §6 / §13 enforcement path. GS-1 promote only
  adds a new flag on the existing `compound` command + a new module.

## Constraints

- **Refuse placeholder `regression_seed:`**: if the field still
  starts with `TODO: operator-fill` (the literal GS-1 capture
  template prefix from `canary.ts:` `regressionSeed` template),
  refuse with a clear error pointing to the slug + the field.
  Pre-edit promote = dead on arrival. Mirrors CE-3-promote
  `PlaceholderPreventionSeed`.
- **Refuse already-promoted records**: if `promoted_to:` is present
  in the frontmatter, refuse with the existing target ref. Operator
  re-runs are a no-op.
- **Refuse missing canary file**: if `<stateRoot>/canaries/<slug>.md`
  doesn't exist, refuse. Suggest `ls .sgc/canaries/`.
- **Refuse dedup match without `--force`**: if `compoundRelated`
  reports a `duplicate_match` (similarity ≥ `DEDUP_THRESHOLD`),
  refuse and print the duplicate ref + similarity. Mirrors
  CE-3-promote — promote is a one-shot operator action, not an
  in-flight task update, so silent merge would hide a real signal.
  Operator decides: either edit `regression_seed:` to differentiate,
  or pass `--force` for intentional re-write.
- **`--force` bypasses the dedup refuse** but still requires a real
  `compound.related` spawn (Invariant §3 stamp shape). Reason field:
  `user_forced`. Does NOT bypass `AlreadyPromoted` — that idempotency
  guard requires explicit `promoted_to:` removal from the canary
  file. Matches CE-3-promote.
- **Category derivation** is heuristic: pass `phaseOutputExcerpt +
  packageName + failedPhase` (joined with `\n\n`) to
  `compoundContextHeuristic` for category/tags/problem_summary.
  This is the same heuristic the inline path of `runCompound`'s
  `compound.context` uses and that CE-3-promote feeds with
  `summaryExcerpt + workflow_name`. The packageName + failedPhase
  combination keeps canary records semantically distinct from
  ship-failure records (which would categorize by workflow_name).
- **SolutionEntry field mapping** (deterministic):
  - `id` = fresh ULID
  - `signature` = `computeSignature(problem_summary)` (same as
    `runCompound` + CE-3-promote)
  - `category` / `tags` / `problem` / `symptoms` from
    `compoundContextHeuristic` output
  - `solution` = templated: `"Canary failure of
    <packageName>@<expectedVersion> at phase <failedPhase> on
    <short_sha>; see body for phase output excerpt + operator's
    regression_seed."`
  - `prevention` = canary frontmatter `regression_seed:`
    (operator-edited, verbatim — Invariant §1 doesn't apply: this
    is operator input, not LLM output). Mirrors CE-3-promote's
    `prevention_seed:` handling.
  - `what_didnt_work` = `[]` (canary records don't carry
    review-flagged approaches; field stays empty array,
    `validateSolution` requires array not non-empty)
  - `source_task_ids` = `[<task_id-derived-from-current-or-tag>]` —
    if `readCurrentTask()` returns null (no active task), fall
    back to a synthetic `CANARY-<short-sha>-<phase>` id; otherwise
    use the active task_id. (Decisions corpus stays referenceable.)
    Mirrors CE-3-promote `SHIP-FAILURE-<short-sha>` shape.
  - `confidence: "provisional"`
  - `first_seen` / `last_updated` = now
  - `times_referenced` = 0
  - `related_entries` from `compoundRelated.related_entries` (top-5
    near-match refs, range 0.3 < sim < threshold) — exactly the
    same surface as `runCompound` + CE-3-promote
- **Slug derivation**: default = `canary-<short-sha>-<phase>` (e.g.
  `canary-c29f021-smoke_install`). The (sha, phase) tuple is preserved
  from the canary capture's own slug, ensuring two canary records
  for the same sha at different phases promote to distinct solutions/
  slugs (no collision). `--solution-slug <s>` overrides. Mirrors
  CE-3-promote `ship-failure-<short-sha>` shape extended for the
  GS-1-specific phase dimension.
- **Spawn-trail for Invariant §3 audit**: the `compound.related`
  call goes through `spawn(..., { inlineStub })` to produce a real
  `spawn_id` directory under `.sgc/spawns/`. Matches `runCompound`
  + CE-3-promote pattern; downstream `compound_related_spawn_id`
  audit consumers see the same shape.
- **`canaries/<slug>.md` mutation on success**: read the file, parse
  frontmatter + body, add `promoted_to: <category>/<slug>` to the
  frontmatter object, re-serialize, atomic-rewrite. Preserves body
  unchanged. The new field is the operator's audit anchor and the
  idempotency guard. Mirrors CE-3-promote.
- **No event emit in v0**: same posture as GS-1 capture (no
  `spawn.start/end` beyond the inline `compound.related` spawn,
  which already follows Invariant §13 paired-event semantics). A
  `compound.canary_promoted` event is future scope.
- **Async fs / atomic writes** consistent with `runCompound` +
  CE-3-promote + GS-1 capture. Use `writeAtomic` (state.ts) for the
  canary mutation; `writeSolution` already uses it.

## Success criteria

1. **New module** `src/dispatcher/canary-promote.ts` exports:
   ```ts
   export interface PromoteCanaryOptions {
     slug: string
     stateRoot?: string
     /** Bypass dedup; --force flag. */
     force?: boolean
     /** Override SolutionEntry slug (default canary-<short-sha>-<phase>). */
     solutionSlug?: string
     logger?: Logger
   }
   export interface PromoteCanaryResult {
     canaryPath: string
     solutionPath: string
     dedupAction: "new_entry" | "user_forced"
     relatedRefs: string[]
   }
   export class PromoteCanaryError extends Error {
     readonly code:
       | "MissingCanaryFailure"
       | "PlaceholderRegressionSeed"
       | "AlreadyPromoted"
       | "DuplicateMatch"
   }
   export async function promoteCanaryFailure(
     opts: PromoteCanaryOptions,
   ): Promise<PromoteCanaryResult>
   ```

2. **`src/commands/compound.ts` extended**: new exported
   `runCanaryPromote(opts)` wrapping `promoteCanaryFailure`. The
   existing `runCompound` + `runCompoundPromote` are unchanged. The
   CLI dispatcher in `src/sgc.ts` routes `--from-canary <slug>` to
   `runCanaryPromote`; absent the flag, behavior is unchanged
   (existing `runCompound` or `runCompoundPromote` paths).

3. **`src/sgc.ts` `compound` `defineCommand`** gains one new arg:
   - `--from-canary <slug>` (string, optional)
   Existing `--force` is reused. Existing `--solution-slug` (from
   CE-3-promote) is reused — works for both `--from-ship-failure`
   and `--from-canary` paths (semantically identical: "override the
   default solutions/ slug name"). NOT introducing a third
   slug-override flag.

4. **Tests** `tests/dispatcher/canary-promote.test.ts` (≥6 cases):
   1. **Missing canary file** → throws `PromoteCanaryError` code
      `MissingCanaryFailure`.
   2. **Placeholder `regression_seed:`** (starts with `TODO:
      operator-fill`) → throws `PromoteCanaryError` code
      `PlaceholderRegressionSeed`.
   3. **Happy path**: edited `regression_seed:` + clean corpus →
      writes solutions/ entry at default slug
      `canary-<short-sha>-<phase>`; canary file gains
      `promoted_to:`; result.dedupAction = `new_entry`;
      `result.relatedRefs` is empty array (no near-matches).
   4. **Dedup match** (existing solution similar above threshold)
      with no `--force` → throws `PromoteCanaryError` code
      `DuplicateMatch`; no write to solutions/, no mutation of
      canary file.
   5. **`--force` bypasses dedup match** → writes new entry;
      result.dedupAction = `user_forced`.
   6. **Already-promoted** (re-run on a record with `promoted_to:`)
      → throws `PromoteCanaryError` code `AlreadyPromoted`;
      idempotent; `--force` does NOT bypass this.
   7. **Phase-disambiguation slug** (regression for GS-1
      multi-phase shape): promote two canary records for same sha
      at different phases (smoke_install + health_url) → writes
      two distinct solutions/ slugs (`canary-<sha>-smoke_install`
      vs `canary-<sha>-health_url`); both succeed.

   `tests/dispatcher/sgc-cli.test.ts` (extend):
   - `sgc compound --help` lists `--from-canary` (alongside the
     existing `--from-ship-failure`).

   Total test delta: ≥8 (target: dispatcher 756 → ≥764 pass / 0
   fail).

5. **No changes** to: `contracts/sgc-capabilities.yaml`,
   `prompts/*.md`, `src/dispatcher/spawn.ts`,
   `src/dispatcher/validation.ts`, `src/dispatcher/compound.ts`,
   `src/dispatcher/compound-promote.ts` (CE-3-promote module stays
   byte-for-byte; GS-1-promote is a sibling module),
   `src/dispatcher/canary.ts` (GS-1 capture stays byte-for-byte),
   `src/commands/watch-ci-failure.ts`, `src/commands/canary.ts`,
   `src/commands/ship.ts`, any Invariant §1 / §3 / §6 / §13
   enforcement path.

6. **CHANGELOG.md** gains a `## Unreleased` (or `## v1.12.0`) entry
   naming this work as completing GS-1's deferred Open Question #4
   (promote helper); naming it by feature ID `f8-promote` (sibling
   to f8 = GS-1 capture).

7. **`tasks/specs/gs-1-canary.md`** change-log gains an r5 entry
   pointing to this spec; status stays `implemented` (the parent
   feature didn't regress) but the deferred Open Question #4
   (promote helper) is marked resolved-by-sibling-spec.

8. **Release** v1.11.1 → **v1.12.0** (minor — additive feature +
   additive `--from-canary` flag on existing `compound` command):
   - SemVer non-patch ✓ (minor; new CLI surface)
   - CHANGELOG migration note ✓ (no migration — additive flag;
     operators unchanged unless they invoke `--from-canary`)
   - Opt-out / revert: `git revert <release-sha>` reverts code;
     existing `promoted_to:` data in `canaries/*.md` is harmless
     leftover (operator-local state, reversible). Matches
     CE-3-promote release exemption rationale.
   - Per [[project_sgc_ship_workflow]]: main-direct + `v1.12.0` tag
     → publish.yml → npm publish; `package.json` +
     `plugins/sgc/.claude-plugin/plugin.json` lockstep version
     bump.
   - Discoverability: README command table row for `sgc compound`
     extended to mention `--from-canary`; `sgc compound --help`
     lists the new flag.

9. **Dogfood** (lands in same ship as r2 → implemented bump): the
   v1.11.0 self-dogfood already produced a real canary-failure
   record at `.sgc/canaries/2026-05-25-c29f021-smoke_install.md`
   carrying the PATH-shadow regression context. Promote this real
   record (after edit) end-to-end:
   ```
   $EDITOR .sgc/canaries/2026-05-25-c29f021-smoke_install.md
   # Replace `regression_seed: "TODO: operator-fill ..."` with
   # the actual safeguard (e.g. "Use isolated `npm install
   # --prefix <mkdtemp>` for any version-verification tooling;
   # `npx --yes pkg@ver` PATH-shadows when bin is on PATH; see
   # feedback_npx_path_shadow memory.")
   sgc compound --from-canary 2026-05-25-c29f021-smoke_install
   # → writes solutions/<cat>/canary-c29f021-smoke_install.md
   # → canary file gains promoted_to: <cat>/canary-c29f021-smoke_install
   ```
   This validates the **GS-1 → GS-1-promote → CE-1 hand-off**
   end-to-end: the promoted solution's `prevention:` field becomes
   discoverable by `extractPreventions` on the next L3 `sgc plan`,
   feeding into `planner.adversarial` as a prior-prevention. **Same
   shape as CE-3 → CE-3-promote → CE-1 hand-off** (which closed CE
   loop end-to-end at v1.7.0).

## Open questions

- **Re-promote semantics**: should `--force` on an `AlreadyPromoted`
  record overwrite the previous `promoted_to:` pointer? Lock: **NO**.
  `--force` only bypasses `DuplicateMatch` dedup refuse, not
  `AlreadyPromoted` idempotency guard. Operator explicitly removes
  `promoted_to:` from canary file to re-promote. Two mutations is
  fine; conflating them is a footgun. Matches CE-3-promote OQ
  resolution.
- **`source_task_ids` when no active task**: synthetic
  `CANARY-<short-sha>-<phase>` id (locked above). Open whether a
  future janitor pass should reconcile these against
  `.sgc/decisions/` task ids — defer; not blocking.
- **Cross-record dedup (canary vs ship-failure of same sha)**: a
  canary failure and a ship-failure on the same commit_sha could
  promote into similar solutions/ entries. The `compound.related`
  Jaccard pass will catch them via `signature` match. v0 lets
  operator decide via `DuplicateMatch` refuse → either differentiate
  regression_seed wording, or `--force` for intentional separate
  records (two distinct failure-class observations on same commit
  is a valid case). No special-casing needed.
- **Promote → CE-1 prevention injection** (downstream): once the
  promoted solution lands in `solutions/<cat>/<slug>.md`,
  `extractPreventions` will pick it up on next `sgc plan` L3 call
  for the same category, feeding it into `planner.adversarial`. This
  is the actual compound-engineering close for the GS-1 arc: a
  post-publish canary failure becomes a future planner pre-mortem
  input — symmetric to CE-3 → CE-1 closure. Lock: nothing to do
  here; CE-1 already reads any `solutions/` entry with a non-empty
  `prevention:` field regardless of source namespace
  (ship-failures/ vs canaries/) since both go through
  `compoundRelated` + `writeSolution` to land identical SolutionEntry
  shapes.
- **Bin name in promoted solution context**: the GS-1 capture
  records `packageName` but not `binName` (which derived from pkg
  name via `deriveBinName(pkg)`). When promote sees a record from a
  pkg whose bin differs from default (e.g. operator passed
  `--bin custom-name`), the promote-side reconstruction can't
  recover that. v0 lock: the `binName` divergence is not part of
  the failure-classification signal — `failedPhase: smoke_install`
  already implies "the bin invocation went wrong"; the solution
  body's templated text references `packageName` only. If real
  field experience shows operator needs `binName` in the promoted
  solution body, add `binName?: string` to the capture frontmatter
  in GS-1.x (not blocking this spec).

## Change log

- 2026-05-25 r3 — **end-to-end loop closed against real data**. Post-
  v1.12.0 ship + CE-3 self-watch confirmed green for fd5227b. First
  live promote dogfood (`sgc compound --from-canary
  2026-05-25-c29f021-smoke_install` against the real PATH-shadow capture
  from v1.11.0 dogfood, after operator edited `regression_seed:` to
  the actual safeguard) **caught a dispatcher robustness gap**:
  ```
  ERROR  undefined is not an object (evaluating 'text.normalize')
    at tokenize (src/dispatcher/dedup.ts:46:22)
    at similarity / findBestMatch / compoundRelatedHeuristic / promoteCanaryFailure
  ```
  Root cause: 2 of 3 legacy `.sgc/solutions/runtime/*.md` entries from
  pre-CE-1 phases carry minimal frontmatter (intent + category only —
  missing schema-required signature/tags/problem). `tokenize(undefined)`
  crashes at `.normalize()`. NOT GS-1.1-specific — same crash hits
  `runCompound` + `runCompoundPromote`; dispatcher gap that escaped
  detection because no compound iteration had hit those entries since
  they were authored. Identical-shape to CE-3.1 (v1.6.1) + GS-1.1
  (v1.11.1) dogfood-found bugfix pattern — **third dogfood-found bug
  in the GS-1 arc; validates dogfood-as-test paradigm a third time**.

  **GS-1.2 fix shipped as v1.12.1** (commits f95fe5b fix + 879cc86
  chore release, CE-3 self-watch green for 879cc86): defensive guards
  in `src/dispatcher/dedup.ts` — `tokenize` coerces non-string → empty
  Set; `similarity` coalesces tags → []. Behavior on malformed entries:
  similarity degrades to "no overlap" (score 0) rather than throwing.
  Tests +8 in new `tests/dispatcher/dedup.test.ts`. Dispatcher CI gate
  765 → 773.

  **Post-fix live re-dogfood SUCCESS**:
  ```
  $ sgc compound --from-canary 2026-05-25-c29f021-smoke_install
  promote: action=new_entry
  solution=.sgc/solutions/other/canary-c29f021-smoke_install.md
  canary=.sgc/canaries/2026-05-25-c29f021-smoke_install.md  [exit=0]
  ```

  **Solution shape verified** (`.sgc/solutions/other/canary-c29f021-smoke_install.md`):
  - `prevention:` = operator-edited regression_seed verbatim (the npx
    PATH-shadow safeguard from [[feedback_npx_path_shadow]] memory)
  - `solution:` = templated "Canary failure of @sdsrs/sgc@1.11.0 at
    phase smoke_install on c29f021..."
  - `category: other` (heuristic-derived)
  - `source_task_ids: [94913CB45F9D4C3E906B3C2C8E]` (active CE parent
    intent picked up)
  - `related_entries:` 3 refs (legacy entries safely scored 0 via
    new dedup guard; harmless audit trail)
  - `confidence: provisional`
  - Canary file mutation: `promoted_to: other/canary-c29f021-smoke_install`
    stamped (idempotency guard + audit anchor)

  **GS-1 → GS-1-promote → CE-1 hand-off VERIFIED end-to-end against
  real data**: `extractPreventions` on the next L3 `sgc plan` for
  category `other` will discover this prevention (matching the
  `prevention:` field non-empty) and feed it into
  `planner.adversarial` as a prior-prevention. Identical-shape closure
  to CE-3 → CE-3-promote → CE-1 (v1.7.0) — both arcs now end-to-end
  closed.

  All 9 spec success criteria met:
  - #1 module + types ✓ (canary-promote.ts)
  - #2 runCanaryPromote ✓ (commands/compound.ts)
  - #3 --from-canary arg ✓ (sgc.ts)
  - #4 ≥7 unit tests ✓ (9 cases)
  - #5 zero touch on CE-3-promote / GS-1 capture / invariant paths ✓
  - #6 CHANGELOG ## Unreleased → v1.12.0 (then v1.12.1 dedup fix) ✓
  - #7 parent spec r5 entry ✓
  - #8 v1.12.0 release shipped + v1.12.1 dogfood-fix shipped ✓
  - #9 dogfood green ✓ (above)

  Open Question carryover: cross-record dedup CE-3 vs GS-1 records on
  same SHA (OQ #3) remains as documented — operator chooses
  differentiate / --force per case.

  **GS-1 arc fully closed**. v1.11.0 (capture) → v1.11.1 (PATH-shadow
  fix) → v1.12.0 (promote) → v1.12.1 (dedup robustness). 4 ships,
  3 dogfood-found bugs, all 3 fixed inside the same session. Spec
  status: implemented r3.

- 2026-05-25 r2 — status → implemented. Shipped in a single in-session
  commit batch (un-pushed, awaiting separate ship AUTH for v1.12.0
  release per [[project_sgc_ship_workflow]]):
  - New module `src/dispatcher/canary-promote.ts` (~250 LOC) — fork of
    `src/dispatcher/compound-promote.ts` (CE-3 promote) with
    ship-failure → canary-failure shape swaps. Exports
    `promoteCanaryFailure` + `PromoteCanaryOptions` /
    `PromoteCanaryResult` / `PromoteCanaryErrorCode` /
    `PromoteCanaryError`. All 4 refuse guards, Invariant §3 write-gate
    path (`compoundContext → compoundRelated (heuristic) → writeSolution`
    with real spawn audit trail under `.sgc/spawns/`), and
    `promoted_to:` audit-anchor mutation match CE-3-promote
    byte-for-byte.
  - `src/commands/compound.ts` extended — exports `runCanaryPromote(opts)`
    wrapping `promoteCanaryFailure`. `runCompound` + `runCompoundPromote`
    (CE-3) **unchanged**.
  - `src/sgc.ts` `compound` defineCommand — new `--from-canary <slug>`
    arg; early-branch routing checked BEFORE `--from-ship-failure`
    (predictable ordering, mutually exclusive in practice). Reuses
    existing `--solution-slug` flag (dual-purpose description updated).
    `--force` reused. No new flag for solution slug override.
  - 9 new unit tests in `tests/dispatcher/canary-promote.test.ts` — all
    success criterion #4 cases (T1 MissingCanaryFailure / T2
    PlaceholderRegressionSeed / T3 AlreadyPromoted / T4 DuplicateMatch
    no-force + refuse-path file-level invariants / T5 happy path + slug
    + prevention + promoted_to / T6 `--force` bypasses DuplicateMatch /
    T7 `--force` does NOT bypass AlreadyPromoted / T8 phase-
    disambiguation regression / T9 PromoteCanaryError shape sanity).
    All 9 pass isolated; 30 expect() calls; ~71ms wall.
  - 1 extended test in `tests/dispatcher/sgc-cli.test.ts` — `compound
    --help` listing asserts `--from-canary` alongside existing
    `--from-ship-failure` / `--solution-slug` / `--force` (extends
    existing test, no count delta there).
  - CHANGELOG.md gains `## Unreleased` entry (4 sections: Added /
    Architecture / Tests / Compatibility — mirrors GS-1 v1.11.0 +
    CE-6 v1.10.0 structure); names GS-1.1 by feature ID f8-promote
    (sibling to f8 = GS-1 capture).
  - Parent spec `tasks/specs/gs-1-canary.md` r5 entry — marks GS-1
    Open Question #4 resolved-by-sibling-spec; status stays
    `implemented` (parent didn't regress).
  - Dispatcher CI gate **756 → 765** (+9). 1999 expect() calls; ~122s
    wall. **All 9 success criteria met**:
    - #1 module + types ✓ (canary-promote.ts exports the full surface)
    - #2 commands/compound.ts extension ✓ (runCanaryPromote)
    - #3 sgc.ts --from-canary registration ✓
    - #4 ≥7 unit tests ✓ (9 cases incl. T8 phase-disambiguation)
    - #5 zero touch on CE-3-promote / GS-1 capture / invariant paths ✓
    - #6 CHANGELOG ## Unreleased entry ✓
    - #7 parent spec r5 entry ✓
    - #8 v1.12.0 release — **deferred** to separate ship AUTH per
      project ship workflow
    - #9 dogfood — **deferred** to post-ship (promote the real
      `.sgc/canaries/2026-05-25-c29f021-smoke_install.md` from
      v1.11.0's PATH-shadow dogfood; lands as r3 update after ship)

- 2026-05-25 r1 — initial draft following `GS-1.1 promote helper`
  direction (this session, after GS-1 v1.11.0 → v1.11.1 ship cycle
  closed end-to-end with self-dogfood green). Locks in: heuristic-
  only promote (no LLM); `--from-canary <slug>` flag on existing
  `compound` command (no new subcommand); same Invariant §3
  write-gate as `runCompound` + `runCompoundPromote` (real
  `compound.related` spawn, real `DedupStamp`, real `writeSolution`);
  operator-edited `regression_seed:` is the authoritative
  `prevention` field; `promoted_to:` frontmatter mutation on success
  is the audit trail + idempotency guard; refuse placeholder seed +
  already-promoted + missing file + dedup-match-without-force;
  `--force` only bypasses dedup, not AlreadyPromoted. Default slug
  shape `canary-<short-sha>-<phase>` preserves the (sha, phase)
  tuple from capture-side dedup key (CE-3-promote's
  `ship-failure-<short-sha>` shape didn't need the phase dimension).
  Reuses existing `--solution-slug` flag for slug override (no third
  override flag). Dogfood path is the real
  `.sgc/canaries/2026-05-25-c29f021-smoke_install.md` record from
  v1.11.0's PATH-shadow dogfood (after operator edits
  `regression_seed:`). Closes GS-1 spec Open Question #4
  (deferred to sibling spec per CE-3 → CE-3-promote precedent).
  Identical-shape to CE-3-promote spec
  (`tasks/specs/ce-3-promote-helper.md` r1, 2026-05-22) — same 4
  refuse guards, same Invariant §3 write-gate path, same operator-
  edited-seed authoritative posture, same `promoted_to:` audit
  anchor, same `--force` semantics.
