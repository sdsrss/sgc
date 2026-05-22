---
status: implemented
revision: 2
task_id: CE-4-ASYNC-PLAN
feature_id: f5
parent_intent: (none — CE-4 is P2.CE-4 from the original 6-item compound list; not under the closed CE-1/2/3 parent intent 94913CB45F9D4C3E906B3C2C8E)
---

# CE-4 — `sgc plan <task> --async`

## Goal

Run `sgc plan` in the background so the operator (or `compound`
caller, or future orchestrator) gets a job handle and exits
immediately, instead of blocking ~10–60 s on the L3 planner cluster
(planner.eng + planner.ceo + planner.adversarial + researcher.history
+ specialist reviewers). The compounding payoff of CE is multiplied
when the operator can do other work while the cluster runs; today's
sync plan is the largest fixed wait on the CE workflow.

After this lands:

```
sgc plan "audit auth refactor" --async       # forks, prints job_id, exits in <100ms
# … operator does other work …
sgc plan --jobs                              # lists active + recent jobs
sgc plan --status <job-id>                   # shows frontmatter + tail log
sgc plan --status <job-id> --log             # full log
```

For external watchers (Claude main session, fswatch / inotify), both
channels fire on completion:

- `events.ndjson` → `plan.async_complete` event (or `plan.async_failed`)
- `<stateRoot>/plan-jobs/<job-id>.done` (or `.failed`) sentinel file

## Non-goals

- Do NOT modify the synchronous plan flow. `sgc plan <task>` without
  `--async` is unchanged. `--async` is a parent-side wrapper that
  forks a detached child running the existing sync code path.
- Do NOT introduce a daemon, IPC socket, or in-process job queue.
  Job state lives entirely in files under `<stateRoot>/plan-jobs/`.
- Do NOT change Invariant §13 Tier-1 paired-event semantics.
  `plan.async_start / .async_complete / .async_failed` are NEW
  command-level events (additive to schema; `event_type` is template
  literal `${string}.${string}` and stays compile-time-typed).
  They follow the same start-and-then-paired-terminal pattern as
  `spawn.start / .end` but are not coerced into §13 — they're a new
  voluntary pairing.
- Do NOT auto-promote completed plans into anything. v0 stops at
  "job done; intent.md written; events.ndjson recorded." Whatever
  ran before sync plan ran after sync plan also runs after async
  plan — there is no orchestration layer.
- Do NOT support concurrent `--async` plans in v0. The first one
  holds the lock (single `progress/current-task.md`, shared
  `progress/agent-prompts/` pool). Refuse a second `--async` with a
  pointer to the running job. Per-job-isolated progress dirs are
  future scope (CE-5 territory).
- Do NOT auto-clean old job files. Operator runs `sgc plan --jobs
  --prune-older-than 7d` (future scope; v0 keeps everything).
- Do NOT add OS-level notify (`notify-send` / `osascript`). Stays
  file-based; consumers do the rendering.
- Do NOT change `--async` behavior based on L-level. Even L0 plans
  can run `--async` (operator-explicit choice; not gated). Hint
  printed if level resolves to L0/L1 ("--async overhead probably
  not worth it for L0/L1; sync usually completes <2s").

## Constraints

- **Single active job per project** (HARD). On `sgc plan <task>
  --async`, scan `<stateRoot>/plan-jobs/*.md`; if any has
  `status:running` AND the recorded `pid` is alive (via
  `process.kill(pid, 0)` — sends signal 0 which is a liveness probe,
  no side effect), refuse with the conflicting job id + tail
  command. Stale jobs (pid dead but status still `running`) are
  marked `status:stale` lazily at the next status-read; that frees
  the lock.
- **Detached child via `node:child_process.spawn({detached: true})`**.
  Bun's `Bun.spawn` lacks first-class `detached` semantics; node's
  child_process detached path is well-supported under Bun runtime
  and is what existing detached-shell-out patterns use elsewhere.
  Parent calls `proc.unref()` to fully release. Stdio: stdin =
  "ignore"; stdout/stderr → log file fd opened from the parent
  (so the child's writes append even after parent exits). The
  child re-execs `<bun> <sgc-entry> plan <task>` with the env var
  `SGC_PLAN_ASYNC_CHILD=<job-id>` set. **Env var (not flag)** is
  the child-mode signal because citty has no API to hide a defined
  arg from `--help`; an env var keeps the operator CLI surface
  clean and is the standard pattern for "internal IPC handle."
- **Job file frontmatter shape** (`<stateRoot>/plan-jobs/<job-id>.md`):
  ```yaml
  ---
  job_id: <ULID>
  task: <verbatim task arg>
  started_at: <ISO 8601>
  pid: <child pid; -1 before fork>
  log_path: <absolute path to <job-id>.log>
  status: running | done | failed | stale
  completed_at: <ISO 8601>     # absent until terminal
  error: <one-line error msg>  # absent except status:failed
  intent_path: <absolute path>  # absent until plan finishes writing it
  level: L0 | L1 | L2 | L3      # absent until classified
  ---
  ```
  Body: empty initially; child may append a copy of the sync plan's
  console output but log file is the canonical record.
- **ULID job_id** (same generator as `compound-promote.ts:generateUlid`
  via `crypto.randomUUID()` 26-char hex slice).
- **Sentinel files** on completion (touched by child before exit):
  - success → `<stateRoot>/plan-jobs/<job-id>.done`
  - failure → `<stateRoot>/plan-jobs/<job-id>.failed`
  Empty files (zero-byte); their existence is the signal. fswatch /
  inotify hook into `<plan-jobs>/` and dispatch on `.done` / `.failed`
  creation events.
- **events.ndjson emissions** (additive event types, no schema break):
  - parent emits `plan.async_start` immediately before spawning
    detached child: `{task_id: job_id, agent: "sgc.plan-async",
    event_type: "plan.async_start", payload: {job_id, task,
    log_path, pid}}`. `task_id` overloaded with `job_id` because the
    sync plan call's eventual task_id isn't known yet (assigned
    inside the child after classification); using the job_id as the
    correlator keeps the pair indexable.
  - child emits `plan.async_complete` (or `.async_failed`) right
    before exit, in the SAME job-id correlator namespace. Payload
    carries `{job_id, task_id?, level?, intent_path?,
    duration_ms, exit_code}`.
- **Stdout/stderr capture**: parent opens `<job-id>.log` via
  `Bun.file().writer()` or `openSync(...)` (O_WRONLY|O_CREAT|O_APPEND
  mode 0o644), passes the FD as child's stdout + stderr in
  `Bun.spawn({stdio: ["ignore", fd, fd]})`. Closes its end of the
  FD after spawn. Child inherits and writes directly.
- **Stale-job lazy detection**: on `sgc plan --jobs` and `sgc plan
  --status <id>`, every job with `status:running` is probed via
  `process.kill(pid, 0)`. If it throws `ESRCH`, job file is mutated
  to `status:stale` (atomic re-write via `serializeFrontmatter` +
  `writeFileSync`), and the stale status is the one rendered.
  This eliminates the "zombie running" footgun without a periodic
  cleanup process.
- **`--async-child` is hidden** (not surfaced in `--help`). Citty
  supports per-arg metadata; flag definition omits or marks it
  internal. Surfaced in source comments + spec.
- **No spawn architecture change**. Child runs existing sync
  `runPlan(...)` with whatever logger/spawn mode the env resolves
  to. The async layer is OUTSIDE the spawn cluster.

## Success criteria

1. New module `src/dispatcher/plan-jobs.ts` exports:
   ```ts
   export interface PlanJob {
     job_id: string
     task: string
     started_at: string
     pid: number
     log_path: string
     status: "running" | "done" | "failed" | "stale"
     completed_at?: string
     error?: string
     intent_path?: string
     level?: "L0" | "L1" | "L2" | "L3"
   }
   export class PlanJobError extends Error {
     readonly code:
       | "ConcurrentJobActive"
       | "JobNotFound"
       | "MalformedJobFile"
   }
   export interface ForkOptions {
     stateRoot?: string
     /** Test hook: inject fake spawn. Production = Bun.spawn detached. */
     spawnImpl?: (argv: string[], opts: { logFd: number }) => { pid: number }
     /** Test hook: clock injection. */
     now?: () => number
     /** Test hook: ULID gen injection. */
     ulid?: () => string
     /** Test hook: liveness probe. Default process.kill(pid, 0). */
     isAlive?: (pid: number) => boolean
   }
   export interface ForkResult {
     job: PlanJob
     jobPath: string
   }
   export async function forkAsyncPlanJob(
     task: string,
     opts?: ForkOptions,
   ): Promise<ForkResult>
   export async function completePlanJob(
     jobId: string,
     completion: { taskId?: string; level?: string; intentPath?: string },
     opts?: { stateRoot?: string; now?: () => number; logger?: Logger },
   ): Promise<void>
   export async function failPlanJob(
     jobId: string,
     error: string,
     opts?: { stateRoot?: string; now?: () => number; logger?: Logger },
   ): Promise<void>
   export async function listJobs(
     opts?: { stateRoot?: string; isAlive?: (pid: number) => boolean },
   ): Promise<PlanJob[]>
   export async function showJob(
     jobId: string,
     opts?: {
       stateRoot?: string
       isAlive?: (pid: number) => boolean
       logTailLines?: number   // default 100
     },
   ): Promise<{ job: PlanJob; logTail: string }>
   ```

2. `src/commands/plan.ts` gains two branches:
   - PARENT (`opts.async === true && opts.asyncChild === undefined`):
     calls `forkAsyncPlanJob`, prints job summary to stderr, exits 0.
     Existing sync branch untouched.
   - CHILD (`opts.asyncChild === <job-id>`): runs the existing sync
     `runPlan` body, then calls `completePlanJob` (on success) or
     `failPlanJob` (on caught throw) with classification metadata.

3. `src/sgc.ts` `plan` `defineCommand` gains three flags:
   - `--async` (boolean, optional) — start in background
   - `--jobs` (boolean, optional) — list jobs (no task arg needed)
   - `--status <job-id>` (string, optional) — show one job
   - `--log` (boolean, optional; only with --status) — print full log
   - `--async-child <job-id>` (string, optional; **NOT in --help**)
   The handler dispatches: `--jobs` → listJobs + format; `--status`
   → showJob + format; `--async` → forkAsyncPlanJob; otherwise sync.
   Positional `task` is optional when `--jobs` / `--status` is set.

4. Tests: `tests/dispatcher/plan-jobs.test.ts` (≥10 cases):
   1. `forkAsyncPlanJob` happy path: writes job file with frontmatter
      shape; sentinel files absent; spawn called with `--async-child
      <job-id>` argv.
   2. `forkAsyncPlanJob` refuses if existing job has `status:running`
      AND pid is alive (`isAlive` returns true) → throws
      `PlanJobError` code `ConcurrentJobActive`.
   3. `forkAsyncPlanJob` proceeds if existing job has
      `status:running` BUT pid is dead (`isAlive` returns false) —
      stale job is marked, new job starts.
   4. `completePlanJob`: updates frontmatter (status:done +
      completed_at + intent_path + level); touches `.done` sentinel;
      `.failed` absent.
   5. `failPlanJob`: updates frontmatter (status:failed +
      completed_at + error); touches `.failed` sentinel; `.done`
      absent.
   6. `listJobs`: returns frontmatter for every `<stateRoot>/plan-jobs/*.md`,
      sorted by `started_at` descending; stale probe applied.
   7. `listJobs` empty corpus: returns `[]` (no plan-jobs dir).
   8. `showJob`: returns frontmatter + tail of log file (default
      100 lines); when log < 100 lines, returns whole log.
   9. `showJob` missing job → throws `PlanJobError` code
      `JobNotFound`.
   10. Stale lazy-detect: `showJob` on running-but-dead job mutates
       file to `status:stale` + returns stale shape.
   11. `completePlanJob` emits `plan.async_complete` event via the
       provided logger (capture in test sink).
   12. `failPlanJob` emits `plan.async_failed` event.

   `tests/dispatcher/sgc-cli.test.ts` (extend):
   - `plan --help` lists `--async`, `--jobs`, `--status`, `--log`
     (NOT `--async-child`).

   Total test delta: ≥12 (target: 690 → ≥702 dispatcher pass).

5. CHANGELOG.md `## Unreleased` entry naming CE-4 + the new
   `plan.async_*` event types + the new namespace.

6. Live dogfood: `sgc plan "fix typo in CHANGELOG" --async` →
   stderr prints `job_id`, log_path, watch hint; job file appears;
   child completes asynchronously; `sgc plan --status <id>` shows
   `done`; `sgc plan --jobs` lists it; `.sgc/progress/events.ndjson`
   carries paired `plan.async_start` + `plan.async_complete`.

## Open questions

- **`--async-wait` blocking variant**: out of v0 scope (declined
  option (c) in 2026-05-22 align). If a future caller (e.g. CI
  scripts wanting fire-and-forget-but-block-this-shell semantics)
  needs it, add `--async --wait` then. v0 forces operator to poll.
- **Per-job isolated `progress/agent-prompts/` pool**: the single
  active job constraint is conservative. Future CE-5 orchestration
  might want concurrent plans for unrelated tasks. Lock for v0:
  single job; revisit when concurrent need actually shows up.
- **`progress/current-task.md` semantics under async**: the child
  writes current-task.md as the sync flow does. That mutates a
  file the operator's foreground session might be inspecting via
  `sgc status`. Document this behavior; do not try to isolate in
  v0 (per-job progress dir is CE-5 territory).
- **Stale-detection on Windows**: `process.kill(pid, 0)` semantics
  differ on Windows. v0 is Linux/macOS-targeted (sgc's CI is
  ubuntu-latest); Windows defer to whoever asks.
- **Auto-prune of completed jobs**: `<stateRoot>/plan-jobs/` will
  accumulate over time. Deferred; operator can `rm <id>.md <id>.log
  <id>.done` manually. Future flag `--prune-older-than <Nd>`.

## Change log

- 2026-05-22 r2 — status → implemented. Single feat commit. Dispatcher
  suite 690 → 702 pass / 0 fail (+12 = 11 plan-jobs-unit + 1 plan-CLI-help).
  Live dogfood at `/tmp/sgc-ce4-dogfood/` verified all 4 paths
  (happy / failed / list / concurrent-refuse) end-to-end with paired
  `plan.async_start` + `plan.async_complete | plan.async_failed`
  events in events.ndjson + sentinel `<job-id>.done | .failed`
  files. One in-session bug surfaced + fixed before commit: parent's
  flag-derived PlanOptions (motivation/forceLevel/userSignature/
  autoConfirm/forceNewTask) didn't reach the child because the child's
  re-exec argv is `[bun, sgc.ts, "plan", task]` only (no flag
  re-serialization). Root cause: env-var-as-IPC was chosen for child
  signal but I forgot to also forward the flag-derived options. Fix:
  freeze options into `SGC_PLAN_CHILD_OPTS` JSON env at parent fork
  time; child branch of `runPlan` reads + merges before calling
  `runPlanCore`. Surfaced via first dogfood run rejecting motivation
  as "5 words" (child saw default = taskDescription = 5 words),
  even though parent flag carried 25-word string.

- 2026-05-22 r1 — initial draft from `开 CE-4` brainstorm align
  (2026-05-22 chat). User accepted Anchors 1-4 (file handle no
  daemon · single active job · status surface via `--jobs` /
  `--status` flags · stdout to per-job log file). Notify-mechanism
  hard decision resolved option (a): events.ndjson event +
  sentinel file. CE-4 sits OUTSIDE the closed CE-1/2/3 parent
  intent 94913CB45F9D4C3E906B3C2C8E; this is feature f5 of the
  original 6-item P2 compound list (P2.CE-4 = async plan). No
  Invariant §3 contact; L2 additive (new flags, new module, new
  namespace, additive event types). Spawn architecture unchanged
  — async layer wraps the sync `runPlan` flow at the parent/child
  process boundary.
