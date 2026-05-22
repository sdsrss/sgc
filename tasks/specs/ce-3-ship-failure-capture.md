---
status: draft
revision: 2
task_id: 94913CB45F9D4C3E906B3C2C8E
feature_id: f4
parent_intent: .sgc/decisions/94913CB45F9D4C3E906B3C2C8E/intent.md
---

# CE-3 — `sgc watch-ci-failure` ship-failure capture

## Goal

Close the third half of the CE compound-engineering loop in sgc:
automatic capture of ship failures as raw "prevention seed" material.
New standalone CLI `sgc watch-ci-failure` polls the publish workflow
run for the current branch's HEAD commit (or for an explicit
`--run-id`) until conclusion. On `failure`, the command writes a
templated record to `<stateRoot>/ship-failures/<auto-slug>.md`
carrying enough context (commit SHA, tag, run URL, failing-step
summary excerpt) for an operator — or a future automation pass — to
convert into a finished prevention via the existing `sgc compound`
flow.

The capture path is heuristic-templated: no LLM call, no agent
spawn, no event-stream emission. Failure data is structured
metadata; LLM-synthesis happens later inside `sgc compound` when an
operator chooses to promote a ship-failure into a real solution.

The command is opt-in: `sgc ship`'s behavior is unchanged (task-ship
writes `.sgc/decisions/<task_id>/ship.md` only; release-ship via
`git push origin main --tags` is operator-driven). CE-3 attaches to
the release-CI side via a separate command, decoupled from
`sgc ship`'s task-ship semantics. Operator workflow becomes:

```
git push origin main --tags
sgc watch-ci-failure
```

## Non-goals

- Do NOT write to `<stateRoot>/solutions/`. Invariant §3 forbids
  solutions writes without a `compound.related`-issued
  `dedup_stamp`; CE-3 sidesteps the invariant by writing to a NEW
  `<stateRoot>/ship-failures/` namespace, mirroring CE-2's
  `<stateRoot>/reflections/` precedent.
- Do NOT introduce a new compound agent (`compound.ship_failure`
  etc). The 4-agent compound cluster (context/related/solution/
  prevention) stays the canonical solutions-creation path. CE-3
  captures raw material; compound promotes it to a finished
  prevention.
- Do NOT call any LLM in the watch+capture flow. Failure metadata
  (commit SHA, failing test name, `$GITHUB_STEP_SUMMARY` excerpt)
  is structured-enough; LLM rerank value is marginal and would
  defeat the "capture immediately, no network dependency on the
  failure-handler path" semantic.
- Do NOT add a `--watch-ci-failure` flag to `sgc ship` or modify
  `sgc ship` behavior at all. `sgc ship` writes task-ship metadata
  (`.sgc/decisions/<task_id>/ship.md`) and does NOT do
  `git push origin main --tags` (release-ship is operator-driven
  in sgc's main-direct workflow per
  `project_sgc_ship_workflow.md`). Coupling CE-3 to `sgc ship`
  would mislead: there is no push event inside `sgc ship` to
  watch after.
- Do NOT auto-invoke `sgc watch-ci-failure` from any other
  command. v0 is purely operator-triggered. Auto-chaining belongs
  to a future "release pipeline" feature, not CE-3.
- Do NOT capture non-CI failure modes in v0 (push-rejected,
  version-mismatch, npm-publish-fail). Push-rejected fails before
  ship reaches watch state; version-mismatch fails inside the
  manifest-sync test already running on CI red path; npm-publish
  failures DO surface in publish.yml red, so they're covered
  transitively. Standalone capture for these is future scope.
- Do NOT download full CI logs. v0 uses only
  `$GITHUB_STEP_SUMMARY` (which `publish.yml` already writes bun
  test failure output to per project memory `project_sgc.md`) +
  `gh run view --json conclusion,name,headSha,headBranch,url`.
  Full-log fetch needs auth + bloats capture; future scope.
- Do NOT change `sgc compound`, compound agents, or Invariant §3
  enforcement. CE-3 only adds a new flag on `sgc ship`, a new
  module, and a new namespace.

## Constraints

- **New namespace, not solutions/**: `<stateRoot>/ship-failures/`
  is created lazily by `mkdir { recursive: true }` on first
  write. `ensureSgcStructure` `LAYERS` list is unchanged (same
  pattern as CE-2's `reflections/`).
- **Dedup-by-SHA**: the slug derives from `headSha`; if
  `<stateRoot>/ship-failures/<sha-slug>.md` already exists,
  capture short-circuits with `action: "deduped"` and no
  overwrite. Operators re-running the same red ship don't get
  duplicate records. No `computeSignature`/`dedup_stamp` needed —
  the SHA itself is the dedup key.
- **No Invariant §13 paired event owed**: no agent spawn (no
  `spawn.start/end`), no LLM call (no `llm.request/response`).
  v0 emits NO command-level event either, keeping `events.ndjson`
  consumers unchanged. A future cmd-level `ship.failure_captured`
  event is permitted but out of v0 scope.
- **Reuse existing `gh` shell-out** (`src/dispatcher/gh-runner.ts`
  pattern). No new dep. Polling interval default 15s; configurable
  via `--watch-interval <seconds>` (bounds [5, 60]). Timeout
  default 600s (10 min, ~3× past publish.yml runtime); bounds
  [60, 1800].
- **Async fs** (`node:fs/promises`), consistent with H.1 ship C +
  CE-2.
- **Templated frontmatter shape**:
  ```yaml
  ---
  kind: ship-failure
  captured_at: <ISO 8601>
  commit_sha: <40 hex>
  tag: <v X.Y.Z | "(none)">
  workflow_run_id: <gh run id>
  workflow_run_url: <url>
  workflow_name: <publish.yml | other>
  conclusion: failure
  prevention_seed: "TODO: operator-fill; captured failure of
    <workflow_name> at <short_sha>. Convert via `sgc compound`."
  ---
  ```
  Body: `## Failure context` (run name, conclusion) +
  `## $GITHUB_STEP_SUMMARY excerpt` (truncated to 2000 chars) +
  `## Next steps for operator` (templated TODO list).
- **CLI behavior on `success` conclusion**: silent no-op exit 0.
  No record written. (CE-3 is failure-path-only.)
- **CLI behavior on timeout**: print `[PARTIAL: watch timed out
  after <N>s; CI still in progress; no capture written]` to
  stderr; exit 0 (timeout is not itself a failure).
- **Slug shape**: `<YYYY-MM-DD>-<short-sha>` (e.g.
  `2026-05-22-9c8bc57`). Short-SHA = first 7 chars. Collision on
  same-day re-attempt of same SHA → dedup short-circuits before
  slug needed.

## Success criteria

1. New module `src/dispatcher/ship-failure.ts` exports:
   ```ts
   interface WatchOptions {
     intervalSec?: number   // default 15
     timeoutSec?: number    // default 600
     branch?: string        // default current branch
     workflowName?: string  // default "publish.yml"
   }
   interface WatchResult {
     status: "success" | "failure" | "timeout"
     run?: {
       id: string
       url: string
       name: string
       headSha: string
       headBranch: string
     }
     summaryExcerpt?: string  // populated on "failure"
   }
   interface ShipFailure {
     commitSha: string
     tag: string | null
     workflowName: string
     workflowRunId: string
     workflowRunUrl: string
     summaryExcerpt: string
   }
   interface CaptureResult {
     action: "captured" | "deduped"
     path: string
   }
   export async function watchPublishWorkflow(
     opts?: WatchOptions
   ): Promise<WatchResult>
   export async function captureShipFailure(
     failure: ShipFailure,
     stateRoot?: string
   ): Promise<CaptureResult>
   ```
2. New CLI handler `src/commands/watch-ci-failure.ts` exports
   `runWatchCiFailure(opts: WatchCliOptions) → Promise<void>`:
   - Resolve current branch (or `opts.branch`) + HEAD commit
     short-sha from git (or use `opts.runId` directly).
   - Call `watchPublishWorkflow`.
   - On `failure` → build `ShipFailure` + call
     `captureShipFailure` + print `captured: <path>` to stderr.
   - On `success` → print `CI green for <short-sha>; no capture.`
     to stderr; exit 0.
   - On `timeout` → print `[PARTIAL: watch timed out after <N>s;
     CI still in progress; no capture written]` to stderr;
     exit 0.
3. `src/sgc.ts` registers a new `watch-ci-failure` defineCommand
   with args `--workflow <name>` (default `publish.yml`) /
   `--branch <name>` (default current branch) /
   `--run-id <id>` (skip discovery, attach directly) /
   `--interval <s>` (default 15) /
   `--timeout <s>` (default 600). Lazy-imports `runWatchCiFailure`.
   Added to the `subCommands` map. `sgc ship` is NOT modified.
4. Tests: `tests/dispatcher/ship-failure.test.ts` (≥7 cases):
   1. `watchPublishWorkflow success` short-circuits returning
      `{status:"success"}`.
   2. `watchPublishWorkflow failure` returns
      `{status:"failure", summaryExcerpt}` with the parsed
      `$GITHUB_STEP_SUMMARY`.
   3. `watchPublishWorkflow timeout` returns `{status:"timeout"}`
      after exceeding `timeoutSec`.
   4. `captureShipFailure` first-call writes templated entry,
      returns `{action:"captured"}` + path under
      `<stateRoot>/ship-failures/`.
   5. `captureShipFailure` second-call same SHA → returns
      `{action:"deduped"}`, no overwrite of body.
   6. `captureShipFailure` with empty `summaryExcerpt` →
      `## $GITHUB_STEP_SUMMARY excerpt` section reads
      `(empty — workflow did not write $GITHUB_STEP_SUMMARY)`.
   7. `captureShipFailure` truncates summaryExcerpt > 2000 chars
      to 2000 with `...` sentinel.
   8. (Implementation hook) `gh` shell-out is parameterized so
      tests can inject a fake `runCommand`; production calls real
      `gh-runner.ts`.
   `tests/dispatcher/sgc-cli.test.ts` (extend): `sgc --help`
   lists `watch-ci-failure` subcommand; `sgc watch-ci-failure
   --help` shows the 5 flags.
   Total test delta: ≥9 (target: 668 → ≥677 dispatcher pass).
5. CHANGELOG.md gains a `## Unreleased` entry naming CE-3 by
   feature ID (f4 under intent
   94913CB45F9D4C3E906B3C2C8E).

## Open questions

- **gh polling implementation**: shell-out to `gh run view`
  (existing pattern in `gh-runner.ts`) vs `@octokit/rest` SDK
  (heavier, adds dep). Lock: shell-out. No new dep, mirrors
  existing ship-flow code, simpler test injection point. Resolve
  in T1.
- **Workflow detection when multiple workflows match the push**:
  `publish.yml` is the only release-triggering workflow on this
  repo today (`.github/workflows/`). If a future workflow joins
  the release path, the `--watch-workflow <name>` flag (currently
  hardcoded to `"publish.yml"`) is the extension point. Defer
  until needed.
- **`prevention_seed:` placeholder structure**: fixed string vs
  structured (commit / workflow / failing-step list embedded)?
  Lock: structured stub: `"TODO: operator-fill; captured failure
  of <workflow_name> at <short_sha>. Convert via sgc compound."`
  — gives operator a thread to pull while keeping the field
  human-editable.
- **`sgc compound --from-ship-failure <slug>` ergonomic helper**:
  cleanest UX for promoting ship-failures/ → solutions/ would be
  a flag on the existing compound command. Out of CE-3 v0 scope
  — file as follow-up after operator field experience clarifies
  the actual promotion workflow.

## Change log

- 2026-05-22 r1 — initial draft from `开 CE-3` brainstorm align
  (2026-05-22 chat). Locks in: opt-in `--watch-ci-failure` flag
  on `sgc ship`, heuristic-templated capture (no LLM, no agent
  spawn, no event emit in v0), new namespace
  `<stateRoot>/ship-failures/` to sidestep Invariant §3 (mirrors
  CE-2's `reflections/` precedent for §6), `$GITHUB_STEP_SUMMARY`
  + `gh run view` as failure context source, dedup-by-SHA short
  slug, `prevention_seed:` field flagging the capture as raw
  material awaiting `sgc compound` promotion. Reuses existing
  `gh-runner.ts` shell-out pattern; no new dependency.
- 2026-05-22 r2 — design pivot to **standalone `sgc
  watch-ci-failure` command** (user ACK same session). Inspecting
  `src/commands/ship.ts:117` `runShip` revealed `sgc ship` does
  NOT do `git push origin main --tags`; ship is task-ship
  (writes `.sgc/decisions/<task_id>/ship.md`), release-ship is
  operator-driven manual `git push --tags` per `project_sgc_
  ship_workflow.md`. Adding a `--watch-ci-failure` flag to `sgc
  ship` therefore mislabels CE-3 (no push event in `runShip` to
  watch after). Pivot: new standalone CLI command, runs after
  manual push, attaches to the just-fired publish workflow via
  branch HEAD or `--run-id`. All other r1 design choices (no
  LLM, no agent spawn, new namespace, $GITHUB_STEP_SUMMARY,
  dedup-by-SHA, prevention_seed seed-field) retained. Affected
  success criteria: 2 (command handler at
  `src/commands/watch-ci-failure.ts` instead of ship.ts edit) +
  3 (new defineCommand registration in `src/sgc.ts`, ship not
  touched). Test delta bumped 8 → 9 to cover the new
  subcommand-help case.
