# Phase G.2.b — compound.context LLM swap (Design Spec)

**Status**: Draft (pending execution)
**Date**: 2026-04-27
**Parent**: `docs/superpowers/specs/2026-04-24-phase-g-design.md` §7
**Sibling**: `docs/superpowers/specs/2026-04-27-phase-g2a-design.md` (planner.eng pattern; reuse mechanically)
**Depends on**: G.2.a (planner.eng LLM swap, head `7463c36`).
**Blocks**: G.3 (E2E + dogfooding).

---

## 1. Goal

Swap `compound.context` from a regex-driven category classifier + 13-tag whitelist + 400-char intent slice to a real LLM agent that produces semantically correct `category | tags | problem_summary | symptoms`. Reuse the G.2.a pattern: heuristic-rename + alias + manifest `prompt_path`. No tool-use loop.

## 2. Scope (in / out)

**In**:
- Rename `compoundContext` → `compoundContextHeuristic`; expose `export const compoundContext = compoundContextHeuristic` for backwards compat. Sibling stubs (`compoundSolution` / `compoundRelated` / `compoundPrevention`) untouched.
- Add `prompt_path: prompts/compound-context.md` to `compound.context` anchor in `contracts/sgc-capabilities.yaml`. The three sibling agents (`compound.solution / .related / .prevention`) inherit via the `<<: *compound_base` merge; override their `prompt_path` to `null` so only `compound.context` routes to LLM.
- Declare `inputs:` block on `compound.context` (currently absent on the anchor — only `outputs:` is declared).
- Author `prompts/compound-context.md` (zero-shot + `## Anti-patterns` section domain-rewritten for compound; full text in §4).
- Expand `tests/dispatcher/compound.test.ts` with U1–U5 (heuristic byte-compat + alias + manifest + prompt-template structure + LLM-branch happy + LLM-branch schema-violation).
- Author `tests/eval/compound-context-llm.test.ts` (NEW, CI-skip via `test.skipIf(!HAS_KEY)`; HAS_KEY ≡ `ANTHROPIC_API_KEY || OPENROUTER_API_KEY`).

**Out**:
- `compound.solution / .related / .prevention` LLM swaps — separate phase (sibling stubs are not on the value path the same way; defer until dogfooding shows the gap).
- `runCompound` signature changes — zero diff. Inline mode dispatches to `compoundContextHeuristic` via `inlineStub`; LLM mode picks up via manifest `prompt_path`.
- LLM tool-use loop — same deferral as G.2.a §6.3.
- Few-shot examples in the prompt — rejected, same reason as G.2.a §8.Q2.
- Post-parse tag truncation / cap enforcement — prompt-only constraint per parent §7.7.
- Real-LLM judge or snapshot scoring — rejected, same as G.2.a §8.Q1.

## 3. Mechanical layer

### 3.1 Contract — unchanged

```typescript
// before AND after — identical
export interface CompoundContextInput {
  task_id: string
  intent: string
  diff?: string
  ship_outcome?: string
}

export interface CompoundContextOutput {
  category: SolutionCategory      // enum[runtime, build, auth, data, perf, ui, infra, other]
  tags: string[]
  problem_summary: string
  symptoms: string[]
}
```

`SolutionCategory` enum is enforced at the type level. LLM output failing the enum → `OutputShapeMismatch` (Invariant §9 guards; U5b covers).

### 3.2 Heuristic rename + alias

```typescript
export function compoundContextHeuristic(input: CompoundContextInput): CompoundContextOutput {
  // ...existing body unchanged: 7-pattern category regex + 13-tag candidate
  // filter + 400-char problem_summary slice + ship_outcome→symptom map
}

/** Backward-compat alias. Prefer the heuristic-specific name in new code. */
export const compoundContext = compoundContextHeuristic
```

Behavior byte-identical pre- and post-rename. Mirrors G.2.a planner-eng.ts pattern.

### 3.3 Manifest change — `contracts/sgc-capabilities.yaml`

Anchor (currently lines 372–395) gains `prompt_path` + `inputs:`:

```yaml
compound.context:     &compound_base
  version: "0.1"
  source: CE /ce:compound stage-1 cluster
  purpose: |
    Build context for compound extraction AND assign tags/category.
    ...(unchanged)
  prompt_path: prompts/compound-context.md      # NEW
  inputs:                                        # NEW (anchor was outputs-only)
    task_id: string
    intent: markdown
    diff: string                                 # optional in TS; declared for documentation
    ship_outcome: string                         # optional in TS; declared for documentation
  scope_tokens:
    - "read:decisions"
    - "read:progress"
    - "read:solutions"
    - "write:solutions"
    - "read:reviews"
  token_budget: 5000
  timeout_s: 180
  outputs:
    category: enum[runtime, build, auth, data, perf, ui, infra, other]
    tags: array[string]
    problem_summary: markdown
    symptoms: array[string]

compound.solution:
  <<: *compound_base
  purpose: "Extract what worked / didn't"
  prompt_path: null                              # NEW — sibling stays heuristic
  outputs:
    solution: markdown
    what_didnt_work: array[{approach, reason_failed}]

compound.related:
  <<: *compound_base
  purpose: "Dedup check — MUST run before any write"
  prompt_path: null                              # NEW
  outputs:
    duplicate_match: object
    related_entries: array[string]
    dedup_stamp: object

compound.prevention:
  <<: *compound_base
  purpose: "Derive prevention strategy"
  prompt_path: null                              # NEW
  outputs:
    prevention: markdown
```

Reviewer pattern (lines 331–337) is the precedent: `reviewer.security: { <<: *reviewer_base, prompt_path: null, ... }`.

### 3.4 `src/commands/compound.ts` — no-op

`runCompound` already passes `{ task_id, intent }` and supplies `inlineStub: (i) => compoundContext(...)` (lines 97–107). The alias keeps the inline path byte-identical; LLM path engages when manifest has `prompt_path` + API key set, exactly as G.2.a planner.eng.

### 3.5 `src/dispatcher/spawn.ts` — no-op

`resolveMode` auto-routes via `manifest.prompt_path`. Validated by Phase F + G.2.a.

## 4. Prompt template (`prompts/compound-context.md`)

Cache-stable prefix terminates at `## Input` heading. `<input_yaml/>` placeholder mandatory.

```markdown
# Purpose

Build the context block for a compound (post-ship lessons-learned) entry:
classify the problem, tag it, summarize the essence, and list observable
symptoms.

You are NOT writing the solution narrative — that is `compound.solution`'s
job. You are NOT deduping — that is `compound.related`'s job. Your job
is the FACTUAL frame: what kind of problem is this, what does it look
like, what would another engineer search for to find it again.

## Scope

- Token scope: read:decisions, read:progress, read:solutions, read:reviews
- Allowed outputs: category, tags, problem_summary, symptoms

## Your analysis

1. Read the `intent` (a `title\n\nmotivation` markdown block, sometimes
   plus `diff` and `ship_outcome`). Reason from those texts alone. Do
   NOT invent file paths, function names, or commit SHAs that are not
   literally present in the input.

2. Pick exactly ONE `category` from the closed enum:
   `auth | data | infra | perf | ui | build | runtime | other`.
   Definitions:
   - `auth` — authentication, authorization, sessions, tokens, identity
   - `data` — schema, migrations, SQL, persistence, data integrity
   - `infra` — deploy, k8s, docker, terraform, CI/CD, host config
   - `perf` — latency, throughput, cache hit rate, timeout tuning
   - `ui` — rendering, layout, components, frontend interaction
   - `build` — bundlers, dependency resolution, compile pipeline
   - `runtime` — crashes, null/undefined, races, exception flow
   - `other` — anything that doesn't cleanly fit above

   When unsure between two categories, return `other`. Do NOT force-fit.
   "authorize the user to read docs" is `other` (or `auth` only if the
   problem is actually about token/session machinery, not the verb
   "authorize").

3. Emit `tags`: lowercase, hyphen/underscore-separated, ≤ 8 items
   total, each ≤ 20 characters. Tags must be searchable terms — what
   another engineer would type into grep, not sentence fragments.
   Examples: `rate-limit`, `migration`, `nfc`, `spawn-timeout`. NOT:
   `the auth system`, `slow queries sometimes`.

4. Emit `problem_summary`: 2–4 sentences distilling the PROBLEM
   (not the solution, not a recap of the intent title). Future search
   reads this first; vague summaries waste retrieval budget.

5. Emit `symptoms`: 1–4 observable, specific symptoms drawn from
   `intent` / `diff` / `ship_outcome`. If the input does not name a
   concrete symptom, return `["(symptom not stated in input)"]` —
   honesty over fabrication.

## Anti-patterns: do NOT output

1. **Filename / symbol invention.** Do not output `src/foo/bar.ts`,
   function names, line numbers, or commit SHAs unless the input
   literally contains them. compound is post-ship archival, not code
   navigation.

2. **Forced category fit.** When intent does not match any of the 7
   specific buckets, return `other`. Squeezing `authorize the user to
   read docs` into `auth` because the word "authorize" appears is the
   exact failure mode of the heuristic this swap replaces.

3. **Sentence-shaped tags.** `tags` is a search-term list, not a
   description. Bad: `["the auth flow", "various concerns"]`. Good:
   `["auth", "session-token"]`.

4. **`problem_summary` that recaps intent.** The summary is a fresh
   distillation of the PROBLEM. Do not paraphrase the intent title;
   do not list "the user wants to add X." State the failure shape or
   risk shape that motivated the work.

5. **Placeholder `symptoms`.** Banned: `"behavior documented in
   intent"`, `"see the diff"`, `"the change shipped"`. If no concrete
   symptom is in the input, output the literal string
   `"(symptom not stated in input)"`.

6. **Banned vocabulary in any output string.** `category` enum is
   already constrained; `tags`, `problem_summary`, `symptoms` must NOT
   contain:
   - English: `could potentially`, `might affect`, `various concerns`,
     `several issues`, `generally`, `overall`, `seems to`,
     `production-ready`, `comprehensive`, `robust`
   - 中文: `显著`, `大幅`, `基本上`, `大部分情况`, `相当不错`
   These mark vague output. Replace with concrete naming.
   (Same 15-term list as `prompts/planner-eng.md` — the dual-source
   sync rule from G.2.a §6 applies here too.)

### Bad / good contrast

```yaml
# bad — forced category, lazy tags, intent-recap summary, placeholder symptoms
category: auth
tags:
  - the auth system
  - various concerns
problem_summary: |
  The user wants to authorize readers to access the documentation pages.
  This was implemented and shipped.
symptoms:
  - behavior documented in intent

# good — honest "other", searchable tags, problem-shape summary, concrete symptom
category: other
tags:
  - docs-access
  - permissions
  - reader-role
problem_summary: |
  Documentation pages were globally readable but a subset (internal-only
  RFCs) needed reader-role gating without breaking the public docs path.
  The gate had to be additive — existing public URLs must keep returning
  200 for unauthenticated viewers.
symptoms:
  - "(symptom not stated in input)"
```

## Reply format

```yaml
category: auth | data | infra | perf | ui | build | runtime | other
tags:
  - <tag-1>
  # ≤ 8 items, each ≤ 20 chars, lowercase, hyphen/underscore
problem_summary: |
  <2-4 sentences, problem essence not intent recap>
symptoms:
  - <observable symptom 1>
  # 1-4 items; if none stated, single-element ["(symptom not stated in input)"]
```

## Input

<input_yaml/>

## Submit

Write only the YAML above. No prose outside the YAML block.
```

**Design notes embedded in the template choice**:

- Anti-pattern #2 (forced category fit) is the explicit replacement of the heuristic's `authorize` → `auth` failure mode. The eval test e1 (§5.2) enforces this.
- Anti-pattern #6 banned-vocab list is **dual-sourced** with `prompts/planner-eng.md`. The G.2.a §6 sync rule applies — any change to either file must update the other in the same commit. Current list is 15 terms (10 EN + 5 中文); `may break` remains excluded for the same false-positive reason logged in the planner.eng eval comment block.
- Anti-pattern #5 placeholder ban with the literal `"(symptom not stated in input)"` opt-out preserves Iron Law #2 honest-partial behavior — fabrication is worse than admitted absence.
- Bad/good contrast: one pair only, deliberately covering 4 anti-patterns at once (forced category + sentence tags + intent-recap + placeholder symptoms). Negative anchor for specificity, not few-shot.

## 5. Test harness

### 5.1 Unit-branch — `tests/dispatcher/compound.test.ts` (EXPAND)

Existing heuristic tests (`compoundContext: auth keyword → auth category` etc.) stay byte-identical via the alias. New section appended:

| # | Assertion | Mechanism |
|---|---|---|
| U1a | Heuristic alias byte-compat (regex path) | `compoundContext` alias → same `category=auth` for `"refactor the auth token flow"` |
| U1b | Heuristic alias byte-compat (no-pattern path) | alias → `category=other` for generic input |
| U2 | `compoundContext === compoundContextHeuristic` | identity assertion |
| U3 | Manifest LLM-routing readiness | `getSubagentManifest("compound.context").prompt_path === "prompts/compound-context.md"` AND `getSubagentManifest("compound.solution").prompt_path === null` (sibling stays heuristic) |
| U4 | Prompt template structure | `prompts/compound-context.md` contains `\n## Input\n`, `<input_yaml/>`, `## Anti-patterns`, `do NOT output`, `Filename / symbol invention`, `Forced category fit`, and the first banned-vocab term `could potentially` |
| U5a | LLM-branch happy — canned valid YAML → `CompoundContextOutput` shape | Inject mock `anthropicClientFactory`; canned YAML with `category: data`, 3 tags, multi-sentence summary, 2 symptoms; assert all four output fields parsed correctly |
| U5b | LLM-branch schema violation — invalid `category` enum throws `OutputShapeMismatch` | Canned YAML with `category: malformed`; assert `OutputShapeMismatch` raised by `validateOutputShape` |

U5 mock pattern is identical to G.2.a planner-eng U5: `SpawnOptions.anthropicClientFactory` injection + canned text content.

`BANNED_VOCAB_RE` is **not** asserted at unit-branch level (same rationale as G.2.a §5.1: tautology against hand-written canned YAML).

### 5.2 Eval-branch — `tests/eval/compound-context-llm.test.ts` (NEW, CI-skip)

```typescript
import { describe, test, expect } from "bun:test"
import { spawn } from "../../src/dispatcher/spawn"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { CompoundContextOutput } from "../../src/dispatcher/agents/compound"

const HAS_KEY =
  !!process.env["ANTHROPIC_API_KEY"] || !!process.env["OPENROUTER_API_KEY"]

const FIXTURES = [
  // e1 — heuristic-mis-classify negative test. The verb "authorize"
  // currently triggers the regex auth-bucket; LLM should resist.
  {
    id: "e1",
    intent: "authorize internal users to read the RFC docs section",
    expectCategoryNot: "auth" as const,
    expectMinTags: 1,
  },
  // e2 — clear runtime/auth boundary; either is acceptable.
  {
    id: "e2",
    intent: "add rate limiting middleware to public API endpoints",
    expectCategoryIn: ["auth", "runtime", "infra", "perf"] as const,
    expectMinTags: 2,
  },
  // e3 — clear data category.
  {
    id: "e3",
    intent: "migrate .sgc/state from YAML to SQLite with rollback path",
    expectCategoryIn: ["data"] as const,
    expectMinTags: 2,
  },
  // e4 — Chinese intent, clear runtime category.
  {
    id: "e4",
    intent: "修复 dispatcher 在并发 spawn 时的状态竞态",
    expectCategoryIn: ["runtime"] as const,
    expectMinTags: 1,
  },
] as const

const BANNED_VOCAB_RE =
  /(could potentially|might affect|various concerns|several issues|generally|overall|seems to|production-ready|comprehensive|robust|显著|大幅|基本上|大部分情况|相当不错)/i

const EVAL_TIMEOUT_MS = 60_000

describe("compound.context LLM eval", () => {
  for (const f of FIXTURES) {
    test.skipIf(!HAS_KEY)(
      `${f.id} — ${f.intent.slice(0, 50)}`,
      async () => {
        const stateRoot = mkdtempSync(join(tmpdir(), `sgc-eval-cc-${f.id}-`))
        try {
          const res = await spawn(
            "compound.context",
            { task_id: f.id, intent: f.intent },
            { stateRoot, taskId: f.id },
          )
          const out = res.output as CompoundContextOutput

          // Universal: enum + no banned vocab anywhere
          expect([
            "auth", "data", "infra", "perf", "ui", "build", "runtime", "other",
          ]).toContain(out.category)
          expect(JSON.stringify(out)).not.toMatch(BANNED_VOCAB_RE)

          // tag shape: count + length + lowercase
          expect(out.tags.length).toBeGreaterThanOrEqual(f.expectMinTags)
          expect(out.tags.length).toBeLessThanOrEqual(8)
          for (const t of out.tags) {
            expect(t.length).toBeLessThanOrEqual(20)
            expect(t).toBe(t.toLowerCase())
          }

          // category constraint
          if ("expectCategoryNot" in f) {
            expect(out.category).not.toBe(f.expectCategoryNot)
          }
          if ("expectCategoryIn" in f) {
            expect(f.expectCategoryIn).toContain(out.category)
          }
        } finally {
          rmSync(stateRoot, { recursive: true, force: true })
        }
      },
      EVAL_TIMEOUT_MS,
    )
  }
})
```

**Cost / cadence**: 4 calls × ~600 in / ~200 out tokens × `claude-sonnet-4-6` ≈ a few cents. Manual run during G.2.b author validation + G.3 dogfooding.

## 6. Drift / sync rule (cross-prompt)

`prompts/compound-context.md` Anti-patterns #6 banned-vocab list and `prompts/planner-eng.md` Anti-patterns #3 banned-vocab list are **the same 15 terms**. Both files plus their respective eval-test `BANNED_VOCAB_RE` regexes share one source of truth.

**Rule**: any change to the banned-vocab list MUST update all four locations in the same commit:

1. `prompts/planner-eng.md` Anti-patterns #3
2. `prompts/compound-context.md` Anti-patterns #6
3. `tests/eval/planner-eng-llm.test.ts` `BANNED_VOCAB_RE`
4. `tests/eval/compound-context-llm.test.ts` `BANNED_VOCAB_RE`

PR self-review checklist line:

```
grep -oE "could potentially|might affect|various concerns|several issues|\
generally|overall|seems to|production-ready|comprehensive|robust|\
显著|大幅|基本上|大部分情况|相当不错" \
  prompts/planner-eng.md prompts/compound-context.md \
  tests/eval/planner-eng-llm.test.ts tests/eval/compound-context-llm.test.ts \
  | sort -u
```

Output should list the same 15 terms across all four files. Mismatch → drift.

## 7. PR file scope

```
contracts/sgc-capabilities.yaml             (manifest: +prompt_path on anchor + on 3 sibling overrides)
prompts/compound-context.md                  (NEW)
src/dispatcher/agents/compound.ts            (rename + alias on compoundContext)
tests/dispatcher/compound.test.ts            (expand: +U2/U3/U4/U5a/U5b; U1a/U1b kept as existing)
tests/eval/compound-context-llm.test.ts      (NEW, CI-skip)
docs/superpowers/specs/2026-04-27-phase-g2b-design.md  (this doc)
```

Six files, ~270 LOC of source + test + prompt + spec. Single PR.

## 8. Decision log

Reused from G.2.a unless noted; re-locking here for traceability.

**Q1 — Drift verdict mechanism**: keyword-match (`expectCategoryIn` / `expectCategoryNot`) + banned-vocab + tag-shape assertions. Rejected: LLM-as-judge (cost), snapshot+manual-review (G.3 dogfooding covers).

**Q2 — Prompt structure**: zero-shot + `## Anti-patterns` + 6-anti-pattern domain-rewrite for compound. Rejected: pure zero-shot (insufficient — heuristic's specific failure modes need explicit naming), few-shot examples (template overfitting).

**Q3 — Sibling agents (`compound.solution / .related / .prevention`)**: stay heuristic. Rejected: bundle all 4 (scope blow-up; sibling value-path is lower than `compound.context`'s category-misclassification cost). Triggered re-spec after G.3 dogfooding if sibling outputs surface as the bottleneck.

**Q4 — Eval fixture set**: 4 fixtures (e1–e4) covering heuristic-mis-classify negative, English clear bucket, English data category, Chinese runtime. Rejected: reuse parent §8.2 s1–s4 verbatim (s1 is L1 typo — no compound trigger; s4 is L3 migration — already covered by e3). Compound's eval surface is different from planner.eng's (category correctness vs risk specificity), so fixtures diverge.

**Q5 — Tag/symptom shape enforcement**: prompt-only (≤8 items, ≤20 chars, lowercase) + post-hoc test assertion in eval. Rejected: post-parse cap in code (parent §7.7 explicit defer; revisit only if drift surfaces in G.3).

## 9. Open questions / assumptions

- **Heuristic body unchanged**: `compoundContextHeuristic` keeps the regex+whitelist+slice body. Existing `runCompound` integration tests (line 184: `expect(entries[0]?.category).toBe("auth")` for `"auth token"` keyword) MUST pass byte-identically under `SGC_FORCE_INLINE=1`.
- **Manifest sibling-override coverage**: U3 asserts both `compound.context.prompt_path === "..."` AND at least one sibling has `prompt_path === null`. Without the sibling override, `<<: *compound_base` would inherit `prompt_path` and accidentally route 3 stub agents to a non-existent prompt file.
- **`<input_yaml/>` fields**: `runCompound` currently passes `{ task_id, intent }` only — `diff` and `ship_outcome` are declared in the TS interface and the manifest but not threaded through. The prompt's analysis section says "sometimes plus diff and ship_outcome" to handle the case where future callers do pass them. Acceptable as forward-compat; eval fixtures don't pass them either.
- **Bun ICU + Chinese tokenization**: e4 fixture relies on ICU-segmented Chinese being meaningful enough for the LLM to classify `runtime` correctly. Validated already by Phase G Unicode hotfix.

## 10. Evidence gate (for G.2.b PR)

- All 528 existing tests green at HEAD `7463c36`.
- Five new unit assertions (U2 / U3 / U4 / U5a / U5b) pass in CI; U1a/U1b kept as existing heuristic tests.
- Manual `ANTHROPIC_API_KEY=…` (or `OPENROUTER_API_KEY=…`) eval run output pasted into PR description per parent §9.
- `grep` cross-prompt sync-check output (§6) demonstrates 15-term parity across 4 files.
- `SGC_FORCE_INLINE=1 bun test` byte-identical to pre-PR (heuristic untouched; alias preserves call sites).
- PR description references this spec + parent §7 explicitly.
- Test count target: 528 → 533 unit (+5 from U2 expanded; U1a/U1b are already counted) + 4 CI-skip eval = 537 with API key set.
