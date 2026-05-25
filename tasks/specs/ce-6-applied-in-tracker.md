---
status: draft
revision: 1
task_id: ce-6-applied-in-tracker
feature_id: f7
parent_intent: (none — CE-6 is P3.CE-6 from the original 6-item compound list; sibling to CE-4/CE-5 outside parent intent 94913CB45F9D4C3E906B3C2C8E)
---

# CE-6 — `applied_in` score feedback loop (评分回流)

## Goal

Close the data-direction of the CE compound-engineering loop. When
`planner.adversarial` (at L3 plan time) emits a `failure_mode` whose
`early_signal` references a known prior_prevention's `solution_ref`
(CE-1 step-5 recurrence flag), write that consuming `task_id` back to
the source `solutions/<cat>/<slug>.md` frontmatter's new optional
`applied_in: [task_id, ...]` field. Score is derived as
`applied_in.length` — count of distinct decisions that hit this
lesson via the pre-mortem path. This makes "which lessons truly took
effect" auditable from the lesson side, completing the round-trip
that CE-1 (forward injection) and CE-2 (read-side audit) started.

Closes **P3.CE-6** from the original 6-item compound list shown in
prompt P#699 ("评分回流——哪条 solution 真的避免了下次回归"); after
this lands the original list is 6/6 shipped.

## Non-goals (v0)

- Do NOT introduce an LLM-mode path for the writeback. Extraction is
  pure substring match of known `prior_preventions[].solution_ref`
  values against `failure_modes[].early_signal` strings — the same
  pattern `src/dispatcher/reflect.ts:104` already uses for CE-2's
  `discussed` detection. No new prompt, no spawn, no Tier-2
  `llm.request/llm.response` events owed.
- Do NOT promote `solution_ref` to a separate `FailureMode` field.
  Keeping it embedded in `early_signal` (per
  `prompts/planner-adversarial.md:86-87`) means CE-6 ships without
  touching the planner.adversarial manifest output shape, prompt
  contract, or `validation.ts` validator. Smaller blast radius;
  prompt-regression tests stay green.
- Do NOT add timestamp or probability to records. P#699 spec
  literally says `applied_in: [task_ids]` — a scalar string array.
  Score = count. Future enrichment (recency weighting, weighted by
  planner-emitted probability) is **breaking** to the scalar shape;
  defer behind a separate spec when v0 data shows the need.
- Do NOT mutate any solution-content fields. `recordApplied` writes
  ONLY the `applied_in` array. `intent / category / prevention /
  source / source_task_ids / what_didnt_work / times_referenced /
  last_updated` are untouched. Regression test enforces this.
- Do NOT backfill historical decisions. CE-6 is forward-looking —
  only L3 plans run after CE-6 ships populate `applied_in`. The
  alternative (scan all `.sgc/decisions/*/intent.md` ## Pre-mortem
  sections and back-extract refs) is its own audit pass; out of
  scope.
- Do NOT add a new CLI command in v0 (no `sgc applied --solution
  <ref>`). The data lives in solutions frontmatter directly; `cat
  solutions/<cat>/<slug>.md` reveals it. `sgc reflect` stdout gains
  a per-candidate `applied: N` annotation as the v0 read-side
  surface — minimal additional change.
- Do NOT add an opt-out env flag (no `SGC_DISABLE_APPLIED_TRACKER`).
  The writeback target (`<stateRoot>/solutions/`) is operator-local
  state; mutation is reversible (`git checkout` or manual frontmatter
  delete). npm consumers see no behavior change unless they run L3
  `sgc plan` with a populated solutions corpus.
- Do NOT route the writeback through `writeSolution()` (which is
  Invariant §3 write-gated by `dedup_stamp`). See **Invariant §3
  carve-out** below.

## Constraints

- **Invariant §3 carve-out (metadata-only mutation)**: Invariant §3
  binds `writeSolution()` because that function mutates
  *solution-content* (`intent / prevention / what_didnt_work /
  source_task_ids / times_referenced`) and requires a deterministic
  `dedup_stamp` from `compound.related` to authorize the write. The
  rationale is documented in
  `feedback_compound_related_invariant3.md`: "do NOT LLM-swap
  compound.related; dedup_stamp authorizes writeSolution and must
  stay deterministic." CE-6's mutation is purely an additive
  *audit-trail metadata* field — it does NOT alter what the solution
  says, what category it belongs to, or its dedup identity. The new
  helper `recordApplied()` bypasses `writeSolution()` deliberately
  and goes directly through `parseFrontmatter` →
  `serializeFrontmatter` → `writeAtomic`. The spec test in success
  criterion #6 enforces that no content field changes.
- **Reuse existing helpers**: `solutionPath(cat, slug, stateRoot)`
  (state.ts:470), `parseFrontmatter` (state.ts:100),
  `serializeFrontmatter`, and `writeAtomic` (state.ts:121). No new
  fs primitives. `SolutionEntry` interface in
  `src/dispatcher/types.ts` gains the optional field.
- **Sync fs** is acceptable (consistent with current `state.ts`).
  Async conversion happened in H.1 ship C for researcher-history.ts
  to enable parallel I/O across the corpus walk; CE-6 writes target
  ≤ N solution files (N = matched `prior_preventions`, capped at
  CE-1 `topN=3` by default), so the I/O is bounded and sync is
  fine. Keeps the helper signature simple to call from plan.ts.
- **Concurrency model**: read-merge-write per file. CE-4 `--async`
  enforces single-active-plan-per-project (see
  `src/dispatcher/plan-jobs.ts` concurrency gate). The realistic
  race window is an operator running two sync `sgc plan` invocations
  in parallel terminals against the same project — minute-scale,
  unlikely but possible. Mitigation: on detected stale mtime
  (read-side mtime ≠ pre-write mtime), retry once; if still stale
  after retry, emit `plan.applied_failed` with reason
  `stale_mtime_after_retry` and skip that file. The plan itself
  does NOT fail — writeback failure is best-effort.
- **Defensive parsing** per CE-1 obs #95 precedent (`solutions/`
  may contain raw-markdown test fixtures or hand-edited files):
  `parseFrontmatter` wrapped in try/catch per file; failure logs
  `plan.applied_failed` with reason `parse_failed` and skips.
- **Path traversal guard**: `solution_ref` arrives from
  `prior_preventions[].solution_ref` which is computed in
  `preventions.ts:153` as `${scan.category}/${scan.slug}` from
  `walkSolutionsCorpus` directory listing — both components are
  read from the filesystem, not user input. Still, `recordApplied`
  validates ref shape matches `/^[a-z0-9_]+\/[a-zA-Z0-9._-]+$/`
  before resolving the path; unparseable refs log skipped_malformed.
- **Event additions** (additive to events.ndjson schema, follows
  CE-4 `plan.async_*` precedent — `event_type` is template-literal
  typed `${string}.${string}`):
  - `plan.applied_recorded` (success): payload `{task_id,
    solution_refs_input: string[], updated: string[],
    skipped_already_applied: string[], skipped_missing: string[],
    skipped_malformed: string[]}`
  - `plan.applied_failed` (per-file failure): payload `{task_id,
    solution_ref, reason: "parse_failed" | "stale_mtime_after_retry"
    | "io_error", error_message}`
- **Plan-flow isolation**: `recordApplied` is called AFTER
  `planner.adversarial` returns AND BEFORE `writeIntent` at
  `plan.ts:570`-area where the pre-mortem is rendered into intent.md
  body. Plan.ts wraps the recordApplied call in try/catch — any
  throw is converted to a `plan.applied_failed` event and the plan
  continues. Iron Law: writeback failure NEVER fails plan.
- **L3-only activation**: extraction + recordApplied only fires on
  the L3 plan branch where planner.adversarial runs with
  `prior_preventions` (current `plan.ts:380` guard:
  `if (level === "L3" && ...)`). L1/L2 paths untouched. Memory #120
  pattern.
- **No new `scope_tokens` declarations**. `recordApplied` runs in
  the dispatcher process (plan.ts is the CLI orchestrator), not an
  agent spawn. Agent capability scope_tokens do NOT apply. The
  filesystem write authority sits implicit in the CLI process.

## Success criteria

1. **New module** `src/dispatcher/applied-tracker.ts` (~150 LOC)
   exports:
   ```ts
   export interface RecordAppliedResult {
     updated: string[]               // solution_refs whose file gained a new task_id
     skipped_already_applied: string[]   // task_id already in applied_in
     skipped_missing: string[]       // solution file not found
     skipped_malformed: string[]     // ref shape invalid OR frontmatter parse failed
     stale_skipped: string[]         // stale mtime persisted after one retry
     write_failed: string[]          // writeAtomic threw (disk full, EPERM, etc)
   }
   export function extractAppliedSolutionRefs(
     failure_modes: FailureMode[],
     prior_preventions: PriorPrevention[],
   ): string[]
   export function recordApplied(
     stateRoot: string | undefined,
     solution_refs: string[],
     task_id: string,
     opts?: { logger?: Logger },
   ): RecordAppliedResult
   ```
   - `extractAppliedSolutionRefs`: for each `fm.early_signal`,
     substring-match against each `prior_preventions[].solution_ref`;
     return deduped union. Empty input → empty output.
   - `recordApplied`: per ref, validate shape → resolve via
     `solutionPath` → readFile + parseFrontmatter → if `task_id ∉
     applied_in`, append (preserving prior entries), serialize,
     writeAtomic. Mtime-CAS retry on conflict (max 1 retry).

2. **`SolutionEntry` type** (in `src/dispatcher/types.ts`) gains
   optional field:
   ```ts
   applied_in?: string[]   // task_ids that consumed this prevention via planner.adversarial recurrence
   ```
   Field is additive-optional — existing solution files without it
   are valid (treated as empty by `recordApplied` and downstream
   readers).

3. **plan.ts L3 wire-up** (~10 LOC, after `adversarialOut = ...`
   assignment at `src/commands/plan.ts:433`):
   ```ts
   if (priorPreventions.length > 0 && adversarialOut) {
     try {
       const refs = extractAppliedSolutionRefs(
         adversarialOut.failure_modes,
         priorPreventions,
       )
       if (refs.length > 0) {
         const result = recordApplied(stateRoot, refs, taskId, { logger })
         logger.event({
           task_id: taskId, spawn_id: null, agent: "plan.applied",
           event_type: "plan.applied_recorded",
           level: "info",
           payload: { solution_refs_input: refs, ...result },
         })
       }
     } catch (err) {
       logger.event({
         task_id: taskId, spawn_id: null, agent: "plan.applied",
         event_type: "plan.applied_failed",
         level: "warn",
         payload: {
           error_class: err instanceof Error ? err.name : "unknown",
           error_message: err instanceof Error ? err.message : String(err),
         },
       })
     }
   }
   ```
   Plan never fails on recordApplied error.

4. **sgc reflect read-side** (~8 LOC across
   `src/dispatcher/reflect.ts`):
   - `auditDecision` body loop (~line 178) reads
     `solutionFrontmatter.applied_in?.length ?? 0` from the existing
     scan (already parsed at reflect.ts:182 — no extra fs read) and
     sets it on `ReflectCandidate.applied_count`.
   - stdout formatter at line ~300: when `discussed: true`, append
     `applied: N` after the `(overlap: M)` tag.
   - `ReflectCandidate` type gains `applied_count: number`
     (always-present, defaults to 0 when frontmatter has no
     `applied_in` field); `--json` output surfaces it.

5. **Tests** (current 717 → ~735):
   - `tests/dispatcher/applied-tracker.test.ts` (≥10 cases):
     - happy: 2 refs both new → both updated
     - idempotent: re-recording same task_id → skipped_already_applied
     - missing: ref resolves to non-existent file → skipped_missing
     - malformed-ref: invalid shape → skipped_malformed
     - malformed-frontmatter: file exists but unparseable → skipped_malformed + event
     - empty input refs → no-op, all-empty result
     - dedup-existing: applied_in already has task_id from earlier
       run → no write, skipped_already_applied
     - preserves content (CRITICAL): asserts intent / prevention /
       what_didnt_work / source_task_ids / times_referenced /
       category / source unchanged after recordApplied
     - extractAppliedSolutionRefs: single ref in signal, multi refs,
       no refs, ref-not-in-prior_preventions filtered out
     - stale-mtime retry: simulate mtime change between read and
       write → retries once → succeeds on second pass
   - `tests/dispatcher/plan.test.ts` extend (≥2 cases):
     - L3 with mocked adversarial returning failure_modes containing
       solution_ref in early_signal → recordApplied called +
       intent.md still written + applied_in present on file
     - recordApplied throws → plan.ts catches, logs
       plan.applied_failed event, plan still completes with
       intent.md written
   - `tests/dispatcher/reflect.test.ts` extend (≥1 case):
     - candidate with `applied_in: [x, y]` on disk → stdout shows
       `applied: 2` for discussed, `--json` output has
       `applied_count: 2`

6. **No changes** to: `contracts/sgc-capabilities.yaml`,
   `prompts/planner-adversarial.md`, `prompts/compound-*.md`,
   `prompts/researcher-history.md`, `src/dispatcher/spawn.ts`,
   `src/dispatcher/validation.ts`, `src/dispatcher/agents/`,
   any Invariant enforcement path (§1, §3, §6, §13). CE-1's
   `prior_preventions` injection, CE-2's reflect-audit semantics,
   and Invariant §3 dedup_stamp gate stay byte-for-byte unchanged.

7. **CHANGELOG.md** gains `## Unreleased` (or `## v1.10.0`) entry
   naming CE-6 by feature ID f7 (sibling to CE-4/CE-5 outside parent
   intent 94913CB45F9D4C3E906B3C2C8E), describing: new optional
   `applied_in` field; heuristic-only extraction; write path bypasses
   Invariant §3 with metadata-only carve-out rationale; reflect
   stdout addition; the closure of the original 6-item compound list.

8. **Release** as v1.9.0 → **v1.10.0** (minor — additive feature).
   Per §EXT released-artifact checklist:
   - SemVer non-patch ✓ (minor)
   - CHANGELOG migration note ✓ (no migration needed — additive
     optional field; the entry calls out the new field and explains
     it activates only on L3 plan with non-empty `prior_preventions`)
   - Opt-out / revert path: `git revert <release-sha>` reverts code;
     existing `applied_in` data in solutions/*.md is harmless
     leftover that future code ignores. Acceptable per the
     "operator-local state, reversible" exemption.
   - One-time discoverability: existing `sgc tail` / events.ndjson
     surfaces `plan.applied_recorded` events when the first L3 plan
     post-upgrade runs. README mentions the field in the solutions
     schema section.

## Open questions

- **Mtime-CAS retry depth**: spec locks at "1 retry, then skip with
  stale_skipped event". If real concurrent-plan-on-same-solution
  contention turns out to need higher tolerance, bump in a follow-up
  patch. v0 priority: fail-soft over fail-loud.
- **Cap on `applied_in` array length**: not capped in v0. Long-lived
  popular solutions could accumulate hundreds of task_ids over
  months. If frontmatter parser slows materially (>100ms for a
  single solution read) we add a cap with rotation policy (keep
  newest N + counter). Defer until v0 telemetry shows the pain.
- **Future migration to richer schema** (timestamp + probability per
  applied event): currently spec-locked OUT (non-goal). When the
  pressure surfaces, the migration is a Δ-contract on the
  `solutions/` frontmatter shape — L3 in its own right, with
  schema-version bump on the SolutionEntry interface.

## Change log

- 2026-05-25 r1 — initial draft from `继续 CE-6` clarification
  conversation. Locks in: planner.adversarial substring-match as
  the applied signal (NOT sgc reflect, NOT hybrid); direct frontmatter
  mutation (NOT separate ledger); scalar `[task_ids]` shape (NOT
  object records with timestamp/probability); Invariant §3
  metadata-only carve-out (recordApplied bypasses writeSolution
  with explicit rationale + content-preservation regression test);
  L3-only activation; writeback failure NEVER fails plan; reflect
  stdout `applied: N` annotation as the v0 read-side surface.
