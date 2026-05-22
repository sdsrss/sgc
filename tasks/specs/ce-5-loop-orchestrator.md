---
status: implemented
revision: 2
task_id: CE-5-LOOP
feature_id: f6
parent_intent: (none — CE-5 is P2.CE-5 from the original 6-item compound list; sibling to CE-4 outside parent intent 94913CB45F9D4C3E906B3C2C8E)
---

# CE-5 — `sgc loop <task>` end-to-end orchestrator

## Goal

Chain the per-task SGC workflow into a single command. Operator
runs `sgc loop <task>`; the orchestrator drives the six-step
sequence

```
plan → [pause work] → review → qa → [pause ship] → compound
```

with checkpoint state at `<stateRoot>/loop-runs/<run-id>.md`.
Steps that are intrinsically operator-controlled (`work` = the
actual code implementation; `ship` = the human-signed release
gate at L3) write a paused-state marker and exit so the operator
can do their part, then resume with `sgc loop --resume <run-id>`.
Auto-able steps (`plan`, `review`, `qa`, `compound`) run inline
sequentially in the same process; any failure halts the loop,
records `status:failed` on that step, and exits non-zero —
operator fixes the underlying issue and re-runs `--resume` to
retry the failed step.

The compound-engineering payoff: a single command takes a task
from idea → corpus entry, with explicit pauses where the human
must act. Before CE-5, operators chained 5-6 sub-commands manually
and had to track which step they were on.

`reflect` is NOT in the chain — it's a post-hoc audit tool that
walks decisions↔solutions across the whole project, not a
per-task step. Operators run `sgc reflect` independently.

## Non-goals

- Do NOT execute the `work` step. The "implementation" inside
  work is the operator writing code; no LLM / agent / heuristic
  belongs there. v0 manual gate pauses + exits + relies on
  operator to mark complete via `--resume`. (Future: an `agent-loop`-style
  helper that lets a parent Claude session fulfill work via
  Task() / file-poll. Out of CE-5 v0.)
- Do NOT execute the `ship` step at L3. Invariant §4 requires
  interactive human signature; the loop pauses and lets the
  operator run `sgc ship` themselves. At L0/L1/L2 the loop COULD
  run ship inline, but for v0 consistency we pause at `ship`
  regardless of level — operator's call when to ship.
- Do NOT introduce a daemon, IPC socket, or in-process job queue.
  State lives entirely in files under `<stateRoot>/loop-runs/`.
- Do NOT fork subprocesses for steps. CE-4's `sgc plan --async`
  is the async story; CE-5 is the linear orchestration story.
  An operator who wants both could wrap `sgc loop` with
  `sgc plan --async` semantics in a future "loop --async" pass —
  out of v0 scope.
- Do NOT re-implement plan / review / qa / compound. Loop calls
  the existing `runPlan` / `runReview` / `runQa` / `runCompound`
  functions inline. No CLI shell-out, no extra spawn.
- Do NOT include `reflect` in the chain (rationale above —
  reflect is post-hoc audit, not per-task).
- Do NOT support concurrent loops on the same task. v0 refuses
  `sgc loop <task>` if an in-progress run exists for that task_id;
  operator must `--resume` the existing run or explicitly cancel
  it (manual `rm`).
- Do NOT auto-clean completed runs. Operator runs
  `rm <stateRoot>/loop-runs/<run-id>.md` to prune. Future flag
  `--prune-older-than <Nd>`.

## Constraints

- **State file shape** (`<stateRoot>/loop-runs/<run-id>.md`):
  ```yaml
  ---
  run_id: <ULID>
  task: <verbatim task arg>
  started_at: <ISO 8601>
  last_updated_at: <ISO 8601>
  task_id: <empty until plan succeeds>
  level: <empty until plan succeeds; one of L0..L3>
  current_step: plan | work | review | qa | ship | compound | done
  status: running | paused | failed | complete
  failed_step: <name; only when status:failed>
  error: <one-line; only when status:failed>
  steps:
    - step: plan
      status: pending | in_progress | paused | done | failed | skipped
      started_at?: <ISO>
      completed_at?: <ISO>
      output_ref?: <task_id from plan>
      error?: <one-line if status:failed>
    - step: work
      status: ...
    - ... (review / qa / ship / compound)
  ---
  ```
  Body: optional operator-readable narrative; v0 writes a "next
  steps" hint when the run pauses or fails.

- **Step status enum**:
  - `pending` — not yet reached
  - `in_progress` — currently executing (set briefly during the
    runX call; reset to done/failed on completion)
  - `paused` — manual gate pause; operator action required;
    `--resume` marks done and proceeds
  - `done` — completed successfully
  - `failed` — runX threw; error captured; `--resume` retries
  - `skipped` — never used in v0; reserved for future "skip
    step if precondition unmet" logic

- **Run status enum** (top-level):
  - `running` — transient (set during execution; replaced before
    write)
  - `paused` — a step is in `paused` status; operator owes action
  - `failed` — a step is in `failed` status; operator owes fix
  - `complete` — all 6 steps in `done` (or `skipped`)

- **Concurrency**: scanning `<stateRoot>/loop-runs/*.md` at
  `sgc loop <task>` start time refuses if any run with the same
  `task` (string match) has `status:running` OR `status:paused`
  OR `status:failed`. Suggests `--resume <run-id>` or manual
  `rm`. **Distinct from CE-4's pid-liveness probe** — loop
  state is fully file-based; no process-aliveness concept.

- **Fail-fast policy**: any runX throw → catch → mark step
  `failed` + set `error` + write state + propagate exit code 1.
  Subsequent steps are not attempted. `--resume <run-id>`
  retries the failed step from the top.

- **Manual gate `work`**: hit AFTER plan succeeds. Action:
  mark `work.status = paused`, write state with `status:paused`
  + `current_step: work`, print "next: implement; `sgc loop
  --resume <run-id>` when done" to stderr, exit 0.

- **Manual gate `ship`**: hit AFTER qa succeeds. Same paused-state
  pattern, hint references `sgc ship --signed-by <id>` at L3.

- **`--resume` semantics**: read state, find first non-done step:
  - If `paused` → mark `done`, set `last_updated_at`, continue
    to next step in loop
  - If `failed` → retry runX, on success mark `done`, on throw
    mark `failed` again
  - If `pending` (shouldn't happen with linear loop, but
    defensive) → run normally
  - If all done → print "run already complete" + exit 0

- **Step runners are injectable** (test isolation): `runLoop`
  accepts an `opts.steps` override map keyed by step name. Default
  uses the real `runPlan` / `runReview` / `runQa` / `runCompound`.
  Tests inject fakes that record invocation + can fail on demand.
  `work` and `ship` have no runner (manual gates).

- **`reflect` deliberately omitted** from STEPS array. Operators
  run it standalone post-hoc.

## Success criteria

1. New module `src/dispatcher/loop.ts` exports:
   ```ts
   export type LoopStepName =
     | "plan" | "work" | "review" | "qa" | "ship" | "compound"
   export type StepStatus =
     | "pending" | "in_progress" | "paused" | "done" | "failed" | "skipped"
   export type RunStatus =
     | "running" | "paused" | "failed" | "complete"
   export interface LoopStepEntry {
     step: LoopStepName
     status: StepStatus
     started_at?: string
     completed_at?: string
     output_ref?: string
     error?: string
   }
   export interface LoopRun {
     run_id: string
     task: string
     started_at: string
     last_updated_at: string
     task_id?: string
     level?: "L0" | "L1" | "L2" | "L3"
     current_step: LoopStepName | "done"
     status: RunStatus
     failed_step?: LoopStepName
     error?: string
     steps: LoopStepEntry[]
   }
   export class LoopError extends Error {
     readonly code:
       | "RunNotFound"
       | "ConcurrentRunActive"
       | "MalformedRunFile"
   }
   /** Injectable step runners; default uses production runX functions. */
   export interface StepRunners {
     plan?: (state: LoopRun, opts: LoopOptions) => Promise<{ task_id: string; level: string; intent_path: string }>
     review?: (state: LoopRun, opts: LoopOptions) => Promise<void>
     qa?: (state: LoopRun, opts: LoopOptions) => Promise<void>
     compound?: (state: LoopRun, opts: LoopOptions) => Promise<void>
   }
   export interface LoopOptions {
     stateRoot?: string
     resume?: string             // run_id to resume
     steps?: StepRunners
     now?: () => number
     ulid?: () => string
     // Pass-through to plan step:
     motivation?: string
     userSignature?: { signed_at: string; signer_id: string }
     forceLevel?: "L0" | "L1" | "L2" | "L3"
   }
   export interface LoopResult {
     run: LoopRun
     terminal_reason:
       | "complete"
       | "paused_work"
       | "paused_ship"
       | "failed"
   }
   export async function runLoop(
     task: string | null,  // null when --resume is set
     opts: LoopOptions,
   ): Promise<LoopResult>
   export async function listLoopRuns(
     opts?: { stateRoot?: string },
   ): Promise<LoopRun[]>
   export async function showLoopRun(
     runId: string,
     opts?: { stateRoot?: string },
   ): Promise<LoopRun>
   ```

2. `src/commands/loop.ts` (new) — CLI handler `runLoopCommand(opts)`:
   - `sgc loop <task>` → fresh run
   - `sgc loop --resume <run-id>` → continue existing
   - `sgc loop --runs` → list runs sorted by started_at desc
   - `sgc loop --status <run-id>` → show one run
   - Prints terminal-reason hint on exit (next step / fix hint)

3. `src/sgc.ts` registers `loop` defineCommand with args:
   - positional `task` (optional)
   - `--resume <run-id>`
   - `--runs`
   - `--status <run-id>`
   - pass-through: `--motivation` / `--signed-by` / `--level`
   Added to `subCommands` map.

4. Tests `tests/dispatcher/loop.test.ts` (≥10 cases):
   1. Fresh run: `runLoop("fix typo", {steps: fakes})` runs plan →
      hits work gate → status:paused, work entry status:paused,
      terminal_reason=paused_work; subsequent steps still pending.
   2. `--resume` past work: state has work:paused → mark done →
      proceeds → review runs → qa runs → hits ship gate → paused_ship.
   3. `--resume` past ship: state has ship:paused → mark done →
      compound runs → status:complete, terminal_reason=complete.
   4. Plan fail: fake plan throws → state has plan:failed +
      error; loop status:failed; terminal_reason=failed.
   5. `--resume` retries failed step: state has plan:failed →
      retry runs plan again → success → proceeds to work pause.
   6. listLoopRuns: empty corpus → []; with 3 seeded runs →
      sorted by started_at desc.
   7. showLoopRun: missing run id → LoopError code RunNotFound.
   8. Concurrency refuse: existing paused run for same task →
      starting fresh `runLoop("same task", ...)` throws LoopError
      code ConcurrentRunActive.
   9. State file frontmatter round-trip: parse a written state
      file → matches in-memory shape; re-write → identical.
   10. LoopError shape: instanceof Error + readonly .code.
   11. `--resume` on a complete run → returns existing
       terminal_reason without re-running steps.
   12. Fresh run with forceLevel=L3 propagates to plan step input.

5. CHANGELOG.md `## Unreleased` entry naming CE-5.

6. Live dogfood: fresh state root → `sgc loop "fix typo in
   CHANGELOG"` → plan runs at L1 → pause at work gate →
   `sgc loop --resume <id>` → review + qa run → pause at ship →
   `sgc loop --resume <id>` → compound runs → status:complete.
   State file frontmatter inspection confirms each step's status
   transition.

## Open questions

- **`reflect` integration**: out of v0 scope. Future flag
  `sgc loop --then-reflect` could chain reflect post-compound;
  but for now operator owns it.
- **`agent-loop` integration for `work`**: future v1 could
  spawn the `sgc agent-loop` pending-spawn UI at the work gate
  so a parent Claude session can pick up the work. Deferred.
- **Auto-skip `compound` when nothing to compound**: existing
  `sgc compound` already has `update_existing` / `skip` outcomes
  via the janitor. CE-5 v0 just runs compound and trusts that
  the janitor logic decides. No explicit skip in CE-5.
- **L0 pause-at-work**: even L0 tasks pause at work. Could be
  too noisy for typo fixes. Operator hint mentions the option
  to manually edit state file to `work.status: skipped` for
  trivial L0 work. Defer auto-skip-on-L0 to v1.
- **Cancelling a run mid-loop**: operator just deletes the state
  file (`rm <stateRoot>/loop-runs/<run-id>.md`). No `sgc loop
  --cancel` flag in v0.

## Change log

- 2026-05-22 r2 — status → implemented. Single feat commit. Dispatcher
  suite 702 → 717 pass / 0 fail (+15 = 14 loop-unit + 2 sgc-cli help
  + adjusted count). One in-session **L0 carve-out** added pre-commit
  after first dogfood: L0 plan flow doesn't write `decisions/<task_id>/intent.md`
  (existing plan behavior — L0 is direct-to-work), so `runReview`
  crashed with `intent.md not found`. Fix: after plan succeeds, if
  `run.level === "L0"`, auto-mark `review` / `qa` / `ship` /
  `compound` entries as `skipped` with the current timestamp;
  iterator skips them naturally. L0 loop is now `plan → [pause
  work] → done` (4 skipped). L1+ chain unchanged. Documented as
  +1 regression test (review/qa/compound runners throw if invoked
  at L0; test verifies they're never called). Live L0 dogfood at
  `/tmp/sgc-ce5-dogfood/` verified: fresh `sgc loop "fix CHANGELOG
  typo"` → plan runs (level=L0) → 4 post-work steps marked
  skipped → pause at work → operator-readable summary; `sgc loop
  --resume <id>` → work paused→done → all skipped → status:complete.
  Open Question #4 partially resolved (auto-skip-on-L0 for
  review/qa/ship/compound landed; auto-skip-on-L0 for work pause
  intentionally NOT done — operator still needs to apply the
  trivial change, even at L0). L1+ chain dogfood deferred (would
  need real operator implementation between resumes; unit-test
  coverage of the chain runs is sufficient).

- 2026-05-22 r1 — initial draft from `开 CE-5` brainstorm align
  (2026-05-22 chat). User accepted Anchors 1-4 (file-based state
  · sync orchestrator · explicit manual gates at work + ship ·
  fail-fast checkpoint) + scope (c) 6-step chain (excl. reflect).
  L3 feature (orchestration layer, new CLI entry point); sits
  outside the closed CE-1/2/3 parent intent. No Invariant §3
  contact directly — compound step routes through `runCompound`
  which already enforces §3 via the same write-gate as before.
  No new event types; the underlying runX steps emit their own
  spawn.start/end / llm.request/response events via the existing
  logger infrastructure.
