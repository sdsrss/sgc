# Changelog

## v1.15.0 — 2026-05-27 — GS-4 sgc debug systematic-debugging phase-walker

**GS-4 (feature f11, sibling to CE-N + GS-1 + GS-2 + GS-7, no parent intent).**
Fifth ship of the **GS-N absorb arc**: 4-phase debug orchestrator
absorbed from sp:systematic-debugging + CLAUDE.md §6 Iron Law #3
intent. Heuristic-only sgc-native walker over a single-file
investigation state.

### Added — `sgc debug`

- **`sgc debug start "<symptom>"`** opens a new
  `.sgc/investigations/<YYYY-MM-DD>-<HHMM>-<kebab>.md` and
  auto-walks the three read-only phases (investigate / analyze /
  hypothesize), pausing at implement. Heuristic readers reuse CE-1
  `walkSolutionsCorpus` (prior preventions), events.ndjson tail
  (three-strike signature recurrence), ship-failures/ + canaries/
  scan (historical signature match).
- **`sgc debug close --id <id> --root-cause "<text>" --fix-commit <sha>
  --verify-command "<cmd>"`** is the Iron Law #3 hard-gate:
  refuses unless all 3 flags non-empty + fix-commit matches
  `/^[0-9a-f]{7,40}$/`. Already-closed and missing-file paths refuse
  with named stderr.
- **`sgc debug --runs`** lists investigations sorted started_at desc.
- **`sgc debug --status <id>`** stdout-passthroughs the investigation file.

### Events

Four voluntary `debug.*` event types appended to `events.ndjson`
(additive under existing `${string}.${string}` template literal,
schema_version stays 1): `debug.start` / `debug.phase_complete` /
`debug.heuristic_failed` / `debug.closed`.

### Changed

- **POSITIONING.md** refreshed: GS-N arc paragraph extended to mention
  GS-4 ship; one new delegate-table row for `sgc debug`; `### sgc owns`
  gains Root-cause debug bullet.

### Tests

- Dispatcher CI gate **833 → 872** pass (+39; spec target was +20,
  beats by 95%). 39 new in `debug.test.ts` covering id-derivation +
  4 heuristic readers + render + atomic write + runDebugStart (happy
  + empty-corpus + collision + resilience) + runDebugClose (3-flag
  gate + SHA shape + already-closed + missing-file refusals) +
  runDebugList + runDebugStatus + 2 sgc-cli help-surface. 0 fail.
  Eval-tier failures pre-existing LLM-API-dependent flakes,
  unrelated.

### Invariants

- No impact. No schema bump. `debug.*` event_types additive under
  existing `${string}.${string}` template literal. No Tier 1 paired
  events owed (no agent spawn). No Tier 2 owed (no LLM call). §1 / §3
  / §4 / §6 / §13 enforcement paths untouched.

### No migration required

Additive command + new `.sgc/investigations/` namespace; operators
not invoking `sgc debug` are unaffected. CE-1 / CE-2 / CE-3 / CE-4 /
CE-5 / CE-6 / GS-1 / GS-1.1 / GS-1.2 / GS-2 / GS-7 byte-for-byte
unchanged.

## v1.14.1 — 2026-05-27 — GS-7 DOG-3 dogfood-found bugfix (T11 regex)

**GS-7 follow-on bugfix** discovered via self-dogfood: v1.14.0 publish.yml
failed the `Run dispatcher tests (gate publish)` step because T11's
`sgc --help lists land subcommand` regex was too tight. The pattern
`/land\s+.*watch-ci-failure.*canary/i` passes locally where citty renders
the command name as bare-word `land    Post-publish ...` but fails under
GitHub Actions where consola CI-mode wraps the command in literal
backticks: `` `land`    Post-publish ... ``. The regex's `\s+` anchor
matches the bare-word form but not the backtick. v1.14.0 never landed
on npm (publish gated on test-pass); no consumer-facing version skew.

### Fixed

- `tests/dispatcher/sgc-cli.test.ts:264` — replaced the tight regex with
  three separate `toContain` assertions ("Post-publish ship chain" +
  "watch-ci-failure" + "canary"). Format-agnostic; still catches "land
  never rendered." Reproduced locally with `CI=1` env before fix
  (`SGC_FORCE_INLINE=1 CI=1 bun test ...`).

### Dogfood lesson

5th dogfood-as-test win in the GS-N arc (CE-3.1 → GS-1.1 → GS-1.2 → GS-2
clean → GS-7 DOG-3). Paradigm validated again: the failure surfaced
**after** local test green (833/0) and **after** push+tag, when v1.14.0's
own CI ran. `sgc watch-ci-failure` captured `c7ccce2` at
`.sgc/ship-failures/2026-05-27-c7ccce2.md` exactly as designed.

### No migration required

Test-only fix; no production-code change, no schema change, no behavior
change. Dispatcher CI gate stays at 833 pass / 0 fail.

## v1.14.0 — 2026-05-27 — GS-7 sgc land post-publish ship chain

**GS-7 (feature f10, sibling to CE-N + GS-1 + GS-2, no parent intent).**
Fourth ship of the **GS-N absorb arc**: post-publish ship chain
orchestrator. Single command chains `sgc watch-ci-failure` (CE-3) +
`sgc canary` (GS-1) with fail-fast on either.

### Added — `sgc land`

- **`sgc land`** post-publish ship chain orchestrator. Single command
  chains `sgc watch-ci-failure` (CE-3) + `sgc canary` (GS-1) with
  fail-fast on either. Default reads package + version from cwd-nearest
  `package.json`; per-flag override via `--package` / `--version`.
- **Stateless** (no `land-runs/` namespace) — emits 3 voluntary events
  (`land.start` / `land.complete` / `land.failed`) to `events.ndjson`
  for telemetry. Underlying CE-3 / GS-1 capture artifacts
  (`.sgc/ship-failures/<slug>.md` / `.sgc/canaries/<slug>.md`) remain
  the operator-actionable failure anchors.

### Changed

- **POSITIONING.md** refreshed: GS-N arc paragraph extended to mention
  GS-1.1 / GS-1.2 / GS-2 / GS-7 ships (previously listed only GS-1.0 /
  GS-1.1). One new delegate-table row for `sgc land`.

### Tests

- Dispatcher CI gate **815 → 833** pass (+18, beats plan target of +12
  by 50%): 16 `land.test.ts` (deriveLandInputs / defaultStepRunners /
  happy path / watch-capture / canary-capture / runner-throw /
  arg-error) + 2 sgc-cli help-surface. 0 fail. Eval-tier 3 fails
  pre-existing LLM-API-dependent flakes, unrelated.

### Invariants

- No impact. No schema bump. `land.start` / `land.complete` /
  `land.failed` event_types are additive under existing
  `${string}.${string}` template literal.

### No migration required

Additive command; operators not invoking `sgc land` are unaffected.
CE-1 / CE-2 / CE-3 / CE-4 / CE-5 / CE-6 / GS-1 / GS-1.1 / GS-1.2 / GS-2
byte-for-byte unchanged.

## v1.13.0 — 2026-05-26 — GS-2 sgc handoff session-state checkpoint

**GS-2 (feature f9, sibling to CE-N + GS-1, no parent intent).** Third
ship of the **GS-N absorb arc**: sgc-native heuristic implementations of
selected gstack-style capabilities per `docs/POSITIONING.md`. Absorbs
`gs:/context-save` + `gs:/context-restore` intent into a sgc-protocol-
aware checkpoint that survives `/clear`, `/exit`, and context-window
compaction (CLAUDE.md §11 SESSION post-compaction recovery).

### Added — `sgc handoff --auto` + `sgc handoff --print <slug>`

- `sgc handoff --auto` scans `.sgc/` state across **6 namespaces**
  (`decisions/`, `plan-jobs/`, `loop-runs/`, `ship-failures/`,
  `canaries/`, `progress/events.ndjson`) + `git status` + recent
  commits, then writes a structured `tasks/<slug>-paused.md` markdown
  checkpoint **outside `.sgc/`**.
- Iron Law #2 verify command derived via **3-tier priority cascade**:
  1. `loop-runs/<id>.md status:paused` → `sgc loop --resume <id>`
  2. `plan-jobs/<id>.md status:running` (pid alive per existing lazy
     stale-detect in `listJobs()`) → `sgc plan --status <id>`
  3. `progress/events.ndjson` tail unclosed `spawn.start` →
     `sgc tail --since <ts>` (operator inspects)
  4. Fallback when no signal: `verify_command: "TODO: operator-fill"`
     (string sentinel parallel to CE-3 `prevention_seed:` and GS-1
     `regression_seed:` conventions).
- `sgc handoff --print <slug>` reads back the existing paused.md to
  stdout (exit 0 found / exit 1 missing).
- Slug derivation: `<YYYY-MM-DD>-<kebab(title)[:40]>` from mtime-newest
  `.sgc/decisions/<id>/intent.md` `title` field; trailing `-` trimmed
  post-truncation. Fallback `<YYYY-MM-DD>-<HHMM>-handoff` when no
  parseable intent.

### Constraints (heuristic-only, zero new dependency)

- **No LLM call**, no agent spawn, **no Invariant §13 paired event** in
  v0 (matches CE-3 r1 + GS-1 r1 conservatism). No event written either.
- **No new `.sgc/` namespace** — paused.md lives at project repo root
  `tasks/<slug>-paused.md`, alongside the existing `tasks/specs/`. No
  Invariant §3 / §6 entanglement; tasks/ default-tracked in git for
  cross-machine carryover (operator opts out via `.gitignore` if pure-
  local).
- **Atomic overwrite** semantics: re-running `--auto` replaces existing
  paused.md via temp-file + rename (POSIX-atomic), no dedup gate.
- **Complementary** (not competing) with `claude-mem-lite`'s
  `<session-handoff>` SessionStart hook (different consumer: agent-
  context vs operator-read). Zero hook surface added by GS-2.
- **Defensive per-section parsing**: each sub-gather independently
  try/catch wrapped. Failing one section returns safe empty value
  (empty array / `undefined` / placeholder string); never aborts the
  whole snapshot. Pattern mirrors CE-1 `walkSolutionsCorpus` defensive
  parseFrontmatter precedent.

### Tests

- New `tests/dispatcher/handoff.test.ts` (42 unit tests across kebab/
  slug derivation, verify-command cascade priorities, all 7 sub-gathers,
  orchestrator integration, render determinism, atomic write, CLI exit
  codes).
- `tests/dispatcher/sgc-cli.test.ts` +2 help integration tests (verifies
  `sgc --help` lists `handoff` + `sgc handoff --help` shows
  `--auto`/`--print`).
- Dispatcher CI gate **773 → 815** (+42; target was +20). Full suite
  2820 expect() calls; ~122s wall via `SGC_FORCE_INLINE=1 bun test
  tests/dispatcher/`. Eval-tier tests (`tests/eval/*-llm.test.ts`)
  remain CI-skip when no `ANTHROPIC_API_KEY` / `OPENROUTER_API_KEY` set
  (unchanged from v1.12.1 baseline).

### No migration required

Additive command; operators not invoking `sgc handoff` are unaffected.
No changes to `contracts/sgc-capabilities.yaml`, `prompts/*.md`,
`src/dispatcher/spawn.ts`, `src/dispatcher/validation.ts`,
`src/commands/plan.ts`, `src/commands/work.ts`, `src/commands/ship.ts`,
`src/commands/compound.ts`, `src/commands/canary.ts`,
`src/commands/loop.ts`, `src/commands/reflect.ts`,
`src/commands/watch-ci-failure.ts`, or any Invariant §1 / §3 / §6 / §13
enforcement path. CE-1 / CE-2 / CE-3 / CE-4 / CE-5 / CE-6 / GS-1 /
GS-1.1 / GS-1.2 byte-for-byte unchanged.

### Modules added

- `src/dispatcher/handoff.ts` (~620 LOC with types + 7 sub-gathers +
  orchestrator + cascade + render + atomic write + `defaultGitProbe`).
- `src/commands/handoff.ts` (~74 LOC CLI wrapper).
- `src/sgc.ts` extended with `handoff` defineCommand registration +
  `subCommands` map entry (lazy-import pattern matching CE-3 / CE-4 /
  CE-5 / GS-1 precedent).

### Discoverability

- `sgc --help` now lists `handoff` subcommand between `canary` and
  `status`.
- `sgc handoff --help` documents `--auto` + `--print` flags.
- POSITIONING.md update (new "Session-state checkpoint" bullet in
  `### sgc owns`) deferred to GS-7 ship per prior session roadmap.

### Invariant §4 orthogonality (clarification)

`sgc handoff --auto` is an **L0 read-only tool command** — its `--auto`
flag is the auto-discover-slug-and-state shorthand, NOT the L3
auto-confirm flag that Invariant §4 forbids. §4 binds `runPlan` /
`runShip` when task level is L3; `runHandoff` is not in that
enforcement path. Documented explicitly in spec Constraints to avoid
future reviewer false-positive.

## v1.12.1 — 2026-05-25 — GS-1.2 dispatcher dedup robustness (GS-1.1 live-dogfood DOG-2)

### Fixed (`tokenize`/`similarity` crash on legacy minimal-frontmatter solutions)

- **GS-1.1 live promote dogfood caught a dispatcher robustness gap.** Running `sgc compound --from-canary 2026-05-25-c29f021-smoke_install` (the v1.11.0 PATH-shadow capture, after operator edited `regression_seed:`) against this repo's own `.sgc/solutions/` corpus (3 existing entries) crashed: `ERROR  undefined is not an object (evaluating 'text.normalize')` at `tokenize` → `similarity` → `findBestMatch` → `compoundRelatedHeuristic` → `promoteCanaryFailure`. Root cause: 2 of the 3 legacy solution files (`runtime/review-specialist-fanout-append-only-2026-04-26.md` + `runtime/review-strip-prior-art-back-channel-2026-04-29.md` from pre-CE-1 phases) have minimal frontmatter (`intent:` + `category:` only) — missing `signature` / `tags` / `problem` / `solution` / `prevention`. When `findBestMatch` iterates, `tokenize(existing.problem)` receives `undefined` and crashes at `.normalize()`. TypeScript declared `problem: string` but runtime data violated the type. **NOT GS-1.1-specific** — the same crash hits `runCompound` + `runCompoundPromote` against this corpus; the gap had escaped detection because no `compound` run had iterated those entries since they were authored.
- **Identical-shape to CE-3.1 (v1.6.1) and GS-1.1 (v1.11.1) dogfood pattern**: the new tool catches a real bug on first use against real-world state. Validates the dogfood-as-test paradigm a third time.

### Changed (defensive guards in `src/dispatcher/dedup.ts`)

- `tokenize(text)`: coerce non-string input to empty `Set` before `text.normalize("NFC")`. Inline comment cites the live-dogfood reproducer.
- `similarity()`: coerce `candidate.tags` and `existing.tags` to `[]` before `new Set()` (symmetric defensive shape for the other TypeScript-declared-as-`string[]`-but-runtime-may-be-`undefined` field).
- Behavior on malformed entries: similarity degrades to "no overlap" (score 0) rather than throwing. signature-match path still returns 1.0 even when other fields malformed. Pipeline stays operational; legacy entries get scored deterministically as non-matches and surface in `related_entries:` as scored-0 refs (harmless).

### Tests

- 8 new unit tests in new `tests/dispatcher/dedup.test.ts`: `tokenize` (undefined / null / empty string → empty Set + well-formed input no behavior regression) / `similarity` (existing.problem undefined / candidate.problem undefined → no throw; signature match still wins over malformed shape) / `findBestMatch` (mixed-quality corpus iterates without throwing).
- Dispatcher CI gate **765 → 773** (+8). 2017 expect() calls; ~122s wall.

### Live dogfood verification post-fix

```
$ sgc compound --from-canary 2026-05-25-c29f021-smoke_install
promote: action=new_entry solution=.../solutions/other/canary-c29f021-smoke_install.md canary=.../.sgc/canaries/2026-05-25-c29f021-smoke_install.md
[exit=0]
```

Solution landed at `.sgc/solutions/other/canary-c29f021-smoke_install.md` with `prevention:` = operator-edited `regression_seed:` verbatim (the npx PATH-shadow safeguard from [[feedback_npx_path_shadow]] memory). Canary file gained `promoted_to: other/canary-c29f021-smoke_install`. `related_entries:` lists all 3 existing solutions (legacy entries safely scored 0 via the new dedup guard). **GS-1 → GS-1-promote → CE-1 hand-off verified end-to-end against real data** — `extractPreventions` on the next L3 `sgc plan` for category `other` will discover this prevention and feed it into `planner.adversarial`.

### Compatibility

- Patch release — no API change, no schema change, no migration. Existing operator state unchanged. Pure defensive hardening of an already-public function contract (TypeScript types were correct; the fix protects against runtime data that violates the type).

## v1.12.0 — 2026-05-25 — GS-1.1 promote helper `sgc compound --from-canary <slug>` (closes GS-1 OQ #4)

### Added (GS-1.1: canary-failure → solutions/ promote bridge)

- **You can now promote captured canary failures into the knowledge corpus**, exactly like CE-3 ship-failures. New flag `sgc compound --from-canary <slug>` converts a `.sgc/canaries/<slug>.md` record (after the operator edits its `regression_seed:` frontmatter into the actual safeguard) into a finished `solutions/<category>/<slug>.md` entry through the **same Invariant §3 write-gate** that `runCompound` and `runCompoundPromote` (CE-3 promote) use. Heuristic-only — no LLM call, no new agent; the existing `compoundContextHeuristic` derives category/tags/problem, and `compoundRelatedHeuristic` mints the `DedupStamp` that authorizes `writeSolution`. **`compound.related` stays deterministic** per [[feedback_compound_related_invariant3]] — an LLM minting `best_similarity: 0` could bypass the corpus dedup; that contract is unchanged.
- Identical-shape to CE-3-promote: 4 refuse guards (`MissingCanaryFailure` / `PlaceholderRegressionSeed` / `AlreadyPromoted` / `DuplicateMatch`), `--force` bypasses `DuplicateMatch` only (does NOT bypass `AlreadyPromoted`), `promoted_to:` frontmatter mutation is the audit anchor + idempotency guard, `--solution-slug` flag reused for slug override. Operator-edited `regression_seed:` is authoritative (Invariant §1 doesn't apply — operator input, not LLM output).
- **Default solution slug** is `canary-<short-sha>-<phase>` (e.g. `canary-c29f021-smoke_install`), distinguishing GS-1.1 from CE-3-promote's single-key `ship-failure-<short-sha>` shape. Reason: GS-1 capture dedup is by (sha, phase), so two canary records on the same commit at different phases must promote to distinct solution slugs without collision. Regression test T8 (`tests/dispatcher/canary-promote.test.ts`) pins this.
- **Closes GS-1 spec Open Question #4** (promote helper deferred from v1.11.0 ship per sibling-spec pattern, identical to CE-3 → CE-3-promote at v1.6.1 → v1.7.0). Parent spec `tasks/specs/gs-1-canary.md` r5 marks OQ #4 resolved-by-sibling-spec.

### Architecture

- New module `src/dispatcher/canary-promote.ts` (~250 LOC): exports `promoteCanaryFailure(opts)`, `PromoteCanaryOptions` / `PromoteCanaryResult` / `PromoteCanaryErrorCode` / `PromoteCanaryError` types. Fork of `src/dispatcher/compound-promote.ts` (CE-3 promote) with ship-failure → canary-failure shape swaps: `ship-failures/` → `canaries/`, `prevention_seed` → `regression_seed`, `workflow_run_id/url + workflow_name` → `package_name + expected_version + failed_phase + health_url`, `SHIP-FAILURE-<sha>` synthetic task_id → `CANARY-<sha>-<phase>`, slug `ship-failure-<sha>` → `canary-<sha>-<phase>`.
- `src/commands/compound.ts` extended: new exported `runCanaryPromote(opts)` wrapping `promoteCanaryFailure`. `runCompound` + `runCompoundPromote` (CE-3) unchanged. The CLI dispatcher in `src/sgc.ts` adds an `--from-canary <slug>` arg + early-branch routing (checked before `--from-ship-failure` for predictable ordering); absent the flag, existing `runCompound` / `runCompoundPromote` paths are unchanged.
- `--solution-slug` flag description updated to note dual-purpose (works for both `--from-ship-failure` and `--from-canary` paths). No third override flag introduced.
- Heuristic input shape for `compoundContextHeuristic`: `<phase_output_excerpt>\n\n<package_name> <failed_phase>` (mirrors CE-3-promote's `<summary>\n\n<workflow_name>` posture but routes the GS-1 package+phase dimensions into tag candidates). `problem_summary` is the first 400 chars of that input per `compoundContextHeuristic` contract.

### Tests

- 9 new unit tests in `tests/dispatcher/canary-promote.test.ts`: T1 MissingCanaryFailure / T2 PlaceholderRegressionSeed / T3 AlreadyPromoted / T4 DuplicateMatch no-force (asserts no solutions/ write + no canary mutation on refuse path) / T5 happy path (default slug `canary-<sha>-<phase>` + prevention = operator seed + promoted_to: stamped on canary file) / T6 `--force` bypasses DuplicateMatch / T7 `--force` does NOT bypass AlreadyPromoted (orthogonal guard) / T8 phase-disambiguation regression (same SHA two different phases → two distinct solution slugs, both succeed, distinct prevention fields preserved) / T9 PromoteCanaryError shape sanity (Error subclass with readonly .code).
- 1 extended test in `tests/dispatcher/sgc-cli.test.ts`: `compound --help` listing now asserts `--from-canary` alongside existing `--from-ship-failure` / `--solution-slug` / `--force`.
- Dispatcher CI gate **756 → 765** (+9 = 9 canary-promote unit tests; sgc-cli extension doesn't add a test count). 1999 expect() calls; ~122s wall.

### Compatibility

- Additive command flag — `--from-canary` is optional on the existing `compound` command; absent it, behavior is unchanged. Operators see no breakage unless they invoke the new flag.
- `compound-promote.ts` (CE-3-promote module) is **byte-for-byte unchanged**. `canary.ts` (GS-1 capture) is **byte-for-byte unchanged**. Invariant §1 / §3 / §6 / §13 enforcement paths untouched. No `prompts/*.md`, `contracts/sgc-capabilities.yaml`, agent manifest, or `spawn.ts` / `validation.ts` edits.
- Reverting via `git revert <release-sha>` leaves any `promoted_to:` data in `.sgc/canaries/*.md` behind harmlessly (operator-local state, reversible — matches CE-3-promote release exemption rationale).
- **Closes the GS-1 → GS-1-promote → CE-1 hand-off**: promoted canary solutions' `prevention:` field becomes discoverable by `extractPreventions` on the next L3 `sgc plan`, feeding `planner.adversarial` as a prior-prevention. Identical-shape closure to CE-3 → CE-3-promote → CE-1 (which closed CE loop end-to-end at v1.7.0).

## v1.11.1 — 2026-05-25 — GS-1.1 dogfood-found bugfix (DOG-1: PATH-shadowed npx)

### Fixed (smoke_install PATH shadow — caught by own first dogfood)

- **GS-1 v1.11.0's self-dogfood caught its own bug.** Running `sgc canary --package @sdsrs/sgc --version 1.11.0` against the freshly-published v1.11.0 returned `canary failure: phase smoke_install … exitCode=0 but stdout missing 1.11.0; stdout=1.3.0`. Root cause: `npx --yes <pkg>@<ver>` (AND the `--package=<pkg>@<ver> -- <bin>` form) silently shadow-resolves `<bin>` from PATH first, bypassing the requested `@version` — when a globally-installed `sgc` (here at 1.3.0 via `/home/sds/.nvm/.../bin/sgc`) is on PATH, both npx forms run that binary instead of fetching v1.11.0 from the registry. This is identical-shape to CE-3.1's DOG-1 fix (v1.6.0 → v1.6.1): the new tool catches its own first regression on first use. **Fix**: `defaultNpxSmoke` rewritten to install into an isolated `mkdtemp` prefix via `npm install --prefix <tmp> --no-save --silent <pkg>@<ver>` and then invoke `<tmp>/node_modules/.bin/<bin>` directly — bypassing PATH lookup entirely.

### Added

- New `binName?: string` field on `CanaryOptions` and `CanaryCliOptions` (CLI flag `--bin <name>`). Defaults to the package name's last segment via `deriveBinName(pkg)` helper (`@sdsrs/sgc` → `sgc`; bare `npm` → `npm`). Lets operators override when bin name diverges from the unscoped package basename.
- New export `deriveBinName(pkg: string): string` from `src/dispatcher/canary.ts` so the CLI handler can derive defaults without re-implementing the rule.

### Changed

- `defaultNpxSmoke` no longer calls `npx`. Renames intentionally avoided — field stays `npxSmoke` on `CanaryOptions` for back-compat with the v1.11.0 test-injection contract (added a comment noting the field name lags the implementation).
- `npxSmoke` injection signature extended additively: `(pkg, ver) → ...` is now `(pkg, ver, bin?) → ...`. Existing v1.11.0 test mocks that ignore the third arg continue to work; new tests can capture it.
- `runCanaryChecks` propagates `opts.binName` as the third argument when calling `npxSmoke` (was previously absent — fix wires it through).

### Tests

- 2 new unit tests in `tests/dispatcher/canary.test.ts`: (a) binName pass-through from `runCanaryChecks` → `npxSmoke` injection (DOG regression); (b) `deriveBinName` covers `@scope/foo → foo` + bare-name identity for 4 cases.
- `tests/dispatcher/sgc-cli.test.ts` `canary --help` expanded 7 → 8 flags (adds `--bin`).
- Dispatcher CI gate 754 → 756 (+2 unit tests; sgc-cli `canary --help` extends existing test to assert the new `--bin` flag — no test-count delta there).

### Compatibility

- API additive — `binName` is optional everywhere; `npxSmoke` 3rd arg is optional. v1.11.0 consumers see no breakage.
- `npm install` (per-smoke-invocation) adds ~5-10s wall to phase-2 vs the broken v1.11.0 `npx` form (which was instant but wrong). Accepted: correctness > speed on a once-per-release path.
- Spec `tasks/specs/gs-1-canary.md` change log adds r3 entry documenting the dogfood-found bug + fix.

## v1.11.0 — 2026-05-25 — GS-1 `sgc canary` post-publish health check (first ship of GS-N absorb arc)

### Added (GS-1: `sgc canary` heuristic post-publish check)

- **You can now catch the "CI green ≠ npm propagated ≠ binary works" gap.** GS-1 (f8, sibling to the CE-N arc, no parent intent) adds a standalone CLI `sgc canary` that runs up to three sequential phases against a just-released package: (1) `npm_propagation` — poll `npm view <pkg> dist-tags.latest --json` until the value equals `<expected_version>` or timeout; (2) `smoke_install` — `npx --yes <pkg>@<expected_version> --version` and assert exit 0 + stdout includes the version; (3) `health_url` (optional, when `--health-url <u>` is set) — `fetch(u)` with retry (3× spaced 5s), assert 2xx + optional body regex via `--health-regex`. First-failure short-circuits subsequent phases. On `success` → stderr `canary green for <pkg>@<ver>; no capture.` exit 0. On `failure` → templated record at `.sgc/canaries/<YYYY-MM-DD>-<short-sha>-<phase>.md` with `regression_seed: TODO …`, stderr `canary failure: …` exit 1. On `timeout` → `[PARTIAL: …]` exit 0. This is the post-CI complement to CE-3 `sgc watch-ci-failure`: CE-3 watches publish.yml turn green; GS-1 watches the actual artifact reach npm and execute. The v1.6.0 publish CI was green but the just-published binary mis-defaulted `--workflow` and was unusable until CE-3.1 (v1.6.1) — that's exactly the gap GS-1 closes.
- **First ship of the GS-N absorb arc.** sgc-native heuristic implementation of `gs:/canary` intent per `docs/POSITIONING.md`. **Not vendored from gstack** — no gstack source copied, no gstack binary called, no gstack dependency introduced (explicit not-doing per `feedback_sgc_plan_motivation_word_vendor.md`). Operator workflow: `git push --tags && sgc watch-ci-failure && sgc canary`.

### Architecture

- New module `src/dispatcher/canary.ts` (~290 LOC): `runCanaryChecks(opts)` runs the phase ladder with first-failure short-circuit; `captureCanaryFailure(failure, stateRoot)` writes the templated record. Test hooks `npmView` / `npxSmoke` / `httpFetch` / `now` / `sleep` are injectable; production uses `Bun.spawn(["npm", "view", …])` / `Bun.spawn(["npx", "--yes", …])` / native `fetch()` / `Date.now` / `setTimeout`. URL safety: `isSafeUrl` rejects non-`https?://` schemes; `UnsafeUrlScheme` error class thrown BEFORE any side effect.
- New CLI handler `src/commands/canary.ts` (~140 LOC): resolves `packageName` (flag → `package.json` `name` → refuse), `expectedVersion` (flag → `package.json` `version` → `git describe --tags --exact-match HEAD` → refuse), `commitSha` via `git rev-parse HEAD`, `tag` via `git tag --points-at HEAD`. Exposes `parsePhases(csv)` helper validating the 3 phase names.
- `src/sgc.ts`: registers `canary` defineCommand with 7 flags (`--package` / `--version` / `--phases` / `--health-url` / `--health-regex` / `--interval` / `--timeout`); added to `subCommands` map after `watch-ci-failure`. Lazy-imports `runCanary` (matches CE-3 / CE-4 / CE-5 pattern).
- **New namespace, not solutions/**: `.sgc/canaries/` is created lazily via `mkdir { recursive: true }` on first write (mirrors CE-3 `ship-failures/` and CE-2 `reflections/` precedents that sidestep Invariant §3 dedup-stamp requirement). Dedup key = `(short-sha, phase)` tuple in the slug; same SHA failing different phases writes separate records.
- **No event emission in v0**: no `spawn.start/end`, no `llm.request/response`. Future `canary.start / canary.phase_done / canary.failed` events are permitted but out of v0 scope (matches CE-3 r1 conservatism — events are easier to add later than to schema-break later).
- **Exit-code split from CE-3**: GS-1 exits 1 on `failure` (gating signal — operator may chain `sgc canary && ./deploy-promote.sh`); CE-3 exits 0 on `failure` (silent observer). Deliberate: CE-3 captures CI red as raw material without asserting operator action; GS-1 declares post-publish red as a reason-to-halt-deploy.
- **Defensive parsing**: malformed `npm view` JSON is treated as "not yet propagated" (continue polling), NOT thrown as failure — matches CE-3 `watchPublishWorkflow` malformed-JSON handling. Only the timeout itself signals failure on the propagation phase.

### Tests

- 14 new unit tests in `tests/dispatcher/canary.test.ts`: happy path (T1) / npm_propagation pending→ready + timeout + malformed-JSON (T2 ×3) / smoke_install exit-non-zero + stdout-mismatch (T3 ×2) / phase short-circuit (T4) / health_url 2xx + regex-mismatch + UnsafeUrlScheme refuse (T5 ×3) / capture happy + dedup + different-phase-same-sha + truncate-> 2000 (T6 ×4).
- 1 new test in `tests/dispatcher/sgc-cli.test.ts`: `sgc canary --help` lists all 7 flags. `sgc --help` listing extended to assert `canary` appears (no test count delta — extends existing helpers test).
- Dispatcher CI gate **739 → 754** (+15 = 14 canary unit + 1 sgc-cli help-listing). 1961 expect() calls; ~122s wall.

### Compatibility

- Additive command + additive namespace — no migration. Operators unchanged unless they invoke `sgc canary`. Reverting via `git revert <release-sha>` leaves any `.sgc/canaries/*.md` data behind harmlessly (operator-local state, reversible).
- No `contracts/sgc-capabilities.yaml`, `prompts/*.md`, `src/dispatcher/spawn.ts`, `src/dispatcher/validation.ts`, `src/commands/compound.ts`, `src/commands/watch-ci-failure.ts`, `src/commands/ship.ts`, or any Invariant §1 / §3 / §6 / §13 enforcement path is touched.
- **Deferred to GS-1.1** (sibling spec, mirrors CE-3 → CE-3-promote pattern): `sgc compound --from-canary <slug>` promotion helper; `--health-retry-count` + `--health-retry-interval` flags; multi-package canary.

## v1.10.0 — 2026-05-25 — CE-6 applied_in 评分回流 (P3.CE-6 — original 6-item compound list 6/6 closed)

### Added (CE-6: applied_in score feedback loop)

- **You can now see which lessons actually fired.** CE-6 (f7, sibling to CE-4/CE-5 outside parent intent `94913CB45F9D4C3E906B3C2C8E`) adds an optional `applied_in: TaskId[]` field to every solution's frontmatter. Each time `planner.adversarial` flags a recurrence at L3 plan time (CE-1 step 5), the consuming `task_id` is appended back to the source `solutions/<cat>/<slug>.md`. Score = `applied_in.length`. `sgc reflect` surfaces the count per candidate as `(overlap: M, applied: N)`. This closes the score-feedback half of the CE compound-engineering loop: CE-1 forward-injects preventions into the planner; CE-2 audits decisions against the corpus; CE-6 now writes the actually-surfaced applications back to each lesson — so a lesson that has saved you N times tells you so on its own face. **Original 6-item compound list from prompt P#699 is now 6/6 shipped.**

### Architecture

- New module `src/dispatcher/applied-tracker.ts` (186 LOC): `extractAppliedSolutionRefs(failure_modes, prior_preventions)` substring-matches refs out of `early_signal` strings; `recordApplied(stateRoot, refs, task_id)` does per-file read-merge-write with mtime-CAS retry (max 1) and emits `plan.applied_recorded` / `plan.applied_failed` events.
- Plan.ts L3 branch wires the call after `planner.adversarial` returns, BEFORE writeIntent. Wrapped in try/catch — writeback failure NEVER aborts plan. Activation gate: `capturedPriorPreventions.length > 0 AND adversarialOut.failure_modes.length > 0`. `capturedPriorPreventions` is hoisted to outer scope because `priorPreventions` is captured inside the parallel-task IIFE.
- `sgc reflect` stdout gains `applied: N` annotation per candidate; `--json` adds `applied_count: number` to each `ReflectCandidate`. Read off the existing scan, no extra fs traffic.
- New event types (additive to events.ndjson schema, template-literal typed): `plan.applied_recorded` (success path) / `plan.applied_failed` (per-ref failure, payload `{solution_ref, reason, error_message}`) / `plan.applied_wire_failed` (outer wire-up throw, payload `{error_class, error_message, reason: "wire_up_throw"}`). Per-ref and wire-up failures use distinct event types so `sgc tail` consumers can filter on either without payload-shape surprises.
- New `RecordAppliedResult` shape has 6 buckets: `updated / skipped_already_applied / skipped_missing / skipped_malformed / stale_skipped / write_failed`. `write_failed` is reserved for `writeAtomic` throws (disk full, EPERM); `skipped_malformed` is reserved for ref-shape and frontmatter-parse failures — buckets do not overlap.
- New test seam: `PlanOptions.adversarialOverride?: PlannerAdversarialOutput` lets integration tests pin deterministic adversarial output. Production path unchanged when undefined.

### Invariant §3 carve-out (metadata-only)

`recordApplied` writes to `solutions/*.md` **without going through `writeSolution()`** (which is Invariant §3 write-gated by `dedup_stamp`). Rationale: §3 binds *solution-content* mutations (intent / prevention / what_didnt_work / source_task_ids / times_referenced) to keep dedup-stamp deterministic per `feedback_compound_related_invariant3.md`. CE-6 mutates ONLY the new `applied_in` audit-trail field — not part of the dedup signature. Regression test `tests/dispatcher/applied-tracker.test.ts` H8 (`recordApplied — Invariant §3 metadata-only carve-out (CRITICAL)`) enforces that no solution-content field ever changes through `recordApplied`.

### Tests

- 15 new unit tests in `tests/dispatcher/applied-tracker.test.ts` (extract: E1–E7 / record happy: H1 / idempotent: H2–H3 / errors: H4–H7 / content-preservation: H8 / mtime+sequential: H9–H10).
- 2 new integration tests in `tests/dispatcher/plan-ce6-integration.test.ts` (CE6-W1: applied_in lands on disk when adversarial early_signal refs a prior_prevention via `adversarialOverride` test hook; CE6-W2: plan tolerates absent solutions/ corpus). beforeEach saves+restores `SGC_FORCE_INLINE` env to prevent cross-file env-var contamination.
- 2 new integration tests in `tests/dispatcher/reflect.test.ts` (CE6-R1: stdout shows `applied: N`; CE6-R2: applied_count: 0 when field absent).
- Dispatcher CI gate 718 → 739 (+21 = 15 unit + 2 plan + 2 reflect + 2 bun-counts-describe-wrappers).

### Compatibility

- Schema is **additive-optional** — existing `solutions/*.md` files without `applied_in:` are valid (treated as empty array). No migration. Reverting via `git revert <release-sha>` leaves data behind harmlessly; future code without the field-aware code path ignores it.

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
