---
status: implemented
revision: 2
task_id: 94913CB45F9D4C3E906B3C2C8E
feature_id: f3
parent_intent: .sgc/decisions/94913CB45F9D4C3E906B3C2C8E/intent.md
---

# CE-2 — `sgc reflect` decisions↔solutions audit

## Goal

Close the second half of the CE compound-engineering loop in sgc:
auditing past decisions against accumulated preventions. New CLI
`sgc reflect` scans `<stateRoot>/decisions/<task_id>/intent.md` and
cross-references each with keyword-overlapping
`<stateRoot>/solutions/<category>/*.md` entries, then classifies each
matched prevention as `discussed` (it appears in the decision's
`## Pre-mortem` section) or `silent` (keyword match but no mention).
Output is a fact-only report — no violation verdict.

The audit is read-only and runs entirely client-side (no LLM call,
no agent spawn). It is the operator's `git blame` for compound
engineering: "did we surface this lesson when we made that decision?"

## Non-goals

- Do NOT emit violation / verdict / judgment language in the
  output. The report names matched-but-silent preventions as a
  fact ("solution X was not mentioned in this pre-mortem"); the
  operator is the judge.
- Do NOT introduce an LLM-mode path. Heuristic-only — keyword
  overlap + substring `includes` checks on the pre-mortem segment.
  No `prompts/reflect-*.md`. No new `prompt_path` declaration. No
  Tier-2 `llm.request/llm.response` events from this command.
- Do NOT auto-trigger reflect from ship / qa / review. Manual CLI
  only in v0. Auto-trigger from ship-failure rollback is CE-3's
  responsibility (parent intent feature f4); keeping the seams clean
  prevents CE-2 / CE-3 scope merge.
- Do NOT audit `scope_tokens` declarations against actual reads.
  That's a different audit dimension (capability-vs-use) and would
  need spawn-event correlation; out of scope for v0.
- Do NOT write into `<stateRoot>/reviews/`. Reviews are owned by
  `reviewer.*` / `qa.*` agents under Invariant §6 (append-only,
  optional `--append-as` suffix). Reflect outputs to a separate
  `<stateRoot>/reflections/` directory with replace-on-rerun
  semantics, decoupling the two namespaces.
- Do NOT spawn `planner.adversarial` or any agent. Reflect is a
  pure-CLI lens; it never re-runs pre-mortem, never re-asks the
  LLM. The data it operates on is the decision's own frozen
  artifact.

## Constraints

- **Reuse `extractKeywords` + `walkSolutionsCorpus`** from
  `src/dispatcher/agents/researcher-history.ts` (both `export`ed
  by CE-1). Single source of NFC + `Intl.Segmenter` tokenization
  truth; reflect does not re-implement the corpus walker.
- **Reuse `parseFrontmatter`** from `src/dispatcher/state.ts` for
  reading both intent.md and solution.md headers. Defensive parse
  (try/catch) — solutions/ may contain hand-edited or test-fixture
  markdown (CE-1 obs #95 precedent at `solutions/_seed/`).
- **Async fs** (`node:fs/promises`), consistent with H.1 ship C's
  conversion of researcher-history.ts. No `readdirSync` /
  `readFileSync` in new code.
- **No `Forbidden: read:*` clauses touched.** Reflect is a CLI
  subcommand, not an agent — capability scope_tokens do not apply.
  The `read:decisions` + `read:solutions` capability lives implicit
  in the CLI process; the dispatcher's per-agent scope fence is
  unaffected.
- **No new `events.ndjson` Invariant**. Reflect does not spawn, so
  Tier-1 `spawn.start/end` pairing does not apply. No Tier-2 LLM
  events either (no LLM call). The command MAY emit a cmd-level
  `reflect.audited` audit event for telemetry, but in v0 it does
  NOT — keeps Invariant §13 enforcement surface unchanged and the
  command silent under `sgc tail` follow.
- **`--save` write semantics: replace**, not append. A reflection
  is a current-state snapshot, not a streaming log. Re-running
  reflect on the same task_id overwrites
  `<stateRoot>/reflections/<task_id>.md`. Invariant §6 does not
  apply (it is scoped to `reviews/<task_id>/<reviewer>.md`).
- **Token budget**: stdout default output ≤ 80 chars per line
  where reasonable (operator terminals). JSON output unconstrained.
- **Heuristic `discussed` detection**: two-strike — (a)
  `solution_ref` substring match in the `## Pre-mortem
  (planner.adversarial)` section of intent.md, OR (b)
  prevention_text first-sentence ≥3-keyword overlap with any
  pre-mortem `Early signal:` line. Either match → `discussed: true`.
  Neither → `silent`.

## Success criteria

1. New module `src/dispatcher/reflect.ts` exports
   `auditDecision(taskId, stateRoot?, opts?)` →
   `Promise<ReflectReport>` and `auditAllDecisions(stateRoot?,
   opts?)` → `Promise<ReflectReport[]>` where the types are:
   ```ts
   interface ReflectCandidate {
     solution_ref: string
     category: string
     prevention_text: string | null
     keyword_overlap: number
     discussed: boolean
     discussed_evidence: string | null
   }
   interface ReflectReport {
     task_id: string
     decision_path: string
     candidates: ReflectCandidate[]
   }
   interface AuditOptions {
     since?: string  // YYYY-MM-DD, filters by intent.frontmatter.created_at
   }
   ```
2. CLI command `sgc reflect` registered in `src/sgc.ts` via citty,
   with flags `--task <id>` / `--since <date>` / `--save` / `--json`.
   No-arg form audits all `.sgc/decisions/*/intent.md`.
3. Default stdout output is human-readable markdown-like sections,
   one per decision, listing each candidate with `discussed` /
   `silent` tag and (if silent) the solution_ref + first-sentence
   preview. `--json` swaps to `ReflectReport[]` JSON. `--save`
   additionally writes `<stateRoot>/reflections/<task_id>.md` per
   audited task (replace semantics).
4. `<stateRoot>/reflections/` is created lazily on first `--save`
   call. `ensureSgcStructure` MAY pre-create the directory but is
   not required to; reflect tolerates a missing directory and
   mkdir-recursive on demand.
5. No changes to `prompts/`, `contracts/sgc-capabilities.yaml`,
   manifest scope_tokens, or `Invariant §1 / §13` enforcement
   paths. CE-1's `prior_preventions` field stays untouched.
6. Tests: reflect.ts unit (≥6 cases — empty solutions corpus, no
   keyword match, all-discussed, some-silent, since-filter
   include + exclude, malformed solution frontmatter survival);
   CLI integration in `sgc-cli.test.ts` (at least 2 cases —
   default stdout shape, `--json` shape on a seeded fixture).
   Total test delta: ≥8 new tests (729 → ≥737 baseline).
7. CHANGELOG.md gains a `## Unreleased` entry naming CE-2 by
   feature ID (f3 under parent intent 94913CB45F9D4C3E906B3C2C8E),
   describing the new command and its read-only / heuristic-only
   posture.

## Open questions

- **Discussed-detection fallback for legacy intent.md without
  CE-1's `solution_ref` in early_signal**: pre-CE-1 intent.md files
  have pre-mortem segments that do NOT reference solution_refs
  (CE-1 introduced `prior_preventions` + step-5 emission only at
  v1.4.0 / 2026-05-21). For these, only the (b) keyword-overlap
  fallback can fire. Should reflect surface a `pre_ce1_legacy:
  true` flag on such candidates to mark detection confidence as
  weaker? — resolve during T2 (heuristic implementation).
- **Cross-decision dedup**: when the same `solution_ref` appears
  silent across multiple decisions, do we surface as a separate
  "recurring silence" rollup view (e.g.
  `sgc reflect --rollup`)? — defer to a follow-up if v0 stdout
  output is too noisy in practice.

## Change log

- 2026-05-22 r1 — initial draft from `继续 ce-2` brainstorm
  align (2026-05-22 chat). Locks in: heuristic-only path, no LLM
  swap, no agent spawn, stdout + opt-in `--save` to new
  `<stateRoot>/reflections/`, no auto-trigger (delegated to CE-3),
  fact-not-verdict output, two-strike `discussed` detection
  (solution_ref substring OR ≥3-keyword pre-mortem early_signal
  overlap). Reuses CE-1 exports `extractKeywords` +
  `walkSolutionsCorpus` + `parseFrontmatter`.
- 2026-05-22 r2 — status → implemented. Shipped in commit
  `f3ff3ab` (single feature commit). Dispatcher suite 650 → 668
  pass / 0 fail (+18 = 16 reflect-unit + 2 sgc-cli integration).
  All 7 success criteria met. Dogfood verified end-to-end via
  `sgc reflect --task 94913CB45F9D4C3E906B3C2C8E` against the
  parent CE intent — the seed prevention
  `other/sgc-plan-motivation-word-vendor-2026-05-21` (authored
  2026-05-21) correctly lands `silent` (overlap: 14) because the
  parent intent's pre-mortem was written before the seed
  existed; that is the right v0 answer (no false-positive
  `discussed`, no false `silent` once the loop closes
  post-CE-1). No version bump yet; release lands at ship time
  as a separate AUTH decision. Open Question #1 (pre-CE-1
  legacy `pre_ce1_legacy: true` confidence flag) and #2
  (cross-decision rollup) remain deferred until v0 stdout
  noise turns out to need them in practice.
