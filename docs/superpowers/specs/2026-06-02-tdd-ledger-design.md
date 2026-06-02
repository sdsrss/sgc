---
status: draft
revision: 1
topic: tdd-ledger
phase: 2a
---

# TDD-ledger — design spec (Phase 2a)

## Goal

Anchor the existing `sgc work --done` close-gate to a **recorded prior-RED** (a
failing test / repro + its observed failure output) or an explicit
`--waive-red <reason>`, and make the RED→GREEN pair capturable into the CE
`solutions/` corpus through the existing capture→promote pipeline.

sgc is a **ledger, not a coach**: it *records* the RED→GREEN loop as an
attestation (it never executes the test — same posture as the existing
`--verify-command`, which sgc records but does not run). If `superpowers` is
installed it *runs* the loop; sgc *records* it either way.

This operationalizes the AI-coding spec's own "cite the prior-failing state"
rule (Iron Law #2 bugfix anchor / Iron Law #1 additive RED-first) that the
`sgc work --done` close-gate does not yet enforce.

## Non-goals (YAGNI)

- NOT a re-implementation of `sp:test-driven-development`'s runner. sgc does not
  execute tests or detect red/green — it records operator attestations.
- No two-step `sgc work --red` pre-capture command (evaluated, declined — sgc
  does not execute either command, so temporal pre-recording is attestation
  either way; fold into `--done`).
- No auto-`writeSolution` on `--done` (evaluated, declined — couples `work.ts`
  to the Invariant §3 write-gate and risks corpus bloat; promote stays the
  deliberate, dedup-gated step it is for ship-failures).
- No new `SolutionCategory` enum value (`regression`/`tdd`) — reuse the existing
  enum; promote defaults to `other`, operator-overridable.
- No cross-machine `solutions/` sync (separate cross-cutting debt).
- prior-RED capture lives on the `work` path only — not added to `sgc debug
  close` (which already has its own Iron Law #3 gate).

## Constraints

- **Invariant §3 (deterministic write-gate)**: the `red-green` → `solutions/`
  promote MUST route through the deterministic `findBestMatch` dedup_stamp, like
  `--from-ship-failure`. No LLM mints the stamp; `work.ts` does not call
  `writeSolution`. (See `feedback_compound_related_invariant3.md`.)
- **Released-artifact user-visible default-behavior change** → L3, SemVer minor
  bump, CHANGELOG migration note, opt-out path, first-use discoverability signal
  (CLAUDE-extended §2 Released-artifact checklist). Precedent: v1.19.0 added the
  `--verify-command` hard gate the same way (minor + grandfather already-done).
- **Mirror existing patterns**: capture frontmatter mirrors `ShipFailureFrontmatter`
  (`kind` / `captured_at` / `prevention_seed` / `promoted_to`); promote mirrors
  `--from-ship-failure`; slug collision mirrors investigations' `resolveCollisionId`.
- Bundle re-inlines `src/` + `package.json` → any change here requires
  `npm run build:cli` + committing `plugins/sgc/bin/sgc.mjs` (mode `100755`).

## Success criteria

1. `sgc work --done <id>` refuses unless `--verify-command` **and**
   (`--prior-red` + `--red-output`) **xor** `--waive-red <reason>` are supplied.
2. Supplying both a prior-red pair and `--waive-red` is refused (conflict).
3. A done-transition with a prior-red pair records `prior_red` / `red_output`
   on the feature **and** writes a `red-green/<slug>.md` capture file.
4. A `--waive-red` done records `waived_red` on the feature and writes **no**
   capture file.
5. Already-done features remain a grandfathered no-op (no gate, no capture).
6. `sgc compound --from-red-green <slug>` builds a `SolutionEntry`, runs the
   deterministic dedup, `writeSolution`s a new entry on a miss, merges on a hit
   (no duplicate), and writes `promoted_to` back (idempotent on re-run).
7. `tsc` clean; `sgc doctor` green (bundle parity + slash↔CLI parity);
   full `tests/dispatcher` suite green; the new behaviors RED-first.

## Architecture

### Component 1 — `sgc work` close-gate (`src/commands/work.ts`)

New `WorkOptions` fields: `priorRed?`, `redOutput?`, `waiveRed?`.

Gate logic inside the existing `--done` non-grandfather branch, **after** the
`--verify-command` check:

```
hasRed   = priorRed?.trim() && redOutput?.trim()
hasWaive = waiveRed?.trim()
if (priorRed XOR redOutput)        → throw "both --prior-red and --red-output required together"
if (hasRed && hasWaive)            → throw "give a prior-red pair OR --waive-red, not both"
if (!hasRed && !hasWaive)          → throw "done refused: record a prior-RED (--prior-red + --red-output) or --waive-red <reason>"
```

On pass:
- `hasRed`: set `feature.prior_red`, `feature.red_output`; write capture file
  (Component 3).
- `hasWaive`: set `feature.waived_red`; no capture file.

Gate is **level-agnostic** (consistent with the existing `--verify-command`
gate). `--waive-red "docs-only"` / `--waive-red "additive: no prior failing path"`
is the escape for L0/additive work, and the reason is retained as ledger data.

### Component 2 — `Feature` ledger fields (`src/dispatcher/types.ts`)

Add optional `prior_red?: string`, `red_output?: string`, `waived_red?: string`.
Surfaced in `sgc work` listing and `sgc handoff` so the ledger is observable
(a feature shows RED-anchored vs waived). Additive, backward-compatible
(absent on features done before the gate existed).

### Component 3 — `red-green/<slug>.md` capture (mirrors ship-failures)

Written by `work.ts` (via a `state.ts` helper `writeRedGreenCapture`) under
`<stateRoot>/red-green/`. Slug = `slugify(feature.title)`-`<task_id>` with
same-minute collision resolution (`resolveCollisionId` pattern). Frontmatter:

```yaml
kind: red-green
captured_at: <iso>
task_id: <task_id>
feature_id: <id>
level: <task.level>
prior_red: <failing test / repro>
red_output: <observed failure>
verify_command: <verify-command>
evidence: <evidence?>           # omitted if absent
prevention_seed: "TODO: operator-fill"
promoted_to: <category/slug>    # written back by promote; absent until then
```

`writeRedGreenCapture` uses `writeAtomic` (per STAB-4). Capture-time
`prevention_seed` is the operator-fill placeholder (`PLACEHOLDER_PREFIX` reuse).

### Component 4 — `sgc compound --from-red-green <slug>` (mirrors `--from-ship-failure`)

New flag on the `compound` command (wired in `sgc.ts`) routing to a
`runCompoundPromoteRedGreen` in `src/dispatcher/compound-promote.ts` (or a thin
sibling). Flow, mirroring `--from-ship-failure`:

1. Read `red-green/<slug>.md`; reject if `prevention_seed` still carries the
   `TODO: operator-fill` placeholder (parity with ship-failure's
   capture-time-placeholder guard).
2. Build `SolutionEntry`:
   - `category`: from `--category` flag, default `other`.
   - `problem`: composed from `red_output` (+ `prior_red` as context).
   - `symptoms`: `[red_output]`.
   - `what_didnt_work`: `[]`.
   - `solution`: `verify_command` (+ `evidence` if present).
   - `prevention`: `prevention_seed`.
   - `tags`: derived (e.g. `["tdd", "red-green", level]`).
   - `source_task_ids`: `[task_id]`.
   - `confidence`: `"provisional"`.
3. Deterministic `findBestMatch` dedup → `writeSolution` (new on miss, merge on
   hit — the §3 stamp authorizes the write; no LLM in the loop).
4. Write `promoted_to: <category/slug>` back to the capture frontmatter
   (idempotent; an `AlreadyPromoted` guard catches re-runs, like ship-failure).

Default promote slug: `red-green-<task_id>-<feature_id>` (overridable via the
existing `--slug` flag).

## Data flow

```
operator: sgc work --done f3 --verify-command "pytest tests/x.py" \
            --prior-red "tests/x.py::test_pagination" \
            --red-output "AssertionError: expected 20 got 50"
   │
   ├─ work.ts gate passes → feature.{prior_red,red_output,verify_command,evidence}
   └─ writeRedGreenCapture → .sgc/red-green/<slug>.md (prevention_seed=TODO)

operator (later / janitor): fills prevention_seed, then
            sgc compound --from-red-green <slug>
   │
   └─ compound-promote: read capture → SolutionEntry → findBestMatch dedup
        → writeSolution(.sgc/solutions/<category>/<slug>.md) → promoted_to back

researcher.history (next plan): mines solutions/ → prior_art surfaces the lesson
```

Honest framing: **capture is automatic** on `--done`; **promote stays the
deliberate, dedup-gated step** (same as ship-failures). The corpus is fed via
"auto-capture + standard promote", not done-time auto-write.

## Error handling

- Missing prior-red pair AND no waive → throw with the usage line (this throw IS
  the first-use discoverability signal).
- Partial pair (`--prior-red` without `--red-output` or vice versa) → throw.
- prior-red pair + `--waive-red` together → throw (conflict).
- `--from-red-green <slug>` on a missing file → clear "capture not found" error.
- `--from-red-green` while `prevention_seed` still `TODO: operator-fill` → refuse
  (operator must fill the reusable lesson first).
- Re-running `--from-red-green` on an already-promoted capture → no-op via
  `promoted_to` / `AlreadyPromoted` guard.

## Testing (L3 evidence ladder, RED-first)

`tests/dispatcher/work-tdd-ledger.test.ts` (+ extend `compound-promote.test.ts`):

| Case | Expectation |
|---|---|
| `--done` no red, no waive | throws (gate) |
| `--done` `--prior-red` only (no `--red-output`) | throws (partial pair) |
| `--done` prior-red pair + `--waive-red` | throws (conflict) |
| `--done` prior-red pair | done; feature carries prior_red/red_output; capture file written |
| `--done` `--waive-red "docs-only"` | done; feature.waived_red set; NO capture file |
| `--done` already-done feature | grandfathered no-op (no gate, no capture) |
| `compound --from-red-green` (placeholder unfilled) | refused |
| `compound --from-red-green` (filled, miss) | new solution written + promoted_to back |
| `compound --from-red-green` (filled, dedup hit) | merge, no duplicate file |
| `compound --from-red-green` re-run | idempotent no-op |

Plus: `tsc --noEmit` clean; `sgc doctor` (source) green incl. bundle parity +
slash↔CLI parity; full `tests/dispatcher` suite green; `npm run build:cli` +
committed bundle.

## Release (CLAUDE-extended §2 Released-artifact checklist)

- **SemVer**: minor → v1.25.0 (lockstep `package.json` + `plugin.json`).
- **CHANGELOG top migration note**: `sgc work --done` now requires a prior-RED
  pair or `--waive-red`; show both call forms.
- **Opt-out**: `--waive-red "<reason>"` is the per-call zero-breakage escape.
- **Discoverability**: the refusal error message on a bare `--done`.
- **Grandfather**: already-done features stay a no-op.
- Bundle rebuilt + committed `100755`; verify `npm view @sdsrs/sgc@1.25.0
  dist.shasum` post-publish (provenance-403 false-negative guard).

# Change log

- rev 1 (2026-06-02): initial draft from brainstorming (Q1=fold-into-`--done`,
  Q2=capture+existing-promote, Q3=hard-gate prior-red-xor-waive, level-agnostic).
