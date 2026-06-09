# Changelog

## v1.31.8 — 2026-06-09 — dogfood hardening: state-root env, classifier security gap, LLM planner resilience, CLI/render fixes

Three more dogfood passes (rounds 11–13) drove the tool through its full
lifecycle as a real user would — including real-LLM mode (OpenRouter) and the
Playwright `--browse` real-browser QA — and surfaced a cluster of defects. The
headline is a recurring **state-root-bypass class**: four commands resolved
their `.sgc/` location by inlining `join(cwd, ".sgc")` instead of the
centralized `resolveStateRoot`, silently ignoring `SGC_STATE_ROOT`.

### What changed

- **`SGC_STATE_ROOT` is now honored by every command.** `handoff`, `qa`
  (real-browser screenshot dir), `debug` (5 sites), and `land` each resolved
  state by inlining `join(cwd|repoRoot, ".sgc")` / `?? process.cwd()`, so with
  `SGC_STATE_ROOT` pointed elsewhere they read/wrote the wrong project's `.sgc/`
  — e.g. `handoff` leaked an unrelated repo's active task, and `qa --browse`
  dropped screenshots into a non-gitignored `<cwd>/reviews/`. All now route
  through `resolveStateRoot` (the `--repo-root` test seam is preserved).
- **The classifier no longer under-classifies security work.** The L2 keyword
  set covered `auth`/`payment`/`token`/`session` but missed common phrasings, so
  "add rate limiting to the login endpoint" fell through to L1 and skipped the
  independent review + QA gate. A `SECURITY_KEYWORDS` set (login / password /
  credential / oauth / sso / 2fa / csrf / xss / injection / rate-limit / …) now
  escalates these to at least L2; the strong-L0 short-circuit still wins, so a
  genuine "fix the login-page typo" stays L0.
- **A single planner's malformed YAML no longer aborts the whole plan.** In
  real LLM mode, when `planner.eng`/`planner.ceo` returned YAML the parser
  couldn't load, `Promise.all` rejected and the entire plan died (losing the
  classification and every other planner's work). `researcher.history` already
  degraded gracefully; `eng`/`ceo` now do too — a failed planner yields a
  `revise` verdict + a concern + a `planner.spawn_failed` event, and the plan
  completes.
- **`--level` and the task argument are validated.** `sgc plan --level BOGUS`
  used to write an out-of-range level into `intent.md` (corrupting every gate
  that keys off it); it's now rejected, and `validateIntent` enforces the level
  enum at the write boundary. `sgc plan "   "` (whitespace-only) is rejected
  like the empty string.
- **`sgc tail --since` validates its value.** A non-date like `--since
  yesterday` used to silently filter every event out (lexical compare); it now
  errors clearly and normalizes valid inputs to canonical ISO.
- **The motivation ≥20-word check runs before the planner cluster**, so an
  under-length `--motivation` fails fast instead of burning planner spawns
  (real LLM tokens) only to be rejected at the write boundary.
- **`sgc qa` no longer counts prose flow labels as failures.** Named `--flows`
  (e.g. `load,checkout`) are recorded as notes for surfacing; a clean pass used
  to print "N failed flow(s)" and write a bogus "Step 'note' failed" finding.
  Notes are now excluded from the count and the persisted findings.
- **Prior-art lines no longer dangle a colon.** Frontmatter-only solutions have
  an empty heuristic excerpt, which rendered `**ref** (score 0.89): `; the
  trailing `: ` is now omitted when there's no excerpt.
- **`sgc metrics` reports the real bundle size in source mode.** It measured
  `import.meta.url`, which is the bundle when shipped but the ~9 KB source file
  under `bun src/sgc.ts` — it now resolves the committed bundle (~921 KB).

## v1.31.7 — 2026-06-08 — schema validation on progress/ writes (Invariant §7 gap)

A ninth and tenth dogfood pass probed the scope-token boundary (§1/§8/§9 —
verified sound, no functional bug) and the schema-validation boundary (§7),
which had a real gap.

### What changed

- **The `progress/` state docs are now validated on write, like every other
  `.sgc/` doc.** `decisions/`, `reviews/`, and `solutions/` writes already
  rejected a malformed object before it hit disk, but `current-task.md`,
  `feature-list.md`, and `handoff.md` were written with no required-field check —
  a malformed in-memory object produced a file that only failed (cryptically) at
  read time. They now reject a missing required field at write with a clear
  `current-task missing required field: <name>` (current-task: task_id / level /
  session_start / last_activity — `active_feature` stays optional, cleared when
  all features are done; feature-list: each feature's id / title / status;
  handoff: from_session / to_session_hint / summary / open_questions).
- **Comment fix**: the §1 output-leak comment now correctly says
  `validateOutputShape` *rejects* (not "filters") undeclared fields (§9).

## v1.31.6 — 2026-06-08 — claude-cli mode retries transient rate-limit / overload

An eighth dogfood pass walked the LLM-mode paths (anthropic-sdk / claude-cli /
openrouter) for error recovery, retry, and signal interruption. One real gap
fixed; the signal-drain registry and the status-based retry path verified sound.

### What changed

- **`claude-cli` mode now retries a transient rate-limit or overload.** The
  retry classifier treated an error as transient by its numeric HTTP `.status`
  (408/409/429/5xx) or a timeout message. anthropic-sdk and openrouter carry
  `.status`, so their rate-limits (429) and overloads (529/5xx) already retried —
  but `claude-cli` surfaces these as `is_error` / non-zero-exit / stderr *text*
  and carries `.exitCode`, never `.status`, so they fell through to a fatal
  no-retry. The classifier now also recognizes the message-only signals
  *overloaded*, *too many requests*, *service unavailable*, *temporarily
  unavailable*, and *rate-limited*. Fixed-window usage caps (*usage limit*,
  *quota exceeded*) deliberately stay fatal — retrying them only burns the
  backoff. Only the no-`.status` path changed; anthropic-sdk / openrouter
  behavior is unchanged.

## v1.31.5 — 2026-06-08 — dedup no longer writes duplicates for untagged solutions

A seventh dogfood pass deep-dived the compound knowledge loop
(`reflect` / `compound` / dedup). One real defect fixed; the threshold logic,
applied/surfaced counting, and reflect audit verified correct.

### What changed

- **Two solutions about the same bug no longer escape dedup just because they
  are untagged.** The compound write path stores `["untagged"]` when no tags
  were produced, but the dedup *candidate* carried the raw (empty) tags, so
  `similarity` compared `[]` against `["untagged"]`, scored the tag component
  `0`, and halved the score — dragging genuine near-duplicates below the dedup
  threshold and writing a polluting second solution (`related=0`). `similarity`
  now strips the `"untagged"` placeholder from both sides, so an untagged pair
  compares on its problem text alone (the same near-duplicate now links as
  `related`, and merges via `update_existing` when the problem text is close
  enough). The 0.85 dedup threshold and its boundary handling are unchanged.

## v1.31.4 — 2026-06-08 — state-layer hardening (concurrent-write lock · clearer corrupt-file errors)

A sixth dogfood pass stress-tested the `.sgc/` state layer's concurrency and
crash recovery. Two real defects fixed; the rest (the file lock primitive,
`writeAtomic`, every directory walk) verified robust.

### What changed

- **Concurrent `sgc work --add` / `--done` no longer silently loses features.**
  Each mutating path is a read-modify-write of the feature list, and while
  `writeAtomic` makes each individual write atomic, the surrounding
  read→append→write is not: firing several `sgc work --add` in parallel left
  only the last writer's feature (the others' appends were clobbered). The
  mutating paths now serialize through a `withFileLock` around the critical
  section (bounded-retry wait, always released); read-only listing stays
  lock-free. Eight parallel adds now all survive.
- **A corrupt or partially-written state file now names itself and the fix.** A
  truncated `.sgc/progress/current-task.md` (or intent/ship/feature-list/handoff)
  threw a context-free `file missing YAML frontmatter`. The error now includes
  the file path and a recovery hint — `.sgc/` is regenerable runtime state, so
  the fix is usually "delete it and re-run, or restore the file".

## v1.31.3 — 2026-06-08 — loop adopts an active task (discover→plan→loop no longer dead-ends)

A fifth dogfood pass walked the full `discover → plan → loop` chain and found a
dead-end trap, fixed with regression tests.

### What changed

- **`sgc loop` adopts an already-planned task instead of dead-ending.** If you
  ran `sgc plan X` manually (or a prior loop attempt planned) and then
  `sgc loop X`, the loop's plan step called `runPlan`, which refuses with
  "active task in handoff", so the loop marked plan *failed* and told you to
  `sgc loop --resume` — but resume retried the plan step, hit the same refusal,
  and failed again, forever. The plan step now **adopts** the active task
  (logging `loop: adopting active task <id>`) and proceeds to the work gate.
  Only the active-task refusal is intercepted; other plan failures still
  propagate.
- **The loop concurrency guard now blocks *any* in-flight run, not just a
  same-task one.** Previously a fresh loop for a different task while one was
  paused slipped past the guard and (with adoption) would have run under the
  wrong task. A different-task loop is now refused with guidance to resume or
  abandon the in-flight run first; a completed/shipped loop still lets a new
  loop plan fresh.

## v1.31.2 — 2026-06-08 — dogfood fixes (tail spawn id · watch-ci-failure/land fast-fail)

A fourth dogfood pass over `plan` / `status` / `tail` / `agent-loop` / `land` /
`watch-ci-failure` found three real defects, all fixed with verification. No
behavior-contract changes.

### What changed

- **`sgc tail` shows the spawn's ULID, not a fragment of the agent name.** The
  spawn column rendered `spawn_id.slice(-12)`, but `spawn_id` is
  `<ULID>-<agent>`, so the last 12 chars were the *tail of the agent name*
  (e.g. "sifier.level") — redundant with the agent column and reading like
  corruption. It now shows the ULID head (`split("-")[0]`), the unique
  discriminator that pairs a `spawn.start` with its `spawn.end`.
- **`sgc watch-ci-failure` no longer hangs silently on a local-only repo.** With
  no git remote there is no CI run to discover, so the poll loop ran silently to
  its full timeout (default 600s). It now fails fast with an actionable message
  (`--run-id` still attaches directly), and prints a starting
  `watching <workflow> for <sha>…polling up to Ns` line so the wait is expected,
  not a perceived hang.
- **`sgc land` no longer hangs silently on a local-only repo.** `land`'s
  watch-CI step called the poll primitive directly, bypassing the above guard;
  it now applies the same no-remote fast-fail.

## v1.31.1 — 2026-06-08 — dogfood fixes (cso ENOLOCK clarity · debug --runs alignment)

A third dogfood pass over `compound` / `reflect` / `debug` / `canary` / `cso` /
`handoff` found two real defects, both fixed with regression tests. No
behavior-contract changes.

### What changed

- **`sgc cso` no longer silently skips the dependency audit on a missing
  lockfile.** In a repo with no committed lockfile, `npm audit --json` returns
  *valid JSON* — an error envelope `{"error":{"code":"ENOLOCK",…}}` — which the
  vulnerability-count parsers correctly reject, so cso reported "npm audit
  returned non-JSON or unparseable output; dep audit skipped" and a security
  review quietly ran without ever auditing dependencies. cso now recognizes the
  error envelope and surfaces the actionable cause: *"dep audit could not run:
  npm reported ENOLOCK (…) — create a lockfile (`npm i --package-lock-only`)
  and re-run `sgc cso`"*.
- **`sgc debug --runs` columns no longer collide.** The ID column was a fixed
  38-wide pad, but investigation ids (`YYYY-MM-DD-HHMM-<slug>`) run ~46 chars,
  so the STATUS column abutted the id with no separator. The table now sizes the
  ID and STATUS columns to the widest row (ids stay full-width so they remain
  copy-pasteable for `--id`).

## v1.31.0 — 2026-06-08 — QA/ship gate integrity (honest verdicts · loop qa gate)

A second end-to-end dogfood pass — this time over the review → qa → ship →
loop chain — found a cluster of gate-integrity defects: the QA gate could be
satisfied by a *failed* QA, and the `loop` orchestrator's own auto-QA produced
an immutable failing report that then made loop-driven L2/L3 tasks
unshippable. All fixed, each with regression tests.

### What changed

- **`sgc ship` now gates on the QA *verdict*, not just its existence.** The
  L2+ ship gate previously checked only that a `qa.browser` report existed —
  so a `verdict: fail` QA (a real-browser smoke that found console errors, or
  a stub run with no target) silently satisfied the gate. It now mirrors the
  code-review fail-gate (Invariant §5): a failed QA blocks ship unless an
  override with reason ≥40 chars is recorded.
- **`sgc qa` reflects its verdict in the exit code.** A `verdict: fail` QA now
  exits 1 (consistent with `review` / `cso` / `doctor`), so `sgc qa <url>
  --flows … && sgc ship` and CI gating work. `concern` stays exit 0 (advisory,
  never a rubber stamp).
- **`sgc loop` pauses at QA.** The orchestrator's auto-QA step ran with no
  target → always `verdict: fail`, which the (now-fixed) ship gate blocks, and
  append-only state (Invariant §6) prevented re-running QA with a real target —
  leaving loop-driven L2/L3 tasks unshippable. `qa` is now a manual gate
  alongside `work` and `ship`: the loop pauses so the operator runs `sgc qa
  <url> --flows …` against a real target, then `--resume` reuses that report.
  Flow is now `plan → [pause work] → review → [pause qa] → [pause ship] →
  compound`. (Automation scorecard accordingly: 5/9 automated stages, 4 human
  gates.)
- **L0 tasks no longer point you at a command that crashes.** L0 is fast-path
  and writes no `intent.md`, but `sgc work` (all features done) printed
  "Run `sgc review`" for every level — and `sgc review` hard-required
  `intent.md`, crashing with a cryptic `intent.md not found`. The completion
  message is now level-aware, and `sgc review` refuses an L0 task with a clear
  explanation (review/qa/ship are L2+ gates).
- **Clearer empty-target QA error.** `sgc qa --target <url>` silently failed
  ("target_url is empty") because `target` is a positional argument, not a
  `--target` flag. The error now says so: pass the URL positionally
  (`sgc qa <url> --flows <a,b>`).

## v1.30.0 — 2026-06-08 — CLI UX hardening (clean errors · auto-gitignore · ergonomic gates)

End-to-end dogfood pass over the full `sgc` CLI surfaced four real
user-facing issues — all fixed, each with regression tests. No breaking
changes; existing flags and flows are unchanged.

### What changed

- **Errors no longer dump an internal stack trace.** citty's `runMain`
  rendered every thrown `Error` as a full V8 stack trace — printed *twice* —
  so an expected, user-actionable failure (`active task in handoff — pass
  --force-new-task`, an LLM provider 403, the verification close-gate) read
  like an internal crash. The entrypoint now routes `--help`/`--version`
  through citty unchanged but runs commands itself, surfacing a single clean
  `error: <message>` line on stderr (unknown/missing commands still print
  usage). Set **`SGC_DEBUG=1`** to restore the full stack for diagnosis.
- **`.sgc/` is now auto-gitignored.** The README has always described `.sgc/`
  as runtime state (not source), but nothing enforced it — a fresh
  `git add -A` would commit `decisions/`, the event stream, and agent
  prompts, and `sgc review` would then flag sgc's own internal TODO markers.
  `ensureSgcStructure` now appends `.sgc/` to the repo-root `.gitignore`
  (idempotent; only for the implicit default location at a git repo root —
  a custom `SGC_STATE_ROOT` stays the operator's responsibility).
- **`sgc debug close` infers `--id`** when exactly one investigation is
  `in_progress`, mirroring `sgc work --done` (which it documents itself as
  mirroring). Ambiguous cases (0 or >1 open) still require an explicit `--id`.
- **`sgc handoff` (bare) now runs the checkpoint**, matching the documented
  `sgc handoff [--auto]` (`--auto` optional). `--print <slug>` remains the
  explicit read mode.

### Tests

- +9 regression tests (`sgc-cli.test.ts`: clean-error / `SGC_DEBUG` /
  auto-gitignore incl. `SGC_STATE_ROOT` isolation; `debug.test.ts`:
  sole-in-progress inference) and 1 handoff test repurposed to assert
  bare == checkpoint. Dispatcher suite 1151 → 1160 pass, 0 fail.

## v1.29.4 — 2026-06-08 — audit P2-3/P2-5: lifecycle automation metric + heuristic↔LLM schema parity

Closes the last two audit items (`docs/COMPREHENSIVE-AUDIT-v1.29.1.md` §6) —
all P0/P1/P2 findings are now resolved. No breaking changes.

### What changed

- **P2-5 — automation metric measures the lifecycle, not loop slots.**
  `computeAutomation` no longer counts only the 6 loop steps (a near-constant
  that missed the CE knowledge arc the audit flagged). It now spans the full
  plan → ship → compound → reuse lifecycle (6 loop stages + capture / promote /
  reuse), counting the **compound-promote human gate** (the operator hand-fills
  `prevention_seed`) alongside work + ship. Scorecard now reads **6/9 automated
  lifecycle stages (3 human gates: work, ship, compound-promote)**. Label,
  `metrics-baseline.yaml`, and `sgc doctor` check (K) are all synced.
- **P2-3 — heuristic ↔ LLM schema-parity test (deterministic).** Semantic
  agreement between the two modes is inherently non-deterministic, but schema
  agreement is not: for four decision-critical LLM-backed agents
  (`classifier.level`, `planner.ceo`, `planner.eng`, `reviewer.correctness`)
  the heuristic output must pass the SAME `validateOutputShape` gate the LLM
  output passes — so the modes are schema-aligned by construction. A heuristic
  that drops / renames / mistypes a declared field now trips a test with no
  live model.

### Validation

- 1220 pass / 38 skip / 0 fail (103 files); `tsc` clean; `sgc doctor` 64 OK
  source / 0 fail (bundle parity + metrics baseline in sync).

## v1.29.3 — 2026-06-08 — audit P2 batch: parse recovery, cache invalidation, honest async level, TTHW

Second fix-dominant release from the v1.29.1 audit
(`docs/COMPREHENSIVE-AUDIT-v1.29.1.md` §6/§7.5). No breaking changes.

### What changed

- **P2-2 — OpenRouter parse recovery.** `extractYamlBlock` gains layered
  recovery: explicit ` ```yaml ` fence → generic ` ``` ` fence (the model
  dropped the language tag — the common real failure) → strip stray fence
  lines on an unterminated body. A truncated/mis-fenced response no longer
  hard-fails as unparseable.
- **P2-7 — fingerprint cache invalidation.** `writeSolution` (the sole
  Invariant-§3 corpus-write gate) now clears the leak-check fingerprint cache,
  so an embedded / long-running process that compounds a solution and then
  reviews in the **same** process no longer leak-checks against a stale corpus.
  New exported `invalidateFingerprintCache()` for targeted per-stateRoot
  invalidation. No-op in the CLI (one process per command).
- **P2-8 — honest async plan level.** `runPlan`'s return `level` is now
  optional; the async-parent path (which forks before classification) omits it
  instead of synthesizing a misleading `"L0"`. The sync + async-child paths
  always carry a real classified level.
- **P2-4 — TTHW measurement.** `scripts/measure-tthw.sh` measures
  time-to-hello-world (npm pack → clean install → first command). Measured
  TTHW ≈ 6.0 s (install 5.99 s + first command 0.058 s; Playwright browser
  download skipped — it is opt-in for real QA). Makes the 高效化 claim a real
  number rather than a documented constant.
- **Docs.** Back-annotated `PRODUCTION-READINESS-AUDIT.md` (v1.21.0 P0/P1/P2
  all shipped) and `COMPREHENSIVE-AUDIT-v1.29.1.md` §4.4/§7.5.

### Validation

- 1215 pass / 38 skip / 0 fail (102 files); `tsc` clean; `sgc doctor` 64 OK
  source / 0 fail; bundle parity green.

## v1.29.2 — 2026-06-08 — audit fixes: test determinism, doc honesty, output lint

Fix-dominant release from the v1.29.1 comprehensive audit
(`docs/COMPREHENSIVE-AUDIT-v1.29.1.md`). No breaking changes.

### What changed

- **P0 — `SGC_FORCE_INLINE` now governs the eval LLM gate.** The
  `tests/eval/*-llm.test.ts` skip gate keyed only on API-key presence, so a
  plain `bun test` routed to a live model whenever a key was exported in the
  dev shell — slow, flaky on model drift, and billable; the documented
  determinism switch did not protect it. New `eval-helpers.hasLiveLlmKey()`
  honors `SGC_FORCE_INLINE` / `SGC_USE_FILE_AGENTS`; 9 `*-llm.test.ts` gate
  through it. Repro: `SGC_FORCE_INLINE=1` clarifier eval went 1 fail / 71.8 s
  → 4 skip / 66 ms.
- **P1 — refreshed stale LLM-visible metadata.** `plugins/sgc/CLAUDE.md`'s
  status header had drifted to v1.20.0 and falsely claimed the L2 reviewer
  cluster was "not yet wired" (it has been wired since Phase 2c — `review.ts`
  runs correctness + tests + maintainability + diff-conditional specialists at
  L2+). Header refreshed, command count corrected 19 → 20, honest depth note
  added. New `sgc doctor` check **(L) `statusHeaderFreshness`** warns when the
  header trails `package.json`, preventing recurrence.
- **P1 — honest reviewer-cluster annotation.** `sgc-capabilities.yaml` now
  documents that the derived reviewers (`prompt_path: null`) are heuristic /
  keyword matchers, not LLM-backed; `status: implemented` means
  functional-and-wired. `prompt_path` truthiness stays the LLM-backed signal.
- **P2 — post-spawn banned-vocab lint.** `detectBannedVocab()` + a
  **non-blocking** `output.banned_vocab` warn event surface vacuous hedge
  vocabulary an LLM emitted against its prompt guardrail. It never rejects — a
  false positive must not break a valid plan/review.

### Validation

- 1208 pass / 38 skip / 0 fail (100 files); `tsc` clean; `sgc doctor` 64 OK
  source / 32 OK bundle / 0 fail; bundle parity green. Bundle rebuilt
  (`npm run build:cli`) for the version bump.

## v1.29.1 — 2026-06-04 — remove the legacy vendored browse tree

Cleanup, no functional change. The vendored gstack `browse/` source (now
superseded by the Playwright real-browser runner shipped in v1.29.0) is removed.

### What changed

- **Deleted `plugins/sgc/browse/`** (~100 MB / 85 files, incl. the compiled,
  non-functional `dist/browse` binary) — it was dead weight in the plugin-install
  payload and a cso dependency-audit blind spot (no `package.json`). `/plugin
  install sgc` is now ~100 MB lighter.
- Removed `contracts/vendored-components.yaml` + its bundle import
  (`embedded-data.ts`), the `build:browse` npm script, and the `tsconfig` exclude.
- `sgc doctor`: removed check **F** (vendored-components provenance — no vendored
  components remain); check **E** (npm `files` excludes `plugins/`) and **D**
  (`bun test` scoping) kept, reworded to drop browse-specific rationale. Doctor
  is now 63 checks (was 64).
- Docs (POSITIONING / README / ROADMAP / qa.md / SKILL.md) updated; ROADMAP 2e
  (native parallel-subagents) marked **won't-do** (the only parallelism need —
  the reviewer cluster — already runs via `Promise.all`).

Real-browser QA is unaffected — it runs on Playwright (`--browse` /
`SGC_QA_REAL=1`); `git` history retains the old browse tree if ever needed.

### Tests

Dispatcher gate green; `sgc doctor` 63/0/0; typecheck 0.

## v1.29.0 — 2026-06-04 — real-browser QA runner, wired via Playwright (opt-in)

`sgc qa` can now run a real browser. Opt-in (`--browse` / `SGC_QA_REAL=1`); the
default stays the non-rubber-stamping stub (`concern`), so this is additive — no
default behavior change.

### What changed

- **New `src/dispatcher/agents/playwright-runner.ts`** — `makeBrowseRunner` +
  `launchPlaywrightSession`. On opt-in, `sgc qa` drives a **Playwright Chromium**
  smoke per target: `goto` → console/`pageerror` → screenshot → verdict. nav
  failure / HTTP ≥ 400 → `fail`; console/page errors → `fail`; clean → `pass`;
  Playwright/browser unavailable → `concern` (never false-passes). Path/URL-like
  flows are navigated individually; prose flows are recorded as labels.
  Screenshot is best-effort evidence (one retry; a miss is noted, not counted).
- **`runQa`** builds the runner on opt-in (`opts.browse` / `SGC_QA_REAL=1`);
  default path is unchanged (stub). New **`--browse`** flag on `sgc qa`.
- **Backend = Playwright** (already a dependency, `--external` in the bundle), not
  the vendored `browse` binary — which proved non-functional in-repo (no
  package.json; server needs diff+playwright+bun:sqlite) and is now legacy/unused.
- Docs across POSITIONING / README / ROADMAP / plugin CLAUDE.md / qa.md / SKILL.md
  / browser.md flipped from "deferred" to "opt-in (wired via Playwright)".

### Using it

`sgc qa <url> --browse` (or `SGC_QA_REAL=1 sgc qa <url>`). A browser is needed:
`npx playwright install chromium`, or `SGC_QA_BROWSER=chrome` to use system Chrome.

### Tests

Unit `tests/dispatcher/playwright-runner.test.ts` 9/9 (injected fake browser).
Gated real-chromium `tests/eval/qa-browse-real.test.ts` verified 3× (clean→pass,
thrown-error→fail). Full dispatcher gate 1122/0; typecheck 0.

## v1.28.1 — 2026-06-04 — Phase 2d: browse on npm (document the degradation as intended)

Closes the last open roadmap item (`docs/ROADMAP.md` Phase 2d) and brings the
browser-QA framing in line with what actually ships. No capability or contract
change — an honesty pass plus a roadmap-status sync.

### Decision

We deliberately **do not** ship the vendored `browse` binary (~100 MB compiled
gstack) on the npm channel. Bundling it would bloat the ~1.7 MB package ~60× for
a runner that is not yet wired; `sgc doctor` check `E` already keeps `plugins/`
out of the npm `files` allowlist. Wiring `sgc qa` to drive the binary is deferred
on **both** channels — the `SGC_QA_REAL` / `--browse` opt-in named in the source
is reserved (read by no code), and the real path is reachable today only via a
programmatic injected `browseRunner` (a test seam) — so `sgc qa` runs a
non-rubber-stamping stub by default everywhere. For real-browser QA today, use
`gs:/browse` (optional interop). Actually wiring the runner remains future work.

### What changed

- **Honest framing** for `sgc qa` across every user- and LLM-facing surface that
  previously implied real-browser QA is the default/native/standalone behavior:
  `docs/POSITIONING.md` (delegate-table row + a new "Channel reality" paragraph
  under *Vendored components*), `README.md` (command table + architecture note),
  `src/sgc.ts` (qa command description, bundled), `plugins/sgc/CLAUDE.md`,
  `plugins/sgc/commands/qa.md`, `plugins/sgc/skills/qa/SKILL.md`, and the
  `plugins/sgc/agents/qa/browser.md` dispatch prompt. By default `sgc qa` runs a
  stub that returns `concern` (never `pass`), so the L2+ QA gate is never
  silently rubber-stamped.
- **Runtime hint**: the `qa.browser` stub's no-runner message now states that
  real-browser QA is deferred/not yet wired (the `SGC_QA_REAL` / `--browse`
  opt-in is reserved) and points to `gs:/browse`, instead of just "QA skipped".
- **Roadmap sync**: `docs/ROADMAP.md` Status block was stale (only through 2a) —
  now records Phase 1 (runtime) + 2b (v1.26.0) + 2c (v1.27.0) + Phase 3 (v1.28.0)
  + 2d (this release). Phases 0–3 and every Phase-2 item are now complete; only
  optional 2e + cross-cutting debt remain.

### Tests

Dispatcher gate 1113 pass / 0 fail; `qa.browser` stub tests 16/16;
`tests/eval/qa-browser.test.ts` 5/5.

## v1.28.0 — 2026-06-04 — four-化 metrics scorecard (Phase 3)

`sgc metrics` reports the product's four 化 (规范化 / 智能化 / 自动化 / 高效化)
as honest, reproducible numbers computed from git-tracked + compiled artifacts —
the Phase 3 deliverable from `docs/ROADMAP.md`.

### What changed

**New: `sgc metrics` command** (`src/commands/metrics.ts` + `src/dispatcher/metrics.ts`)

- `sgc metrics` — human scorecard; `--json` — machine form; `--write-baseline`
  — regenerate the dev/CI baseline.
- Computed live at runtime from data already inside the bundle (embedded
  contracts via `readContract`, the compiled `STEPS` / `MANUAL_GATES` symbols,
  the bundled `package.json`, and the bundle's own size via `import.meta.url`) —
  no baseline read at runtime, identical across plugin / npm / source layouts.
- The four metrics:
  - **规范化** — `machine_enforced / total invariants` = **12/13** (parses
    `contracts/invariant-enforcement.yaml`; §12 is the lone procedural one).
  - **智能化** — `LLM-invokable / total manifested subagents` = **11/23**, keyed
    on `prompt_path` truthiness (the only honest LLM-backed signal per
    `spawn.ts` ROUTES — `prompt_path: null` reviewers are heuristic stubs).
    Framed as roster **capacity**, not a quality measurement.
  - **自动化** — `automated / total loop steps` = **4/6** (the 2 manual gates,
    `work` + `ship`, are intentionally retained per Invariant §4).
  - **高效化** — **1 install step · node ≥ 18 · ~896 KB bundle**.

**New: anti-drift gate** — `metrics/metrics-baseline.yaml` is a committed dev/CI
drift reference (not embedded, not shipped, not read at runtime). `sgc doctor`
check (K) re-computes from on-disk sources and fails on drift; `bundle_bytes` is
display-only and excluded from the diff to avoid a per-commit tripwire.

**Other**

- `src/dispatcher/loop.ts` now exports `MANUAL_GATES` (for 自动化).
- README + `plugins/sgc/CLAUDE.md` add `/metrics`; the four-化 numbers reference
  the baseline (no hand-maintained figures). `docs/CAPABILITY-ABSORPTION-AUDIT.md`
  §4/§5 corrected (智能化 10 → 11, 高效化 "2 步·bun≥1.3" → "1 步·node≥18").

**Strictly no change to**: `solutions/` access, Invariant §1–§13 enforcement, or
any L0–L3 pipeline behaviour. `sgc metrics` is read-only (no LLM, no spawn, no
events) — a measurement surface, the lone documented CE-loop-closure exception.

## v1.27.0 — 2026-06-03 — native L2 reviewer cluster (Phase 2c)

`sgc review` at L2+ now runs a three-agent correctness+tests+maintainability
cluster plus the diff-conditional domain specialists. Previously the multi-reviewer
path was wired only at L3; L2 tasks received a single `reviewer.correctness` pass.
The gate threshold for the diff-conditional specialists is also lowered from L3-only
to L2+, so a security-keyword or migration diff at L2 now triggers the appropriate
specialist automatically.

### What changed

**New subagents** (both in `src/dispatcher/agents/reviewer-quality.ts`)

- `reviewer.tests` — emits a `concern` (severity `medium`) when the diff changes
  source files but adds no test file (classified from the `+++ b/<path>` headers).
- `reviewer.maintainability` — emits a `concern` (severity `low`, advisory) for
  added lines over 120 chars or carrying a `TODO` / `FIXME` / `@ts-ignore` /
  `@ts-nocheck` / `eslint-disable` / `as any` marker.

Both are heuristic stubs; the LLM path uses the synthesized prompt derived from
the `reviewer.correctness` anchor (`prompt_path: null`, no new prompt files —
same shape as the existing domain specialists). Manifest entries flipped from
`status: slot-only` to `status: implemented`.

**`sgc review` wiring (L2+)**

- `src/commands/review.ts` — `reviewer.correctness` still runs at every review;
  at L2+ the dispatch additionally runs `reviewer.tests` + `reviewer.maintainability`
  (always) plus the diff-conditional specialists (security / migration /
  performance / infra) whose gate is lowered from L3-only to L2+.
- Aggregate verdict remains worst-of across all spawned reviewers (`pass < concern < fail`).
  Note the L2 strictness shift: a source-only diff (no test file) now yields a
  `concern` from `reviewer.tests`.
- Invariant §1 (generator-evaluator separation, reviewers MUST NOT read `solutions/`)
  is preserved: the two new agents receive the same back-channel-stripped intent
  and inherit the `reviewer_base` scope tokens (no `read:solutions`).

**POSITIONING**

- `docs/POSITIONING.md` — "Reviewer cluster" row updated from
  `L3-only → all clusters` to `L2+ → correctness + tests + maintainability + specialists`
  to match the now-true behaviour.

**Strictly no change to**: `solutions/` access paths, Invariant §1–§13 enforcement,
`reviewer.correctness` logic, or L0/L1 review paths.

## v1.26.0 — 2026-06-03 — native deep planning (Phase 2b)

`sgc plan` now authors file-level tasks with bite-sized TDD steps at L2 and L3
(and at L1 with `--deep`), writing a single-source-of-truth feature-list.md and
a derived sp-style markdown doc. The new `planner.decompose` subagent runs after
the planning cluster and consumes eng structural risks, researcher prior-art, and
adversarial failure modes to produce concrete `files` + `steps` per feature.

### What changed

**New: `planner.decompose` subagent (Phase 2b)**

- `src/dispatcher/agents/planner-decompose.ts` — inline stub produces
  file-level tasks; LLM path consumes `structural_risks`, `prior_art`,
  `failure_modes`, and `prior_preventions` from the cluster outputs and
  returns `DecomposeOutput` (`tasks[]` with `files`, `steps`,
  `prior_art_refs`, `depends_on`).
- `prompts/planner-decompose.md` — full prompt embedded in bundle via
  `src/dispatcher/embedded-data.ts`; enforces bite-sized TDD steps (one
  RED-then-GREEN pair each), CE guard-step injection from prior failure modes,
  and `depends_on` ordering.

**Enriched `Feature` type**

- `src/dispatcher/types.ts` — `Feature` gains optional `files: string[]`,
  `steps: Step[]`, `prior_art_refs: string[]`, and `depends_on: string[]`
  fields (Phase 2b addition; backward-compatible, undefined on old records).
- `renderPlanMarkdown` + `writePlanDoc` produce a formatted sp-style doc
  under `docs/superpowers/plans/<date>-<slug>.md` when decompose output is
  present.

**`sgc plan` gating**

- Deep decomposition is **implicit at L2/L3** (always on) and **opt-in at L1**
  via `--deep` flag; never at L0.
- `src/commands/plan.ts` runs `planner.decompose` serially after fusion,
  writes enriched features to feature-list.md (single source of truth), then
  writes the derived plan doc.

**`sgc work` adaptation**

- `src/commands/work.ts` `printList` surfaces `files` count and `steps` count
  for decomposed tasks when present.
- `depends_on` ordering is respected: a feature with unmet deps is surfaced
  as blocked in status output.

**CE reuse-in**

- Prior failure modes from `planner.adversarial` flow into decompose as
  guard steps; `prior_art` from `researcher.history` populates `prior_art_refs`
  on each task so the plan inherits the CE knowledge layer.

**POSITIONING**

- `docs/POSITIONING.md` — "Deep plan authoring" row updated from
  `light (planner cluster)` to `native (sgc plan L2/L3 + --deep ...)`;
  intro paragraph updated to remove "deep plan authoring" from the
  remaining-gaps list (only "running the full TDD loop" remains honest gap).

Spec: `docs/superpowers/specs/2026-06-03-deep-planning-design.md`. Plan:
`docs/superpowers/plans/2026-06-03-phase-2b-deep-planning.md`.

## v1.25.0 — 2026-06-02 — TDD-ledger (Phase 2a)

**MIGRATION (behavior change to `sgc work --done`):** closing a feature now
requires a recorded prior-RED **in addition to** the existing `--verify-command`.
Supply either a prior-RED pair or waive it:

```sh
# with a recorded RED:
sgc work --done f1 --verify-command "bun test x" \
  --prior-red "tests/x.test.ts::t" --red-output "expected 20 got 50"

# waive (docs-only / additive, no prior failing path):
sgc work --done f1 --verify-command "n/a" --waive-red "docs-only"
```

`--waive-red "<reason>"` is the per-call escape hatch (zero-breakage path).
Already-done features remain a grandfathered no-op.

### What changed

- **TDD-ledger close-gate** — `sgc work --done` enforces `(--prior-red +
  --red-output)` XOR `--waive-red <reason>`, level-agnostic. sgc *records* the
  attestation; it does not execute the test (parity with `--verify-command` /
  `sgc debug close`). The prior-RED pair and the waive reason persist on the
  feature record as a ledger.
- **red-green capture** — a prior-RED done writes `<stateRoot>/red-green/<slug>.md`
  (mirrors `ship-failures/`), seeded with an operator-fill `prevention_seed`.
- **`sgc compound --from-red-green <slug>`** — promotes a filled capture into
  `solutions/` through the same deterministic Invariant §3 dedup pipeline as
  `--from-ship-failure` (compound.context → compound.related stamp →
  writeSolution); operationalizes the CE capture→promote loop for RED→GREEN
  knowledge feeding prior-art. Promote stays the deliberate, dedup-gated step
  (no done-time auto-write).

Spec: `docs/superpowers/specs/2026-06-02-tdd-ledger-design.md`. Plan:
`docs/superpowers/plans/2026-06-02-tdd-ledger.md`.

## v1.24.1 — 2026-06-02 — docs: super-plugin positioning + README / POSITIONING rewrite (npm page refresh)

Documentation + metadata only — no code, no behavior, no state-file change.
Republished to refresh the npm package page (README + description) and to align
the positioning docs with the self-contained super-plugin framing shipped in
v1.24.0.

### What changed

- **README.md** — rewritten around the all-in-one / one-command-install /
  standalone story; added badges, GEO-citable FAQ + value bullets; fixed stale
  facts (test count 357 → 1051, removed the obsolete bun-runtime install steps).
- **docs/POSITIONING.md** + **plugins/sgc/CLAUDE.md** — "coexists with sp/gs,
  NOT a replacement" → **self-contained super-plugin** that installs in one
  command, runs standalone (Node ≥ 18, no bun), and absorbs gstack +
  Superpowers + Compound-Engineering patterns natively. The old delegate table
  is reframed as *optional interop* (a richer path if sp/gs are installed,
  never required). Honest note retained: deep plan authoring + full TDD
  discipline are the thinnest native gaps and remain the one place sp is the
  richer path.
- **package.json** / **plugin.json** descriptions — keyword-rich super-plugin
  framing for npm + marketplace SEO.

## v1.24.0 — 2026-06-02 — feat: self-contained node-bundle install (Phase 0 — dual-channel, no bun runtime)

`/plugin install sgc` now yields a working CLI on a node-only machine — no bun
runtime, no separate `npm i -g` step. The CLI ships as a single self-contained
node ESM bundle (`plugins/sgc/bin/sgc.mjs`, contracts + prompts inlined) through
both the plugin payload and npm, which share one artifact. First phase of the
self-contained super-plugin direction (spec + plan under `docs/superpowers/`).
Dispatcher suite 1035 → 1051 (+16 tests). No state-file or `.sgc/` schema change.

### What changed

**Bundle + runtime (no bun needed at install)**

- New `src/dispatcher/subprocess.ts` — `spawnCapture` / `whichSync` on
  `node:child_process`; all 15 `Bun.spawn` / `Bun.which` sites converted (incl.
  the claude-cli `defaultRunner`, STAB-2 signal-drain kill preserved). The CLI
  is now node-runnable; bun is a dev/build tool only.
- New `src/dispatcher/embedded-data.ts` — `contracts/*` + `prompts/*` inlined as
  text (`with { type: "text" }`); env → embedded → disk read ladder
  (`SGC_CONTRACTS_DIR` / `SGC_PROMPTS_DIR` escape hatches). `schema.ts`,
  `spawn.ts:formatPrompt`, and `doctor.ts` all route through it.
- New `scripts/build-cli.mjs` (`npm run build:cli`) — single-sources the
  `bun build --target=node` flags shared by the build + the doctor parity check;
  emits `plugins/sgc/bin/sgc.mjs` with a `#!/usr/bin/env node` shebang.

**Distribution (dual-channel, both first-class)**

- Plugin commands use a 4-tier resolver, plugin-bundle first
  (`$CLAUDE_PLUGIN_ROOT/bin/sgc.mjs` → global `sgc` → `bun src/sgc.ts` → error).
- `package.json`: `bin` → the bundle, bundle added to `files`,
  `engines` → `node >= 18` (bun requirement dropped).

**Guards**

- `sgc doctor` adds a bundle-hash parity check (rebuilds + compares to the
  committed bundle; skips when run from a source-less install).
- `doctor` check E now whitelists `plugins/sgc/bin/` only — the vendored browse
  tree still cannot reach the npm tarball.
- CI (`test.yml` + `publish.yml`) rebuilds the bundle and fails on a stale
  committed artifact (`git diff --exit-code`).
- New e2e: `tests/e2e/clean-container.test.sh` (node-only docker acceptance) +
  `tests/e2e/npm-isolated-install.test.sh` (isolated install, PATH-shadow-safe).

## v1.23.1 — 2026-06-01 — chore: production-readiness audit P2 (dead code, doc drift, domain errors, dedup-floor note)

Low-priority P2 follow-ups (`docs/PRODUCTION-READINESS-AUDIT.md` §P2, selected).
Cleanup + UX only — no API, no behavior, no state-file change. Dispatcher
suite 1034 → 1035 (+1 test).

### What changed

**ARCH-1 — dead code + stale file header** (`sgc.ts`)

- Removed the never-instantiated `NotImplementedYet` class (a C-phase MVP relic,
  0 references) and rewrote the header from "8 subcommands … MVP implements only
  status" to the real 19-command surface (pointing at README + `sgc doctor`
  parity as the authoritative sources).

**ARCH-2 — README version drift** (`README.md`)

- The hardcoded `**Status**: v1.x` line drifted on every release. Replaced the
  pinned version with a pointer to npm / CHANGELOG so it can't go stale again.

**UX-3 — bare errors wrapped as domain errors** (`plan-jobs.ts`, `schema.ts`)

- `readJob` now wraps fs/parse failures as `PlanJobError("MalformedJobFile", …)`
  carrying the path, so callers see a domain error instead of a bare
  `StateError` / ENOENT.
- A missing/unreadable contract now reports `sgc contract not found at <path> —
  set SGC_CONTRACTS_DIR if contracts/ lives elsewhere` instead of a bare ENOENT
  stack (helps npm-global install-layout debugging).

**ALG-3 — CJK dedup token floor documented** (`dedup.ts`)

- Re-evaluated the `minLen=2` CJK floor and documented it as a deliberate
  accepted trade-off: lowering to 1 would readmit high-frequency particles
  (的/了/在/是) that dilute the Jaccard signal feeding the non-tunable 0.85 §3
  write gate, far outweighing the rare single-char content word it would
  recover. No behavior change.

## v1.23.0 — 2026-06-01 — fix: production-readiness audit P1 (stability, correctness, knowledge-loop quality)

The P1 follow-up to v1.22.0's P0 batch (`docs/PRODUCTION-READINESS-AUDIT.md` §8).
Closes the remaining stability/correctness/knowledge-honesty gaps — all sitting
in test blind-spots, none visible on a green suite. **Mostly behavior
corrections + hardening; two intentional behavior changes are called out below
(STAB-6 LLM retry, CE-5 janitor gate). No API removed, no config or state-file
format changed — no migration required.** Dispatcher suite 1009 → 1034 (+25 tests).

### What changed

**STAB-4 — `writeAtomic` tmp-name collision + failure leak** (`state.ts`, `spawn.ts`, `agent-loop.ts`)

- Tmp name was `${path}.tmp.${pid}.${Date.now()}` — two writes in the same
  millisecond collided, and a failed `renameSync` leaked the tmp file as
  residue. Now appends a monotonic counter + `crypto.randomBytes` suffix and
  unlinks the tmp in a `try/finally` on rename failure. The **3 duplicate
  copies** (state/spawn/agent-loop) are unified onto the one canonical helper.

**STAB-5 — non-atomic state writes** (`plan-jobs.ts`, `loop.ts`)

- `plan-jobs` `writeJob` and `loop` `writeRun` used bare `writeFileSync`; a
  concurrent stale-probe / `--resume` read could observe a torn file
  (`MalformedJob` / `MalformedRunFile`). Both now route through `writeAtomic`.

**STAB-6 — LLM modes never retried transient failures** *(behavior change)* (`spawn.ts`)

- The claude-cli / anthropic-sdk / openrouter branches threw on the first
  429 / 5xx / abort-timeout. New shared `retryWithBackoff` (the file-poll path
  is refactored onto it too) + `isTransientLlmError` (408/409/429/5xx + abort
  retryable; 4xx/parse/auth fatal) give bounded exponential backoff. Default 2
  retries; set `llmMaxRetries: 0` to opt out.

**STAB-2 — signal drain orphaned child processes** (`spawn.ts`, `logger.ts`, `claude-cli-agent.ts`, `openrouter-agent.ts`, `anthropic-sdk-agent.ts`)

- The SIGINT/SIGTERM drain emitted the synthetic `spawn.end` but never reaped
  the in-flight work — a claude-cli child could orphan (a bare SIGTERM to the
  parent pid doesn't propagate). The registry entry now carries an `abort`
  handle (new `LlmAgentContext.registerAbort`): claude-cli registers a child
  kill via a new optional `SubprocessRunner.onSpawn` hook; openrouter/anthropic
  register `AbortController.abort()`. Drain invokes it before the close event.
- **STAB-3** (exit truncates in-flight writes) was verified a non-issue: all
  state I/O is synchronous, so a signal handler (which runs between ticks, never
  mid-syscall) has no async write window to truncate. No change.

**ALG-2 — output-shape validation gaps** (`validation.ts`)

- `integer` accepted floats/NaN/Inf; `number` accepted NaN/Inf; an empty
  `enum[]` declaration silently passed. Now `Number.isInteger` / `Number.isFinite`
  and a fail-loud empty-enum. Closes the audit's single largest coverage gap.

**ALG-4 — `worstPlanVerdict` silently passed malformed verdicts** (`fuse-plan.ts`)

- An unknown verdict string returned the other side instead of failing safe.
  New `normVerdict` coerces unknown → `reject` (fail-safe).

**ALG-5 — classifier over-/under-classification** (`classifier-level.ts`)

- Added a `STRONG_L0` short-circuit (unambiguous trivial edits beat incidental
  L2/L3 keywords) and tightened L0 keywords (`formatting`/`reformat` not bare
  `format`). Also fixes the inverse: "add a helper function to format dates" no
  longer misreads as L0. First test coverage for this module.

**CE-5 — janitor over-captures + heuristic emitted banned boilerplate** *(behavior change)* (`agents/janitor-compound.ts`, `agents/compound.ts`, `ship.ts`)

- The no-LLM `compoundSolutionHeuristic` emitted exactly the `"…see the diff and
  review reports…"` shape that `prompts/compound-solution.md` bans — now
  captures problem + observed symptoms and flags itself un-enriched.
- The janitor compounded **every** L2/L3 success. New "reusable knowledge" gate
  (`diff_lines` + `MIN_REUSABLE_DIFF_LINES=20`): a small L2/L3 diff with no
  reviewer-flagged novelty now skips — finally aligning the code with the
  long-documented "diff < 20 lines AND no novel → skip" rule. Fail-safe: an
  unknown/0 line count compounds (preserves prior behavior; `ship.ts` computes
  it best-effort from `git diff --numstat HEAD`).

**CE-6 — oversize solutions silently dropped from recall** (`agents/researcher-history.ts`)

- A solution exceeding the 256 KB read cap was `continue`d silently, vanishing
  from the corpus walk with zero signal. Now warns to stderr so the operator
  can rotate/trim it.

## v1.22.0 — 2026-06-01 — fix: production-readiness audit P0 (dedup, reuse-metric honesty, prompt-injection, fork race)

A full production-readiness audit (`docs/PRODUCTION-READINESS-AUDIT.md`)
surfaced 5 HIGH issues sitting in test blind-spots — none visible on a green
suite. This release closes all six P0 items. **Behavior corrections only; no
API removed, no config or state-file format changed — no migration action
required.** Dispatcher suite 969 → 991 (+22 tests).

### What changed

**ALG-1 — dedup empty-set false-merge** (`dedup.ts`, `fuse-plan.ts`)

- The Jaccard identity convention `J(∅,∅)=1` was used as a *component* of an
  averaged similarity, so two information-free entries (empty tags + empty
  problem) scored 1.0 and falsely deduped at the 0.85 gate; the same convention
  merged unrelated empty-token concern keys in plan fusion. New `featureOverlap`
  returns 0 for the no-signal pair; `similarity` now averages only the feature
  components that carry a signal (so a tagless-but-identical-problem pair still
  merges). `jaccard` keeps its mathematical identity semantics, unchanged.

**CE-1 — `times_referenced` relabeled (not removed)** (`state.ts`, `docs/SOLUTIONS.md`, `contracts/sgc-state.schema.yaml`)

- `times_referenced` counts dedup **write-merges** of the same problem, never
  recall/surfacing — it was advertised as a usage/reuse metric. Relabeled in
  doc, code comment, and schema comment to say so (reuse is tracked by
  `surfaced_in` / `applied_in`). The field is **kept** — removing it would be a
  breaking schema change to a released artifact for zero benefit.

**CE-4 — `surfaced_in` over-counting** (`applied-tracker.ts`, `plan.ts`, `reflect.ts`)

- `surfaced_in` recorded every prior-art match at the bare 0.3 recall floor,
  conflating "keyword-collided with a plan" with "reused". New
  `SURFACED_RELEVANCE_FLOOR = 0.5` + `selectSurfacedRefs`: weak 0.3–0.5 matches
  still inform the plan but no longer inflate the metric. `sgc reflect` gains a
  legend disambiguating overlap / applied / surfaced / discussed.

**CE-2 — prompt-injection on the corpus→prompt feedback channel** (`preventions.ts`)

- `compound.*` output is intentionally not leak-scanned (it may read solutions),
  so `extractPreventions` is the trust boundary where LLM-authored corpus text
  re-enters the `planner.adversarial` prompt. New `sanitizePreventionText`
  neutralizes structural break-out vectors (chat-role tags, model special
  tokens, `[INST]` markers, NUL) before the feed; content prose is preserved
  (legitimate preventions document injection lessons). A `prevention.sanitized`
  audit event fires when text is altered.

**STAB-1 — TOCTOU fork race / orphan planner** (new `file-lock.ts`, `plan-jobs.ts`, `loop.ts`)

- The "single-active" guards in `sgc plan --async` and `sgc loop` were
  read-then-write: two concurrent invocations both passed the scan and both
  forked — and because the async planner is `detached:true`, the race produced
  real orphan processes. New O_EXCL `acquireFileLock` (pid-liveness stale
  reclaim) wraps each `[scan → claim]` critical section via a git-ignored
  `.fork.lock` / `.claim.lock` in the state dirs.

**CE-3 — end-to-end loop contract test** (new `tests/dispatcher/ce-loop-e2e.test.ts`)

- Each CE link was unit-tested in isolation; the contract *between* links
  (the `solution_ref` written = recalled = applied = the on-disk file mutated)
  was not. New test drives write → recall → reuse → measure against one corpus
  and asserts the refs line up at every hop.

## v1.21.0 — 2026-06-01 — feat: command-surface parity (16 slash commands) + invariant-source unification

An audit of the plugin surfaced a 3-way command-surface drift and a stale
invariant count. This release closes both and adds machine guards (`sgc doctor`)
so neither can silently recur.

### What changed

**Command surface (slash ↔ CLI parity)**

- 5 new slash commands — `/sgc:reflect`, `/sgc:loop`, `/sgc:debug`, `/sgc:cso`,
  `/sgc:handoff` — bringing the plugin to **16 slash commands**. The 3 CLI-only
  post-publish/CI tools (`canary`, `watch-ci-failure`, `land`) stay CLI-only by
  design.
- `sgc doctor` **(H)**: new slash↔CLI parity check — every CLI subcommand must
  have a `plugins/sgc/commands/<name>.md` or be in the `SLASH_EXEMPT` set; orphan
  slash files warn. Previously unguarded (doctor only checked
  contracts↔prompts↔manifest).
- Trimmed the 18-line CLI-detection boilerplate to 4 lines across 11 command
  files.

**Invariant-source unification**

- Unified the invariant count to **13** everywhere: `README.md` (was "12"),
  `plugins/sgc/CLAUDE.md` (listed only §1–§7 → now §1–§13, §6 title corrected to
  "Audit-Trail Writes Are Durable"), `docs/e-phase-demo.md` (was "12").
- `sgc doctor` **(I)**: new invariant-source parity check — `sgc-invariants.md`
  `## §N.` headings must match `invariant-enforcement.yaml` entries, else fail.

**Docs**

- `README.md` + `plugins/sgc/CLAUDE.md` command tables synced to 19 CLI commands
  (16 slash + 3 CLI-only); corrected stale "18 CLI" / "9 subcommands" / "11
  slash" counts.

### Compatibility

Additive only. New slash commands; no removed/renamed CLI subcommands; no schema
or behavior changes to existing commands. `sgc doctor` adds two checks that fail
closed on drift — run it after editing the command set or the invariant list.

### Verification

dispatcher 964 → 969 tests pass / 0 fail; `tsc --noEmit` clean; `sgc doctor`
0 fail (`§1–§13`, 19/19 command parity).

## v1.20.0 — 2026-06-01 — feat(CE-6): `surfaced_in` tracks L2 prevention reuse + `applied_in` slug-fallback

CE-6 score feedback was **L3-only**: `applied_in` increments only when
`planner.adversarial` (which runs solely at L3) echoes a prevention's
`solution_ref` into a `failure_mode.early_signal`. L2 tasks surface prior
solutions via `researcher.history` but never recorded it — `sgc reflect` showed
`applied: 0` for genuinely-reused preventions. This adds an L2-observable signal
and hardens the L3 match.

### What changed

- New optional solution frontmatter field **`surfaced_in: TaskId[]`**, kept
  **separate** from `applied_in` so the L3-strong "adversarially validated"
  semantics stay intact (`surfaced` = "informed an L2+ plan"). Written by the new
  `recordSurfaced` (shares the parameterized `recordOne` with `recordApplied`;
  same metadata-only Invariant §3 carve-out — never enters the dedup signature).
- `sgc plan` records every `researcher.history.prior_art` `solution_ref` into
  `surfaced_in` for L2+ tasks (Iron Law: writeback failure never fails plan).
- `sgc reflect` output now shows `(overlap, applied, surfaced)`.
- Robustness: `extractAppliedSolutionRefs` gains a slug-fallback (min length 8)
  so `applied_in` still matches when the adversarial LLM drops the `category/`
  prefix from the `solution_ref` it echoes — a designed prompt contract that was
  fragile to LLM non-compliance.
- `contracts/sgc-state.schema.yaml` documents both `applied_in` (previously
  undeclared) and `surfaced_in` as optional CE-6 fields.

### Compatibility

Additive minor. Existing solutions without `surfaced_in` read as 0; `applied_in`
semantics and historical L3 scores are unchanged. No new agent, no LLM, no
Invariant §1/§3/§4 change. New repo-tracked `docs/SOLUTIONS.md` curates the
close-gate (v1.19.0) and CE-6 knowledge with hand-corrected, accurate detail.

## v1.19.0 — 2026-06-01 — feat: verification close-gate on `sgc work --done` (sp:verification-before-completion absorb, Tier 1)

`sgc work --done <feature_id>` now **requires** a `--verify-command` to mark a feature
done — generalizing the `sgc debug close` Iron Law #3 hard-gate from the debug path to the
general work path. This absorbs `superpowers:verification-before-completion` as an
sgc-native structural gate and closes an internal contract asymmetry (debug closes were
hard-gated on evidence; `work --done` previously flipped status with none).

### What changed

- New flags on `sgc work`: `--verify-command <str>` (required to close a feature) and
  `--evidence <str>` (optional free-text naming what was observed).
- `verify_command` is OPERATOR RESPONSIBILITY — sgc records it but does **not** execute it
  (parity with `sgc debug close`; keeps the gate deterministic, no arbitrary exec).
- New optional `Feature` fields `verify_command` + `evidence`, persisted into
  `progress/feature-list.md` on the done-transition (`contracts/sgc-state.schema.yaml`).
- `sgc loop` inherits the gate transitively via its `paused_work` → operator → `work --done`
  handoff; no separate loop gate.

### Compatibility

Additive minor. Features already marked `done` are **grandfathered** — their records lack
the new fields and re-render unchanged; a repeated `--done` on an already-done feature is a
no-op needing no flag. Only new `pending`/`in_progress` → `done` transitions require
`--verify-command`. Invariant §1/§4 untouched (no LLM, no human-signature change).

Out of scope: not a TDD coach (Tier 2 ledger is future work), no per-subtask granularity.

## v1.18.0 — 2026-05-29 — feat(GS-3): plan decision fusion (fused_verdict at L2/L3)

`sgc plan` now emits a **Fused decision** synthesizing the planner cluster (ceo / eng /
adversarial) at L2 and L3: a single `fused_verdict` (`approve | revise | reject`), a
deduped + severity-ranked concern list, and explicit conflict callouts when agents
disagree. The verdict is advisory — the L3 human signature and stdin confirmation gates
(Invariant §4) are unchanged.

### What changed

- New optional frontmatter field `fused_verdict` on `decisions/{id}/intent.md`.
- `sgc plan` output at L2/L3 prepends a `## Fused decision` section at the TOP of
  `intent.md` (before the per-agent verdict sections), listing the fused verdict,
  severity-ranked concerns, and any inter-agent conflicts.
- L1/L0 plans are unchanged — fusion is only triggered at L2 and above.

### Compatibility

Additive, backward-compatible. Existing `intent.md` files without `fused_verdict` still
validate. No new `read:solutions` access — Invariant §1 (Generator-Evaluator Separation)
is untouched. The fusion step is deterministic (no LLM call).

To opt out, pin `@sdsrs/sgc@1.17.4` (or read the per-agent verdict sections as before —
fusion only adds output).

## v1.17.4 — 2026-05-28 — fix(deps): bump @anthropic-ai/sdk ^0.89.0 → ^0.91.1 (clears GHSA-p7fg-763f-g4gf)

Closes the moderate-severity advisory surfaced by GS-5 DOG-7's now-
accurate dep-audit output (cso v1.17.3):

  GHSA-p7fg-763f-g4gf — Claude SDK for TypeScript has Insecure Default
  File Permissions in Local Filesystem Memory Tool
  vulnerable: >=0.79.0 <0.91.1
  fixed: >=0.91.1

sgc's usage is limited to `import Anthropic from "@anthropic-ai/sdk"`
and `client.messages.create(...)` (single call site in
`src/dispatcher/anthropic-sdk-agent.ts`) — the SDK's stable core API,
unchanged across 0.89 → 0.91. No code changes required beyond the
version bump.

### Bumped

- `package.json`: `@anthropic-ai/sdk: ^0.89.0` → `^0.91.1`
- `package-lock.json`: refreshed; npm audit reports 0 vulnerabilities
  post-bump.

### Verify (Iron Law #2)

```
$ bun src/sgc.ts cso
cso verdict: pass
  secret-scan: pass (0 finding(s), 0 warning(s))
  dependency-audit: pass (0 finding(s), 0 warning(s))
  events-anomaly: pass (0 finding(s), 0 warning(s))
```

All three cso checks now pass — first fully-green cso since GS-5
shipped. Pre-bump: dep-audit warned with 1 moderate. Post-bump: 0.

## v1.17.3 — 2026-05-28 — fix(GS-5 DOG-7): cso dep-audit assumed npm JSON shape — bun emits a different schema

**Bugfix restoring accurate cso dep-audit reporting.** Closes the second
v1.17.1 follow-up ticket. Self-dogfood on the sgc repo reported "bun
audit returned non-JSON or unparseable output; dep audit skipped" — a
false claim. `bun audit --json` v1.3.5 emits clean valid JSON on stdout
(stderr separation confirmed); the schema differs from npm:

```json
// bun shape (package-keyed advisory map)
{ "@anthropic-ai/sdk": [{ "id": 1119428, "severity": "moderate", ... }] }

// npm shape (counts under metadata)
{ "metadata": { "vulnerabilities": { "moderate": 1, "total": 1, ... } } }
```

`parseNpmAudit` reads `j.metadata?.vulnerabilities` → undefined on bun
shape → null → false "unparseable" warning. The npm fallback never ran
because bun returned a non-null result.

### Fixed

- `src/commands/cso.ts`: added `parseBunAudit(stdout): AuditCounts | null`
  that handles the package-keyed shape; rejects npm shape (so dispatch
  is schema-driven, not name-driven); counts severities into
  `{critical, high, moderate, low, total}`; ignores unknown severity
  values (forward-compat) and rejects malformed input (Array.isArray
  guard, advisory object guard).
- Added `parseAuditByTool(tool, stdout)` dispatcher that tries the
  tool-specific parser first and falls back to the other parser if
  it returns null — robust to future bun/npm schema drift.
- `auditDependencies` now calls the dispatcher instead of
  `parseNpmAudit` directly. `parseNpmAudit` is also now exported for
  test-only access.

### Tests

- 8 new unit tests in `tests/dispatcher/cso.test.ts`:
  - parseBunAudit: empty `{}` → all zeros
  - parseBunAudit: single moderate advisory → moderate=1, total=1
  - parseBunAudit: multi-package multi-severity → correct counts
  - parseBunAudit: non-JSON → null
  - parseBunAudit: npm-shaped JSON → null (schema-driven dispatch)
  - parseBunAudit: unknown severities ignored, not crashed
  - parseNpmAudit: npm shape → AuditCounts (regression baseline)
  - parseNpmAudit: bun-shaped JSON → null (schema-driven dispatch)
- 22 → 30 cso tests (+8), 0 fail. Post-fix `sgc cso` reports the actual
  @anthropic-ai/sdk@>=0.79.0 <0.91.1 GHSA-p7fg-763f-g4gf moderate
  advisory (sgc's `^0.89.0` is in range — separate ticket to bump the
  dep itself, not part of this parser fix).

### 7th dogfood-found-and-fixed

DOG-1 npx PATH shadow / DOG-2 dedup tokenize / DOG-3 citty CI backtick /
DOG-4 clarifier apostrophe / DOG-5 cso test-fixture false positive /
DOG-6 SIGINT Invariant §13 / **DOG-7 cso bun-shape parser**. All of
DOG-5/6/7 surfaced from a single `sgc cso` invocation on the sgc repo —
the same self-dogfood produced three orthogonal real bugs.

## v1.17.2 — 2026-05-28 — fix(GS-5 follow-up): SIGINT/SIGTERM mid-spawn breaks Invariant §13 Tier-1 pairing

**Bugfix restoring Invariant §13 promise.** Surfaced as the
events-anomaly follow-up filed in v1.17.1: 9 historical unpaired
`spawn.start` entries in `.sgc/progress/events.ndjson`, all from openrouter-
mode long LLM calls (8× `clarifier.discover` via `sgc discover`,
1× `planner.adversarial` in an L3 plan). Per-entry timeline proved each
had `spawn.start` + `llm.request` (fetch reached) but no `llm.response`
and no `spawn.end` — process died mid-fetch.

**Root cause**: Bun's default SIGINT/SIGTERM termination does NOT unwind
the await stack, so spawn.ts's `try { ... } finally { emit spawn.end }`
is skipped when the operator Ctrl+Cs during an in-flight LLM call. The
existing try/finally is structurally correct (7 historical `outcome=error`
spawn.ends prove LLM throws DO run finally) — only hard process termination
bypasses it. No SIGINT handler existed in src/.

### Fixed

- `src/dispatcher/spawn.ts`: added module-level `openSpawns` registry +
  lazily-installed SIGINT/SIGTERM handlers. spawn() registers on
  `spawn.start` emit, deregisters in finally. On signal: drain emits
  synthetic `spawn.end` with `outcome="interrupted"`, `signal=<name>`,
  `elapsed_ms`, level=warn for each open spawn, then re-raises via
  `process.exit(130)` for SIGINT or `process.exit(143)` for SIGTERM.
- 9 historical unpaired entries in `.sgc/progress/events.ndjson` paired
  retroactively (synthetic spawn.end with `signal="unknown"` + `note:
  "retroactive synthesis: pre-v1.18 SIGINT handler did not exist"`).

### Tests

- 5 new unit tests in `tests/dispatcher/spawn-interrupt.test.ts`:
  - drain emits synthetic spawn.end(outcome=interrupted, signal=SIGINT)
    for a registered open spawn
  - successful spawn deregisters → drain after success finds no open
  - failed spawn (forceError) deregisters → no orphan after drain
  - two concurrent open spawns → drain emits 2 synthetic spawn.ends
  - drain with no open spawns is a no-op
- Test surface 1014 → 1019 (+5), 0 fail, 3164 expects, 516s wall.
- DOG-5 follow-up `events-anomaly` check: pre-fix 9 findings → post-fix 0.

### Out of scope

- `bun audit` non-JSON fallback (separate ticket
  `tasks/2026-05-28-cso-dep-audit-bun-fallback.md`).
- Multi-reviewer decision fusion (GS-3, v2.0.0 — high-risk Invariant §1
  back-channel + §6 work, needs spec first).

## v1.17.1 — 2026-05-28 — GS-5 DOG-5 dogfood-found bugfix (test-fixture false positives)

**GS-5 follow-on bugfix** discovered via self-dogfood: first `sgc cso`
invocation against the sgc repo flagged 3 secret-scan findings, all of
which were intentional test fixtures (cso's own AKIA + private-key
regression fixtures in `tests/dispatcher/cso.test.ts` + an old
`plugins/sgc/browse/test/cookie-import-browser.test.ts` password mock).
With this default behavior, the cso command would produce false-positive
noise on every invocation of any repo that has security tests — the
command's signal-to-noise ratio at default settings was unusable.

Surfaced as **DOG-5** in the GS-N dogfood-as-test arc (DOG-1 npx PATH
shadow / DOG-2 dedup tokenize / DOG-3 citty backtick CI wrap / DOG-4
clarifier suggested_next apostrophe / DOG-5 this).

### Fixed

- `src/commands/cso.ts`: secret-scan now excludes test/fixture/mocks
  paths by default. Added `SCAN_EXCLUDE_PATTERNS` regex array:
  `/(^|\/)tests?\//`, `/\.test\.[jt]sx?$/`, `/\.spec\.[jt]sx?$/`,
  `/(^|\/)__fixtures__\//`, `/(^|\/)__mocks__\//`. Refactored
  `listScanFiles` filter from prefix-only `SCAN_EXCLUDE_PATHS` to combined
  `isExcludedPath(rel)` helper covering both prefixes and patterns.
- Convention follows gitleaks / trufflehog defaults; real-code detection
  preserved (AKIA in `src/foo.ts` still fires).

### Tests

- 3 new regression tests in `tests/dispatcher/cso.test.ts`:
  - DOG-5: AKIA in `tests/foo.test.ts` is excluded by default → pass
  - DOG-5: AKIA in `src/foo.ts` STILL fires → fail (real-code detection)
  - DOG-5: `*.spec.ts` + `__fixtures__/` + `__mocks__/` all excluded
- Dispatcher CI gate **906 → 909** pass (+3), 0 fail.

### Follow-ups filed (not blocking v1.17.1 ship)

- `tasks/2026-05-28-cso-events-anomaly-spawn-end-missing.md` — 9 real
  unpaired `spawn.start` entries in `events.ndjson` (clarifier.discover
  x8, planner.adversarial x1, dates 2026-05-21 to 2026-05-26). Real
  Invariant §13 violations; needs spawn-wrapper investigation.
- `tasks/2026-05-28-cso-dep-audit-bun-fallback.md` — `bun audit
  --json` returned non-JSON on sgc repo; tryAudit falls through to
  warn correctly but bun-vs-npm output drift deserves investigation.

### No migration required

Scanner behavior change: test-path findings that previously fired are
now suppressed. Real-code findings unchanged. If a project intentionally
wants test-path scanning, that opt-in flag is deferred to a future
release.

## v1.17.0 — 2026-05-28 — GS-5 sgc cso pre-ship security review

**GS-5 (feature f13, sibling to CE-N + GS-1 + GS-2 + GS-4 + GS-6 + GS-7).**
Seventh ship of the **GS-N absorb arc**: a heuristic chief-security-officer
command that runs three closed-enum checks (secret scan + dep audit +
events.ndjson Tier-1 anomaly per Invariant §13) and writes an
append-only timestamped report under `.sgc/cso/`. Output schema
forward-compatible with future `reviewer.correctness` L3 integration
(reads `.sgc/cso/last-report.json`).

### Added — `sgc cso`

- **`sgc cso`** runs three checks in sequence:
  1. **secret-scan** — regex set over `git ls-files --cached
     --modified --others --exclude-standard` (AWS access key, private
     key block, GitHub PAT, OpenAI/Slack token, generic
     api-key/password assignment). Excludes `.sgc/cso/`, `node_modules/`,
     `.git/`, `dist/`, `build/`, `coverage/`, `tmp/` to prevent
     self-reference false positives. 200KB per-file size cap.
  2. **dependency-audit** — shells `bun audit --json` first, falls
     back to `npm audit --json`; counts critical / high → `findings`
     (verdict fail), moderate / low → `warnings` (verdict warn). Tool
     missing or non-JSON output → graceful skip with warning, NOT
     blocking fail.
  3. **events-anomaly** — reads `.sgc/progress/events.ndjson` (last
     ~2MB tail), tracks `spawn.start` / `spawn.end` pairs by
     `spawn_id`, reports unpaired `spawn.start` as Invariant §13
     Tier-1 violations. Empty / missing events.ndjson → warn (not
     fail); malformed JSON lines → counted in warnings, scan continues.
- **Verdict aggregation**: worst-of across the three checks (fail >
  warn > pass). Exit 1 only on fail; warn and pass both exit 0
  (advisory tier — operator decides whether to ship).
- **Output**: append-only `.sgc/cso/<YYYY-MM-DD>-<HHMM>-<rand>.md`
  per Invariant §6 (never overwritten) + rewritten
  `.sgc/cso/last-report.json` snapshot (machine-readable). Second `sgc
  cso` invocation writes a NEW timestamped file; first run preserved.
- **Default**: opt-in via direct invocation; no auto-run from `/ship`
  this round (deferred — out of scope for v1.17.0).

### Tests

- Dispatcher CI gate **885 → 906** pass (+21: 19 new in
  `cso.test.ts` covering aggregateVerdict ordering / ensureCsoDir /
  scanSecrets clean+AKIA+private-key+self-reference-exclusion+non-git
  graceful / auditDependencies tolerance / detectAnomalies
  missing+empty+paired+unpaired+malformed-resilience / runCso end-to-end
  report write + append-only second-run; +2 in `sgc-cli.test.ts`
  covering `sgc --help` lists cso + `sgc cso --help` semantics under
  CI=1 toContain). 0 fail.

### Changed

- `src/sgc.ts` registers `cso` defineCommand between `canary` and
  `debug` (alphabetical ordering); main dispatch table grows from 18
  to 19 subcommands.

### Invariants

- Invariant §6 (append-only) explicitly upheld: every cso run writes a
  fresh timestamped file under `.sgc/cso/`; only `last-report.json` is
  rewritten (pointer/snapshot, not audit record). Invariant §13
  enforcement aids detection (unpaired spawn.start surfaces as
  finding) — no new event types emitted by cso itself this round.

### No migration required

Additive opt-in command + new `.sgc/cso/` namespace; operators not
invoking `sgc cso` are unaffected. CE-1 / CE-2 / CE-3 / CE-4 / CE-5 /
CE-6 / GS-1 / GS-1.1 / GS-1.2 / GS-2 / GS-4 / GS-6 / GS-7 byte-for-byte
unchanged.

## v1.16.1 — 2026-05-28 — GS-6 DOG-4 dogfood-found bugfix (apostrophe in suggested_next)

**GS-6 follow-on bugfix** discovered via self-dogfood: first `sgc discover
--template anti-pattern` invocation against an active-task state crashed
with OpenRouter YAML parse failure. Pre-existing latent bug in
`prompts/clarifier-discover.md` + heuristic-mode wording: the suggested_next
suffix `(there's an active task: <summary>)` contained a raw `'`
apostrophe, which in LLM mode terminates the single-quoted YAML scalar
mid-string and crashes `openrouter-agent.ts:182` `yamlLoad`. Heuristic
mode bypasses YAML round-trip so unit tests passed all along; only LLM
mode with non-empty `current_task_summary` triggers it.

Surfaced as **DOG-4** in the GS-N dogfood-as-test arc (DOG-1 npx PATH
shadow / DOG-2 dedup tokenize / DOG-3 citty backtick CI wrap / DOG-4
this).

### Fixed

- `src/dispatcher/agents/clarifier-discover.ts`: `(there's an active
  task: ...)` → `(active task: ...)`. Same meaning, no apostrophe.
- `prompts/clarifier-discover.md`: instruction updated with explicit
  warning that suggested_next is YAML-scalar-wrapped and MUST NOT
  contain raw `'`.
- Regression test: `tests/dispatcher/clarifier-discover.test.ts` asserts
  no `'` in suggested_next wrapper text when current_task_summary is set.

### Tests

- Dispatcher CI gate **884 → 885** pass (+1 regression test), 0 fail.

### No migration required

Output text changes from "(there's an active task: X)" to "(active
task: X)" — purely cosmetic, no contract change.

## v1.16.0 — 2026-05-28 — GS-6 sgc discover --template framing selector

**GS-6 (feature f12, sibling to CE-N + GS-1 + GS-2 + GS-4 + GS-7).**
Sixth ship of the **GS-N absorb arc**: a closed-enum `--template <name>`
overlay for `sgc discover`, layering office-hours / cut-line /
pre-mortem framings on top of the existing domain-hint pattern.
Templates change question CONTENT only; the
`ClarifierDiscoverOutput` schema is unchanged across all values.

### Added — `sgc discover --template <name>`

- **Three closed-enum values for v1.16.0**: `product` (office-hours
  user-value framing: who hurts today / narrowest wedge / willing to
  pay), `scope` (cut-line forcing: smallest version / cut-line /
  deadline-halved drop list), `anti-pattern` (pre-mortem failure-mode:
  silent-failure / failure-mode oracle / rollback path). Source-of-truth
  = exported `DISCOVER_TEMPLATES` const in
  `src/dispatcher/agents/clarifier-discover.ts`.
- **Default behavior unchanged** when `--template` is omitted —
  regression test pins the no-flag path byte-identical.
- **Unknown `--template`** exits non-zero with stderr `unknown template:
  '<value>'. valid: product, scope, anti-pattern`; no silent fallback.
- **Templates layer additively** with existing domain hints: `--template
  product` on an auth topic still emits the threat-model question.
- **LLM-mode aligned** via `prompts/clarifier-discover.md` template
  section documenting the same anchor markers; heuristic and LLM modes
  emit the same wording markers tests assert on.

### Tests

- Dispatcher CI gate **872 → 884** pass (+12: 9 new in
  `clarifier-discover.test.ts` covering 3 per-template wording-marker
  tests + default byte-identical regression + additive layering with
  domain hints + closed-enum guard + runDiscover unknown-template
  throw + runDiscover happy-path passthrough + prompt-template
  marker sync; +3 in `sgc-cli.test.ts` covering `--help` flag
  visibility under CI=1 (DOG-3 toContain dodge), end-to-end
  `--template product` wording, unknown-template stderr+exit-non-zero).
  0 fail.

### Changed

- `ClarifierDiscoverInput` gains an optional `template?:
  DiscoverTemplate` field. Existing call sites unaffected (additive).

### Invariants

- No impact. No schema bump. No new event types. No new agent spawn.
  `--template` is CLI-surface-only; clarifier.discover manifest
  unchanged.

### No migration required

Additive flag; operators not passing `--template` are unaffected. CE-1
/ CE-2 / CE-3 / CE-4 / CE-5 / CE-6 / GS-1 / GS-1.1 / GS-1.2 / GS-2 /
GS-4 / GS-7 byte-for-byte unchanged.

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
