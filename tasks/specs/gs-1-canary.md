---
status: implemented
revision: 4
task_id: gs-1-canary
feature_id: f8
parent_intent: (none — GS-1 is the first ship of the GS-N absorb arc, sgc-native heuristic implementations of selected gstack-style capabilities per docs/POSITIONING.md. Not vendored from gstack — original implementation. Sibling arc to CE-N; outside any compound parent intent)
---

# GS-1 — `sgc canary` post-publish health check

## Goal

Add a sgc-native **post-publish canary check** absorbed from `gs:/canary`
intent. New standalone CLI `sgc canary` runs up to three sequential
phases against a just-released package:

1. **`npm_propagation`** — poll `npm view <pkg> dist-tags.latest` until
   the value equals `<expected_version>` or timeout.
2. **`smoke_install`** — `npx --yes <pkg>@<expected_version> --version`
   in an isolated cache; assert exit 0 + stdout includes
   `<expected_version>`.
3. **`health_url`** (optional, only when `--health-url <u>` is set) —
   `fetch(u)` with retry; assert 2xx + optional body regex
   (`--health-regex <pattern>`).

On `success` → stderr `canary green for <pkg>@<ver>; no capture.` exit 0.
On `failure` → write templated record to
`<stateRoot>/canaries/<YYYY-MM-DD>-<short-sha>-<phase>.md` with
`regression_seed: TODO ...` (parallels CE-3 `prevention_seed:`), stderr
`canary failure: phase <p> for <pkg>@<ver>; captured: <path>` exit 1.
On `timeout` → `[PARTIAL: canary timed out after <N>s; ...]` exit 0.

GS-1 is the **post-CI complement** to CE-3 `sgc watch-ci-failure`:
CE-3 watches publish.yml turn green; GS-1 watches the actual artifact
reach npm and execute. Together they close the "CI green ≠ npm
propagated ≠ binary works" gap — visible since v1.6.0 where the publish
CI was green but the just-published binary mis-defaulted the
`--workflow` flag and was unusable until CE-3.1 (v1.6.1) re-shipped.

Heuristic-only — no LLM, no agent spawn, no Invariant §13 paired event
owed in v0. Failure data (npm view JSON, npx stdout+stderr, fetch
response) is structured-enough; LLM synthesis happens later inside
`sgc compound --from-canary` (deferred to GS-1.1, mirroring CE-3 →
CE-3-promote split).

Operator workflow becomes:

```
git push origin main --tags
sgc watch-ci-failure       # CE-3: catch publish.yml red
sgc canary                  # GS-1: catch post-publish propagation/binary red
```

GS-1 is the **first ship of the GS-N absorb arc** — sgc-native
heuristic implementations of select gstack-style capabilities per
`docs/POSITIONING.md`. The arc is sibling to CE-N and follows the same
SPINE: spec → plan → implement → dogfood → main-direct → tag → publish.

## Non-goals (v0)

- Do NOT replace CE-3 `watch-ci-failure`. CE-3 watches the CI process
  (publish.yml run); GS-1 watches post-publish reality (npm registry +
  binary execution). Both run after `git push --tags`; both write
  distinct namespaces (`ship-failures/` vs `canaries/`); both intentionally
  remain operator-triggered in v0.
- Do NOT auto-chain from `sgc watch-ci-failure` or any other command.
  v0 is purely operator-triggered. `sgc canary && echo ok` is the v0
  composition model. Auto-chain belongs to a future "release pipeline"
  feature, not GS-1.
- Do NOT introduce an LLM-mode path. Failure metadata (npm registry
  response, npx exit/stderr, fetch response code+body) is
  structured-enough; LLM rerank value is marginal and would defeat the
  "capture immediately, no network dependency on the failure-handler
  path" semantic (same rationale as CE-3 r1).
- Do NOT add `--from-canary <slug>` to `sgc compound` in v0. Capture
  first, promote later. GS-1.1 promote helper sibling spec lands after
  operator field experience clarifies whether the canary
  `regression_seed:` shape survives the existing
  `compoundContextHeuristic` input contract used for CE-3-promote's
  `prevention_seed:`. Mirrors the CE-3 → CE-3-promote sibling-spec
  pattern.
- Do NOT write to `<stateRoot>/solutions/`. Invariant §3 forbids
  solutions writes without a `compound.related`-issued `dedup_stamp`;
  GS-1 sidesteps the invariant by writing to a NEW
  `<stateRoot>/canaries/` namespace (mirrors CE-3's
  `<stateRoot>/ship-failures/`, CE-2's `<stateRoot>/reflections/`
  precedents).
- Do NOT introduce a new runtime dependency. `npm view` and `npx` are
  shell-outs following the existing `src/dispatcher/gh-runner.ts`
  pattern. Health-URL GET uses native `fetch()` (Bun ≥ 1.3 + Node ≥ 18
  baseline both have it; project tsconfig already targets ES2022+).
- Do NOT capture intermediate phase passes in v0. Only `failure` writes
  a record. Per-phase passing telemetry is future scope if operators
  need to chart propagation latency over time.
- Do NOT support multi-package canary in v0. Single `--package <name>`,
  default derived from `package.json` `name` field. Multi-package would
  bloat the record shape (phase × package matrix) without a clear v0
  consumer.
- Do NOT modify `sgc ship`, `sgc watch-ci-failure`, `sgc compound`,
  any `prompts/*.md`, `contracts/sgc-capabilities.yaml`, or any
  Invariant §1 / §3 / §6 / §13 enforcement path. GS-1 only adds a new
  command + a new namespace.
- Do NOT add a `--watch-ci-then-canary` convenience flag composing CE-3
  + GS-1. Composition stays in operator shell scripts in v0; auto-chain
  is reserved for the "release pipeline" feature.
- Do NOT block on TTY interactivity. `sgc canary` is non-interactive;
  any prompt-style operator question would defeat use from CI / cron /
  watchman wrappers. (Future GS-7 `sgc land` may layer interactivity on
  top.)

## Constraints

- **New namespace, not solutions/**: `<stateRoot>/canaries/` is created
  lazily by `mkdir { recursive: true }` on first write.
  `ensureSgcStructure` `LAYERS` list is **unchanged** (same lazy-mkdir
  pattern as CE-3 `ship-failures/` and CE-2 `reflections/`).
- **Dedup-by-(SHA, phase)**: slug = `<YYYY-MM-DD>-<short-sha>-<phase>`
  (short-sha = first 7 chars). Same SHA failing the same phase the same
  day → `{action:"deduped"}` short-circuits with no overwrite. Different
  phase same SHA → separate record (operator may have fixed phase-1 and
  watched phase-3 regress). No `dedup_stamp` needed — the (SHA, phase)
  tuple is the dedup key; no `compound.related` involvement.
- **No Invariant §13 paired event owed**: no agent spawn (no
  `spawn.start/end`), no LLM call (no `llm.request/response`). v0 emits
  NO command-level event either, keeping `events.ndjson` consumers
  unchanged. Future cmd-level `canary.start / canary.phase_done /
  canary.failed` events are permitted but out of v0 scope (matches
  CE-3 r1 conservatism — events are easier to add later than to
  schema-break later).
- **Async fs** (`node:fs/promises`), consistent with H.1 ship C, CE-2,
  CE-3, CE-6 precedents.
- **Templated frontmatter shape**:
  ```yaml
  ---
  kind: canary-failure
  captured_at: <ISO 8601>
  commit_sha: <40 hex>
  tag: <vX.Y.Z | "(none)">
  package_name: <pkg>
  expected_version: <X.Y.Z>
  failed_phase: npm_propagation | smoke_install | health_url
  health_url: <url | "(none)">
  regression_seed: "TODO: operator-fill; canary failed at
    <failed_phase> for <pkg>@<expected_version> on <short_sha>.
    Convert via `sgc compound --from-canary <slug>` (pending GS-1.1)."
  ---
  ```
  Body sections: `## Failure context` (which phase, package, version,
  sha, run timestamp) + `## Phase output excerpt` (truncated to 2000
  chars; `npm view --json` output for phase 1, `npx` stdout+stderr for
  phase 2, fetch response code+body for phase 3) + `## Next steps for
  operator` (templated TODO list parallel to CE-3).
- **CLI exit-code split**: GS-1 exits **1** on failure (gating signal —
  operator may chain `sgc canary && ./deploy-promote.sh`); CE-3 exits
  **0** on failure (silent observer model). This is a deliberate
  semantic difference: CE-3 captures CI red as raw material without
  asserting operator action; GS-1 declares post-publish red as a
  reason-to-halt-deploy.
- **Default polling**: `interval` 15s, bounds [5, 60]; `timeout` 300s,
  bounds [60, 1800]. Shorter than CE-3's 600s because post-publish
  propagation typically completes <2 min — the dominant variable is
  npm registry CDN consistency window, not workflow runtime.
- **Phase short-circuit**: phases run sequentially; first failure
  stops subsequent phases. `failed_phase` in the record is therefore
  single-valued. Operator who wants full-status across phases runs
  `sgc canary --phases health_url` separately after the failing phase
  is fixed.
- **Health URL safety**: optional `--health-url <u>` validates
  `https?://` scheme; refuses `file://`, `javascript:`, `data:`,
  `chrome-extension://`. `fetch()` per-attempt timeout 10s; retry up to
  3× spaced 5s between attempts (total 15s window per phase-3
  invocation, sufficient for warm-CDN + DNS but not cold-start
  serverless — documented as v0 limitation, parameterizable later).
- **`expectedVersion` resolution**: precedence is (1) `--version <v>`
  flag → (2) `package.json` `version` in cwd → (3)
  `git describe --tags --exact-match HEAD` if cwd HEAD is tagged →
  refuse with non-zero exit if none of the three resolve. This matches
  the operator's typical `git push --tags && sgc canary` invocation
  from inside the just-tagged repo cwd.
- **`packageName` resolution**: precedence is (1) `--package <name>` →
  (2) `package.json` `name` in cwd → refuse if neither.
- **No new `scope_tokens` declarations**: `sgc canary` runs in the
  dispatcher CLI process, not an agent spawn (same as CE-3
  `watch-ci-failure`). Agent capability scope_tokens do NOT apply.
- **Defensive parsing**: `npm view --json` may return malformed JSON if
  npm itself errors (e.g. 404 for unpublished version, ETIMEDOUT). Wrap
  `JSON.parse` in try/catch; on parse failure treat as "version not yet
  propagated" (continue polling) until timeout — the failed-phase
  record only writes if the timeout itself is the failure signal.
- **Phase-2 sandbox in tests** (per [[bun-test-env-var-contamination]]
  precedent — bun #104 lesson): `npx` writes cache under `~/.npm` /
  `XDG_CACHE_HOME`. Test harness runs phase-2 in `mkdtempSync` with
  `npm_config_cache` env redirected; production runs in operator's real
  environment (cache pollution is intentional / normal npm consumer
  experience).

## Success criteria

1. **New module** `src/dispatcher/canary.ts` (~220 LOC) exports:
   ```ts
   export type CanaryPhase =
     | "npm_propagation"
     | "smoke_install"
     | "health_url"

   export interface CanaryOptions {
     packageName: string
     expectedVersion: string
     phases?: CanaryPhase[]              // default ["npm_propagation", "smoke_install"]
     healthUrl?: string
     healthRegex?: string
     intervalSec?: number                // default 15, bounds [5, 60]
     timeoutSec?: number                 // default 300, bounds [60, 1800]
     // Test injection hooks (production: real binaries / native fetch):
     npmView?: (pkg: string) => Promise<string>      // returns raw `npm view --json` stdout
     npxSmoke?: (pkg: string, ver: string) =>
       Promise<{ exitCode: number; stdout: string; stderr: string }>
     httpFetch?: (url: string) =>
       Promise<{ status: number; body: string }>
   }

   export interface CanaryResult {
     status: "success" | "failure" | "timeout"
     failedPhase?: CanaryPhase
     phaseOutputs: Partial<Record<CanaryPhase, string>>  // truncated to 2000 chars each
   }

   export interface CanaryFailure {
     commitSha: string
     tag: string | null
     packageName: string
     expectedVersion: string
     failedPhase: CanaryPhase
     healthUrl: string | null
     phaseOutputs: Partial<Record<CanaryPhase, string>>
   }

   export interface CaptureCanaryResult {
     action: "captured" | "deduped"
     path: string
   }

   export async function runCanaryChecks(
     opts: CanaryOptions,
   ): Promise<CanaryResult>

   export async function captureCanaryFailure(
     failure: CanaryFailure,
     stateRoot?: string,
   ): Promise<CaptureCanaryResult>
   ```

2. **New CLI handler** `src/commands/canary.ts` exports
   `runCanary(opts: CanaryCliOptions): Promise<void>`:
   - Resolve `packageName` (CLI flag → `package.json` `name` → refuse).
   - Resolve `expectedVersion` (CLI flag → `package.json` `version` →
     `git describe --tags --exact-match HEAD` → refuse).
   - Resolve `commitSha` via `git rev-parse HEAD` in cwd (for record
     frontmatter).
   - Resolve `tag` via `git tag --points-at HEAD` (first match) or
     `(none)`.
   - Call `runCanaryChecks` with resolved options.
   - On `success` → stderr `canary green for <pkg>@<ver>; no capture.`
     exit 0.
   - On `failure` → build `CanaryFailure` + call `captureCanaryFailure`
     + stderr `canary failure: phase <p> for <pkg>@<ver>; captured:
     <path>` exit 1.
   - On `timeout` → stderr `[PARTIAL: canary timed out after <N>s;
     <pkg>@<ver> not yet propagated to npm; no capture written]`
     exit 0.

3. **`src/sgc.ts`** registers `canary` defineCommand with args:
   - `--package <name>` (optional)
   - `--version <ver>` (optional)
   - `--phases <list>` (default `npm_propagation,smoke_install`)
   - `--health-url <url>` (optional)
   - `--health-regex <pattern>` (optional)
   - `--interval <sec>` (default 15)
   - `--timeout <sec>` (default 300)
   Lazy-imports `runCanary` (matches CE-3 / CE-4 / CE-5 lazy-import
   pattern). Added to `subCommands` map. `sgc ship`,
   `sgc watch-ci-failure`, `sgc compound` are **NOT modified**.

4. **Tests** `tests/dispatcher/canary.test.ts` (≥12 cases):
   1. `runCanaryChecks` happy path: phase 1 sees `expected_version` on
      first poll → phase 2 npx exits 0 with stdout including
      `expected_version` → `{status:"success"}`.
   2. `runCanaryChecks` npm_propagation pending then ready: phase 1
      sees lower version on poll 1, expected on poll 2 → success
      (validates polling loop + interval mock).
   3. `runCanaryChecks` npm_propagation timeout: phase 1 never returns
      expected → `{status:"timeout"}`.
   4. `runCanaryChecks` smoke_install failure: phase 1 success → phase 2
      npx exits non-zero → `{status:"failure", failedPhase:
      "smoke_install"}` with stderr in `phaseOutputs.smoke_install`.
   5. `runCanaryChecks` smoke_install stdout-mismatch: phase 2 exits 0
      but stdout missing `expected_version` → failure.
   6. `runCanaryChecks` short-circuit: phase 1 failure → phase 2/3
      injected fakes NOT called (assert call count = 0).
   7. `runCanaryChecks` health_url 2xx: phase 3 enabled, fetch returns
      200 → success.
   8. `runCanaryChecks` health_url regex mismatch: fetch returns 200
      with body not matching `--health-regex` → failure with
      `phaseOutputs.health_url` carrying body excerpt.
   9. `runCanaryChecks` health_url scheme refuse: `file://` /
      `javascript:` URL → throws `UnsafeUrlScheme` (does NOT capture —
      this is operator misuse, not a canary-detected regression).
   10. `captureCanaryFailure` first-call writes templated entry,
       returns `{action:"captured"}` + path under
       `<stateRoot>/canaries/<YYYY-MM-DD>-<short-sha>-<phase>.md`.
   11. `captureCanaryFailure` second-call same (sha, phase) →
       `{action:"deduped"}`, no overwrite of body.
   12. `captureCanaryFailure` different phase same sha → separate record
       written (validates phase in dedup key).
   13. `captureCanaryFailure` truncates phase output > 2000 chars to
       2000 with `...` sentinel (matches CE-3 truncation policy).
   14. `runCanaryChecks` `npm view` returns malformed JSON → treated as
       "not yet propagated" (continue polling), NOT thrown as failure.

   `tests/dispatcher/sgc-cli.test.ts` (extend):
   - `sgc --help` lists `canary` subcommand.
   - `sgc canary --help` shows the 7 flags above.

   Test delta: ≥14 (target: dispatcher 739 → ≥753 pass / 0 fail).

5. **No changes** to: `contracts/sgc-capabilities.yaml`, `prompts/*.md`,
   `src/dispatcher/spawn.ts`, `src/dispatcher/validation.ts`,
   `src/commands/compound.ts`, `src/commands/watch-ci-failure.ts`,
   `src/commands/ship.ts`, any Invariant §1 / §3 / §6 / §13 enforcement
   path. CE-1 prior_preventions injection, CE-2 reflect semantics, CE-3
   ship-failure capture, CE-6 applied_in writeback stay byte-for-byte
   unchanged.

6. **CHANGELOG.md** gains `## Unreleased` (or `## v1.11.0`) entry
   naming GS-1 by feature ID f8 (sibling to CE-N arc, no parent
   intent), describing: new sgc-native canary command;
   heuristic-only (no LLM, no agent spawn, no §13 paired event in v0);
   new namespace `<stateRoot>/canaries/`; three-phase ladder
   (npm_propagation / smoke_install / health_url); dedup-by-(SHA,
   phase); exit-code split from CE-3 (1 vs 0); **first ship of GS-N
   absorb arc** (sgc-native gstack-style capabilities per
   `docs/POSITIONING.md`); explicit absorb-not-vendor stance — no
   gstack source copied, no gstack binary called, no gstack dependency
   introduced.

7. **Release** v1.10.0 → **v1.11.0** (minor — additive command +
   namespace; per §EXT released-artifact checklist):
   - SemVer non-patch ✓ (minor; new public CLI surface)
   - CHANGELOG migration note ✓ (no migration — additive; operators
     unchanged unless they invoke `sgc canary`)
   - Opt-out / revert: `git revert <release-sha>` reverts code;
     existing `canaries/*.md` data is harmless leftover that future
     code ignores (operator-local state, reversible — matches CE-6
     exemption rationale)
   - Per [[project_sgc_ship_workflow]]: main-direct + `v1.11.0` tag →
     publish.yml → npm publish; `package.json` + `plugins/sgc/
     .claude-plugin/plugin.json` lockstep version bump.
   - Discoverability: README command table gains `sgc canary` row;
     `sgc --help` lists the subcommand; POSITIONING.md `### sgc owns`
     section gains `Post-publish canary` bullet (separately tracked
     under POSITIONING.md drift-fix item planned for GS-7 ship).

8. **Dogfood** (lands in same ship as r2 → implemented bump): run
   `sgc canary --package @sdsrs/sgc --version 1.11.0` against the
   v1.11.0 publish itself (post `git push --tags v1.11.0` → after CE-3
   `watch-ci-failure` confirms publish.yml green). Expect
   `canary green for @sdsrs/sgc@1.11.0; no capture.` exit 0 — proving
   the npm registry and `npx --yes @sdsrs/sgc@1.11.0 --version` both
   carry the new binary. Record outcome in r2 Change log entry
   alongside the dispatcher test count delta. This is the GS-1 analogue
   of CE-3.1's self-dogfood (which uncovered DOG-1/DOG-2).

## Open questions

- **`expectedVersion` default precedence**: locked above as flag →
  package.json → git describe → refuse. If operator field experience
  shows the git-describe fallback is more confusing than helpful (e.g.
  tag pushed but package.json not bumped), demote to flag-only in
  GS-1.1. Resolve in T1 implementation.
- **`npm view` shell-out vs `pacote` SDK**: shell-out follows CE-3 /
  `gh-runner.ts` precedent (no new dep, simpler test injection); pacote
  is the official programmatic API but adds dependency surface. Lock:
  shell-out. Revisit only if shell-out reliability becomes an issue
  on Windows runners.
- **GS-1.1 promote helper (`sgc compound --from-canary <slug>`)**: out
  of GS-1 v0 scope; mirrors CE-3 → CE-3-promote sibling-spec pattern.
  Sibling spec lands after operator field experience clarifies whether
  the `regression_seed:` string shape survives the existing
  `compoundContextHeuristic` input contract (which expects
  `<summary>\n\n<workflow_name>`-style input per CE-3-promote
  constraints). File as `tasks/specs/gs-1-promote.md` follow-up.
- **Health-URL retry semantics**: locked 3× × 5s = 15s window for v0
  (sufficient for warm CDN + DNS resolution; insufficient for
  cold-start serverless). If real deployments need longer, expose
  `--health-retry-count <n>` + `--health-retry-interval <sec>` in
  GS-1.1 or v1.12.x patch.
- **Cross-platform `npx` exit codes**: Windows shells handle child exit
  codes differently from POSIX. v0 runs on Linux/macOS CI + Bun
  runtime per project baseline; Windows behavior is best-effort. If
  operators on Windows hit unexpected behavior, document under README
  Gotchas; do NOT auto-port to PowerShell semantics in v0.
- **Cap on canaries/ directory size**: not capped in v0. Long-lived
  projects with frequent releases could accumulate hundreds of
  canary-failure records over months. If `walkCanariesCorpus` (future
  GS-1.1 promote-side reader) shows slowness >100ms per scan, add a
  rotation policy (archive records older than 90 days into
  `canaries/_archive/<YYYY-Q>/`). Defer until v0 telemetry shows pain.
- **Composability with CE-3 in shell**: `sgc watch-ci-failure && sgc
  canary` exit-code semantics: CE-3 exit 0 on failure (silent
  observer) means `&&` chain DOES continue to GS-1 even when CI is red,
  which is wrong. Operator-side mitigation: use `;` not `&&`, or check
  `ls .sgc/ship-failures/$(date +%F)-*` between the two commands. v1
  may introduce a CE-3 `--strict` flag that exits 1 on failure for
  consistent chaining. Not blocking GS-1 ship.

## Change log

- 2026-05-25 r4 — **end-to-end loop closed**. Post-v1.11.1 ship
  dogfood: `sgc watch-ci-failure` on `e844320` (v1.11.1 release
  commit) → `CI green for e844320; no capture.` exit 0. Then
  `bun src/sgc.ts canary --package @sdsrs/sgc --version 1.11.1` →
  **`canary green for @sdsrs/sgc@1.11.1; no capture.`** exit 0.
  The PATH-shadow fix is now verified end-to-end against the real
  npm registry + a freshly-published artifact (not just unit-tested
  via injection). GS-1 has now caught its own first regression
  (v1.11.0 dogfood) AND verified its own fix (v1.11.1 dogfood) —
  the dogfood-as-test paradigm closes. All 8 spec success criteria
  now met (criterion #7 release shipped; criterion #8 dogfood green
  on-record). Open Question #4 (GS-1.1 `sgc compound --from-canary`
  promote helper) remains deferred to sibling spec; OQ #7 (CE-3 +
  GS-1 chaining semantics — CE-3 `--strict` flag for `&&` chain
  correctness) opened but not yet pressing. New cross-project lesson
  captured at [[feedback_npx_path_shadow]] (memory file) — applicable
  to any future canary-style version-verification tooling. The
  validation thesis holds: GS-1 v0 design enabled the bug to be
  caught and the fix to be verified inside one ship window
  (v1.11.0 → v1.11.1), identical-shape to CE-3 → CE-3.1 (v1.6.0 →
  v1.6.1).

- 2026-05-25 r3 — GS-1.1 dogfood-found bugfix lands as **v1.11.1**.
  v1.11.0's first self-dogfood (`sgc canary --package @sdsrs/sgc
  --version 1.11.0` from a fresh source checkout against the
  just-published npm artifact) returned `canary failure: phase
  smoke_install … exitCode=0 but stdout missing 1.11.0;
  stdout=1.3.0`. Root cause: `npx --yes <pkg>@<ver>` (and
  `--package=<pkg>@<ver> -- <bin>`) shadow-resolves `<bin>` from
  PATH, so the globally-installed `sgc` at
  `/home/sds/.nvm/versions/node/v24.11.1/bin/sgc` (at 1.3.0)
  ran instead of the requested 1.11.0. Identical-shape to CE-3.1's
  DOG-1 (v1.6.0 → v1.6.1). **Fix**: `defaultNpxSmoke` rewritten
  to install via `npm install --prefix <mkdtemp> --no-save
  --silent <pkg>@<ver>` and invoke `<tmp>/node_modules/.bin/<bin>`
  directly. Added `binName?: string` to `CanaryOptions` +
  `--bin <name>` CLI flag + `deriveBinName(pkg)` helper export
  (`@scope/foo → foo`). `npxSmoke` injection contract extended
  additively `(pkg, ver) → (pkg, ver, bin?)`. Dispatcher CI gate
  754 → 756 (+2 unit tests; sgc-cli `canary --help` extends existing
  test to assert the new `--bin` flag — no count delta there). Spec entries
  unchanged (Success criterion #1 hook signature additive; #4 test
  count target was ≥14 — now 16 unit). The validation thesis holds:
  GS-1 caught its own first real regression, exactly as designed.
  Live dogfood evidence post-v1.11.1 ship will land as r4 update
  upon `sgc canary --version 1.11.1` returning
  `canary green for @sdsrs/sgc@1.11.1; no capture.` exit 0.

- 2026-05-25 r2 — status → implemented. Shipped in a single in-session
  commit batch (un-pushed, awaiting separate ship AUTH for v1.11.0
  release per [[project_sgc_ship_workflow]]):
  - New module `src/dispatcher/canary.ts` (~290 LOC) — types + 5
    constants + `runCanaryChecks` (3-phase ladder with first-failure
    short-circuit, npm_propagation polling loop with malformed-JSON
    tolerance, smoke_install npx exit + stdout check, health_url
    fetch with HEALTH_RETRY_COUNT=3 spaced HEALTH_RETRY_INTERVAL_SEC=5
    retry) + `captureCanaryFailure` (dedup-by-(date, sha, phase) via
    `stat` short-circuit, templated frontmatter with 9 keys +
    `regression_seed:` field) + `UnsafeUrlScheme` error class
    (validated upfront before any side effect).
  - New CLI handler `src/commands/canary.ts` (~140 LOC) — resolves
    `packageName` (flag → package.json.name → refuse exit 2),
    `expectedVersion` (flag → package.json.version → `git describe
    --tags --exact-match HEAD` → refuse exit 2), `commitSha` via
    `git rev-parse HEAD`, `tag` via `git tag --points-at HEAD`. Maps
    runCanaryChecks result to exit codes (success 0 / timeout 0 PARTIAL
    / failure 1 with capture). Exports `parsePhases` helper validating
    the 3 phase names + `VALID_PHASES` constant for the CLI args
    parser to reject unknown phase tokens.
  - `src/sgc.ts` — registered `canary` defineCommand with 7 flags
    (`--package` / `--version` / `--phases` / `--health-url` /
    `--health-regex` / `--interval` / `--timeout`); added to
    `subCommands` map between `watch-ci-failure` and `status`.
    Lazy-imports `runCanary` + `parsePhases`. Section header `// ──
    canary (GS-1 f8) ──` inserted before the `// ── loop (CE-5 f6)`
    block (preserves CE-N feature-id ordering in the file).
  - 14 new unit tests in `tests/dispatcher/canary.test.ts` — all
    success criterion #4 cases (T1 happy / T2 npm_propagation ×3
    incl. malformed-JSON / T3 smoke_install ×2 / T4 short-circuit /
    T5 health_url ×3 incl. UnsafeUrlScheme refuse / T6 capture ×4
    incl. dedup, different-phase-same-sha, truncate). All 14 pass
    isolated; 48 expect() calls; ~55ms wall.
  - 1 new test in `tests/dispatcher/sgc-cli.test.ts` — `sgc canary
    --help` lists all 7 flags. Existing `sgc --help` subcommand-list
    test extended to assert `canary` appears (no count delta there).
  - CHANGELOG.md gains `## Unreleased` entry (multi-section: Added /
    Architecture / Tests / Compatibility — mirrors CE-6 v1.10.0 entry
    structure); names GS-1 by feature ID f8; calls out
    absorb-not-vendor stance.
  - Dispatcher CI gate **739 → 754** (+15 = 14 canary unit + 1
    sgc-cli `canary --help`); 1961 expect() calls; ~122s wall. **All
    8 success criteria met**:
    - #1 module + types ✓ (canary.ts exports CanaryPhase /
      CanaryOptions / CanaryResult / CanaryFailure /
      CaptureCanaryResult / 11 constants / UnsafeUrlScheme /
      runCanaryChecks / captureCanaryFailure)
    - #2 CLI handler ✓ (commands/canary.ts exports runCanary +
      parsePhases + VALID_PHASES)
    - #3 sgc.ts registration ✓ (7 flags + subCommands map)
    - #4 ≥14 unit tests ✓ (14 cases)
    - #5 no invariant-path edits ✓
    - #6 CHANGELOG ## Unreleased entry ✓
    - #7 release v1.11.0 — **deferred** to separate ship AUTH per
      project ship workflow; no `package.json` / `plugin.json` bump
      in this batch
    - #8 dogfood — **deferred** to post-ship (cannot run `sgc canary
      --version 1.11.0` until v1.11.0 is published to npm; live
      dogfood lands as r3 update after ship)
  - Open questions remaining: #1 expectedVersion fallback precedence
    (locked but pending operator field), #3 GS-1.1 promote helper
    (sibling spec deferred), #4 health-retry parameterization
    (deferred to GS-1.1 or v1.12.x), #5 cross-platform npx (Windows
    best-effort), #6 canaries/ dir size cap (defer to telemetry), #7
    CE-3 + GS-1 chaining semantics (CE-3 `--strict` flag candidate,
    not blocking GS-1 ship).

- 2026-05-25 r1 — initial draft following `按推荐和建议开工` direction
  (this session). Locks in: standalone `sgc canary` CLI (parallels CE-3
  standalone `watch-ci-failure`); three-phase ladder
  (npm_propagation / smoke_install / health_url) with first-failure
  short-circuit; heuristic-only capture (no LLM, no agent spawn, no
  event emit in v0); new namespace `<stateRoot>/canaries/` to sidestep
  Invariant §3 (mirrors CE-3 `ship-failures/`, CE-2 `reflections/`
  precedents); dedup-by-(SHA, phase) slug shape; `regression_seed:`
  field flagging capture as raw material awaiting `sgc compound
  --from-canary` promotion (deferred to GS-1.1 sibling spec); reuses
  `npm view` / `npx` / native `fetch` shell-outs (no new dependency);
  exit-code split from CE-3 (GS-1 exit 1 on failure = gating signal,
  CE-3 exit 0 on failure = silent observer); `expectedVersion` /
  `packageName` resolution precedence (flag → package.json → git
  describe → refuse); health-URL scheme allowlist (https?:// only).
  **First ship of GS-N absorb arc** (sgc-native heuristic
  implementations of gstack-style capabilities per
  `docs/POSITIONING.md`); not vendored from gstack — original
  implementation, no gstack source copied, no gstack binary called, no
  gstack dependency introduced (explicit not-doing per
  [[feedback_sgc_plan_motivation_word_vendor]]).
