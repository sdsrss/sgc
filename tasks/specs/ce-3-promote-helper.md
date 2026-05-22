---
status: draft
revision: 1
task_id: 94913CB45F9D4C3E906B3C2C8E
feature_id: f4-promote
parent_intent: .sgc/decisions/94913CB45F9D4C3E906B3C2C8E/intent.md
parent_spec: tasks/specs/ce-3-ship-failure-capture.md
---

# CE-3 promote — `sgc compound --from-ship-failure <slug>`

## Goal

Close the second half of the CE-3 compound-engineering arc: the
operator-promotion bridge from `<stateRoot>/ship-failures/<slug>.md`
into `<stateRoot>/solutions/<category>/<slug>.md`. CE-3 v0 captures
raw failure material; this helper converts a captured ship-failure
record (after the operator has edited its `prevention_seed:`
frontmatter into a real safeguard) into a finished `solutions/`
entry through the **same Invariant §3 write-gate** that `runCompound`
uses. Heuristic-only, no LLM, no agent spawn beyond the existing
`compound.related` stamp issuer.

After this lands, the operator workflow becomes:

```
git push origin main --tags
sgc watch-ci-failure          # captures ship-failures/<sha-slug>.md on red
$EDITOR .sgc/ship-failures/<sha-slug>.md   # operator fills prevention_seed
sgc compound --from-ship-failure <sha-slug>  # promote → solutions/
```

`ship-failures/` becomes the working namespace for in-flight captures;
`solutions/` remains the canonical knowledge corpus that
`researcher.history` + `extractPreventions` (CE-1) mine.

## Non-goals

- Do NOT change `runCompound` (the task-decision compound path)
  semantics or signature. Promote is a sibling entry point at the
  CLI layer, not a hook inside `runCompound`.
- Do NOT call any LLM in the promote path. The 4-agent
  context/related/solution/prevention cluster stays for task-decision
  compound; promote uses **only `compoundRelatedHeuristic`** for its
  Invariant §3 stamp and **deterministic frontmatter mapping** for
  the SolutionEntry fields. Operator-edited `prevention_seed:` is
  authoritative; no LLM rewrite.
- Do NOT auto-invoke promote from `watch-ci-failure`. v0 is
  operator-driven (operator must edit `prevention_seed:` first; no
  meaningful auto-promote without that edit).
- Do NOT delete or move `ship-failures/<slug>.md` on success. Mutate
  in place by adding `promoted_to: <category>/<slug>` to its
  frontmatter (audit trail, non-destructive). Re-running promote on
  a record that has `promoted_to:` set refuses (idempotent).
- Do NOT bypass `validateDedupStamp` / `validateSolution`. The
  promote helper produces a stamp that `writeSolution` validates by
  the same path as `runCompound`. A bug here cannot corrupt the
  corpus more than `runCompound` already can.
- Do NOT introduce `compound.ship_failure` / `compound.from-failure`
  / similar new agents. Manifest stays at the 4 compound agents.

## Constraints

- **Refuse placeholder `prevention_seed:`**: if the field still
  starts with `TODO: operator-fill` (the literal CE-3 capture
  template prefix from `ship-failure.ts:339`), refuse with a clear
  error pointing to the slug + the field. Pre-edit promote = dead
  on arrival.
- **Refuse already-promoted records**: if `promoted_to:` is present
  in the frontmatter, refuse with the existing target ref. Operator
  re-runs are a no-op.
- **Refuse missing ship-failure file**: if `<stateRoot>/ship-failures/<slug>.md`
  doesn't exist, refuse. Suggest `ls .sgc/ship-failures/`.
- **Refuse dedup match without `--force`**: if `compoundRelated`
  reports a `duplicate_match` (similarity ≥ `DEDUP_THRESHOLD`),
  refuse and print the duplicate ref + similarity, **mirroring
  `runCompound`'s update_existing branch for the no-force case**
  EXCEPT this is a refuse-not-merge: ship-failure promotion is a
  one-shot operator action, not an in-flight task update, so silent
  merge would hide a real signal. Operator decides: either edit
  `prevention_seed:` to differentiate, or pass `--force` for
  intentional re-write.
- **`--force` bypasses the dedup refuse** but still requires a real
  `compound.related` spawn (Invariant §3 stamp shape). Reason field:
  `user_forced`.
- **Category derivation** is heuristic: pass `summaryExcerpt + workflow_name`
  to `compoundContextHeuristic` for category/tags/problem_summary.
  This is the same heuristic the inline path of `runCompound`'s
  `compound.context` uses; reusing it keeps the corpus shape
  consistent. (Ship-failure body content is the input "intent" for
  context purposes.)
- **SolutionEntry field mapping** (deterministic):
  - `id` = fresh ULID
  - `signature` = `computeSignature(problem_summary)` (same as
    `runCompound`)
  - `category` / `tags` / `problem` / `symptoms` from
    `compoundContextHeuristic` output
  - `solution` = templated: `"Ship failure of <workflow_name> at
    <short_sha> (run <run_id>); see body for $GITHUB_STEP_SUMMARY
    excerpt + operator's prevention_seed."`
  - `prevention` = ship-failure frontmatter `prevention_seed:`
    (operator-edited, verbatim — Invariant §1 doesn't apply: this
    is operator input, not LLM output)
  - `what_didnt_work` = `[]` (ship-failures don't carry
    review-flagged approaches; field stays empty array,
    `validateSolution` requires array not non-empty)
  - `source_task_ids` = `[<task_id-derived-from-current-or-tag>]` —
    if `readCurrentTask()` returns null (no active task), fall
    back to a synthetic `SHIP-FAILURE-<short-sha>` id; otherwise
    use the active task_id. (Decisions corpus stays referenceable.)
  - `confidence: "provisional"`
  - `first_seen` / `last_updated` = now
  - `times_referenced` = 0
  - `related_entries` from `compoundRelated.related_entries` (top-5
    near-match refs, range 0.3 < sim < threshold) — exactly the
    same surface as `runCompound`
- **Slug derivation**: default = `ship-failure-<short-sha>` (e.g.
  `ship-failure-9c8bc57`). `--slug <s>` overrides.
- **Spawn-trail for Invariant §3 audit**: the `compound.related`
  call goes through `spawn(..., { inlineStub })` to produce a real
  `spawn_id` directory under `.sgc/spawns/`. Matches `runCompound`
  pattern; downstream `compound_related_spawn_id` audit consumers
  see the same shape.
- **`ship-failures/<slug>.md` mutation on success**: read the file,
  parse frontmatter + body, add `promoted_to: <category>/<slug>` to
  the frontmatter object, re-serialize, atomic-rewrite. Preserves
  body unchanged. The new field is the operator's audit anchor and
  the idempotency guard.
- **No event emit in v0**: same posture as CE-3 capture (no
  spawn.start/end beyond the inline `compound.related` spawn,
  which already follows Invariant §13 paired-event semantics). A
  `compound.promoted` event is future scope.
- **Async fs / atomic writes** consistent with `runCompound` and
  CE-3 capture. Use `writeAtomic` (state.ts) for the ship-failure
  mutation; `writeSolution` already uses it.

## Success criteria

1. New module `src/dispatcher/compound-promote.ts` exports:
   ```ts
   export interface PromoteOptions {
     slug: string
     stateRoot?: string
     /** Bypass dedup; --force flag. */
     force?: boolean
     /** Override SolutionEntry slug (default ship-failure-<short-sha>). */
     solutionSlug?: string
     logger?: Logger
   }
   export interface PromoteResult {
     shipFailurePath: string
     solutionPath: string
     dedupAction: "new_entry" | "user_forced"
     relatedRefs: string[]
   }
   export class PromoteError extends Error {
     readonly code:
       | "MissingShipFailure"
       | "PlaceholderPreventionSeed"
       | "AlreadyPromoted"
       | "DuplicateMatch"
   }
   export async function promoteShipFailure(
     opts: PromoteOptions,
   ): Promise<PromoteResult>
   ```

2. `src/commands/compound.ts` extended: new exported
   `runCompoundPromote(opts)` wrapping `promoteShipFailure`. The
   existing `runCompound` is unchanged. The CLI dispatcher in
   `src/sgc.ts` routes `--from-ship-failure <slug>` to
   `runCompoundPromote`; absent the flag, `runCompound` runs as
   today.

3. `src/sgc.ts` `compound` `defineCommand` gains two new args:
   - `--from-ship-failure <slug>` (string, optional)
   - `--solution-slug <s>` (string, optional; only valid alongside
     `--from-ship-failure`)
   Existing `--force` is reused. Existing `--slug` is reserved for
   `runCompound`; new `--solution-slug` keeps the promote path
   semantically distinct.

4. Tests: `tests/dispatcher/compound-promote.test.ts` (≥6 cases):
   1. Missing ship-failure file → throws `PromoteError` code
      `MissingShipFailure`.
   2. Placeholder `prevention_seed:` (starts with `TODO: operator-fill`)
      → throws `PromoteError` code `PlaceholderPreventionSeed`.
   3. Happy path: edited `prevention_seed:` + clean corpus →
      writes solutions/ entry; ship-failure file gains
      `promoted_to:`; result.dedupAction = `new_entry`.
   4. Dedup match (existing solution similar above threshold) with
      no `--force` → throws `PromoteError` code `DuplicateMatch`;
      no write to solutions/, no mutation of ship-failure file.
   5. `--force` bypasses dedup match → writes new entry;
      result.dedupAction = `user_forced`.
   6. Already-promoted (re-run on a record with `promoted_to:`) →
      throws `PromoteError` code `AlreadyPromoted`; idempotent.

   `tests/dispatcher/sgc-cli.test.ts` (extend):
   - `sgc compound --help` lists `--from-ship-failure` and
     `--solution-slug`.

   Total test delta: ≥7 (target: 681 → ≥688 dispatcher pass).

5. CHANGELOG.md gains a `## Unreleased` entry naming this work as
   completing CE-3's deferred Open Question #4 (promote helper).

6. `tasks/specs/ce-3-ship-failure-capture.md` change-log gains a
   r4 entry pointing to this spec; status stays `implemented`
   (the parent feature didn't regress) but the deferred Open
   Question #4 is marked resolved-by-sibling-spec.

## Open questions

- **Re-promote semantics**: should `--force` on an
  `AlreadyPromoted` record overwrite the previous `promoted_to:`
  pointer? Lock: NO. `--force` only bypasses the
  `DuplicateMatch` dedup refuse, not the `AlreadyPromoted` idempotency
  guard. If operator wants to re-promote, they explicitly remove
  the `promoted_to:` field from the ship-failure file. Two
  mutations is fine; conflating them is a footgun.
- **`source_task_ids` when no active task**: synthetic
  `SHIP-FAILURE-<short-sha>` id (locked above). Open whether a
  future janitor pass should reconcile these against
  `.sgc/decisions/` task ids — defer; not blocking.
- **Promote → CE-1 prevention injection**: once the promoted
  solution lands in `solutions/<cat>/<slug>.md`,
  `extractPreventions` will pick it up on next `sgc plan` L3 call
  for the same category, feeding it into `planner.adversarial`.
  This is the actual compound-engineering close: a ship failure
  becomes a future planner pre-mortem input. Lock: nothing to do
  here; CE-1 already reads any `solutions/` entry with a non-empty
  `prevention:` field.

## Change log

- 2026-05-22 r1 — initial draft from `继续 CE-4` clarification
  conversation, which surfaced that the original 6-item compound
  list had CE-3 only half-closed (capture done in v1.6.0+v1.6.1,
  promote deferred per CE-3 r3 Open Question #4). User chose option
  (a) "finish CE-3 second half before starting CE-4 async plan."
  Locks in: heuristic-only promote (no LLM); `--from-ship-failure
  <slug>` flag on existing `compound` command (no new subcommand);
  same Invariant §3 write-gate as `runCompound` (real
  `compound.related` spawn, real `DedupStamp`, real
  `writeSolution`); operator-edited `prevention_seed:` is the
  authoritative `prevention` field; `promoted_to:` frontmatter
  mutation on success is the audit trail + idempotency guard;
  refuse placeholder seed + already-promoted + missing file +
  dedup-match-without-force; `--force` only bypasses dedup, not
  AlreadyPromoted.
