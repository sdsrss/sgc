# Changelog

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
