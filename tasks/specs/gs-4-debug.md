---
status: draft
revision: 1
task_id: gs-4-debug
feature_id: f11
parent_intent: (none — GS-4 is the fifth ship of the GS-N absorb arc, sgc-native heuristic implementations of selected gstack-style capabilities per docs/POSITIONING.md. Sibling to CE-N; outside any compound parent intent. Sibling to GS-1 canary v1.11.0 + GS-1.1 promote v1.12.0 + GS-1.2 dedup robustness v1.12.1 + GS-2 handoff v1.13.0 + GS-7 land v1.14.0/v1.14.1.)
---

# GS-4 — `sgc debug` systematic-debugging phase-walker

## Goal

Add a sgc-native **4-phase debug orchestrator** absorbed from
`sp:systematic-debugging` intent + CLAUDE.md §6 Iron Law #3
("NO FIX WITHOUT ROOT CAUSE"). New standalone CLI `sgc debug` walks
the canonical 4 phases (investigate → analyze → hypothesize →
implement) as a state machine over `.sgc/investigations/<id>.md`,
auto-running the three read-only phases on `start` and pausing for
the operator at `implement`. `sgc debug close` is the Iron Law #3
hard-gate: refuses unless `--root-cause` + `--fix-commit` +
`--verify-command` all non-empty.

```
sgc debug start "<symptom>"
  ≡ open <id>.md → status:in_progress → run investigate + analyze +
    hypothesize heuristically → status:current_phase=implement →
    print hypotheses + pause

sgc debug close --id <id>
       --root-cause "<text>"
       --fix-commit <sha>
       --verify-command "<cmd>"
  ≡ validate 3 flags non-empty → write fix evidence → status:closed
```

This makes Iron Law #3 mechanically enforced rather than convention.
Today the rule binds at protocol layer but lives in agent prose;
sgc debug captures the same evidence shape (prior failing path → root
cause → verify command) into a structured single-file record an
operator (or future LLM consumer) can grep.

The 4-phase mapping to `sp:systematic-debugging`:

| sp phase | sgc debug phase | Mode |
|---|---|---|
| Investigate (gather facts) | `investigate` | auto (heuristic) |
| Analyze (pattern-match) | `analyze` | auto (heuristic, reuses CE-1 corpus walker) |
| Hypothesize (rank candidates) | `hypothesize` | auto (heuristic, top-N render) |
| Implement (fix + verify) | `implement` | operator (paused) |
| (close discipline) | `close` | operator (Iron Law #3 hard-gate) |

GS-4 is the **fifth ship of the GS-N absorb arc**, sibling to GS-1
canary / GS-1.1 promote / GS-1.2 dedup robustness / GS-2 handoff /
GS-7 land. The arc follows the same SPINE: spec → plan → implement →
dogfood → main-direct → tag → publish. Heuristic only. Zero new
dependencies. No new hook surface. Reuses CE-1 `walkSolutionsCorpus`
+ `tokenize` + `parseFrontmatter` (single source for cross-corpus
keyword overlap); reuses events.ndjson tail for three-strike
detection; reuses ship-failures/ + canaries/ scanning for historical
signature match.

## Non-goals (v0)

- Do NOT add `sgc compound --from-investigation` promote sibling spec
  in v0. Defer to **GS-4.1** (mirrors CE-3 → CE-3-promote / GS-1 →
  GS-1.1 sibling-spec pattern). Reason: v0 demand is "capture +
  enforce Iron Law #3", not "feed back into solutions/ corpus." The
  promote path is natural follow-on once operators have closed enough
  investigations to validate the seed shape, the same way GS-1.1
  followed GS-1 only after canary records existed.
- Do NOT add LLM-mode for `investigate` / `analyze` / `hypothesize` in
  v0. Matches the GS-N arc convention (CE-3 r1 + GS-1 r1 + GS-2 r1 +
  GS-7 r1 conservatism). Heuristic-only keeps the pre-fix path
  network-independent — operator hitting a bug during outage / offline
  can still `sgc debug start` without API key set. LLM-mode is a
  natural GS-4.2 sibling.
- Do NOT mechanically enforce the §6 three-strike rule (rollback the
  introducing path after 3 matching error signatures). v0 SURFACES
  three-strike matches in the `## 2 — Analyze` section ("⚠ same
  signature seen 3× in events.ndjson tail — consider rollback per §6
  three-strike"); operator decides whether to pivot. Mechanical
  rollback would require deciding which commit "introduced" the path,
  which is not derivable from events.ndjson alone.
- Do NOT scope to sgc-self only. `sgc debug` runs in any cwd
  containing `.sgc/`; sgc-self dogfood is the first consumer but no
  sgc-self gate exists. Matches CE-2 reflect / CE-3 watch-ci-failure
  / GS-1 canary universality.
- Do NOT add `--abandon <id>` flag. Operator who decides mid-walk that
  the investigation is wrong path → manual `rm
  .sgc/investigations/<id>.md`. Same convention as `.sgc/loop-runs/`
  + `.sgc/plan-jobs/` (no `sgc loop --abandon`; no `sgc plan
  --abandon`).
- Do NOT add `--reopen <id>` flag. Re-debugging the same symptom →
  `sgc debug start "<symptom>"` creates a new id. Closed
  investigations are immutable history; their `root_cause` /
  `fix_commit` / `verify_command` fields are the audit anchor and
  must not be retroactively edited via CLI.
- Do NOT make `sgc debug` write to `.sgc/solutions/` (Invariant §3),
  `.sgc/reviews/` (Invariant §6), `.sgc/decisions/`, or
  `.sgc/progress/handoff.md`. The only written state is
  `.sgc/investigations/<id>.md`; events appended to
  `.sgc/progress/events.ndjson` are voluntary telemetry.
- Do NOT support interactive TTY prompts at any phase. `sgc debug` is
  non-interactive; matches CLI convention across all 10 existing
  sgc subcommands.
- Do NOT auto-trigger from a Stop / SessionEnd / PostToolUse hook.
  Consumption is operator-typed when investigating. Hook surface
  remains occupied by claude-mem-lite; same v0 rationale as GS-2 +
  GS-7.
- Do NOT include any `--json` output flag in v0. Structured data lives
  in `.sgc/investigations/<id>.md` frontmatter (readable as YAML by
  any consumer) and in events.ndjson via `sgc tail`. A `--json`
  flag duplicates the channel. Matches GS-7 OQ #7 decision.
- Do NOT support escape from Iron Law #3 close gate via `--reason`
  flag. The three required flags are absolute; if operator can't
  fill one, the investigation stays in_progress (acceptable interim
  state) or operator manually deletes the file. v0 takes the strict
  reading.

## Constraints

### State-layer touch points

`sgc debug` writes ONLY to `.sgc/investigations/<id>.md` (new
namespace, mkdir lazy on first start) and APPENDS to
`.sgc/progress/events.ndjson` (existing). All other reads are
read-only:

- `.sgc/solutions/<cat>/*.md` — CE-1 `walkSolutionsCorpus` for
  prevention overlap in `analyze` phase.
- `.sgc/ship-failures/*.md` + `.sgc/canaries/*.md` — historical
  signature scan in `analyze` phase.
- `.sgc/progress/events.ndjson` — last 500 lines tail for
  three-strike pattern in `analyze` phase.
- `.sgc/decisions/` — NOT read in v0 (decisions are intent records,
  not error history; no signal for debug analyze).

### Invariants untouched

- **§1 back-channel**: not applicable — no LLM agent spawn, no
  reviewer/qa input.
- **§3 dedup write-gate**: not applicable — no `writeSolution` call.
- **§4 L3 ship signature**: not applicable — `sgc debug` is an L0
  read+capture tool, not a ship-path runner.
- **§6 reviews append-only**: not applicable — no `appendReview` call.
- **§13 paired events Tier 1**: `sgc debug` is not a spawn; no
  `spawn.start` / `spawn.end` owed. The four voluntary `debug.*`
  events are additive telemetry, not Tier 1.
- **§13 Tier 2**: not applicable — no LLM call.
- **schema_version**: stays at 1. `event_type: ${string}.${string}`
  template literal already accepts the four new event-type strings;
  no contract bump owed.

### Module pattern follows CE-5 / GS-2 / GS-7

```
src/dispatcher/debug.ts          (orchestrator + types + heuristic phases +
                                  Iron Law #3 gate + atomic write)
src/commands/debug.ts            (citty thin wrapper, lazy-imports runDebugStart /
                                  runDebugClose / runDebugList / runDebugStatus)
src/sgc.ts                       (defineCommand block + subCommands registration)
tests/dispatcher/debug.test.ts   (unit suite with opts.heuristic injection)
tests/dispatcher/sgc-cli.test.ts (+2 help-surface tests)
```

`opts.heuristic` injection seam (mirrors CE-5 loop's `opts.steps` +
GS-7 land's `opts.steps`) lets tests stub the three heuristic readers
(`corpusOverlap` / `eventsTailScan` / `historicalSignatureScan`)
without touching real disk. `defaultHeuristic()` lazy-imports CE-1
`walkSolutionsCorpus` from `src/dispatcher/preventions.ts`.

### Id derivation

`<YYYY-MM-DD>-<HHMM>-<kebab(symptom)[:30]>` derived at `start` time.
Mirrors GS-2 `deriveSlug` shape with two adjustments: source is
operator-typed `<symptom>` argument (not `decisions/intent.md
title`); slug body cap is 30 chars (not 40) because symptom strings
tend to be shorter and the HHMM time prefix already disambiguates
same-day repeats.

`kebabize` lowercases + strips NFD diacritics + replaces
non-`[a-z0-9]` with `-` + trims edge `-` (same as GS-2). Fallback
`<YYYY-MM-DD>-<HHMM>-debug` (no body) when `kebab(symptom)` is empty
(pure CJK / pure punctuation symptom). Same-minute collision (two
`sgc debug start` calls in same minute with same kebab) → second
appends `-2` / `-3` suffix; tie-break is filesystem mtime of existing
investigations/.

### Heuristic phase logic

**Investigate** (auto, ≤200ms target):

1. `git rev-parse HEAD` (best-effort; not-a-repo → `(no git)`).
2. `git status --porcelain` (last 20 changed paths).
3. `events.ndjson` tail last 50 lines (timestamp + event_type +
   agent only, no full payload).
4. Render to `## 1 — Investigate` body section.

No LLM. Defensive try/catch per sub-step; failed step writes `(N/A:
<reason>)` placeholder, never aborts phase.

**Analyze** (auto, ≤500ms target):

1. Tokenize `<symptom>` via existing `tokenize` (CE-1 export, NFC +
   `Intl.Segmenter`).
2. `walkSolutionsCorpus(stateRoot, tokens)` → keyword-overlap top-N=5
   from `.sgc/solutions/*/`.
3. Scan `.sgc/ship-failures/*.md` + `.sgc/canaries/*.md` for matching
   error-signature substrings (first 80 chars of symptom).
4. `events.ndjson` tail last 500 lines → group by error signature
   (event payload `error_class` + `error_message[:80]` normalized);
   any signature with count ≥3 → three-strike flag.
5. Render `## 2 — Analyze` with three sub-sections: prior preventions
   (corpus hits), historical signatures (ship-failures/canaries
   hits), three-strike (events.ndjson recurrence flags).

**Hypothesize** (auto, ≤100ms target):

1. Concatenate top-N candidates from analyze step into ranked list
   ordered by descending overlap score (prior preventions first, then
   historical signatures, then three-strike).
2. Render `## 3 — Hypothesize` as numbered list with `solution_ref`
   or `capture_ref` anchors and one-line relevance reason per item.
3. If all three analyze sub-sections empty → render single line:
   `No prior matches. Operator-formulated hypothesis required.`

### Iron Law #3 close gate

`runDebugClose(opts)` validates ALL THREE flags before any write:

| Flag | Validation | stderr on fail |
|---|---|---|
| `--root-cause` | non-empty after trim | `close refused: --root-cause required (Iron Law #3)` |
| `--fix-commit` | non-empty + matches `/^[0-9a-f]{7,40}$/` | `close refused: --fix-commit must be 7-40 hex chars (Iron Law #3)` |
| `--verify-command` | non-empty after trim | `close refused: --verify-command required (Iron Law #3)` |

`--fix-commit` SHA is NOT validated against actual git history (no
`git cat-file -e` check) in v0; operator-typed SHA is trusted.
Validation gate is "shape only" — same posture as GS-2 slug suffix
regex.

Investigation must exist + status MUST be `in_progress` to close.
Already-closed → `close refused: <id> already closed` exit 1.
Missing file → `close refused: no investigation at <path>` exit 1.

On success: writes `status:closed` + `closed_at:<ISO>` +
`root_cause:<text>` + `fix_commit:<sha>` + `verify_command:<cmd>` to
frontmatter; appends `## 5 — Fix evidence` section to body; emits
`debug.closed` event.

### Event-stream contract

Four new event types, all additive under existing
`${string}.${string}` template literal:

```json
{"event_type":"debug.start","payload":{"investigation_id":"...","symptom":"..."}}
{"event_type":"debug.phase_complete","payload":{"investigation_id":"...","phase":"investigate|analyze|hypothesize"}}
{"event_type":"debug.closed","payload":{"investigation_id":"...","root_cause":"...","fix_commit":"...","verify_command":"..."}}
{"event_type":"debug.heuristic_failed","payload":{"investigation_id":"...","phase":"...","error_class":"...","error_message":"..."}}
```

`debug.heuristic_failed` fires per-phase when a defensive try/catch
absorbs a heuristic step failure (e.g. corpus walk threw,
events.ndjson unreadable). Phase still completes with placeholder
body; the event is the audit anchor. No Tier 1 paired event owed.

### Atomic write

`writeInvestigation` uses `fs.writeFile(tmp) + fs.rename(tmp, target)`
POSIX-atomic pattern (same as GS-2 `writeHandoffMarkdown`). Re-run
on closed file would be refused at validation; mid-walk atomic
rewrite is needed for `start` → `close` transition.

### Async fs

`node:fs/promises` only — consistent with H.1 ship C, CE-1, CE-2,
CE-3, CE-6, GS-1, GS-2, GS-7 precedents.

### CLI exit-code split

- `start "<symptom>"` happy → stderr `started: <path>` exit 0
- `start "<symptom>"` IO/permission failure → stderr `debug failed:
  <reason>` exit 1
- `close --id <id>` happy → stderr `closed: <id>` exit 0
- `close` Iron Law #3 violation → stderr `close refused: <field>
  required (Iron Law #3)` exit 1
- `close` no-such-investigation → stderr `close refused: no
  investigation at <path>` exit 1
- `close` already-closed → stderr `close refused: <id> already
  closed` exit 1
- `--runs` (no arg) → stdout table sorted started_at desc → exit 0
- `--status <id>` → stdout frontmatter + 4 sections → exit 0 if found,
  1 if missing
- bare `sgc debug` → stderr `usage: sgc debug start "<symptom>" |
  close --id <id> ... | --runs | --status <id>` exit 1

### Process exit + stdout buffering

`runDebug*` returns a `DebugResult { exitCode: 0 | 1, ... }`; citty
`run` handler is responsible for `process.exit(exitCode)` after
stdout/stderr are flushed. Mirrors `canary` / `handoff` / `land`
pattern.

stdout writes via `opts.stdoutWrite ?? process.stdout.write` and
stderr via `opts.stderrWrite ?? process.stderr.write` for test
isolation.

### Hidden test seam

`--state-root <path>` + `--repo-root <path>` flags (not documented in
`--help`, mirrors CE-3 / GS-1 / GS-2 / GS-7 hidden hooks) let tests
point at synthetic state without env var pollution. `opts.now?: Date`
override on the dispatcher entry function (`runDebugStart(opts)`)
covers id-derivation determinism in tests.

## Success criteria

GS-4 ships when ALL of:

1. **`sgc debug` exists** as a registered subcommand. `sgc --help`
   lists it; `sgc debug --help` shows `start <symptom>` /
   `close --id` / `--runs` / `--status <id>` surface.

2. **`start` happy path**: `sgc debug start "<symptom>"` in a repo
   with `.sgc/` creates `.sgc/investigations/<YYYY-MM-DD>-<HHMM>-<kebab>.md`
   with frontmatter status:in_progress, current_phase:implement, runs
   all three heuristic phases inline, prints `## 3 — Hypothesize`
   hypothesis list to stdout, exits 0. Events.ndjson contains
   `[debug.start, debug.phase_complete×3]`.

3. **`start` empty corpus**: `sgc debug start "<symptom>"` in a repo
   with empty `.sgc/solutions/` and empty `.sgc/ship-failures/` and
   empty `.sgc/canaries/` produces investigation with `## 2 — Analyze`
   sub-sections each rendering `(none)` and `## 3 — Hypothesize`
   rendering `No prior matches. Operator-formulated hypothesis
   required.` Exit 0.

4. **`start` heuristic failure resilience**: `sgc debug start
   "<symptom>"` where `.sgc/progress/events.ndjson` is corrupt
   (unparseable line) → analyze phase swallows error, writes
   placeholder, emits `debug.heuristic_failed` event, completes
   normally, exit 0. Investigation file still readable.

5. **`close` Iron Law #3 gate fires** for each missing flag:
   - `sgc debug close --id <id>` (no flags) → exit 1, stderr cites
     `--root-cause`
   - `sgc debug close --id <id> --root-cause "..."` → exit 1, stderr
     cites `--fix-commit`
   - `sgc debug close --id <id> --root-cause "..." --fix-commit "..."` →
     exit 1, stderr cites `--verify-command`
   - All three present → exit 0, frontmatter updated, body section 5
     appended, `debug.closed` event emitted.

6. **`close` SHA shape gate**: `sgc debug close --id <id> --root-cause
   "..." --fix-commit "not-a-sha" --verify-command "..."` → exit 1,
   stderr cites the regex requirement. `--fix-commit abc1234` (7 chars)
   passes; `--fix-commit deadbeefdeadbeefdeadbeefdeadbeefdeadbeef`
   (40 chars) passes.

7. **`close` already-closed refuse**: re-running close on an already
   closed `<id>` → exit 1, stderr `close refused: <id> already
   closed`. Frontmatter unchanged (no overwrite).

8. **`close` missing file**: `sgc debug close --id nonexistent` →
   exit 1, stderr `close refused: no investigation at <path>`.

9. **`--runs`**: lists every `.sgc/investigations/*.md` sorted
   started_at desc, with status column + symptom column truncated to
   60 chars. Exit 0 on empty list (stdout `no investigations`).

10. **`--status <id>`**: stdout shows frontmatter + 4 body sections
    verbatim. `<id>` missing → exit 1 stderr `no investigation at
    <path>`.

11. **Three-strike surface**: synthetic events.ndjson with the same
    `error_class:Error` + `error_message:Timeout exceeded for foo` in
    3 distinct entries → analyze phase output contains `⚠ three-strike:
    Error: Timeout exceeded for foo (3 occurrences)` line. operator
    sees the §6 rollback hint.

12. **Test surface**: dispatcher CI gate ≥ **+20 tests** (≥18 in
    `tests/dispatcher/debug.test.ts` covering all 11 paths above +
    id-derivation variants + heuristic-injection seam smoke + atomic
    write + slug collision; +2 in `tests/dispatcher/sgc-cli.test.ts`
    for `--help` listing + `debug --help` flag visibility). Full
    dispatcher suite green: 0 fail. Target: 833 → ≥853.

13. **No changes** to: `contracts/sgc-capabilities.yaml`,
    `prompts/*.md`, `src/dispatcher/spawn.ts`,
    `src/dispatcher/validation.ts`, `src/commands/plan.ts`,
    `src/commands/work.ts`, `src/commands/ship.ts`,
    `src/commands/compound.ts`, `src/commands/canary.ts`,
    `src/commands/loop.ts`, `src/commands/reflect.ts`,
    `src/commands/watch-ci-failure.ts`,
    `src/commands/land.ts`, `src/commands/handoff.ts`,
    any Invariant §1 / §3 / §6 / §13 enforcement path. CE-1 / CE-2 /
    CE-3 / CE-4 / CE-5 / CE-6 / GS-1 / GS-1.1 / GS-1.2 / GS-2 / GS-7
    all stay byte-for-byte unchanged.

14. **CHANGELOG.md** gains `## v1.15.0` entry naming GS-4 by feature
    ID f11 (sibling to CE-N + GS-1 + GS-2 + GS-7, no parent intent),
    describing: new sgc-native `sgc debug start | close | --runs |
    --status` commands; heuristic-only (no LLM, no agent spawn, no
    §13 paired event in v0); writes to new `.sgc/investigations/`
    namespace; Iron Law #3 mechanically enforced at close (3-flag
    hard gate); three-strike pattern surfaced in analyze phase
    (informational, not enforced); **fifth ship of GS-N absorb arc**
    (sgc-native gstack-style capabilities per
    `docs/POSITIONING.md`); explicit absorb-not-vendor stance — no
    gstack source copied, no gstack binary called, no gstack
    dependency introduced.

15. **Release** v1.14.1 → **v1.15.0** (minor — additive command;
    per §EXT released-artifact checklist):
    - SemVer non-patch ✓ (minor; new public CLI surface)
    - CHANGELOG migration note ✓ (no migration — additive;
      operators unchanged unless they invoke `sgc debug`)
    - Opt-out / revert: `git revert <release-sha>` reverts code;
      existing `.sgc/investigations/*.md` files are harmless
      leftover that future code ignores (operator-local state
      files, reversible).
    - Per [[project_sgc_ship_workflow]]: main-direct + `v1.15.0`
      tag → publish.yml → npm publish; `package.json` +
      `plugins/sgc/.claude-plugin/plugin.json` lockstep version
      bump.
    - Post-publish verification chain per GS-7 ship: `sgc land`
      from v1.14.1 against v1.15.0 release (FIRST post-v1.14.0
      dogfood of `sgc land` per GS-7 OQ #8 deferred decision —
      this is the natural dogfood-of-dogfood evidence).
    - Discoverability: README command table gains `sgc debug`
      row; `sgc --help` lists the subcommand; POSITIONING.md
      `### sgc owns` section gains `Root-cause debug` bullet.

16. **Dogfood** (lands in same ship as r1 → implemented bump): run
    `sgc debug start "<some real GS-4 in-session bug if any
    surfaces>"` from the live repo at end of implementation session.
    Expect:
    - Exit 0
    - `.sgc/investigations/<YYYY-MM-DD>-<HHMM>-<kebab>.md` written
    - All 4 body sections rendered (## 1–## 3 with content, ## 4
      empty for operator)
    - At least one of analyze sub-sections has a hit (corpus or
      historical signature or three-strike) given the existing
      .sgc/ state
    - `sgc debug --status <id>` reproduces stdout

    If dogfood surfaces a bug (DOG-4), fix-in-arc (v1.15.1)
    following CE-3.1 + GS-1.1 + GS-1.2 + GS-7 DOG-3 precedent. The
    GS-N arc has caught 4 dogfood-found bugs across 6 ships; GS-4 is
    the next opportunity (paradigm validation chain: CE-3.1 → GS-1.1
    → GS-1.2 → GS-2 clean → GS-7 DOG-3 → GS-4 ?).

## Open questions

1. **Should `--runs` support `--status-filter <in_progress|closed>`?**
   Recommended (v0): no. The status column makes filtering operator-
   trivial via grep / awk; adding a flag at v0 is YAGNI. Revisit if
   operators report friction with `.sgc/investigations/` exceeding
   ~20 records.

2. **Should `start` accept symptom from stdin (no positional arg) for
   multi-line symptoms?** v0: no. Symptom is operator-typed one-liner;
   multi-line investigations encode their bulk into `## 1 —
   Investigate` body via the heuristic, not into the slug source.
   If operator wants to record multi-line context, manual edit of
   the body section is fine — investigation file is operator-readable
   markdown.

3. **What's the `events.ndjson` tail window for three-strike
   detection?** v0: locked at last 500 lines (mirrors GS-2 P3 cascade
   choice). Long-running sessions producing many events could push
   the strike beyond the window. If field experience shows missed
   strikes, expand to 2000 lines or time-based windowing in GS-4.x.

4. **Should `analyze` weight three-strike higher than corpus overlap
   in `hypothesize`?** v0: corpus hits rank first (operator-curated
   knowledge > automated pattern detection). Three-strike is signal
   but not authoritative without operator interpretation. Revisit if
   dogfood shows three-strike candidates routinely outrank corpus
   for actual root causes.

5. **Should `close` validate `fix_commit` SHA exists in `git log`?**
   v0: no — shape-only regex. Validating against `git cat-file -e
   <sha>` adds a shellout and a third failure path; operator who
   typed a wrong SHA gets a quiet audit-trail error rather than CLI
   noise. If field experience shows operators frequently typo SHAs,
   add `--strict` flag in GS-4.x.

6. **Should there be a `sgc debug retro` audit command?** Tempting
   — list closed investigations + group root causes + count
   recurrence — but separate concern from GS-4 core. Mirrors CE-2
   `sgc reflect` shape; would be a sibling GS-4.x or natural fold
   into CE-2 reflect's audit surface. Defer.

7. **Should `sgc compound --from-investigation <id>` exist as v0
   feature?** No — explicit GS-4.1 sibling spec scope per
   Non-goals. Reason: needs validated seed shape from real closed
   investigations before deciding category derivation rules.
   Operators who want to seed solutions/ from an investigation
   today can manually copy `root_cause` text into a
   `prevention_seed:` field on an existing decision (same path
   absent the flag).

8. **POSITIONING.md drift entry**: GS-4 adds another sgc-owned
   capability ("Root-cause debug"). Bundle in same ship as the
   delegate-row update, mirrors GS-2 + GS-7 bundling. POSITIONING.md
   row content: `sgc debug start | close — 4-phase systematic-
   debugging walker with Iron Law #3 mechanical close gate`.

9. **Should `current_phase: implement` block other sgc commands?**
   E.g. should `sgc plan` refuse to run when an in-progress
   investigation exists? v0: no. Investigations are operator-state
   artifacts, not protocol-blocking gates. Operator decides whether
   to interleave debug with plan/work/review.

10. **HHMM granularity in slug — risk of collision under fast
    operator iteration?** Two `sgc debug start` calls in the same
    HHMM window will produce same-prefix slugs; the `-2`/`-3`
    suffix appends to disambiguate. v0 accepts this — operators
    running ≥2 debug starts in one minute is rare enough that
    suffix appendage is a reasonable cost.

## Change log

- 2026-05-27 r1 — initial draft. brainstorming session locked 3
  design axes: shape (B phase-walker orchestrator over A scaffold /
  C heuristic suggestor), phase granularity (B1 auto-walk read-only
  + pause at implement over B2 per-phase subcommand / B3 single
  advance), state shape (S1 single-file `.sgc/investigations/<id>.md`
  over S2 multi-file directory / S3 hybrid), Iron Law #3 close gate
  strictness (G1 three-flag hard required over G2 root_cause-only +
  --reason escape / G3 soft warning). Defaults locked via precedent:
  heuristic sources (CE-1 walkSolutionsCorpus + events.ndjson tail +
  ship-failures/canaries signature scan — three-way reuse), compound
  integration deferred to GS-4.1 (mirrors CE-3 → CE-3-promote / GS-1
  → GS-1.1), three-strike informational-only (not mechanical
  rollback), universal audience (no sgc-self gate), no `--json` / no
  `--abandon` / no `--reopen` v0, `--state-root` hidden test seam
  per CE-3/GS-1/GS-2/GS-7 pattern. Architecture approach: in-process
  orchestrator with `opts.heuristic: HeuristicReaders` injection
  seam (mirrors CE-5 sgc loop / GS-2 handoff / GS-7 land). Module
  sized ~280 LOC orchestrator + ~80 LOC commands wrapper;
  dispatcher CI gate 833 → target ≥853 (+20). Spec drafted
  following GS-7 r1 house style (Goal / Non-goals (v0) / Constraints
  / Success criteria / Open questions / Change log). POSITIONING.md
  refresh bundled same ship: `sgc debug` delegate-table row +
  `### sgc owns` Root-cause debug bullet.
