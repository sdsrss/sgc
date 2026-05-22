# CE-3 — `sgc watch-ci-failure` ship-failure capture (plan)

Spec: `tasks/specs/ce-3-ship-failure-capture.md` (status: draft, r2).
Parent intent: `.sgc/decisions/94913CB45F9D4C3E906B3C2C8E/intent.md` (f4 of 4).

## Pre-flight

- **Branch**: main (sgc main-direct per `project_sgc_ship_workflow.md`).
- **Baseline**: head `9c8bc57` (post-CE-2 v1.5.0, working tree clean). CE-2 plan + spec land precedents at `docs/superpowers/plans/2026-05-22-ce-2-reflect-audit.md`.
- **Test baseline**: 668 dispatcher pass (post-CE-2). Goal post-CE-3: ≥677 (Δ≥9).
- **Version bump (T-ship)**: MINOR 1.5.0 → 1.6.0. New CLI subcommand `sgc watch-ci-failure` = user-visible additive surface (`sgc help` list grows, LLM-visible metadata via CHANGELOG = §2 released-artifact L3 hard upgrade).
- **No new dependency**: reuses `gh-runner.ts` shell-out for `gh run view` / `gh run list` calls.

## Task list

### T1 — types + module scaffold (`src/dispatcher/ship-failure.ts`)

New file. Exports `WatchOptions` / `WatchResult` / `ShipFailure` / `CaptureResult` interfaces + skeleton `watchPublishWorkflow` / `captureShipFailure` returning placeholder values. No real logic; TDD shape-first.

```ts
export interface WatchOptions {
  intervalSec?: number
  timeoutSec?: number
  branch?: string
  workflowName?: string
  runId?: string
  /** Test hook: inject a fake gh runner. Production = real gh CLI. */
  runCommand?: (args: string[]) => Promise<{ stdout: string; stderr: string; exitCode: number }>
  /** Test hook: inject a fake clock (returns ms). Production = Date.now. */
  now?: () => number
  /** Test hook: inject a fake sleep. Production = setTimeout-based. */
  sleep?: (ms: number) => Promise<void>
}

export interface WatchResult {
  status: "success" | "failure" | "timeout"
  run?: {
    id: string
    url: string
    name: string
    headSha: string
    headBranch: string
  }
  summaryExcerpt?: string
}

export interface ShipFailure {
  commitSha: string
  tag: string | null
  workflowName: string
  workflowRunId: string
  workflowRunUrl: string
  summaryExcerpt: string
}

export interface CaptureResult {
  action: "captured" | "deduped"
  path: string
}

export async function watchPublishWorkflow(opts: WatchOptions = {}): Promise<WatchResult> {
  // T2 fills
  return { status: "timeout" }
}

export async function captureShipFailure(
  failure: ShipFailure,
  stateRoot?: string,
): Promise<CaptureResult> {
  // T3 fills
  return { action: "deduped", path: "" }
}
```

**Verify**: `bunx tsc --noEmit` green.

### T2 — `watchPublishWorkflow` (gh polling)

1. If `opts.runId` is set, skip discovery: query that run directly.
2. Else: poll `gh run list --workflow <name> --branch <branch> --limit 1 --json status,conclusion,databaseId,name,headSha,headBranch,url` until a run row appears whose `headSha` matches current HEAD (or until timeout). Once we have a run, record it.
3. Poll the run's `status` field via `gh run view <run_id> --json status,conclusion,name,headSha,headBranch,url` every `intervalSec` until `status === "completed"` or timeout.
4. On `conclusion === "success"` → return `{ status: "success", run }`.
5. On `conclusion === "failure" | "timed_out" | "cancelled"` → fetch failing-step log excerpt via `gh run view <run_id> --log-failed` (or `gh api` fallback if not supported); truncate to 2000 chars; return `{ status: "failure", run, summaryExcerpt }`.
6. On wall-clock exceeding `timeoutSec` → return `{ status: "timeout" }`.

Injection points: `opts.runCommand` (default: spawn `gh` via `Bun.spawn`); `opts.now` (default: `Date.now`); `opts.sleep` (default: `(ms) => new Promise((r) => setTimeout(r, ms))`).

```ts
const DEFAULT_INTERVAL_SEC = 15
const DEFAULT_TIMEOUT_SEC = 600
const SUMMARY_MAX_CHARS = 2000
const TRUNCATION_SENTINEL = "..."
```

**Verify**: 3 tests in T6 (success / failure / timeout).

### T3 — `captureShipFailure` (templated write + SHA dedup)

1. Resolve `<stateRoot>/ship-failures/` via `resolveStateRoot(stateRoot)` + `mkdir { recursive: true }`.
2. Slug: `${YYYY-MM-DD}-${shortSha}` where `shortSha = commitSha.slice(0, 7)`. Path: `<dir>/<slug>.md`.
3. Dedup: if path exists, return `{ action: "deduped", path }` without read/overwrite.
4. Truncate `summaryExcerpt` to 2000 chars + `...` sentinel if >2000.
5. Empty-summary fallback text: `"(empty — workflow did not write $GITHUB_STEP_SUMMARY)"`.
6. Build frontmatter via `serializeFrontmatter` (existing in state.ts) with `kind`/`captured_at`/`commit_sha`/`tag`/`workflow_run_id`/`workflow_run_url`/`workflow_name`/`conclusion`/`prevention_seed` keys.
7. Body sections per spec: `## Failure context`, `## $GITHUB_STEP_SUMMARY excerpt`, `## Next steps for operator`.
8. `writeFile` (no atomic dance needed — single-writer flow, dedup gates the duplicate-write case).
9. Return `{ action: "captured", path }`.

**Verify**: 4 tests in T6 (first write / dedup / empty summary / truncation).

### T4 — `src/commands/watch-ci-failure.ts` CLI handler

```ts
export interface WatchCliOptions {
  workflow?: string  // default "publish.yml"
  branch?: string    // default git current branch
  runId?: string     // skip discovery, attach directly
  intervalSec?: number
  timeoutSec?: number
}

export async function runWatchCiFailure(opts: WatchCliOptions = {}): Promise<void> {
  // 1. Resolve current branch via git CLI if opts.branch unset.
  // 2. Resolve HEAD commit short-sha via `git rev-parse HEAD`.
  // 3. Resolve most-recent tag via `git describe --tags --abbrev=0` (or null).
  // 4. Call watchPublishWorkflow with derived opts.
  // 5. Switch on result:
  //    success → stderr "CI green for <short-sha>; no capture."
  //    failure → captureShipFailure + stderr "captured: <path>"
  //    timeout → stderr "[PARTIAL: watch timed out after <N>s; ...]"
}
```

**Verify**: subsumed in T6 sgc-cli.test.ts subcommand-help test.

### T5 — register in `src/sgc.ts`

Insert between `reflect` and `// ── main ──`:

```ts
const watchCiFailure = defineCommand({
  meta: {
    name: "watch-ci-failure",
    description: "Poll the publish CI workflow and capture failures as ship-failure seed records",
  },
  args: {
    workflow: { type: "string", required: false, description: "Workflow filename (default: publish.yml)" },
    branch:   { type: "string", required: false, description: "Branch to watch (default: current git branch)" },
    "run-id": { type: "string", required: false, description: "Attach directly to a specific gh run id; skips discovery" },
    interval: { type: "string", required: false, description: "Polling interval seconds (default: 15)" },
    timeout:  { type: "string", required: false, description: "Total timeout seconds (default: 600)" },
  },
  async run({ args }) {
    const { runWatchCiFailure } = await import("./commands/watch-ci-failure")
    const parseSec = (k: string): number | undefined => {
      const v = args[k] as string | undefined
      if (v === undefined) return undefined
      const n = Number.parseInt(v, 10)
      if (!Number.isFinite(n) || n < 1) throw new Error(`--${k} must be positive integer; got ${v}`)
      return n
    }
    await runWatchCiFailure({
      workflow: args.workflow as string | undefined,
      branch: args.branch as string | undefined,
      runId: args["run-id"] as string | undefined,
      intervalSec: parseSec("interval"),
      timeoutSec: parseSec("timeout"),
    })
  },
})
```

Add to `subCommands`: `"watch-ci-failure": () => watchCiFailure,`. Existing `ship` defineCommand untouched.

**Verify**: `sgc --help` lists `watch-ci-failure`; `sgc watch-ci-failure --help` shows 5 flags.

### T6 — tests

`tests/dispatcher/ship-failure.test.ts` (new):

1. **watch success**: mocked `runCommand` returns `status:"completed" conclusion:"success"` on first poll → returns `{status:"success"}`.
2. **watch failure with summary**: mocked `runCommand` returns `completed/failure` + `gh run view --log-failed` returns short text → returns `{status:"failure", summaryExcerpt}`.
3. **watch timeout**: mocked `runCommand` always returns `in_progress`; injected `now()` advances past `timeoutSec` → returns `{status:"timeout"}`.
4. **watch attaches via --run-id**: skip the `gh run list` discovery; jump straight to `gh run view <id>`.
5. **capture first-write**: returns `{action:"captured", path}`; file exists with expected frontmatter keys (kind, commit_sha, conclusion, prevention_seed).
6. **capture dedup**: second call with same `commitSha` → `{action:"deduped"}`; body unchanged.
7. **capture empty-summary fallback**: `summaryExcerpt: ""` → body section reads `(empty — workflow did not write $GITHUB_STEP_SUMMARY)`.
8. **capture truncates >2000 chars**: oversize summary truncated with `...` sentinel.

`tests/dispatcher/sgc-cli.test.ts` (extend):

9. **subcommand registered**: `sgc --help` stdout contains `watch-ci-failure`.

**Verify**: `SGC_FORCE_INLINE=1 bun test tests/dispatcher/` total 668 → ≥677 (Δ≥9). Inline evidence form per Iron Law #2: cite suite count delta in REPORT.

### T7 — CHANGELOG + commit

`CHANGELOG.md` add `## Unreleased` entry:

```
### Added
- **CE-3 (f4): `sgc watch-ci-failure` ship-failure capture** — new
  standalone CLI that polls the publish CI workflow and captures
  failures as raw `<stateRoot>/ship-failures/<auto-slug>.md` records.
  Heuristic-templated; no LLM, no agent spawn, no Invariant §13
  paired event owed. New namespace sidesteps Invariant §3 (mirrors
  CE-2's `reflections/` precedent for §6). `prevention_seed:`
  frontmatter field flags captures as material awaiting `sgc
  compound` promotion. Flags: --workflow / --branch / --run-id /
  --interval / --timeout. Closes feature f4 of parent intent
  94913CB45F9D4C3E906B3C2C8E (the CE compound-engineering loop is
  now closed across all three arcs: CE-1 v1.4.0 sediment-and-recall,
  CE-2 v1.5.0 reflect-audit, CE-3 capture-on-fail).
```

Single commit `feat(CE-3, f4): sgc watch-ci-failure ship-failure capture`. No version bump (release lands at T-ship).

**Verify**: `git log --oneline -1` shows the commit; working tree clean.

### T-ship — release v1.6.0 (deferred until user-explicit ship signal)

Same shape as CE-2 ship: lockstep version bump, CHANGELOG roll Unreleased → v1.6.0, single release commit, tag, push, publish.yml verify, npm view.

## Inline 3-view self-critique

### CEO view

- **Who benefits**: sgc operators (incl. AI agent operators) whose release ships sometimes go red. Without CE-3, a red publish.yml today produces a CI run URL the operator sees in `gh run list` once; the failure tends to evaporate after operator fixes the immediate issue, leaving no durable "this is what broke" record. CE-3 turns each red ship into a small markdown file under `ship-failures/` that survives.
- **Outcome signal**: simulated red ship → `sgc watch-ci-failure` writes a templated record with the failing-step summary; subsequent `sgc reflect` (CE-2) can audit it later. Loop closed in dogfood: actually running the CE-3 flow against the existing v1.4.x or v1.5.0 publish.yml runs (all green) should silently no-op; running against a synthetic failing run via `--run-id` (or a mocked fixture in tests) should produce a record.
- **Concern — discovery race**: between `git push --tags` and the workflow appearing in `gh run list`, there is a ~5-30s window. `watchPublishWorkflow`'s "poll for matching run" loop covers this, but if the operator runs `sgc watch-ci-failure` BEFORE pushing (typo / forgot order), it will time out with no run ever appearing. Acceptable v0 — timeout message points to it. Future ergonomic: emit a hint after 60s of "no matching run yet" if no row appears, suggesting the operator verify push landed.

### Design view

- **Namespace consistency**: spec mandates `<stateRoot>/ship-failures/`. With CE-2's `reflections/`, the sgc state tree now has 6 top-level subdirs: `decisions/` (immutable per Inv §2), `progress/` (mutable), `solutions/` (dedup-gated per Inv §3), `reviews/` (append-only per Inv §6), `reflections/` (replace-on-rerun audits, CE-2), `ship-failures/` (replace-on-rerun raw failures, CE-3). Each one carries a clear invariant or non-invariant semantic. No accidental overlap.
- **CLI command surface**: `sgc` now has 13 subcommands. Long, but each maps to a real operator workflow stage. Worth a future README revision to group them (planning / execution / audit / ship), out of CE-3 v0 scope.
- **Concern — `prevention_seed:` versus `prevention:` confusion**: CE-1 introduced `prevention:` as a frontmatter field on solutions/*. CE-3 introduces `prevention_seed:` on ship-failures/*. Field-name distinction is intentional (raw material vs finished prevention) and supports the future "promote via sgc compound" flow, but operators reading both files in quick succession may conflate them. Mitigation: CHANGELOG names the distinction; documentation can later add a one-paragraph diagram if needed. Not a v0 blocker.

### Eng view

- **Module graph clean**: `ship-failure.ts` imports `node:fs/promises` + `resolveStateRoot` + `serializeFrontmatter` (existing state.ts exports). No new dispatcher dependency. `gh-runner.ts` is referenced via the `opts.runCommand` injection point only — production wires the real `Bun.spawn` shell-out inline; no new import surface.
- **Test injection discipline**: `WatchOptions` carries `runCommand` / `now` / `sleep` hooks. Production code path passes default implementations; tests pass mocks. This is the same pattern as `ship.ts`'s `opts.upstreamCheck` (defaultUpstreamCheck) and `opts.readConfirmation` (readLineFromStdin). Consistent with existing module style; no global mocking magic.
- **Invariant audit**:
  - §1 (reviewer/qa amnesia): NOT touched (no agent spawn, no reviewer/qa interaction).
  - §3 (dedup_stamp before writeSolution): NOT triggered (writes to `ship-failures/`, not `solutions/`).
  - §6 (review append-only): NOT touched.
  - §13 (event audit): NOT triggered (no spawn, no LLM call, no cmd-level event emit in v0).
- **Concern — `gh` CLI availability**: production code shells out to `gh`. If the env lacks `gh` (e.g. minimal CI runner), `watch-ci-failure` will fail with a clear-ish exit. Operator workflow already requires `gh` for the existing `sgc ship --pr` flag, so this is not a new dependency. The error message in T2 should name `gh` explicitly so the operator knows the missing piece.
- **Concern — `gh run list --headSha <sha>` may not be a real flag** (TODO verify in T1/T2 dev). If `gh run list` does not accept a SHA filter, T2 fallback: filter the JSON output client-side after `gh run list --branch <branch> --limit 5` returns. Document the chosen approach inline in T2.

### Verdict

`approve` from all three views with the discovery-race + `prevention_seed:` confusion + `gh` CLI fallback documented as inline-noted concerns / Open Questions (in spec). No blocking issues. Ready for AUTH.

## AUTH preamble (post-plan)

This task is L3 per §2 released-artifact rule (new CLI subcommand = LLM-visible metadata, additive). It satisfies §4.FULL-lite eligibility (no auth/payment/crypto, ≤3 Modules — dispatcher + commands + state, no prod data-migration).

Hard AUTH needed before T1 execution:

- **op**: implement CE-3 `sgc watch-ci-failure` feature (T1-T7 single feature commit)
- **scope**:
  - new: `src/dispatcher/ship-failure.ts`, `src/commands/watch-ci-failure.ts`, `tests/dispatcher/ship-failure.test.ts`
  - edits: `src/sgc.ts` (defineCommand + subCommands), `tests/dispatcher/sgc-cli.test.ts` (one new subcommand-help test), `CHANGELOG.md` (Unreleased)
  - no edits to: `prompts/`, `contracts/sgc-capabilities.yaml`, `src/commands/ship.ts`, `src/commands/compound.ts`, existing dispatcher files except via the new module
- **risk**: low — heuristic-only, no LLM, no agent spawn, no Invariant §1 / §3 / §6 / §13 enforcement-path change, new file + new CLI command surface, opt-in. Worst-case behavioral surprise = polling loop hangs (covered by `timeoutSec` cap) or gh JSON shape mismatch (covered by defensive try/catch + test mocks).

Awaiting user `[AUTH]` to start T1.
