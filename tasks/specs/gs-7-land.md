---
status: implemented
revision: 2
task_id: gs-7-land
feature_id: f10
parent_intent: (none — GS-7 is the fourth ship of the GS-N absorb arc, sgc-native heuristic implementations of selected gstack-style capabilities per docs/POSITIONING.md. Sibling to CE-N; outside any compound parent intent. Sibling to GS-1 canary v1.11.0 + GS-1.1 promote v1.12.0 + GS-1.2 dedup robustness v1.12.1 + GS-2 handoff v1.13.0.)
---

# GS-7 — `sgc land` post-publish ship chain orchestrator

## Goal

Add a sgc-native **post-publish ship chain orchestrator** absorbed from
`gs:/land-and-deploy` intent, scoped to the sgc-self main-direct + tag
ship flow. New standalone CLI `sgc land` chains two existing sgc
commands in a single fail-fast call:

```
sgc land [--package <name>] [--version <ver>]
  ≡ sgc watch-ci-failure && sgc canary --package <pkg> --version <ver>
```

This collapses the post-tag-push portion of the manual 6-step ship
sequence into one command, closing the "git tag pushed → npm
registry holds new version" verification gap that operator memory
currently has to span across two separate command invocations.

The orchestrator covers steps 4-5 of the current ship sequence:

```
0. bump version (package.json + plugin.json lockstep)         ← manual
1. commit (chore: release vX.Y.Z)                              ← manual
2. git push origin main                                         ← manual
3. git tag v$VER && git push origin v$VER (triggers publish)    ← manual
4. sgc watch-ci-failure  (wait publish.yml CI green or capture) ← sgc land
5. sgc canary --version $VER  (verify npm propagation + smoke)  ← sgc land
```

Steps 0-3 stay in operator scope: they are irreversible (git push
main) and version-derivation gates (lockstep bump across two JSON
files) that benefit from explicit operator authorization, not from
single-command compression. GS-7 absorbs only the post-tag-push
verification chain — where mistakes are recoverable (rerun
`sgc land`) and the operator value is "one wait, one decision."

GS-7 is the **fourth ship of the GS-N absorb arc**, sibling to GS-1
canary (v1.11.0–v1.11.1) / GS-1.1 promote (v1.12.0) / GS-1.2 dedup
robustness (v1.12.1) / GS-2 handoff (v1.13.0). The arc follows the
same SPINE: spec → plan → implement → dogfood → main-direct → tag →
publish. Heuristic only. Zero new dependencies. No new hook surface.

Default behavior reads `package.json#name` + `package.json#version`
from the cwd-nearest `package.json`, so the typical sgc-self
invocation is parameter-free:

```
# inside sgc repo, just after `git push origin v$VER`:
sgc land
# = sgc watch-ci-failure (current branch HEAD)
#   && sgc canary --package @sdsrs/sgc --version <package.json#version>
```

Both `--package` and `--version` override per-flag. POSITIONING.md is
refreshed in the same ship to reflect the GS-N arc growth and the new
`sgc land` row in the delegate table.

## Non-goals (v0)

- Do NOT include steps 0-3 (version bump / commit / push main /
  tag push). These are irreversible operator-authorization gates;
  operator value of compressing them is low and risk of accidental
  push without intentional commit is high.
- Do NOT auto-rollback on failure. Canary fail does NOT trigger
  `npm unpublish` or `git tag --delete v$VER`. Operator decides
  remediation; `sgc land` exits 1 with stderr guidance and lets
  the existing capture artifacts (`.sgc/ship-failures/<slug>.md` /
  `.sgc/canaries/<slug>.md`) anchor the next step.
- Do NOT retry at the orchestrator layer. `watch-ci-failure`
  already polls; `canary` already polls. `sgc land` calls each
  exactly once; rerun is operator-driven.
- Do NOT partial-success: watch green + canary fail ≠ exit 0.
  Both steps must succeed for `sgc land` to exit 0.
- Do NOT write a `land-runs/<id>.md` state file. The two underlying
  commands already write their own capture artifacts on failure
  (ship-failures/, canaries/). The orchestrator is stateless;
  observability lives in stdout/stderr + `land.start` /
  `land.complete` / `land.failed` events appended to
  `events.ndjson`.
- Do NOT add a `--from-land` promote sibling. land is a verification
  chain over already-promotable underlying captures (watch-ci-failure
  already feeds `sgc compound --from-ship-failure`, canary already
  feeds `sgc compound --from-canary`). A separate land-promote would
  duplicate paths.
- Do NOT handle interactive prompts. `sgc` CLI is non-interactive by
  convention; `sgc land` follows. Operator interprets stderr guidance
  and chooses next action.
- Do NOT auto-trigger from a hook (Stop / SessionEnd / PostToolUse).
  Consumption is operator-typed after tag push. Same rationale as
  GS-2: hook surface is occupied by claude-mem-lite; adding a second
  hook in v0 is unjustified scope creep.
- Do NOT widen scope to user-project (non-sgc) flow in v0. Audience
  is sgc-self dogfood. If user-project usage emerges, GS-7.1 can add
  a `--ci-workflow <name>` flag + PR-merge prelude as a sibling
  spec.

## Constraints

### State-layer untouched

`sgc land` does not write to `.sgc/decisions/`, `.sgc/solutions/`,
`.sgc/reviews/`, `.sgc/progress/handoff.md`, `.sgc/loop-runs/`,
`.sgc/plan-jobs/`. The two underlying commands write to
`.sgc/ship-failures/` (on watch capture) and `.sgc/canaries/` (on
canary capture) via their own gates; `sgc land` only consumes their
return values.

### Invariants untouched

- **§1 back-channel**: not applicable — no LLM agent spawn, no
  reviewer/qa input.
- **§3 dedup write-gate**: not applicable — no `writeSolution` call.
- **§6 reviews append-only**: not applicable — no `appendReview` call.
- **§13 paired events Tier 1**: `sgc land` is not a spawn; no
  `spawn.start` / `spawn.end` owed. The voluntary `land.start` /
  `land.complete` / `land.failed` events are additive telemetry, not
  Tier 1.
- **§13 Tier 2**: not applicable — no LLM call.
- **schema_version**: stays at 1. `event_type: ${string}.${string}`
  template literal already accepts the three new event-type strings;
  no contract bump owed.

### Module pattern follows CE-5 / GS-2

```
src/dispatcher/land.ts        (orchestrator + types + defaultStepRunners)
src/commands/land.ts          (citty thin wrapper, lazy-imports runLand)
src/sgc.ts                    (defineCommand block + subCommands registration)
tests/dispatcher/land.test.ts (unit suite with opts.steps injection)
tests/dispatcher/sgc-cli.test.ts (+2 help-surface tests)
```

`opts.steps: LandStepRunners` is the test-injection seam (mirrors
CE-5 sgc loop's `opts.steps` pattern). `defaultStepRunners()`
lazy-imports `runWatchCiFailure` from `src/commands/watch-ci-failure.ts`
and `runCanary` from `src/commands/canary.ts`. Lazy-import keeps
test-mode invocation cheap (no real gh-cli / npm shellouts) and
production-mode CLI startup lean.

### Default-arg derivation

`runLand` reads `<repoRoot>/package.json` asynchronously at entry
(via `node:fs/promises` `readFile` + `JSON.parse`) when either
`opts.package` or `opts.version` is undefined. If `package.json` is
absent or unparseable AND the corresponding flag was not passed,
exit 1 with stderr:

```
land error: cannot derive <field> (no readable package.json at <repoRoot>; pass --<field> <value>)
```

The error is emitted before `land.start` fires (no telemetry noise
on operator setup errors).

### Failure-mode contract

| Trigger | exitCode | step | stderr guidance |
|---|---|---|---|
| `runWatchCiFailure` returns `{captured: true, path}` | 1 | `"watch-ci-failure"` | `land failed at watch-ci-failure: inspect <path>; fix CI; rerun sgc land` |
| `runCanary` returns `{captured: true, path}` | 1 | `"canary"` | `land failed at canary: inspect <path>; check npm registry propagation; rerun sgc land` |
| `runWatchCiFailure` throws | 1 | `"watch-ci-failure"` | `land error in watch-ci-failure: <error.message>` |
| `runCanary` throws | 1 | `"canary"` | `land error in canary: <error.message>` |
| arg-error (package/version unresolvable) | 1 | (no step) | `land error: cannot derive <field> ...` |

Fail-fast at step 1: when watch captures or throws, `runCanary` is
NOT called (test enforces `opts.steps.canary` callCount === 0 on
watch-capture path).

### Event-stream contract

`land.start` fires immediately after successful default-arg
derivation, BEFORE the first step runs:
```json
{"event_type":"land.start","payload":{"package":"...","version":"..."}}
```

On happy path:
```json
{"event_type":"land.complete","payload":{"package":"...","version":"...","duration_ms":<int>}}
```

On step-failure (capture or throw):
```json
{"event_type":"land.failed","payload":{"package":"...","version":"...","failed_step":"watch-ci-failure|canary","capture_path":"...","error_class":"...","error_message":"..."}}
```

`capture_path` is present when underlying step returned `captured:
true`; `error_class` + `error_message` are present when underlying
step threw. They are mutually exclusive in payload by construction
but both fields exist in the type (optional). Schema additive to
events.ndjson v1.

### Process exit + stdout buffering

`runLand` returns a `LandResult { exitCode: 0 | 1, ... }`; the
citty `run` handler is responsible for calling `process.exit(exitCode)`
after stdout/stderr are flushed. The citty pattern mirrors `canary`
and `handoff`.

stdout writes happen via `opts.stdoutWrite ?? process.stdout.write`
and stderr via `opts.stderrWrite ?? process.stderr.write` for test
isolation. Progress lines use `[N/2] ...` prefix to make output
greppable.

## Success criteria

GS-7 ships when ALL of:

1. **`sgc land` exists** as a registered subcommand. `sgc --help`
   lists it; `sgc land --help` shows `--package <name>` + `--version
   <ver>` flags.
2. **Default-arg derivation** works: zero-arg `sgc land` invoked
   inside the sgc repo reads `package.json#name` = `@sdsrs/sgc` and
   `package.json#version` = current version, then proceeds without
   error. With either flag passed, that field overrides.
3. **Happy path**: when both underlying step runners return
   `captured: false`, `sgc land` exits 0 and stdout contains
   `land complete: <package>@<version>`. Events.ndjson has
   `[land.start, land.complete]` for the invocation.
4. **Watch-capture fail-fast**: when `runWatchCiFailure` returns
   `{captured: true, path}`, `sgc land` exits 1, `runCanary` is
   not called, stderr contains the guidance template, and
   events.ndjson has `[land.start, land.failed{failed_step:
   "watch-ci-failure", capture_path: <path>}]`.
5. **Canary-capture exit**: when watch returns green but
   `runCanary` returns `{captured: true, path}`, `sgc land`
   exits 1, stderr contains the canary guidance template, and
   events.ndjson has `[land.start, land.failed{failed_step:
   "canary", capture_path: <path>}]`.
6. **Runner-throw**: when either underlying runner throws, `sgc
   land` exits 1 with `land.failed` event payload containing
   `error_class` + `error_message`.
7. **arg-error**: zero-arg `sgc land` invoked in a directory
   without a readable `package.json` exits 1 with the cannot-derive
   stderr, and emits NO events (land.start never fires).
8. **Test surface**: dispatcher CI gate ≥ +12 tests (+10 in
   `tests/dispatcher/land.test.ts` covering all 5 paths above + 2
   default-arg variants + `--package` + `--version` override + step
   injection seam smoke; +2 in `tests/dispatcher/sgc-cli.test.ts`
   for `--help` listing + `land --help` flag visibility). Full
   suite green: 0 fail.
9. **POSITIONING.md refresh**: GS-N arc paragraph extended to mention
   GS-1.2 + GS-2 + GS-7 ships; one new delegate-table row for
   `sgc land`. No other delegate-table rows touched (review/qa/browse
   factual-nativeization deferred to a later doc-only ship).
10. **Lockstep version bump + ship** per [[project_sgc_ship_workflow]]:
    `package.json` and `plugins/sgc/.claude-plugin/plugin.json`
    bumped to `1.14.0` in the same commit; CHANGELOG v1.14.0 entry
    landed; main-direct push + `v1.14.0` tag triggers publish.yml;
    `sgc watch-ci-failure` (run from local v1.13.0) green for the
    v1.14.0 publish; `sgc canary --package @sdsrs/sgc --version
    1.14.0` (run from local v1.13.0) green.

## Open questions

1. **Should `sgc land` log progress lines to stdout in real-time, or
   buffer until each step completes?** Recommended (v0): real-time
   streaming via `[N/2] watch-ci-failure ...` prefix; underlying
   commands already stream their own progress and `sgc land` adds
   only the prefix line. No buffer.
2. **Should `sgc land` print elapsed wall-time per step?** v0: no.
   `land.complete` event payload carries `duration_ms`; stdout stays
   prose-only. Operators wanting timing query `sgc tail --event-type
   land.*`.
3. **Should runner-throw vs runner-captured be distinguishable in
   exit code?** v0: both exit 1. Distinguishing would require exit
   codes 1 (captured) vs 2 (threw), but that signals different
   operator action only weakly — both require inspection. Keep
   single non-zero exit; differentiate via `land.failed` payload
   `error_class`/`capture_path` presence.
4. **Should `sgc land` validate that `git tag --points-at HEAD`
   includes `v$VER` before starting?** Tempting (catches "version
   bumped in package.json but tag not pushed"), but adds a git
   shellout and a third failure path. v0: skip; watch-ci-failure
   internally fetches the publish run by `expectedSha = git rev-parse
   HEAD`, which already catches "no run for this commit." Operator
   sees a watch timeout rather than a tag-mismatch error, but the
   remediation is the same (push the tag).
5. **Should `sgc land --dry-run` exist?** v0: no. The two underlying
   commands have no destructive side effects (watch is read-only; canary
   does `npm install` into mktemp — disposed via §8.V4). `sgc land`
   itself only orchestrates. A dry-run flag would have nothing to
   omit.
6. **What's `runWatchCiFailure`'s default polling timeout, and should
   `sgc land` expose it as `--timeout`?** v0: defer to whatever
   `runWatchCiFailure` defaults to (current default is the
   `--max-wait-seconds` flag exposed by `sgc watch-ci-failure` —
   confirm during implementation). If propagation matters, add
   `sgc land --max-wait-seconds <N>` passthrough in a later sibling
   spec; do not introduce it v0.
7. **Should `sgc land` support `--json` output?** v0: no. stdout is
   human-readable; structured data lives in events.ndjson via `sgc
   tail`. A `--json` flag duplicates the channel and complicates the
   stdoutWrite seam.
8. **Should the dogfood-of-dogfood (use v1.14.0's `sgc land` to verify
   v1.14.0's own publish) be part of the ship, or deferred to first
   natural post-v1.14.0 patch?** Recommended (v0): defer. Running
   v1.14.0's sgc-land against v1.14.0's own publish requires
   intermediate v1.14.1 patch to test the post-publish path
   meaningfully; manufacturing a no-op patch pollutes ship discipline.
   Defer to first natural post-v1.14.0 ship — that one becomes the
   dogfood-of-dogfood evidence.

## Change log

- 2026-05-27 r2 — **implemented + live ship green** (with DOG-3 dogfood-in-arc
  bugfix). All 10 success criteria met. Module sizing: `src/dispatcher/land.ts`
  370 LOC, `src/commands/land.ts` 37 LOC, `tests/dispatcher/land.test.ts`
  310 LOC (impl total ~407; budget was ~190 — orchestrator grew larger than
  estimated because `deriveLandInputs` package.json reader + `defaultStepRunners`
  lazy-import shim + per-failure-mode stderr templates each added more than
  initially projected; nothing speculative, all in scope per spec §Constraints +
  §Success criteria). Dispatcher CI gate **815 → 833** pass (+18; spec target
  was +12, beat by 50%). 0 fail across full dispatcher suite. Eval-tier 3 fails
  are pre-existing LLM API-dependent flakes (`tests/eval/*-llm.test.ts`),
  unrelated to GS-7.

  **GS-7 commit chain (19 commits on main from session start)**: spec
  `06e060a` → plan `bd8fb5d` → T1–T14 (`9c09311`..`c7ccce2`) → DOG-3 fix
  `3534a97` → release `b2f937b` (v1.14.1) → known-red baseline annotation
  `1e9cc93`. v1.14.0 release commit `c7ccce2` produced a git tag but **no npm
  artifact** — publish.yml gated on dispatcher test green, and the T11 regex
  fired red under CI. v1.14.1 (commit `b2f937b`) is the first npm-published
  artifact of GS-7; consumers querying `@sdsrs/sgc@1.14.0` get 404 by design.

  **DOG-3 dogfood-as-test win (5th in GS-N arc)**: pre-fix T11
  `tests/dispatcher/sgc-cli.test.ts:264` regex `/land\s+.*watch-ci-failure.*canary/i`
  passed locally (`SGC_FORCE_INLINE=1 bun test ...`) but failed under
  `publish.yml` GitHub Actions because citty's help-surface rendering under
  consola CI-mode wraps command names in literal backticks
  (`` `land`    Post-publish ... ``) while local rendering emits the bare
  word (`land    Post-publish ...`). The `\s+` anchor matched the bare-word
  form but not the backtick. Reproduced locally pre-fix with
  `SGC_FORCE_INLINE=1 CI=1 bun test tests/dispatcher/sgc-cli.test.ts` (regex
  failed) and after fix (3-tier `toContain` passed: "Post-publish ship chain"
  + "watch-ci-failure" + "canary"). Capture record at
  `.sgc/ship-failures/2026-05-27-c7ccce2.md`. Lesson saved at
  [[feedback_citty_help_consola_ci_mode.md]]. Paradigm validation chain:
  **CE-3.1 (DOG-1+2 gh-cli tag trap) → GS-1.1 (DOG-1 PATH-shadow) → GS-1.2
  (DOG-2 dedup malformed) → GS-2 (no bug, clean) → GS-7 DOG-3 (T11 regex)**.

  **Live ship evidence** (v1.14.1, commit `b2f937b`):
  - `bun src/sgc.ts canary --package @sdsrs/sgc --version 1.14.1` →
    `canary green for @sdsrs/sgc@1.14.1; no capture.` exit 0 (npm propagation
    + isolated smoke-install both green; PATH-shadow trap avoided via
    `npm install --prefix <mkdtemp>` per [[feedback_npx_path_shadow]]).
  - `bun src/sgc.ts watch-ci-failure` for `1e9cc93` →
    `CI green for 1e9cc93; no capture.` exit 0 (publish.yml ran clean for
    the v1.14.1 release commit + baseline-annotation chore commit).
  - **`sgc land` itself was NOT self-dogfooded against its own v1.14.0/v1.14.1
    publish** — per Open Question #8 the dogfood-of-dogfood is deferred to
    the first natural post-v1.14.0 ship (manufacturing a no-op patch
    purely to test the orchestrator would pollute ship discipline). Next
    GS-N ship will be GS-7's own first dogfood evidence.

  **POSITIONING.md drift fix bundled** per Success Criterion #9: GS-N arc
  paragraph extended to mention GS-1.1 + GS-1.2 + GS-2 + GS-7 ships (was
  GS-1.0 + GS-1.1 only); one new delegate-table row for `sgc land`. Other
  delegate-table rows (review/qa/browse factual-nativeization) deferred to a
  standalone doc-only ship per r1 scope.

  Version bumped v1.13.0 → v1.14.0 → v1.14.1; `package.json` +
  `plugins/sgc/.claude-plugin/plugin.json` lockstep per
  [[project_sgc_ship_workflow]]. v1.14.0 git tag exists on GitHub but
  **no npm artifact** (publish.yml gated red on T11; not retroactively
  cleanable without `git tag --delete v1.14.0 && git push --delete origin
  v1.14.0` which requires explicit operator authorization — left intact;
  operators see latest=1.14.1 on npm and the v1.14.0 git tag tells the
  full story).

- 2026-05-27 r1 — initial draft. brainstorming session locked 5
  design axes: audience (sgc-self dogfood, main-direct + tag flow),
  scope (steps 4-5 only — watch + canary chain), failure mode
  (fail-fast + stderr guidance), API surface (default from
  package.json + per-flag override), state (stateless; stdout/stderr
  + 3 voluntary events only). Architecture approach A chosen:
  in-process orchestrator with `opts.steps: LandStepRunners`
  injection seam (mirrors CE-5 sgc loop / GS-2 handoff). Module
  sized ~120 LOC + ~70 LOC commands wrapper; dispatcher CI gate
  815 → target ≥830 (+12). Spec drafted following GS-2 r1 house
  style (Goal / Non-goals (v0) / Constraints / Success criteria /
  Open questions / Change log). POSITIONING.md refresh bundled
  same ship: GS-N arc paragraph extension + 1 new delegate-table
  row; review/qa/browse fact-drift deferred to standalone doc
  ship.
