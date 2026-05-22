# CE-2 — `sgc reflect` decisions↔solutions audit (plan)

Spec: `tasks/specs/ce-2-reflect-audit.md` (status: draft, r1).
Parent intent: `.sgc/decisions/94913CB45F9D4C3E906B3C2C8E/intent.md` (f3 of 4).

## Pre-flight

- **Branch**: main (sgc uses main-direct + `v*` tag → publish.yml, no PR per project memory `project_sgc_ship_workflow.md`).
- **Baseline**: head `39c1dfe` (post-CE-1.1, working tree clean). 740-line CE-1 plan precedent at `docs/superpowers/plans/2026-05-21-ce-1-prevention-injection.md`.
- **Test baseline**: 729 unit tests (post-CE-1.1, pre-CE-2). Goal post-CE-2: ≥737 (Δ≥8 per spec success criterion 6).
- **Version bump**: MINOR 1.4.1 → 1.5.0. New CLI subcommand `sgc reflect` is user-visible additive surface (`sgc help` list grows, README needs update). LLM-visible metadata via CHANGELOG entry hits §2 released-artifact L3 hard upgrade unambiguously.

## Task list

### T1 — types + module scaffold (`src/dispatcher/reflect.ts`)

New file. Exports `ReflectCandidate` / `ReflectReport` / `AuditOptions` interfaces + skeleton `auditDecision` / `auditAllDecisions` returning empty reports. No real logic; TDD RED placeholder.

```ts
import { parseFrontmatter, resolveStateRoot } from "./state"
import { extractKeywords, walkSolutionsCorpus } from "./agents/researcher-history"

export interface ReflectCandidate {
  solution_ref: string
  category: string
  prevention_text: string | null
  keyword_overlap: number
  discussed: boolean
  discussed_evidence: string | null
}
export interface ReflectReport {
  task_id: string
  decision_path: string
  candidates: ReflectCandidate[]
}
export interface AuditOptions {
  since?: string
}

export async function auditDecision(
  taskId: string,
  stateRoot?: string,
  opts: AuditOptions = {},
): Promise<ReflectReport> {
  // T2 fills this
  return { task_id: taskId, decision_path: "", candidates: [] }
}

export async function auditAllDecisions(
  stateRoot?: string,
  opts: AuditOptions = {},
): Promise<ReflectReport[]> {
  // T3 fills this
  return []
}
```

**Verify**: `bun tsc --noEmit` green. No test added yet.

### T2 — `auditDecision` heuristic (heart of CE-2)

Implements the 4-step pipeline per spec constraints:

1. Resolve `<stateRoot>/decisions/<taskId>/intent.md`; read + `parseFrontmatter` (defensive try/catch — return empty `candidates` on parse fail with `decision_path` still set).
2. Extract keywords from `frontmatter.motivation ?? "" + "\n" + frontmatter.title ?? ""` via `extractKeywords`.
3. `walkSolutionsCorpus(stateRoot, keywords)` → array of `{ solution_ref, category, prevention_text?, keyword_overlap }`. Filter to entries that have `prevention_text` non-empty (CE-2 audits prevention discussion, not solution discussion).
4. For each candidate, run `discussed` detection on the intent.md `## Pre-mortem (planner.adversarial)` segment (sliced from raw markdown):
   - **Strike (a)**: `pre_mortem_segment.includes(candidate.solution_ref)` → `discussed = true`, `discussed_evidence = "solution_ref direct match"`.
   - **Strike (b)**: tokenize `prevention_text.split(/[.!?]/)[0]` (first sentence), intersect with tokens from each `Early signal:` line in the pre-mortem; ≥3 token overlap → `discussed = true`, evidence = matched signal line.
   - Neither → `discussed = false`, `discussed_evidence = null`.

```ts
const PRE_MORTEM_HEADER = "## Pre-mortem"
function slicePreMortem(raw: string): string {
  const idx = raw.indexOf(PRE_MORTEM_HEADER)
  return idx < 0 ? "" : raw.slice(idx)
}
```

**Verify**: 6 unit tests in T6.

### T3 — `auditAllDecisions` + `--since` filter

- `readdir(<stateRoot>/decisions/)` async, filter to dirs containing `intent.md`.
- For each, parse frontmatter; if `opts.since` and `frontmatter.created_at < since` → skip. `since` accepts `YYYY-MM-DD`; compare against `created_at` (ISO 8601) via `new Date(created_at) >= new Date(since)`.
- Call `auditDecision` for each surviving task_id. Collect into array, sort by `created_at` descending.

**Verify**: 2 unit tests (since include + exclude) in T6.

### T4 — CLI registration (`src/sgc.ts`)

Add `defineCommand({ meta: { name: "reflect", description: "Audit decisions against accumulated preventions" }, args: { task: { type: "string", description: "audit only this task_id" }, since: { type: "string", description: "YYYY-MM-DD, audit only decisions created on or after this date" }, save: { type: "boolean", description: "write report to <stateRoot>/reflections/<task_id>.md" }, json: { type: "boolean", description: "emit JSON instead of human-readable output" } }, async run({ args }) { ... } })`.

Run handler:
- Resolve stateRoot.
- If `args.task` → single `auditDecision`, wrap in `[report]`.
- Else → `auditAllDecisions({ since: args.since })`.
- If `args.json` → `console.log(JSON.stringify(reports, null, 2))`.
- Else → human-readable formatter (T5).
- If `args.save` → `writeReflectionFile(stateRoot, report)` for each.

Register: `sgc.subCommands.reflect = reflectCommand`.

**Verify**: `sgc help` lists reflect; `sgc reflect --help` shows flags; one CLI integration test in T6.

### T5 — human-readable formatter + `--save` writer

`formatReport(report: ReflectReport): string` returns:

```
# Reflect: <task_id>

Decision: <decision_path>

Matched preventions: <N>
  - [discussed]  <solution_ref> (overlap: <n>)
    evidence: <discussed_evidence>
  - [silent]     <solution_ref> (overlap: <n>)
    prevention: <first-sentence preview, ≤80 chars>

(empty list → "No matched preventions.")
```

`writeReflectionFile(stateRoot, report)`:
- `mkdir -p <stateRoot>/reflections/` (async, `{recursive: true}`).
- Write `formatReport(report)` to `<stateRoot>/reflections/<task_id>.md`, REPLACE semantics (`writeFile` with no append flag).

**Verify**: snapshot-shape test in T6 (markdown structure + replace-on-rerun).

### T6 — tests

`tests/dispatcher/reflect.test.ts` (new):

1. **empty corpus**: seed `<stateRoot>/decisions/T1/intent.md` only; no `solutions/`. → `candidates: []`.
2. **no keyword match**: seed decision with motivation "foo bar"; seed solution with prevention text + frontmatter keyword "baz". → `candidates: []`.
3. **matched + discussed via solution_ref (strike a)**: seed decision intent.md with `## Pre-mortem` containing the literal solution_ref string. → `candidates[0].discussed === true`, evidence cites solution_ref match.
4. **matched + discussed via signal overlap (strike b)**: pre-mortem `Early signal:` line shares ≥3 tokens with prevention first sentence; solution_ref NOT mentioned. → `discussed === true`, evidence is the signal line.
5. **matched but silent**: keyword overlap exists; pre-mortem segment unrelated. → `discussed === false`.
6. **malformed solution frontmatter survival**: solution.md missing YAML markers / broken YAML → walker skips it (or extractor returns no prevention_text), no throw.
7. **--since include** (in T3): decision created_at after since → present in result.
8. **--since exclude**: decision created_at before since → absent.

`tests/dispatcher/sgc-cli.test.ts` (extend):

9. **default stdout shape**: `sgc reflect --task <id>` against a seeded `<stateRoot>` prints expected markdown header lines.
10. **--json shape**: parses as `ReflectReport[]`, first element has `task_id`/`decision_path`/`candidates` keys.

**Verify**: `SGC_FORCE_INLINE=1 bun test tests/` total 729 → ≥737 (Δ≥8). Inline evidence form per Iron Law #2: cite suite count delta in REPORT.

### T7 — CHANGELOG + commit

`CHANGELOG.md` add `## Unreleased` entry:

```
### Added
- **CE-2 (f3): `sgc reflect` decisions↔solutions audit** — new
  read-only CLI that scans `<stateRoot>/decisions/*/intent.md`
  against keyword-overlapping `<stateRoot>/solutions/*/*.md`
  preventions, classifying each match as `discussed` (mentioned
  in pre-mortem) or `silent` (not mentioned). Heuristic-only,
  no LLM call, no agent spawn. Flags: `--task` / `--since` /
  `--save` / `--json`. Save target `<stateRoot>/reflections/`
  uses replace semantics (Invariant §6 does not apply). Closes
  feature f3 of parent intent
  94913CB45F9D4C3E906B3C2C8E. Spec at
  `tasks/specs/ce-2-reflect-audit.md`.
```

Single commit `feat(CE-2, f3): sgc reflect decisions↔solutions audit`. No version bump in this commit — release commit lands at ship time (T-ship).

**Verify**: `git log --oneline -1` shows the commit; working tree clean.

### T-ship — release v1.5.0 (deferred until user-explicit ship signal)

Per project memory `project_sgc_ship_workflow.md`:
- Lockstep bump `package.json` + `plugins/sgc/.claude-plugin/plugin.json` 1.4.1 → 1.5.0.
- Move `## Unreleased` → `## [1.5.0] - 2026-05-22`.
- Commit `chore: release v1.5.0 (CE-2 reflect audit)`.
- `git tag v1.5.0` + `git push origin main --tags`.
- publish.yml fires; verify `npm view @sdsrs/sgc@1.5.0`.

Do NOT execute T-ship inside the CE-2 build. CE-2 lands as a feature commit; user calls `继续 ship` / `gs:/ship` to fire T-ship as a separate `[AUTH REQUIRED]` decision point.

## Inline 3-view self-critique

### CEO view

- **Who benefits**: sgc operators auditing their own engineering hygiene. Strong dogfood candidate — sgc itself has 4 parent decisions in `.sgc/decisions/` already; CE-2 immediately surfaces whether CE-1's 8 false-premise concerns (the "vendor X" motivation lesson) are now being avoided.
- **Outcome signal**: `sgc reflect --task 94913CB45F9D4C3E906B3C2C8E` on the parent CE intent should classify CE-1's prior_preventions seed as `silent` (parent intent pre-mortem was written 2026-05-21 BEFORE CE-1 shipped, so it could not reference solutions; the audit correctly flags this) — and any post-CE-1 decisions should classify as `discussed` once they go through the prevention-injected planner.adversarial. End-to-end loop closure visible in one command output.
- **Concern — naming**: "reflect" is a common English verb; risk of collision with future `sgc reflect-on-X` subcommands. Mitigation: lock the spec, no second `reflect-*` subcommand without an explicit rename pass. Single-token noun-form alternative `audit` was considered but conflicts with the broader `audit` semantic (security audit, compliance audit) — `reflect` better names what this does.

### Design view

- **Output sink consistency**: spec mandates `<stateRoot>/reflections/` separate from `<stateRoot>/reviews/`. The directory naming parallels `decisions/` / `solutions/` / `progress/` / `reviews/` — fits the existing `<stateRoot>` layout taxonomy (each top-level subdir is one artifact class). No regression on existing readers.
- **Human-readable format minimal**: T5 formatter is markdown-like but NOT a strict markdown spec. Won't render perfectly in a Markdown viewer (no top-level `#` per task, just per-report). Acceptable — stdout is the primary consumer, `--save` files are read by operators in plain text + occasional `cat` / `bat`.
- **Concern — no progressive disclosure**: large corpora could produce verbose stdout. Mitigation deferred to a follow-up `--rollup` or `--silent-only` flag if v0 output is too noisy in practice (Open Question #2 in spec). Not a v0 blocker.

### Eng view

- **Module-graph clean**: reflect.ts imports `parseFrontmatter` + `resolveStateRoot` (state.ts) + `extractKeywords` + `walkSolutionsCorpus` (researcher-history.ts). Both export surfaces already exist post-CE-1; no new exports needed from state.ts. researcher-history.ts is the heaviest dep — but it's already imported by preventions.ts (CE-1), so the dep ring shape is unchanged.
- **Async fs hygiene**: all I/O via `node:fs/promises` per H.1 ship C. No sync calls.
- **Invariant audit**:
  - §1 (reviewer/qa amnesia): NOT touched. Reflect is a CLI, not a reviewer agent.
  - §3 (dedup_stamp determinism): NOT touched.
  - §6 (review append-only): NOT touched. Reflections live under a NEW directory; the append-only rule is path-scoped to `reviews/`.
  - §13 (event audit): NOT triggered. Reflect does not spawn; no `spawn.start/end` / `llm.*` pair owed.
- **Test surface**: 6 unit + 2 CLI integration = 8 tests, exactly the spec minimum. If T6 case 6 (malformed YAML survival) needs splitting (two failure modes — missing `---` vs broken YAML), Δ can grow to 9 — still well under the 10-LOC-of-test-per-LOC-of-prod heuristic for this kind of audit code.
- **Concern — keyword overlap noise**: `extractKeywords` over a long intent.motivation may yield false candidate matches against unrelated preventions (low overlap counts). Mitigation: the `discussed` flag is binary, so a noisy low-overlap candidate flagged `silent` is still a fact-only report — the operator filters by reading. v1 can add an `--overlap-floor N` flag if noise is a real complaint.
- **Concern — pre-mortem section detection fragility**: `slicePreMortem` finds `## Pre-mortem` substring, but if the planner emits the heading with a different prefix (e.g. `## Pre-mortem (planner-adversarial)` with hyphen vs the canonical `(planner.adversarial)` with dot), strike (a) misses. Mitigation: match `## Pre-mortem` prefix only, slice to next `## ` or EOF. Spec implementation handles this.

### Verdict

`approve` from all three views with the two design / eng concerns documented as Open Questions (in spec) / noted-but-deferred (in plan). No blocking issues. Ready for AUTH.

## AUTH preamble (post-plan)

This task is L3 per §2 released-artifact rule (new CLI subcommand = LLM-visible metadata, additive). It satisfies §4.FULL-lite eligibility (no auth/payment/crypto, ≤3 Modules — dispatcher + commands + state, no prod data-migration).

Hard AUTH needed before T1 execution:
- **op**: implement CE-2 `sgc reflect` feature (T1-T7 single feature commit)
- **scope**:
  - new: `src/dispatcher/reflect.ts`, `tests/dispatcher/reflect.test.ts`
  - edits: `src/sgc.ts` (CLI registration), `tests/dispatcher/sgc-cli.test.ts` (extend), `CHANGELOG.md` (Unreleased)
  - no edits to: `prompts/`, `contracts/sgc-capabilities.yaml`, `package.json` (until T-ship), `plugins/sgc/.claude-plugin/plugin.json` (until T-ship), existing dispatcher files except `src/sgc.ts`
- **risk**: low — heuristic-only, no LLM, no agent spawn, no invariant change, new file + new CLI command surface. Worst-case behavioral surprise = `discussed` heuristic too lax (false-positive `discussed`) or too strict (false-positive `silent`); both are tunable via spec Open Question follow-ups.

Awaiting user `[AUTH]` to start T1.
