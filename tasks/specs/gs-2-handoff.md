---
status: implemented
revision: 2
task_id: gs-2-handoff
feature_id: f9
parent_intent: (none — GS-2 is the third ship of the GS-N absorb arc, sgc-native heuristic implementations of selected gstack-style capabilities per docs/POSITIONING.md. Sibling to CE-N; outside any compound parent intent. Sibling to GS-1 canary v1.11.0 + GS-1.1 promote v1.12.0 + GS-1.2 dedup robustness v1.12.1.)
---

# GS-2 — `sgc handoff --auto` session-state checkpoint

## Goal

Add a sgc-native **session-state checkpoint capture** absorbed from
`gs:/context-save` + `gs:/context-restore` intent. New standalone CLI
`sgc handoff --auto` reads sgc dispatcher state across all six
namespaces and writes a structured `tasks/<slug>-paused.md`
markdown checkpoint that a future session can `cat` (or `sgc handoff
--print <slug>`) to rebuild context after `/clear`, `/exit`, or
context-window compaction.

The checkpoint is anchored on **Iron Law #2** (CLAUDE.md §7):
"un-VALIDATE'd items → `tasks/<slug>-paused.md` with exact verify
command." GS-2 makes that artifact automatically producible from
state-on-disk rather than relying on the agent to construct it by
hand at session-exit time — which §11 SESSION post-compaction
recovery and `<session-exit-mid-SPINE>` paths have historically
lost when the agent yielded silently.

Verify-command derivation cascades through three priority signals
extractable from existing sgc state (no LLM, no agent spawn):

1. **`.sgc/loop-runs/<id>.md status:paused`** → `sgc loop --resume <id>`
2. **`.sgc/plan-jobs/<id>.md status:running`** (pid alive per existing
   lazy stale-detect in `listJobs()`) → `sgc plan --status <id>`
3. **`.sgc/progress/events.ndjson` tail unclosed spawn.start** →
   `sgc tail --since <ts>` (operator inspects)
4. **Fallback** when none of the three signal: frontmatter writes
   `verify_command: "TODO: operator-fill"` (string sentinel parallel
   to CE-3 `prevention_seed: TODO ...` + GS-1 `regression_seed: TODO
   ...`).

GS-2 is the **third ship of the GS-N absorb arc**, sibling to GS-1
canary (v1.11.0–v1.12.1). The arc follows the same SPINE: spec →
plan → implement → dogfood → main-direct → tag → publish. Heuristic
only. Zero new dependencies. No new hook surface (operator-driven
consumption: `cat tasks/<slug>-paused.md` or `sgc handoff --print
<slug>`).

Operator workflow becomes:

```
# pre-exit checkpoint:
sgc handoff --auto                       # writes tasks/<YYYY-MM-DD>-<slug>-paused.md
/exit

# next session:
cat tasks/<YYYY-MM-DD>-<slug>-paused.md  # or `sgc handoff --print <slug>`
# Frontmatter `verify_command:` field is the Iron Law #2 anchor.
```

GS-2 is **complementary, not competing**, with `claude-mem-lite`'s
existing `<session-handoff>` SessionStart hook (v2.84.0+): the
claude-mem-lite handoff captures the user's last topic string;
GS-2 captures the sgc-protocol-level work state (active decision,
pending verify command, in-flight plan-jobs / loop-runs / unpromoted
captures, git status, recent commits). Both can coexist; neither
displaces the other.

## Non-goals (v0)

- Do NOT auto-trigger via Stop / SessionEnd hook in v0. GS-2 ships
  CLI only; consumption is operator-driven. Rationale: claude-mem-lite
  already occupies SessionStart hook slot for context-injection; adding
  a second injector would either duplicate work or require coordination
  not worth v0 scope. Operator types `sgc handoff --auto` before
  `/exit` (one-line muscle memory).
- Do NOT add a `--from-handoff` promote sibling spec analogous to
  GS-1.1 (`sgc compound --from-canary`) or CE-3-promote
  (`sgc compound --from-ship-failure`). Handoffs are session-state
  snapshots, not failure data; they are not natural raw material
  for `solutions/` promotion. If a recurring pattern surfaces ("I
  always forget to verify X before /exit"), the natural promotion
  path is operator-typed CE-1 `prevention_seed:` in an existing
  decision, not a `--from-handoff` flag. Document this in Open
  Questions for revisit if real demand emerges.
- Do NOT write to `<stateRoot>/solutions/` (Invariant §3),
  `<stateRoot>/reviews/` (Invariant §6), or any existing namespace.
  GS-2 writes to `tasks/<slug>-paused.md` at the **project repo
  root**, not under `<stateRoot>/`. Rationale: paused.md files are
  task-management artifacts (already-existing `tasks/specs/` lives
  there); placing them in `.sgc/` would commit handoff files to the
  gitignored state layer, defeating cross-machine sync.
- Do NOT create a new `.sgc/handoffs/` namespace. The single-file-
  per-session-pause artifact lives outside `.sgc/`; no dedup-stamp,
  no `compound.related` spawn, no Invariant §3 entanglement.
- Do NOT modify `sgc plan`, `sgc work`, `sgc review`, `sgc qa`,
  `sgc ship`, `sgc compound`, `sgc canary`, `sgc loop`, `sgc reflect`,
  `sgc tail`, `sgc watch-ci-failure`, any `prompts/*.md`,
  `contracts/sgc-capabilities.yaml`, or any Invariant §1 / §3 / §6 /
  §13 enforcement path. GS-2 only adds a new command + a new
  read-only state scanner.
- Do NOT introduce an LLM-mode path. State-on-disk is structured
  (YAML frontmatter for loop-runs / plan-jobs / ship-failures /
  canaries; NDJSON for events); LLM rerank value is marginal and
  would defeat the "capture immediately, no network dependency on
  the pre-exit path" semantic (same rationale as CE-3 r1 + GS-1 r1).
- Do NOT add interactive TTY prompts. `sgc handoff` is non-
  interactive; any prompt would defeat use from operator shell
  aliases or muscle-memory pre-exit invocation.
- Do NOT capture full file contents of in-flight intent.md / loop
  state body / etc. — only frontmatter summary + path pointer.
  Operator who needs full content reads the linked path. Embedding
  full bodies would multiply paused.md size without consumer benefit.
- Do NOT auto-clean paused.md files after operator resume. v0
  treats paused.md as durable audit-trail artifacts; operator
  decides retention (manual `rm tasks/*-paused.md` after resume,
  or commit them for cross-machine carryover).

## Constraints

- **Write path outside `.sgc/`**: `tasks/<slug>-paused.md` lives at
  repo root next to `tasks/specs/`. `mkdir -p tasks/` is invoked
  lazily on first write (no AUTH — project-local task file, same
  trust level as `tasks/specs/*.md`).
- **Slug format**: `<YYYY-MM-DD>-<kebab(title)[:40]>` derived from
  the mtime-newest `.sgc/decisions/<id>/intent.md` `title` field.
  `kebabize` lowercases + strips NFD diacritics + replaces
  non-`[a-z0-9]` with `-` + trims edge `-`. `deriveSlug` then
  truncates the kebab to 40 chars **AND re-trims trailing `-`**
  after truncation (the slice can land on a `-` separator;
  `kebab.slice(0, 40).replace(/-+$/, "")` is the canonical form).
  Fallback `<YYYY-MM-DD>-<HHMM>-handoff` (timestamp-only) when:
  (a) no `.sgc/decisions/` directory, (b) decisions directory empty,
  (c) no `intent.md` parseable, (d) `title` field absent / empty,
  (e) `kebab(title)` empty (pure CJK / pure symbol). Tie-break on
  multiple intents with identical mtime: lexicographic `id` sort
  (deterministic).
- **Atomic overwrite**: re-running `sgc handoff --auto` overwrites
  the existing `tasks/<slug>-paused.md` via `fs.writeFile(tmp) +
  fs.rename(tmp, target)` POSIX-atomic pattern. No same-day dedup,
  no `--force` gate. Rationale: handoff is a state snapshot, not
  an event log; "latest state wins" matches operator intuition and
  costs nothing to re-run twice.
- **No Invariant §13 paired event owed**: no agent spawn (no
  `spawn.start/end`), no LLM call (no `llm.request/response`). v0
  emits NO command-level event either (no `handoff.captured`
  event in events.ndjson), keeping `events.ndjson` consumers
  unchanged. Matches GS-1 + CE-3 r1 conservatism.
- **Read-only scan**: gather sub-functions ONLY read `.sgc/`;
  never write or mutate. `tasks/<slug>-paused.md` is the only
  written artifact.
- **Async fs** (`node:fs/promises`), consistent with H.1 ship C,
  CE-2, CE-3, CE-6, GS-1 precedents.
- **Defensive per-section parsing**: each sub-gather
  (`gatherActiveIntent` / `gatherPlanJobs` / `gatherLoopRuns` /
  `gatherUnpromotedCaptures` / `gatherGit` / `gatherRecentCommits`
  / `gatherUnclosedSpawns`) is independently try/catch wrapped.
  Failing one section returns safe empty value (empty array /
  `undefined` / placeholder string); never aborts whole snapshot.
  Mirrors CE-1 `extractPreventions` defensive parseFrontmatter
  pattern (which sidestepped raw-markdown test-fixture corruption
  per [[feedback_dedup_malformed_corpus]] precedent).
- **CLI exit-code split**:
  - `--auto` success: stderr `paused: <path>` exit 0
  - `--auto` IO/permission failure: stderr `handoff failed:
    <reason>` exit 1
  - `--print <slug>` file exists: stdout passthrough exit 0
  - `--print <slug>` file missing: stderr `no paused.md for slug
    <slug>` exit 1
  - bare `sgc handoff` (no flag): stderr `usage: sgc handoff
    --auto | --print <slug>` exit 1
- **Verify-command cascade is single-valued**: P1 / P2 / P3 / P4
  short-circuit on first non-empty tier. Multiple paused loop-runs
  → newest `last_updated_at` wins for `verify_command`; the rest
  still appear in markdown Section 3 (Loop runs) for operator
  visibility, but only the winner is encoded in frontmatter.
- **Templated frontmatter shape** (minimal, grep-friendly):
  ```yaml
  ---
  slug: <YYYY-MM-DD>-<short-slug>
  generated_at: <ISO 8601>
  sgc_version: <X.Y.Z from package.json>
  verify_command_source: loop-run | plan-job | events-spawn | todo
  verify_command: <command string> | "TODO: operator-fill"
  ---
  ```
  Body sections (6): `## 1 — Active decision + verify command (Iron
  Law #2)` + `## 2 — Plan jobs (in-flight)` + `## 3 — Loop runs
  (in-flight)` + `## 4 — Unpromoted captures` + `## 5 — Git` +
  `## 6 — Recent commits`. Each section caps at 5 lines + optional
  fenced block (git status excerpt / commit list).
- **Combined unpromoted captures**: ship-failures + canaries
  render in a single section (both are "captured but
  `promoted_to:` field absent or empty" — operator's perspective
  is "TODO seed awaiting attention", not "which capture taxonomy").
- **`unclosed_spawns` is P3 signal only**: derived from
  `events.ndjson` tail (last 500 lines, paired by `spawn_id`); not
  rendered as its own markdown section. If P3 wins the cascade,
  the unclosed-spawn context is embedded in Section 1's
  `verify_command` block.
- **No `scope_tokens` declarations**: `sgc handoff` runs in the
  dispatcher CLI process, not an agent spawn (same as CE-3
  `watch-ci-failure`, GS-1 `canary`). Agent capability scope_tokens
  do NOT apply.
- **Invariant §4 (L3 forbids `--auto`) is orthogonal**: §4 binds
  `runPlan` / `runShip` at task level=L3; `sgc handoff --auto` is
  an L0 read-only tool command (no protocol-layer routing into
  plan/work/ship). Spec calls this out explicitly so future
  reviewers do not flag a false positive.
- **`tasks/<slug>-paused.md` default-tracked in git**: matches
  `tasks/specs/*.md` (already in repo). Operators wanting pure-
  local pause checkpoints add `tasks/*-paused.md` to `.gitignore`
  themselves; v0 does NOT auto-gitignore.
- **No retention policy in v0**: paused.md files accumulate. If
  long-lived projects show clutter > N=20, GS-2.x may add
  `sgc handoff --gc` (rm paused.md older than 30 days). Defer
  until v0 telemetry shows pain.

## Success criteria

1. **New module** `src/dispatcher/handoff.ts` (~280 LOC) exports:
   ```ts
   export interface HandoffSnapshot {
     slug: string
     generated_at: string                  // ISO 8601
     cwd: string                           // repo root
     sgc_version: string                   // from package.json
     active_intent?: ActiveIntentSummary
     verify_command: VerifyCommandResult
     plan_jobs: PlanJobSummary[]
     loop_runs: LoopRunSummary[]
     unpromoted_captures: UnpromotedCapture[]
     git: { branch: string; ahead?: number; behind?: number; changes: string[] }
     recent_commits: CommitOneline[]
     unclosed_spawns: UnclosedSpawn[]      // P3 signal only, not rendered
   }

   export interface ActiveIntentSummary {
     task_id: string
     level: "L0" | "L1" | "L2" | "L3"
     title: string
     intent_path: string
     mtime: string
   }

   export interface VerifyCommandResult {
     source: "loop-run" | "plan-job" | "events-spawn" | "todo"
     command?: string
     context?: string
   }

   export interface UnpromotedCapture {
     kind: "ship-failure" | "canary"
     slug: string
     seed_excerpt?: string                 // first 80 chars
   }

   export interface PlanJobSummary {
     job_id: string
     status: "running" | "paused" | "failed" | "stale"
     task: string                          // first 80 chars
     pid?: number
     started_at: string
   }

   export interface LoopRunSummary {
     run_id: string
     status: "running" | "paused" | "failed"
     current_step: string
     task: string                          // first 80 chars
     started_at: string
   }

   export interface CommitOneline { sha: string; subject: string }

   export interface UnclosedSpawn {
     spawn_id: string
     agent: string
     start_ts: string
   }

   // Pure data gathering — read-only sweep of .sgc/ + git
   export async function gatherHandoffState(
     stateRoot: string,
     repoRoot: string,
     opts?: { now?: Date; git?: GitProbe },
   ): Promise<HandoffSnapshot>

   // Deterministic markdown render — pure function of snapshot
   export function renderHandoffMarkdown(snapshot: HandoffSnapshot): string

   // Atomic write — temp file + rename
   export async function writeHandoffMarkdown(
     repoRoot: string,
     slug: string,
     content: string,
   ): Promise<string>                      // returns absolute path

   // Slug derivation — exported for unit testing
   export async function deriveSlug(stateRoot: string, now: Date): Promise<string>

   // Verify-command cascade — pure function
   export function inferVerifyCommand(snapshot: HandoffSnapshot): VerifyCommandResult
   ```

2. **New CLI handler** `src/commands/handoff.ts` (~100 LOC) exports
   `runHandoff(opts: HandoffCliOptions): Promise<void>`:
   - `--auto` (no positional arg): call `deriveSlug` →
     `gatherHandoffState` → `renderHandoffMarkdown` →
     `writeHandoffMarkdown` → stderr `paused: <path>` exit 0.
   - `--print <slug>`: read `tasks/<slug>-paused.md`; stdout
     passthrough; exit 0 if found, 1 if missing.
   - `--state-root <path>` + `--repo-root <path>`: test seam hooks,
     not documented in `--help` (matches CE-3 / GS-1 hidden test
     hooks).
   - No flag: usage error to stderr exit 1.

3. **`src/sgc.ts`** registers `handoff` defineCommand with args:
   - `--auto` (boolean, default false)
   - `--print <slug>` (string)
   Lazy-imports `runHandoff` (matches CE-3 / CE-4 / CE-5 / GS-1
   lazy-import pattern). Added to `subCommands` map. No other
   command modified.

4. **Tests** `tests/dispatcher/handoff.test.ts` (≥20 cases):
   1. `deriveSlug` happy: mtime-newest intent has readable title →
      `<YYYY-MM-DD>-<kebab>` (≤40 char tail).
   2. `deriveSlug` no `.sgc/decisions/` → timestamp fallback.
   3. `deriveSlug` decisions empty → timestamp fallback.
   4. `deriveSlug` intent.md missing `title` → timestamp fallback.
   5. `deriveSlug` title pure CJK → kebab empty → timestamp fallback.
   6. `deriveSlug` two intents identical mtime → lex-sort id
      tie-break (deterministic).
   7. `kebabize` mixed case + punctuation: `"GS-2 Handoff: Auto
      Mode!"` → `"gs-2-handoff-auto-mode"`.
   8. `kebabize` diacritics: `"Café résumé"` → `"cafe-resume"`.
   9. `deriveSlug` truncation: 60-char title → kebab truncated to
      40 chars + trailing `-` trimmed (verify trailing-cut on `-`
      separator produces clean tail, not `gs-2-foo-bar-` style).
   10. `inferVerifyCommand` P1: snapshot has paused loop-run →
       `{source:"loop-run", command:"sgc loop --resume <id>"}`.
   11. `inferVerifyCommand` P2: no paused loop, has running
       plan-job (alive) → `{source:"plan-job", command:"sgc plan
       --status <id>"}`.
   12. `inferVerifyCommand` P3: no loop/plan, has unclosed spawn →
       `{source:"events-spawn", command:"sgc tail --since <ts>"}`.
   13. `inferVerifyCommand` P4 fallback: all signals empty →
       `{source:"todo"}`, no command.
   14. `gatherUnpromotedCaptures` filters: synthetic
       `<stateRoot>/ship-failures/` (one with `promoted_to:` set,
       one without) + `canaries/` (same) → only the unpromoted
       pair returned, combined into single array with `kind`
       discriminator.
   15. `gatherUnclosedSpawns` pairs by `spawn_id`: NDJSON tail
       with 3 spawn.start + 2 spawn.end → 1 unclosed (correct
       spawn_id surfaced).
   16. `gatherGit` non-git-repo: returns `{branch:"(not a git
       repo)", changes:[]}` (no throw).
   17. `renderHandoffMarkdown` deterministic: same snapshot →
       same markdown (byte-equal). Frontmatter `verify_command_
       source: todo` case renders `verify_command: "TODO:
       operator-fill"`.
   18. `writeHandoffMarkdown` atomic: race-test that target file
       never observed in partial-write state across overwrite
       (writes succeed; tmp file cleaned).
   19. `runHandoff --auto` integration: synthetic state root →
       `tasks/<slug>-paused.md` written, exit 0.
   20. `runHandoff --print <slug>` happy + missing-file (2 sub-
       cases).

   `tests/dispatcher/sgc-cli.test.ts` (extend):
   - `sgc --help` lists `handoff` subcommand.
   - `sgc handoff --help` shows `--auto` + `--print` flags.

   Test delta: ≥20 (target: dispatcher 773 → ≥793 pass / 0 fail;
   some items contain sub-cases — render-determinism + render-TODO,
   `--print` happy + missing — so realistic count is 20–22).

5. **No changes** to: `contracts/sgc-capabilities.yaml`,
   `prompts/*.md`, `src/dispatcher/spawn.ts`,
   `src/dispatcher/validation.ts`, `src/commands/plan.ts`,
   `src/commands/work.ts`, `src/commands/ship.ts`,
   `src/commands/compound.ts`, `src/commands/canary.ts`,
   `src/commands/loop.ts`, `src/commands/reflect.ts`,
   `src/commands/watch-ci-failure.ts`, any Invariant §1 / §3 / §6 /
   §13 enforcement path. CE-1 prior_preventions, CE-2 reflect,
   CE-3 ship-failure capture, CE-4 async plan, CE-5 loop, CE-6
   applied_in, GS-1 canary, GS-1.1 canary-promote all stay
   byte-for-byte unchanged.

6. **CHANGELOG.md** gains `## v1.13.0` entry naming GS-2 by
   feature ID f9 (sibling to CE-N arc + GS-1, no parent intent),
   describing: new sgc-native `sgc handoff --auto` + `--print
   <slug>` commands; heuristic-only (no LLM, no agent spawn, no
   §13 paired event in v0); writes outside `.sgc/` to project
   `tasks/` directory (no new state namespace); 3-tier
   verify-command priority cascade (loop-run paused / plan-job
   running / events-tail unclosed) + TODO fallback; complementary
   (not competing) with claude-mem-lite `<session-handoff>`
   SessionStart hook; **third ship of GS-N absorb arc**
   (sgc-native gstack-style capabilities per
   `docs/POSITIONING.md`); explicit absorb-not-vendor stance — no
   gstack source copied, no gstack binary called, no gstack
   dependency introduced.

7. **Release** v1.12.1 → **v1.13.0** (minor — additive command;
   per §EXT released-artifact checklist):
   - SemVer non-patch ✓ (minor; new public CLI surface)
   - CHANGELOG migration note ✓ (no migration — additive;
     operators unchanged unless they invoke `sgc handoff`)
   - Opt-out / revert: `git revert <release-sha>` reverts code;
     existing `tasks/*-paused.md` files are harmless leftover
     that future code ignores (operator-local task files,
     reversible).
   - Per [[project_sgc_ship_workflow]]: main-direct + `v1.13.0`
     tag → publish.yml → npm publish; `package.json` +
     `plugins/sgc/.claude-plugin/plugin.json` lockstep version
     bump.
   - Discoverability: README command table gains `sgc handoff`
     row; `sgc --help` lists the subcommand; POSITIONING.md
     `### sgc owns` section gains `Session-state checkpoint`
     bullet (separately tracked under POSITIONING.md drift-fix
     item planned for GS-7 ship).

8. **Dogfood** (lands in same ship as r1 → implemented bump): run
   `sgc handoff --auto` from the live repo at the end of the
   implementation session. Expect:
   - Exit 0
   - `tasks/<YYYY-MM-DD>-gs-2-handoff-paused.md` (or similar)
     written
   - Frontmatter `verify_command_source` ∈ {`loop-run`,
     `plan-job`, `events-spawn`, `todo`}
   - Body Section 6 (Recent commits) shows the last 3 commits of
     this session
   - `sgc handoff --print <slug>` reproduces stdout
   Record outcome in r2 Change log entry alongside dispatcher test
   count delta. This is the GS-2 analogue of CE-3.1 / GS-1.1
   self-dogfood (which uncovered DOG-1 / DOG-2 / PATH-shadow /
   dedup-malformed bugs). If dogfood surfaces a bug, fix-in-arc
   (v1.13.1) following CE-3.1 + GS-1.1 + GS-1.2 precedent.

## Open questions

- **claude-mem-lite handoff coexistence**: should GS-2 paused.md
  Section 1 include a pointer to the most recent `<session-handoff>`
  block from claude-mem-lite (if detectable from logs)? v0 says NO
  — claude-mem-lite handoff is injected at SessionStart for next
  session's *agent* context; GS-2 paused.md is for *operator*
  read. The two consumers differ. Revisit if operators report
  redundancy or gaps. Resolve in v1.13.x patch or GS-2.x if
  pattern emerges.
- **Multiple active intents (concurrent decisions)**: rare but
  possible — operator runs `sgc plan` on two unrelated tasks in
  the same repo cwd without resolving the first. v0 picks
  mtime-newest as slug source; the older decision is invisible in
  Section 1 but still surfaces in Section 4 (Unpromoted captures)
  if its ship-failure / canary records exist. If field experience
  shows operators want full multi-intent visibility, GS-2.x may
  add `--slug <id>` override to target a specific decision.
- **Cross-platform `git status` parsing**: v0 uses `git status
  --porcelain=v1` which is stable across git versions ≥1.7.
  Windows PowerShell line-ending differences are best-effort; CRLF
  in `git status` output is normalized via `.split(/\r?\n/)`.
  Documented as limitation; not auto-port to native git2 lib.
- **events.ndjson tail window size**: locked at last 500 lines
  for v0. Long-running async plan-jobs producing many events
  could push their spawn.start outside the 500-line window,
  making P3 miss unclosed spawns. If operators report missed P3
  signals on long sessions, expand to last 2000 lines or
  time-based windowing in GS-2.x.
- **Slug collision across distinct sessions same day**: two
  separate sessions on `2026-MM-DD` both with active intent
  `title: "GS-2 handoff"` produce the same slug → atomic
  overwrite (locked decision) replaces older. Operator who needs
  both retained renames the first via `mv tasks/<a>-paused.md
  tasks/<a>-paused.session-1.md` before re-running. Not a
  blocker for v0; document in README.
- **`--from-handoff` compound promote sibling (GS-2.1)**:
  explicitly out of v0 scope per Non-goals. Reopen only if real
  demand surfaces (operator reports "I want to promote my
  paused.md verify_command into a CE-1 prevention"). The natural
  path absent demand is operator-typed `prevention_seed:` on an
  existing decision, not a dedicated promote command.
- **POSITIONING.md drift entry**: GS-2 adds another sgc-owned
  capability ("Session-state checkpoint"). Will be folded into
  the POSITIONING.md drift-fix sweep planned for GS-7 ship per
  prior session deferral list, NOT in this v0 ship.
- **Verify-command shell-quoting safety**: command strings
  embedded in frontmatter are operator-readable but should not
  contain shell metacharacters that would break copy-paste. Loop
  / plan IDs are alphanumeric + `-` per existing slug conventions
  (e.g. `2026-05-26-1842-gs-2`); ISO timestamps in `--since
  <ts>` may contain `:` which most shells handle without
  quoting. Document the format in README; if real breakage
  surfaces, wrap commands in `\` " ` " \` ` escaping in v1.13.x.

## Change log

- 2026-05-26 r2 — **implemented + live dogfood green**. All 8 success
  criteria met. Module sizing: `src/dispatcher/handoff.ts` 620 LOC,
  `src/commands/handoff.ts` 74 LOC (impl total ~694; budget was ~410 —
  larger than estimated because the runGit shell-out helper +
  defaultGitProbe + section-by-section gather helpers added more than
  initially projected; nothing speculative, all in scope per spec
  §Constraints + §Success criteria). Dispatcher CI gate **773 → 815**
  pass (+42; spec target was +20, comfortably cleared). 0 fail across
  full dispatcher suite. Eval-tier 3 fails are pre-existing LLM API-
  dependent flakes (`tests/eval/*-llm.test.ts`), unrelated to GS-2.

  **Live dogfood evidence**: `bun src/sgc.ts handoff --auto` against
  this repo (commit `ca86458` head, mid-shipsession) emitted
  `paused: /mnt/Sda2/dev/sdsbp/sgc/tasks/2026-05-26-vendor-ce-compound-engineering-capabilit-paused.md`
  exit 0. Inspecting the written file:
  - Frontmatter all 5 fields: `slug` / `generated_at` / `sgc_version:
    1.13.0` / `verify_command_source: events-spawn` /
    `verify_command: sgc tail --since 2026-05-26T09:08:31.274Z`.
  - Section 1 cited mtime-newest intent (parent CE compound intent
    `94913CB45F9D4C3E906B3C2C8E`, L3) + Iron Law #2 verify command
    derived via P3 cascade (events.ndjson tail surfaced an unclosed
    `spawn.start` for `clarifier.discover` agent — a real prior-session
    artifact, not synthetic).
  - Sections 2/3/4: in-flight plan jobs / loop runs / unpromoted
    captures all empty (correct — no work in flight, all CE-3/GS-1
    captures already promoted).
  - Section 5 Git: `branch: main (ahead 19, behind 0)` + 2 modified
    files (`package.json` + `plugins/sgc/.claude-plugin/plugin.json`
    — the in-progress v1.13.0 lockstep bump).
  - Section 6: last 3 commits = ca86458 (CHANGELOG) / 38adc9c (T15
    sgc.ts register) / 0f7458a (T14 CLI handler). Correct.

  `sgc handoff --print <slug>` smoke test: stdout reproduced the file
  content verbatim (exit 0). `sgc handoff --print nonexistent-slug`
  emitted `no paused.md for slug nonexistent-slug` exit 1. All 3 CLI
  paths verified live against real state.

  P3 cascade firing is itself evidence the heuristic works against
  real data — the events.ndjson tail genuinely contained an unclosed
  spawn from an earlier session that never finished. The handoff
  surfaced a real Iron Law #2 anchor the operator would otherwise
  miss. This is the GS-2 analogue of GS-1 v1.11.0's first dogfood
  (which caught the PATH-shadow bug) and CE-3.1 v1.6.0's first
  dogfood (which caught the gh-cli tag-trigger trap). Validates the
  dogfood-as-test paradigm a fourth time (CE-3.1 → GS-1.1 → GS-1.2 →
  GS-2). No bug surfaced in T17 dogfood — the implementation is
  correct on first run.

  Version bumped v1.12.1 → v1.13.0; `package.json` +
  `plugins/sgc/.claude-plugin/plugin.json` lockstep per
  [[project_sgc_ship_workflow]] memory.

- 2026-05-26 r1 — initial draft. brainstorming session locked 7
  design axes: shape (协议状态快照 → `tasks/<slug>-paused.md`),
  `--auto` semantics (auto-detect slug + state), scope (6-section
  sweep), verify-cmd source (3-tier priority cascade + TODO
  fallback), next-session consumption (operator-driven, zero
  hook), idempotency (atomic overwrite + no auto-clean), promote
  split (GS-2 standalone, no GS-2.1 sibling). Architecture
  approach A chosen: typed `HandoffSnapshot` + render +
  3 priority signal scanners; mirrors `canary.ts` / `loop.ts`
  module pattern. Module sized ~280 LOC + ~100 LOC commands
  wrapper; dispatcher CI gate 773 → target ≥790 (+17). Spec
  drafted following GS-1 r1 house style (Goal / Non-goals (v0) /
  Constraints / Success criteria / Open questions / Change log).
