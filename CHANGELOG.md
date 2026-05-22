# Changelog

## v1.9.0 — 2026-05-22 — CE-5 sgc loop orchestrator (P2.CE-5 from the original compound list)

### Added (CE-5: `sgc loop <task>` end-to-end orchestrator)

- **CE-5** (f6, sibling to CE-4 outside parent intent `94913CB45F9D4C3E906B3C2C8E`). New CLI `sgc loop <task>` chains the per-task SGC workflow: `plan → [pause work] → review → qa → [pause ship] → compound`. State at `<stateRoot>/loop-runs/<run-id>.md` with frontmatter tracking per-step status (`pending` / `in_progress` / `paused` / `done` / `failed` / `skipped`). Manual gates at `work` (operator implements code) and `ship` (Invariant §4 human signature at L3) pause + exit; `sgc loop --resume <run-id>` marks paused→done before continuing. Fail-fast on any step throw: state captures `failed_step` + `error`; `--resume` retries the failed step. Closes P2.CE-5 from the original 6-item compound list. **`reflect` deliberately NOT in chain** — it's post-hoc audit across the whole project, not a per-task step.
- **L0 carve-out**: L0 plans don't write `intent.md` (existing plan behavior), so review/qa/compound have nothing to operate on. After plan succeeds, if `level === "L0"`, the orchestrator auto-marks review/qa/ship/compound as `skipped` — L0 loop becomes `plan → [pause work] → complete` (4 skipped). Surfaced via first dogfood; +1 regression test guards.
- **Sync orchestration in single process**: each auto-able step is an inline call to the existing `runPlan` / `runReview` / `runQa` / `runCompound`. No subprocess fork. CE-4 (`sgc plan --async`) is the async story; CE-5 is the linear-orchestration story. Step runners are injectable via `opts.steps` for test isolation; production wiring lazy-imports the command modules.
- **Concurrency guard**: starting `sgc loop <task>` refuses if any prior run for the same task is `running` / `paused` / `failed` — operator must `--resume <run-id>` or delete the run file. Distinct from CE-4's pid-liveness probe (loop state is fully file-based; no process aliveness).
- **Status surfaces**: `sgc loop --runs` lists all runs sorted by `started_at` desc; `sgc loop --status <run-id>` shows full frontmatter + per-step status table. Operator-readable hints printed on every terminal-state exit (`paused_work` / `paused_ship` / `failed` / `complete`).
- **Pass-through flags to plan**: `--motivation` / `--level` / `--signed-by` on `sgc loop` propagate into the inner plan step via `LoopOptions`.
- `src/dispatcher/loop.ts` (new, ~330 LOC): `STEPS` const + `runLoop` / `listLoopRuns` / `showLoopRun` + `LoopError` + types + `getDefaultRunners` lazy-import wrapper.
- `src/commands/loop.ts` (new, ~95 LOC): CLI handler `runLoopCommand(opts)` that renders run summary + terminal-reason hint.
- `src/sgc.ts`: registers `loop` defineCommand + adds to `subCommands` map.

### Tests

- 14 new tests in `tests/dispatcher/loop.test.ts`: fresh-start work pause / plan throw → failed / forceLevel propagation / resume past work → ship pause / resume past ship → complete / resume on complete = no re-run / failed retry on resume / listLoopRuns empty / sorted listing / showLoopRun RunNotFound / concurrency refuse / state frontmatter round-trip / LoopError shape / **L0 carve-out** (regression test asserts review/qa/compound runners are NEVER invoked at L0).
- 2 new tests in `tests/dispatcher/sgc-cli.test.ts`: `loop --help` lists `--resume` / `--runs` / `--status`; `sgc --help` lists `loop` subcommand.
- Dispatcher CI gate: 702 → 717 pass / 0 fail (+15, 1829 expect calls, 122.06s wall).
- Live dogfood (`/tmp/sgc-ce5-dogfood/` fresh state root): fresh `sgc loop "fix CHANGELOG typo"` → L0 plan completes → 4 post-work steps auto-marked skipped → pause at work; `sgc loop --resume <id>` → work paused→done → status:complete. Pre-fix dogfood had review crashing with `intent.md not found for <task_id>` — surfaced the L0 carve-out need.

### Notes

- **Why pause at ship even at L0/L1/L2**: ship is a deliberate operator gate regardless of level. Operator decides timing (CI green / coordinate teammates / etc). v0 keeps it consistent.
- **Loop and CE-4 async-plan**: orthogonal — `sgc plan --async` runs ONE plan in the background; `sgc loop` runs an EXPLICIT chain in the foreground. A future "loop --async" pass could compose, but v0 keeps them separate.
- **`agent-loop` (existing) vs `sgc loop` (new)**: completely different concepts. `agent-loop` is the file-poll handshake helper for external actors to fulfill pending spawns. `loop` is the task-workflow orchestrator. The name collision is unfortunate but agent-loop predates this work.

## v1.8.0 — 2026-05-22 — CE-4 async plan (P2.CE-4 from the original compound list)

### Added (CE-4: `sgc plan <task> --async` + job lifecycle)

- **CE-4** (f5, sits OUTSIDE the closed CE-1/2/3 parent intent). New `--async` flag on `sgc plan` forks a detached child running the existing synchronous planner cluster + writes a job handle at `<stateRoot>/plan-jobs/<job-id>.md`. Parent prints `job_id`, `pid`, `log_path`, `watch` command + `events` tail hint to stderr and exits in <100ms — operator can do other work while the planner cluster runs. Closes P2.CE-4 from the original 6-item compound list ("返回 handle 立即退出；后台跑 cluster；完成时写入 events.ndjson + 通知").
- **Single active job per project** (HARD): scanning `<stateRoot>/plan-jobs/*.md` at fork time refuses a second `--async` when any prior job has `status:running` AND the recorded `pid` is alive (`process.kill(pid, 0)` liveness probe). Stale jobs (running-status but dead pid) are marked `status:stale` lazily on read — both `listJobs` and `showJob` apply the probe and persist the transition to disk. Per-job-isolated `progress/` dirs deferred to a future "CE-5 orchestration" pass.
- **Notify channels**: dual signal on terminal status — events.ndjson event (`plan.async_start` / `plan.async_complete` / `plan.async_failed`; additive to schema, template literal `${string}.${string}` still typed) AND sentinel file (`<job-id>.done` or `<job-id>.failed`, zero-byte). External watchers pick whichever fits: Claude main session uses `sgc tail --event-type plan.async_start,plan.async_complete,plan.async_failed --follow`; fswatch / inotify hooks the sentinel file.
- **Status surface**: `sgc plan --jobs` lists all jobs sorted by `started_at` desc with status + pid + task summary; `sgc plan --status <job-id>` renders frontmatter + tail 100 log lines; `--status <id> --log` prints the entire log. Positional `task` arg is now optional (was required) — required only for the run path; `--jobs` and `--status` short-circuit before the task check.
- **Child-mode signal via env var** (`SGC_PLAN_ASYNC_CHILD=<job-id>`) NOT CLI flag — citty has no API to hide a defined arg from `--help`, and operator CLI surface stays clean. Parent's flag-derived `PlanOptions` (motivation / forceLevel / userSignature / autoConfirm / forceNewTask) are frozen into `SGC_PLAN_CHILD_OPTS` JSON env so they survive the parent→child re-exec (child argv carries only `[bun, sgc.ts, "plan", task]`).
- **Detached subprocess via `node:child_process.spawn({detached:true})`** — Bun's `Bun.spawn` lacks first-class detached semantics in current builds; node's child_process detached path is well-supported under Bun runtime. Parent calls `proc.unref()` so the parent process can exit while the child keeps running. Stdio: stdin=ignore; stdout+stderr = inherited fd opened by parent with `openSync(<log_path>, "a")` so the child writes append-mode to `<job-id>.log`.
- **Async layer wraps the sync flow at the parent/child boundary** — spawn() architecture inside the planner cluster is unchanged. The existing `runPlan` body was extracted to `runPlanCore` (private) and `runPlan` became a 3-branch wrapper: parent-async (fork+exit) / child-async (try/catch with completePlanJob/failPlanJob) / sync (call runPlanCore). Pre-CE-4 sync invocation is identical.
- `src/dispatcher/plan-jobs.ts` (new, ~280 LOC): `forkAsyncPlanJob` / `completePlanJob` / `failPlanJob` / `listJobs` / `showJob` / `emitAsyncStart` / `PlanJobError`. All take optional test hooks (`spawnImpl` / `now` / `ulid` / `isAlive`) so units don't touch real processes or clocks.
- `src/commands/plan.ts`: imports the new plan-jobs API + adds the 3-branch wrapper. `PlanOptions.async?: boolean` added.
- `src/sgc.ts`: plan defineCommand gains `--async` / `--jobs` / `--status <id>` / `--log` flags; positional task becomes optional. Run handler dispatches based on which flag is set.

### Tests

- 11 new tests in `tests/dispatcher/plan-jobs.test.ts`: happy fork (argv + env shape) / concurrent guard (alive pid refuse) / stale-lock clear (dead pid proceeds + persists status:stale) / completePlanJob (frontmatter + sentinel + event) / failPlanJob (frontmatter + sentinel + event) / listJobs empty / listJobs sort + stale probe / showJob tail / showJob JobNotFound / showJob lazy-stale persistence / PlanJobError shape.
- 1 new test in `tests/dispatcher/sgc-cli.test.ts`: `plan --help` lists `--async` + `--jobs` + `--status` + `--log`.
- Dispatcher CI gate: 690 → 702 pass / 0 fail (+12, 1754 expect calls, 121.99s wall).
- Live dogfood (`/tmp/sgc-ce4-dogfood/` fresh state root, SGC_FORCE_INLINE=1): 4 paths exercised — happy fork (L1 plan completed; sentinel + events.ndjson `plan.async_start` / `plan.async_complete` pair; status renders); failed fork (motivation too short → `status:failed` + `.failed` sentinel + `plan.async_failed` event); `--jobs` listing sorts newest-first; concurrent refuse (synthetic running job with alive shell pid → `ConcurrentJobActive` error message).

### Notes

- **`--async` overhead vs. payoff**: cluster runtime for L3 is typically 10–60s (planner cluster + researcher.history + specialist reviewers). For L0/L1 tasks the cluster is essentially a single classifier+planner.eng spawn (~100–500ms inline). `--async` is operator-explicit; the fork overhead isn't worth it for L0/L1, but the flag isn't gated by level (operator's call).
- **`progress/current-task.md` under async**: the child mutates `current-task.md` as the sync flow does. A foreground `sgc status` invocation in the same project will reflect the child's task. Documented; not isolated in v0.

## v1.7.0 — 2026-05-22 — CE-3 promote helper (CE-3 vision end-to-end closed)

### Added (CE-3 promote: `sgc compound --from-ship-failure <slug>`)

- **CE-3 second half**: `sgc compound --from-ship-failure <slug>` promotes a captured `<stateRoot>/ship-failures/<slug>.md` record into a finished `<stateRoot>/solutions/<category>/<solution-slug>.md` entry. Closes the deferred Open Question #4 in `tasks/specs/ce-3-ship-failure-capture.md`. After this lands, the operator flow is: `git push --tags` → `sgc watch-ci-failure` (captures red ship) → `$EDITOR .sgc/ship-failures/<slug>.md` (operator edits `prevention_seed:`) → `sgc compound --from-ship-failure <slug>` (promotes to corpus).
- **Heuristic-only promote path**: routes through the same Invariant §3 write-gate as `runCompound` (real `compound.related` spawn, real `DedupStamp`, real `writeSolution`); no LLM call. `compoundContextHeuristic` derives category/tags/problem_summary from `<summary>\n\n<workflow_name>` (the spec-locked input shape); operator-edited `prevention_seed:` is authoritative for the `prevention:` field.
- **Four refuse guards** (operator footguns surface as clean errors, not corpus writes): `MissingShipFailure` (file not at `<stateRoot>/ship-failures/<slug>.md`); `PlaceholderPreventionSeed` (seed still starts with `TODO: operator-fill` or is empty); `AlreadyPromoted` (file already carries `promoted_to:` — idempotent re-run); `DuplicateMatch` (compound.related found similarity ≥ DEDUP_THRESHOLD; refuses without `--force`). `--force` bypasses only `DuplicateMatch`, NOT `AlreadyPromoted` (orthogonal guards).
- **Audit trail / idempotency anchor**: on success the ship-failure file's frontmatter gains `promoted_to: <category>/<solution-slug>`. Subsequent `--from-ship-failure <same-slug>` refuses via the `AlreadyPromoted` guard (operator must remove the field manually to re-promote).
- **Compound-engineering close**: once promoted, the new `solutions/<cat>/<slug>.md` carries a non-empty `prevention:` field that `extractPreventions` (CE-1, `src/dispatcher/preventions.ts`) discovers on the next L3 `sgc plan` call for the matching category — feeding the failure-derived prevention into a future `planner.adversarial` pre-mortem. End-to-end: ship failure → operator edit → corpus → planner anti-pattern injection.
- `src/dispatcher/compound-promote.ts` (new, ~225 LOC): `promoteShipFailure(opts)` + `PromoteError` + types.
- `src/commands/compound.ts`: new exported `runCompoundPromote(opts)` wrapping `promoteShipFailure`. `runCompound` unchanged.
- `src/sgc.ts`: `compound` defineCommand gains `--from-ship-failure <slug>` and `--solution-slug <s>` flags; routes to `runCompoundPromote` when `--from-ship-failure` is set, otherwise unchanged.

### Tests

- 8 new tests in `tests/dispatcher/compound-promote.test.ts`: missing file / placeholder seed / already-promoted / dedup-match-refuse (asserts no solutions write + no ship-failure mutation) / happy-path (asserts solution lands + `promoted_to:` stamped + `prevention:` carries operator seed verbatim) / `--force` bypass / `--force` does NOT bypass `AlreadyPromoted` / `PromoteError` shape (instanceof + `.code`).
- 1 new test in `tests/dispatcher/sgc-cli.test.ts`: `compound --help` lists `--from-ship-failure` + `--solution-slug` + `--force`.
- Dispatcher suite (CI gate, `tests/dispatcher`): 681 → 690 pass / 0 fail (+9, 1698 expect calls, 121.94s wall).
- Live dogfood (`/tmp/sgc-promote-dogfood/` fixture, SGC_FORCE_INLINE=1): all 4 paths exercised end-to-end — happy promote writes `solutions/other/ship-failure-dead123.md` with operator's seed in `prevention:` field; ship-failure file gains `promoted_to: other/ship-failure-dead123`; re-promote refuses with `AlreadyPromoted`; placeholder seed refuses with `PlaceholderPreventionSeed`; missing slug refuses with `MissingShipFailure`.

### Notes

- **Why a flag, not a new subcommand**: `compound` is the existing entry point for "extract knowledge into solutions/"; ship-failure promotion is a sibling input source, not a sibling concept. Flag form keeps the operator vocabulary tight.
- **Invariant §3 fidelity**: the promote path's `dedup_stamp.compound_related_spawn_id` references a real spawn directory just like `runCompound` does. Downstream `compound_related_spawn_id` audit consumers see one shape.
- **No LLM rewrite of operator input**: `prevention_seed:` is copied verbatim into `prevention:` (Invariant §1 doesn't apply — operator-typed text is not LLM output). This is the corpus author's intent, untouched.

## v1.6.1 — 2026-05-22 — CE-3 watch-ci-failure dogfood-found bugfix (DOG-1 + DOG-2)

### Fixed

- **DOG-1**: default `workflowName` was `"publish.yml"` but `gh run list --workflow X` accepts the workflow DISPLAY NAME (`publish-npm`) or filename basename without extension (`publish`), NOT the path-style `.yml` form. The discovery query returned `[]` silently (no gh CLI error) on every poll → watch waited indefinitely → 10-min timeout. Default changed to `"publish-npm"`.
- **DOG-2**: discovery passed `--branch main` to gh, but publish.yml is tag-triggered (`on: push: tags: [v*]`), so the run's `headBranch` field is the TAG name (e.g. `v1.6.0`), not the branch. The `--branch main` filter silently excluded all matching runs. Fix: drop `--branch` from gh argv; add `WatchOptions.expectedSha` (CLI passes derived `git rev-parse HEAD`); client-side filter by `r.headSha.startsWith(expectedSha)` selects the matching row out of stale tag-named runs.
- Discovery `--limit` bumped 5 → 10 for headroom when multiple recent runs sit between the just-pushed run and the next-most-recent.

### Tests

- 3 new RED-first regression tests in `tests/dispatcher/ship-failure.test.ts`: (a) default flag value is `publish-npm`; (b) `--branch` NOT passed to gh; (c) `expectedSha` client-side filter selects the right row out of stale tag-named runs. All 3 failed pre-fix; 12/12 pass post-fix.
- Live evidence: post-fix `sgc watch-ci-failure` (no flags) against v1.6.0's just-fired publish.yml run prints `CI green for e663e3e; no capture.` exit 0. Pre-fix same command printed `[PARTIAL: watch timed out after defaults; CI still in progress; no capture written]`.

### Notes

- Patch (not minor) per §2 LLM-visible-metadata exclusion: bugfix-restoring-intended-behavior (CE-3 release advertised the watch as working at v1.6.0; it did not). No new behavior, no new flag, no contract change. `--branch` arg accepted but now no-op against gh (still exposed on CLI for future non-tag workflow use; reusable via `WatchOptions.branch`).
- v1.6.0 npm users keep the broken watch until they upgrade to ≥1.6.1. The CE-3 README / docs (none yet) should reference v1.6.1+ as the working baseline once written.

## v1.6.0 — 2026-05-22 — CE-3 watch-ci-failure (CE loop closed)

### Added (CE-3: `sgc watch-ci-failure` ship-failure capture)

- **CE-3** (f4 under task `94913CB45F9D4C3E906B3C2C8E`, parent intent `.sgc/decisions/.../intent.md`). New standalone CLI `sgc watch-ci-failure` polls the publish CI workflow for the current branch's HEAD commit (or for an explicit `--run-id`) until conclusion. On `failure`, writes a templated record at `<stateRoot>/ship-failures/<YYYY-MM-DD>-<short-sha>.md` with frontmatter (`kind: ship-failure` / `commit_sha` / `tag` / `workflow_run_id` / `workflow_run_url` / `workflow_name` / `conclusion: failure` / `prevention_seed: TODO ...`) + 3 body sections (Failure context / `$GITHUB_STEP_SUMMARY` excerpt / Next steps for operator). On `success`, silent no-op (`CI green for <sha>; no capture.`); on `timeout`, `[PARTIAL]` stderr message. **Closes the third arc of the CE compound-engineering loop**: CE-1 sediment-and-recall (v1.4.0/v1.4.1), CE-2 reflect-audit (v1.5.0), CE-3 capture-on-fail (this entry).
- **Heuristic-only**: no LLM call, no agent spawn, no `events.ndjson` Tier-1/Tier-2 pair owed. Failure metadata (commit SHA, run URL, failing-step log excerpt) is structured-enough; LLM synthesis is deferred to the future "promote ship-failure → solutions via `sgc compound`" flow.
- **New namespace** `<stateRoot>/ship-failures/` sidesteps Invariant §3 (no `dedup_stamp` from `compound.related` owed) by being outside `solutions/` — mirrors CE-2's `<stateRoot>/reflections/` precedent for Invariant §6. Dedup-by-SHA: same-SHA same-day re-runs return `{action:"deduped"}` without overwrite.
- **CLI flags**: `--workflow <name>` (default `publish.yml`), `--branch <name>` (default current git branch), `--run-id <id>` (skip discovery, attach directly), `--interval <s>` (default 15, clamped [5, 60]), `--timeout <s>` (default 600, clamped [60, 1800]).
- `src/dispatcher/ship-failure.ts` (new, ~250 LOC): `watchPublishWorkflow` + `captureShipFailure` + interfaces. `gh` shell-out via `Bun.spawn` mirrors `gh-runner.ts`; test injection via `opts.runCommand` + `opts.now` + `opts.sleep`. Two-phase poll (discovery + status); failing-step log fetched via `gh run view <id> --log-failed`. SUMMARY_MAX_CHARS=2000 cap with `...` sentinel; empty summary substitutes `(empty — workflow did not write $GITHUB_STEP_SUMMARY)`.
- `src/commands/watch-ci-failure.ts` (new, ~60 LOC): CLI run handler — resolves branch / HEAD-sha / latest tag via `git` shell-out, calls dispatcher, prints stderr UX per spec.
- `src/sgc.ts`: registers `watch-ci-failure` defineCommand + adds to `subCommands` map. **`sgc ship` is NOT modified** (release-ship is operator-driven `git push --tags`; coupling watch to `sgc ship` was the design pivot from spec r1 → r2 inside this session).

### Tests

- 9 new tests in `tests/dispatcher/ship-failure.test.ts`: `watchPublishWorkflow` success / failure-with-summary / timeout / `--run-id` discovery-skip; `captureShipFailure` first-write / dedup / empty-summary fallback / truncation-with-sentinel / null-tag.
- 2 new tests in `tests/dispatcher/sgc-cli.test.ts`: `--help` lists `watch-ci-failure`; `watch-ci-failure --help` shows all 5 flags. Pre-existing CE-2 `--help lists` test extended to include the new subcommand.
- Dispatcher suite (CI gate, `tests/dispatcher`): 668 → 678 pass / 0 fail (+10, 1666 expect calls, 121.84s wall).

### Notes

- Live dogfood verified: `sgc watch-ci-failure --run-id 26273501194` (v1.5.0's real publish.yml run) prints `CI green for 9c8bc57; no capture.` and exits 0. The `gh run view --json` discovery + status poll + git rev-parse derivation all work end-to-end against the live GitHub API.
- Invariants untouched: §1 (no reviewer/qa interaction), §3 (writes to `ship-failures/`, not `solutions/`; no `dedup_stamp` collision), §6 (no `reviews/` write), §13 (no spawn, no LLM call, no cmd-level event emitted in v0).
- `prevention_seed:` field name (vs CE-1's `prevention:`) intentionally marks the capture as raw material awaiting promotion — operator's mental model. A future `sgc compound --from-ship-failure <slug>` helper would close the promotion loop end-to-end; out of CE-3 v0 scope (filed as spec Open Question).
- Deferred (not v0 blockers, all filed in spec): full CI log download (vs the `--log-failed` excerpt); auto-invocation from a hypothetical `sgc release` orchestrator; cross-platform path conventions for the `git describe` tag fallback when no tags exist yet.

## v1.5.0 — 2026-05-22 — CE-2 reflect audit

### Added (CE-2: `sgc reflect` decisions↔solutions audit)

- **CE-2** (f3 under task `94913CB45F9D4C3E906B3C2C8E`, parent intent `.sgc/decisions/.../intent.md`). New read-only CLI `sgc reflect` that scans `<stateRoot>/decisions/*/intent.md` against keyword-overlapping `<stateRoot>/solutions/*/*.md` preventions, classifying each match as `discussed` (mentioned in the decision's `## Pre-mortem` section) or `silent` (matched but not mentioned). Closes the "audit-the-audit-loop" half of the CE compound-engineering closure: CE-1 sediment-and-recall surfaces preventions to future pre-mortems; CE-2 retrospectively reveals which past decisions accumulated preventions BEFORE the loop closed (correctly silent) and which ignored them after (operator's call to investigate).
- **Heuristic-only**: no LLM call, no agent spawn, no `events.ndjson` Tier-1 / Tier-2 pair owed. Two-strike `discussed` detection — (a) substring match of `solution_ref` in the pre-mortem segment (strong post-CE-1 signal since `prompts/planner-adversarial.md` step 5 emits the ref in `early_signal`), OR (b) ≥3-token overlap between `prevention_text` first sentence and any `Early signal:` line (handles pre-CE-1 legacy intent.md where the ref is absent).
- **CLI flags**: `--task <id>` (audit one decision), `--since <YYYY-MM-DD>` (filter by `frontmatter.created_at`), `--save` (write to `<stateRoot>/reflections/<task_id>.md`, replace-on-rerun), `--json` (machine-readable `ReflectReport[]`).
- `src/dispatcher/reflect.ts` (new, ~280 LOC): `auditDecision` + `auditAllDecisions` + `formatReport` + `writeReflectionFile`. Reuses CE-1's exports (`extractKeywords` + `walkSolutionsCorpus` from `researcher-history.ts`; `parseFrontmatter` + `resolveStateRoot` from `state.ts`; `tokenize` from `dedup.ts`) — no duplicated tokenization, no new corpus walker. Defensive: malformed intent.md / solution.md frontmatter is silently skipped (no throw, no event).
- `src/commands/reflect.ts` (new, ~50 LOC): CLI run handler glue.
- `src/sgc.ts`: registers `reflect` defineCommand + adds to `subCommands` map. No changes to other commands.
- `<stateRoot>/reflections/` is created lazily on first `--save` call (the `ensureSgcStructure` `LAYERS` list is unchanged; reflections live outside the Invariant §6 append-only `reviews/` namespace by design).
- Sort order in stdout output: silent candidates first (operator's attention surface), then by `keyword_overlap` descending within each group.

### Tests

- 16 new tests in `tests/dispatcher/reflect.test.ts`: empty corpus / no-keyword-overlap / strike-(a) `solution_ref` direct match / strike-(b) signal-token overlap / matched-but-silent / malformed-solution-frontmatter survival / missing intent.md / decision without frontmatter / no-decisions/-dir / `--since` include / `--since` exclude / invalid `--since` throws / sort-most-recent-first / `formatReport` empty / `formatReport` mixed / `writeReflectionFile` create+replace.
- 2 new tests in `tests/dispatcher/sgc-cli.test.ts`: `sgc reflect --task` stdout shape on seeded fixture; `--json` parses as `ReflectReport[]`. The existing `--help lists ... subcommands` smoke test updated to include `reflect`.
- Dispatcher suite (CI gate, `tests/dispatcher`): 650 → 668 pass / 0 fail (+18, 1624 expect calls).

### Notes

- Manifest, prompts, contracts, and Invariant §1 / §3 / §6 / §13 enforcement paths are unchanged. `prompts/planner-adversarial.md` is not touched by CE-2; CE-1's `prior_preventions` injection is also untouched.
- Discussed-detection's strike (b) ≥3-token threshold is conservative — pre-CE-1 legacy intent.md files whose pre-mortem references a prevention via paraphrase (rather than verbatim signal-line tokens) will land `silent`. The seed dogfood case (`other/sgc-plan-motivation-word-vendor-2026-05-21` vs parent CE intent `94913CB45F9D4C3E906B3C2C8E`) correctly lands `silent` because the seed was authored *after* the parent intent was written. Spec Open Question #1 tracks an optional `pre_ce1_legacy: true` confidence flag if false-positive `silent` becomes a complaint.
- Deferred to follow-up (not v0 blockers): cross-decision rollup view (`sgc reflect --rollup` for "recurring silence" patterns), `--overlap-floor N` to suppress low-overlap noise, integration into `sgc ship` pre-flight (CE-3 territory). All three are filed in spec `tasks/specs/ce-2-reflect-audit.md` Open Questions or implicit in CE-3 scope.
- CE-3 (ship-failure compound auto-trigger, f4 under same parent intent) remains pending — CE-2 deliberately keeps `reflect` manual-only so the auto-trigger surface lands in one place under CE-3.

## v1.4.1 — 2026-05-22 — CE-1.1 hardening (RT-4 prompt + RT-5 caps + L1 DRY/logger/size-cap)

### Fixed (CE-1.1)

- **RT-4** (`prompts/planner-adversarial.md` step 5 rewrite): the v1.4.0 wording told the LLM to "treat each entry [of `prior_preventions`] as a likely failure shape" and fixed `probability: high` for every emission, biasing the planner toward 1:1 mapping prior_preventions → failure_modes regardless of whether the prevention's structural cause actually re-arose. Post-fix introduces a **recurrence gate** (does intent_draft touch the same module/boundary/shape? does it preserve the structural cause?), allows `probability: medium` for partial-match recurrence, and adds an explicit "Do NOT emit when the structural cause does not apply" branch with a "fabricating a recurrence is anti-pattern #2 even when keyword overlap is high" anchor. CHANGELOG entry is `fix:` (restoring intended behavior) not `change:` — the L3 over-inclusion bias was a v1.4.0 ship gap, not a deliberate design.
- **RT-5** (`extractPreventions` cap clamps): `opts.topN` clamped to `[1, 10]`, `opts.maxCharsPerText` clamped to `[40, 1000]`. Pre-fix a caller passing `topN: 9999` returned the full keyword-matched corpus, bloating the `planner.adversarial` spawn input past prompt budgets; the public option was a defense-bypass surface.

### Hardening (CE-1.1 L1 batch — `extractPreventions` + `walkSolutionsCorpus` surface)

- **DRY state-root resolution**: `resolveStateRoot(custom?: string)` lifted to `src/dispatcher/state.ts` exports. The 3-step fallback (`explicit arg → SGC_STATE_ROOT env → ".sgc"`) was inlined at 3 sites (`preventions.ts:60`, `researcher-history.ts:165` + `:226`); now centralized + always returns an absolute path via `node:path.resolve`.
- **DRY tokenization**: `extractKeywords(text)` lifted from file-private (`researcher-history.ts:190`) to exported. `preventions.ts` imports it instead of re-inlining `Array.from(tokenize(...))` — single source of truth across `dedup.ts` / `researcher-history.ts` / `preventions.ts`.
- **File-size cap** in `walkSolutionsCorpus` (`MAX_SOLUTION_FILE_BYTES = 256 KB`): `stat()` precedes `readFile()`; oversize files are skipped before allocating multi-MB NFC-normalized strings. Defensive against accidental log dumps / screenshot blobs / pathological copy-paste leaving multi-MB markdown under `solutions/`.
- **`extractPreventions` opts.logger + opts.taskId**: when a logger is supplied (`plan.ts` L3 branch now does), a Tier-2 `prevention.skipped` event surfaces every drop reason — `frontmatter_parse_failed` / `prevention_field_missing` / `prevention_field_empty` — with the `solution_ref` so operators can query via `sgc tail --agent plan.preventions` why a corpus match did not yield an emission. Mirrors `handleCoerceFailure` (`researcher-history.ts:348`) for the researcher.history path. Per Invariant §13 Tier 2 paired-event semantics.

### Tests

- 11 new tests in `tests/dispatcher/preventions.test.ts`: 4 cap-clamp boundary cases (`topN` × upper/lower, `maxChars` × upper/lower), 4 logger-event reasons (parse_failed / missing / empty / silent-when-omitted), 2 file-size cap (over/under), 1 RT-4 prompt-template regression (negative match on legacy wording + positive match on `hypothesis to test`, `recurrence gate`, `probability: medium`, `Do NOT emit`).
- Dispatcher suite (CI gate, `tests/dispatcher`): 639 → 650 pass / 0 fail (+11, 1575 expect calls).
- Full project suite outside dispatcher unchanged: `plugins/sgc/browse/test/{learnings-injection,path-validation}.test.ts` continue to fail on pre-existing missing `plugins/sgc/bin/gstack-learnings-search` — same failure mode pre-CE-1.1, unrelated to this ship.

### Notes

- The `prior_preventions` capability fence is unchanged: `planner.adversarial` still declares no `read:solutions` scope_token; the input field is pre-fetched by `/plan` (which holds the scope) and crosses the boundary as data only. RT-4 narrows *how aggressively* the LLM treats the data, not whether it can see it.
- Deferred to CE-1.x or a future ship: RT-7 LLM-mode eval test for `prior_preventions` consumption + reproducible-from-clone seed fixture (the `.sgc/` gitignored vs tracked-seed-corpus tension); `prevention_text` prompt-injection delimiter sentinel; symlink advisory (currently safe-by-accident via `Dirent.isFile()` returning false on symlinks); `solution_ref` `?` mismatch between TS optional and YAML required (researcher-history.ts:53 vs sgc-capabilities.yaml:304 — H.1 #8 follow-up); 4 misc INFO.
- CE-2 (`sgc reflect` decisions↔solutions audit) and CE-3 (ship-failure compound auto-trigger) remain pending under shared parent intent `94913CB45F9D4C3E906B3C2C8E`.

## v1.4.0 — 2026-05-22 — CE-1 prevention injection + Red Team hardening

### Feature (CE-1: prevention injection into planner.adversarial)

- **CE-1** (f2 under task `94913CB45F9D4C3E906B3C2C8E`, parent intent `.sgc/decisions/.../intent.md`). When `/plan` classifies a task as L3, the dispatcher keyword-matches `<stateRoot>/solutions/<category>/*.md` against `intent_draft` (reusing the existing NFC + `Intl.Segmenter` walker from `researcher.history`), reads the optional `prevention:` frontmatter field, and passes up to 3 matches as a new `prior_preventions: [{solution_ref, category, prevention_text}]` field on the `planner.adversarial` spawn input. The agent's declared `scope_tokens` are unchanged — data crosses as input, not as runtime capability. Closes the "sediment → recall" half of the CE compound-engineering loop. CE-2 (`sgc reflect`) and CE-3 (ship-failure auto-trigger) remain pending under the same parent intent.
- `src/dispatcher/preventions.ts` (new): `extractPreventions(intentDraft, stateRoot?, opts?)`. Defensive against legacy on-disk shape — files missing the `prevention:` field, or carrying an empty value, or lacking a `---` frontmatter fence entirely (e.g. raw-markdown test fixtures) are silently skipped. Top-N=3, whitespace-fold + 240-char ceiling per emit.
- `src/dispatcher/agents/researcher-history.ts`: `walkSolutionsCorpus` + `SolutionScan` interface promoted from file-private to `export` (no behavior change; 46/46 own-suite still pass).
- `src/dispatcher/agents/planner-adversarial.ts`: `PlannerAdversarialInput` gains optional `prior_preventions?: PriorPrevention[]`. Heuristic ignores; LLM-mode prompt consumes.
- `src/commands/plan.ts`: L3 branch `await extractPreventions(...)` before the `planner.adversarial` spawn; conditionally appends `prior_preventions` to the input; logs recall count + each `solution_ref` for operator visibility. L1/L2 paths untouched.
- 13 new tests (8 extractor unit / 3 prompt-template regression / 2 plan.ts wiring integration). Existing planner-cluster suite (planner-adversarial 19 + planner-eng / .ceo / sgc-plan): 0 regressions.

### Changed

- `prompts/planner-adversarial.md`: drops the `Forbidden: read:solutions` scope bullet; replaces with an `Input channel: prior_preventions` clause noting that the data flows via pre-fetched spawn input, not as runtime capability. New step 5 in `## Your analysis` instructs `probability: high` marking on recurrent failure shapes with the `solution_ref` surfaced in `early_signal`. `.eng` and `.ceo` prompts retain their isolation; the capability fence via manifest `scope_tokens` is unchanged. This is the L3-trigger change (LLM-visible metadata per core §2).

### Hardening (gs:/review pre-ship Red Team — 5 critical findings repaired same ship)

- **RT-1**: closed the `## Pre-mortem (planner.adversarial)` Invariant §1 reviewer back-channel — symmetric to Phase H RT-1 for researcher.history. New `<!-- sgc:pre-mortem:begin/end -->` sentinel pair (`spawn.ts`); `stripPriorArtSection` widened to `stripBackChannelSections` covering both sentinels (`review.ts`); `checkInvariantOneBackChannel` extended with `PRE_MORTEM_BACK_CHANNEL_RE`. CE-1 prompt step 5 surfaced `solution_ref` in `early_signal`, which without this fix would have flowed straight from `solutions/` → `intent.body` `## Pre-mortem` block → `reviewer.correctness` / specialist reviewers — the exact class of leak Phase H/H.1 just closed.
- **RT-2**: word-boundary truncation + `...` sentinel in `extractPreventions`. Pre-fix the 487-char vendor-word seed cut mid-word at `state-dir collisio`, leaving the LLM with only the 8-mode failure enumeration the seed wanted to AVOID priming. Post-fix cuts at last whitespace within `maxChars - 3`, trims, appends `...`. The seed itself was also restructured action-first (folded length 229 now, under the cap) so truncation is no longer load-bearing on this entry.
- **RT-3**: `planner.adversarial` manifest declares `prior_preventions: array[{solution_ref, category, prevention_text}]`. Version bumped 0.2 → 0.3. Closes the §3 TRUST canonical-artifact drift surfaced by `gs:/review`.
- **RT-6**: `await extractPreventions` wrapped in try/catch with a Tier-2 audit event (`prevention.extract_failed`) on throw and an `[]` fallback. Mirrors `handleCoerceFailure` in `researcher-history.ts:348`. Prevents a transient FS / parse error from crashing the entire L3 planner cluster.
- **Perf-1**: `extractPreventions + planner.adversarial spawn` lifted into an IIFE pushed into the `tasks` array (mirrors the `researcher.history` IIFE pattern). Disk walk now runs in parallel with the rest of the planner cluster instead of blocking it.

Suite: 715 → 740 tests (+25), 4 → 2 LLM-eval flake fails. New tests include W4 end-to-end strip (`sgc-review.test.ts`) + T9-T9e gate units (`spawn.test.ts`) + E7/E8 word-boundary truncation (`preventions.test.ts`) + RT-3 manifest regression + RT-6/Perf-1 source-level structural assertions.

Remaining open (filed for a CE-1.1 hardening ship): prompt step 5 vs step 4 over-inclusion bias (RT-4); `opts.topN` / `opts.maxCharsPerText` public-API cap-bypass (RT-5); LLM-mode eval test for prior_preventions consumption + reproducible-from-clone seed fixture (RT-7); 11 informational findings (DRY around state-root + extractKeywords; sentinel-text prompt-injection delimiter; symlink guard in `walkSolutionsCorpus`; file-size cap; logger surface on skip; CHANGELOG test-count claim drift).

### Notes

- Heuristic mode (`plannerAdversarialHeuristic`) ignores the new input field — no LLM key required for tests to pass.
- `.sgc/solutions/` remains gitignored (operator-local invariant); the dogfood seed entry `.sgc/solutions/other/sgc-plan-motivation-word-vendor-2026-05-21.md` is therefore operator-local. Tracked-seed-corpus + first-run bootstrap is a separate ship (see project Deferred / out-of-scope on `.sgc/` gitignore tension).

## v1.3.0 — 2026-05-21 — Audit follow-up batch + first npm publish

**Distribution change** — sgc is now distributable via `npm install -g @sdsrs/sgc`. The unscoped `sgc` name was already taken on npm (different package). The Claude Code plugin layer still installs via `/plugin install sgc` (the marketplace name); the slash commands now auto-detect npm-installed CLI on PATH and fall back to `bun src/sgc.ts` in cwd for source-clone users.

### Distribution (P5 Tier 2: npm publish + GitHub Actions workflow)
- `package.json`: renamed `sgc` → `@sdsrs/sgc` (scoped); bumped 1.2.1 → 1.3.0; added `files`, `engines: {bun: ">=1.3"}`, `publishConfig: {access: public, provenance: true}`, `repository`, `bugs`, `homepage`, `keywords`. Dropped the `browse` bin entry (per-platform binary, not shipped via npm — build from source).
- `src/sgc.ts`: `#!/usr/bin/env bun` shebang (already present, verified executable on `npm install -g`).
- `.github/workflows/publish.yml` (new): triggers on `v*` tag push. Verifies tag matches `package.json` version, runs dispatcher tests as gate, publishes with `--access public --provenance`. Requires `NPM_TOKEN` secret in repo settings.
- 11 `plugins/sgc/commands/*.md`: consolidated Pre-flight + Invocation into one bash block that resolves `$SGC` to `sgc` (PATH) → `bun src/sgc.ts` (cwd) → prints multi-path install help and exits.
- `plugins/sgc/skills/bootstrap/SKILL.md`: dual-path install (npm primary, source-clone alternative).
- `README.md` Install/Update sections: split into "1. Install the CLI" (npm + source) and "2. Install the Claude Code plugin"; `## Update` covers both npm and source paths.
- `plugins/sgc/.claude-plugin/plugin.json`: version bumped 1.2.1 → 1.3.0; description aligned with `package.json` (no "merges best of three" framing).

### Docs (P4-lite: storage expectation-setting, defer team-sync)
- `README.md`: new `### Storage model — operator-local by design` subsection under `## State layout`. Sets explicit expectation that `.sgc/` is per-project, per-machine; calls out the no-team-sync gap; documents the manual side-repo workaround; references the design space (local/team split vs `sgc solutions sync` vs SQLite). Full team-sync feature deferred until real cross-user usage emerges.

### UX (P5 Tier 1: first-failure install guidance) — superseded by Tier 2 above
- Earlier in this version, plugin commands gained a multi-line `printf` preflight + bootstrap SKILL.md hoisted the install block. Tier 2 replaces that single-mode help with dual-path (npm + source) resolver.

### Hardening (P2: output-side Invariant §1 leak check)
- `src/dispatcher/fingerprint.ts` (new): walks `<stateRoot>/solutions/<cat>/<slug>.md`, hashes every fingerprintable line (≥25 chars, not pure markdown structure) with SHA256→16-hex. After-output scan in `spawn.ts` (post-`validateOutputShape`, pre-return) recursively walks reviewer.* / qa.* output string fields, throws `SpawnError` on collision. Other agents (planner.*, compound.*, researcher.history) exempt — they legitimately quote solutions. Per-process cache keyed by stateRoot; `clearFingerprintCache()` exposed for tests.
- Closes the LLM-mode advisory gap acknowledged in `README.md:165-174` for the lazy-copy/literal-quote class of leak; paraphrase-class leaks remain out of scope (would need n-gram overlap or embedding similarity).
- 11 unit tests + 2 spawn integration tests in `tests/dispatcher/fingerprint.test.ts`.

### Refactor (P6: declarative ROUTES table for resolveMode)
- `src/dispatcher/spawn.ts`: replaced the 10-level if-else chain in `resolveMode` with a `ROUTES: ModeRoute[]` table — each row is `{reason, resolve(opts, manifest)}`; first non-null resolution wins.
- Added `resolveModeDebug()` returning `{mode, reason}` for trace/audit output (useful for future `sgc doctor` extension and CI debugging).
- No behavior change — all 28 existing spawn tests pass unmodified. Priority order preserved verbatim from the prior chain.

### Feature (P9: sgc doctor command)
- `src/commands/doctor.ts` (new): consistency check across three name registries — (A) every manifest `prompt_path` declared → file exists in `prompts/`; (B) every `prompts/*.md` → at least one manifest references it (orphans → warn); (C) every `status: slot-only` entry → `prompt_path: null`.
- `src/sgc.ts`: registered `doctor` citty subcommand. Exit code 0 if `fail == 0`, 1 otherwise (CI-gateable).
- `plugins/sgc/commands/doctor.md`: plugin slash command `/sgc:doctor`.
- 5 unit tests in `tests/dispatcher/sgc-doctor.test.ts` cover green/missing/orphan/slot-only-with-prompt/slot-only-clean cases.
- Smoke run against current repo: **24 OK · 0 warn · 0 fail**.

### Docs (P1: positioning alignment)
- `package.json` description: dropped "Merges the best of Superpowers, gstack, and Compound Engineering" framing — sgc is a coexisting 规范层 + 知识引擎, not a vendored merger. Mirrors `docs/POSITIONING.md`.
- `README.md` header: rewrote title + first paragraph to lead with "Spec Layer + Knowledge Engine" + coexists-with-sp/gs; refreshed Status line (v1.1→v1.2.1, 8 cmds→10, 12 invariants→13, added OpenRouter + intentionally-heuristic `compound.related` callout).

### Hardening (P3: sentinel-based Invariant §1 back-channel detection)
- `src/dispatcher/spawn.ts` exports `PRIOR_ART_SENTINEL_BEGIN` / `PRIOR_ART_SENTINEL_END` HTML-comment markers (`<!-- sgc:prior-art:begin -->` / `<!-- sgc:prior-art:end -->`).
- `checkInvariantOneBackChannel`: regex updated to match sentinel **or** legacy `## Prior art (researcher.history)` heading — defense-in-depth during transition; legacy match stays permanently so out-of-band content can't slip past by dropping the sentinel.
- `src/commands/plan.ts`: researcher.history block in intent.body now wrapped in sentinel comments (heading kept inside for human readers).
- `src/commands/review.ts:stripPriorArtSection`: prefers sentinel-pair, falls back to heading-to-next-`## ` heuristic.
- New test T9 in `tests/dispatcher/spawn.test.ts`: sentinel detection works without heading; legacy heading still detected.

### Refactor (P7: compound.related naming)
- `src/dispatcher/agents/compound.ts`: `compoundRelated` → `compoundRelatedHeuristic` with `compoundRelated` alias export so callers/tests don't churn. Header comment cites `feedback_compound_related_invariant3.md` + obs #92 — the heuristic is **intentional**, not deferred LLM-swap.

## v1.2.1 — 2026-05-20 — Plugin marketplace polish

### Plugin packaging
- `.claude-plugin/marketplace.json`: renamed marketplace `sdsrss-sgc` → `sgc`; added `metadata.description` + `metadata.homepage` for `/plugin marketplace list` discoverability.
- `plugins/sgc/.claude-plugin/plugin.json`: added `homepage` + `repository` (string URLs per Claude Code plugin schema); version bumped 1.2.0 → 1.2.1 so existing installs surface this update via `/plugin update sgc`.
- 9 command files (`work / review / qa / ship / compound / status / agent-loop / discover / tail`): uniform `## Pre-flight` block matching `plan.md` — fails fast with `sgc CLI not in cwd` instead of confusing shell errors when the dispatcher source isn't present.
- `plugins/sgc/skills/bootstrap/SKILL.md`: new `## CLI Dependency` section announces the prompt-layer-only design + the CLI clone step at SessionStart so users learn the install model before their first failed command.

### Docs
- README: added `## Update` (two-step `marketplace update` + `update`) and `## Uninstall` (with note that project `.sgc/` is preserved).
- README Install section split into "Claude Code plugin" + "CLI from source" earlier in v1.2.0 follow-up commits.

### Migration
- Users on v1.2.0: `/plugin marketplace update sgc && /plugin update sgc` to pull. No CLI behavior changes; `package.json` synced 1.2.0 → 1.2.1 for traceability only.

## v1.2.0 — 2026-04-21 — Audit remediation

### Strategy
- **Positioning**: sgc declared as "规范层 + 知识引擎" alongside sp/gs. See `docs/POSITIONING.md`.

### Features
- `classifier.level`: real-LLM dispatch path via `prompts/classifier-level.md` (heuristic fallback retained)
- `reviewer.correctness`: real-LLM dispatch path via `prompts/reviewer-correctness.md` (heuristic fallback retained)
- Plugin skills (`plugins/sgc/skills/*/SKILL.md`) now dispatch to the CLI via `bun src/sgc.ts <cmd>`
- `sgc plan` / `sgc ship` auto-write `handoff.md` for session resume
- New `--force-new-task` flag for `sgc plan` when conflicting handoff exists
- Manifest field `prompt_path` for agent-to-prompt template mapping
- Manifest field `status` + `roadmap` for slot-vs-implemented agent visibility

### Performance
- Anthropic SDK: system block now cached with `cache_control: ephemeral`. System prefix is manifest-derived (byte-stable across calls); per-call data (spawn_id, scope tokens, input) moved to user block.

### Tests (357 → 445, +88)
- Eval: `classifier-llm` — heuristic limits + LLM routing readiness
- Eval: `reviewer-correctness-llm` — heuristic blind spots + LLM routing readiness
- Eval: `L3-auto-refused` — Invariant §4
- Eval: `override-reason-short` — Invariant §5
- Eval: `compound-rollback` — Invariant §10
- Eval: `reviewer-conflict` — worst-of verdict aggregation
- Eval: `resume-guard` — session handoff
- Unit: `splitPrompt`, cache-stability integration, prompt-path routing

### Docs
- New: `docs/POSITIONING.md`
- Updated: `plugins/sgc/CLAUDE.md`, `README.md`, all 8 `SKILL.md` files
- Annotated: 5 unimplemented reviewer slots + janitor.archive in capabilities.yaml

## v1.1.0 — 2026-04-16 — D-phase + E-phase

Initial release with full L0-L3 pipeline, 12 invariants, 357 tests.
See `docs/e-phase-demo.md` for details.
