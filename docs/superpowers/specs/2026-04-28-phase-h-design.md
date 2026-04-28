---
status: draft
revision: 2
date: 2026-04-28
phase: H
depends_on: G (G.1 events.ndjson, G.2.a/b LLM swap pattern, G-pre-hotfix Unicode dedup)
blocks: (Phase I — embeddings/vector store, when corpus ≥ 50 entries)
---

# Phase H — `researcher.history` LLM swap (RAG plumbing)

## 1. Goal / Non-goals / Constraints / Success criteria

### Goal

Upgrade `researcher.history` from keyword-only stub to LLM-backed prior-art ranker. Reuse the Phase F/G manifest + `prompt_path` swap pattern. After Phase H, `sgc plan` at L2/L3 surfaces semantically relevant past `solutions/` entries with a per-item one-sentence "why relevant" line, instead of the current keyword-overlap top-5.

This is the third agent in the LLM-everywhere migration after `planner.eng` (G.2.a) and `compound.context` (G.2.b). It closes the POSITIONING.md "knowledge engine" thesis at the architecture layer; real value emerges as `.sgc/solutions/` accumulates entries from organic `sgc ship` flow.

### Non-goals

- No embeddings, no vector store, no new dependency. (Phase I candidate, see §7.)
- No change to `compound.solution` writer path. Corpus grows organically.
- No git log mining. (Stub comment placeholder; defer until corpus has real content + author asks.)
- No design-style overall digest in LLM output. (Stays inside §13 Delegate boundary — `planner.eng` owns `structural_risks`, `sp:brainstorming` owns design exploration.)
- No `plan.md` overall format change. Only one extra `Reason:` line per entry under `## Prior art`.
- No corpus seeding into real `.sgc/solutions/`. Fixture corpus lives at `tests/fixtures/solutions/` for unit + eval. Real corpus seeding (if needed) is a follow-up task outside Phase H.

### Constraints

- ≤6 day window — deadline 2026-05-04 per parent spec §11.
- All 547 unit tests + 8 CI-skip eval tests (post-G.3 baseline) stay green.
- `EventRecord` schema unchanged since G.1.a (G.3 evidence gate #5).
- Heuristic fallback retained: `SGC_FORCE_INLINE=1` OR no API key → keyword-only path.
- Output contract additive — old `plan.ts` callers tolerate missing `relevance_reason`.
- `cache_control` discipline: system block stays byte-identical across calls (purpose + schema), candidates go in user block (per-call delta). The parent spec §11 design issue "N solutions in prompt without breaking cache_control prefix" resolves to this split — see §4.

### Success criteria

1. `prompts/researcher-history.md` lands; manifest declares `prompt_path` + `inputs:`.
2. Heuristic renamed `researcherHistory → researcherHistoryHeuristic` with `export const researcherHistory = researcherHistoryHeuristic` alias (Phase F/G.2 pattern).
3. Pre-filter uses NFC + `Intl.Segmenter` via direct import of `dedup.ts:tokenize` + `normalizeText` (zero duplication of ICU logic).
4. Corpus ≤ 20 entries → all entries pass to LLM. Corpus > 20 → top-N=20 by keyword hit count.
5. LLM outputs `prior_art: PriorArt[]` (≤ 5 entries), each with `relevance_score ∈ [0.3, 1.0]` + `relevance_reason` (≤ 30 words, banned-vocab clean).
6. Zero candidates from pre-filter → skip LLM call entirely; return `{prior_art: [], warnings}`. Validates via mock client call-count assertion.
7. 4 CI-skip eval scenarios (e1-e4) pass: ≥3 of 4 return non-empty `prior_art`; e4 (rename CLI flag — distractor) returns empty (rigor check that LLM rejects low-relevance candidates).
8. ≥1 dogfood `sgc ship` during Phase H window goes through LLM `researcher.history`; events.ndjson extract pasted into `docs/experiments/h-e2e.md`.

---

## 2. Architecture overview

```
sgc plan (L2/L3)
  └── researcher.history spawn (parallel with planner.eng + planner.ceo)
        ├── [STAGE 1: keyword pre-filter — pure JS, in-process, in plan.ts]
        │   1. extractKeywords(intent)  — reuses dedup.ts NFC + Intl.Segmenter
        │   2. scan .sgc/solutions/<cat>/*.md  — count hits per file
        │   3. pick top-N=20 by hit count (or all if corpus ≤ 20)
        │   4. zero candidates → return empty + warning, SKIP spawn
        │
        └── [STAGE 2: LLM rerank — anthropic-sdk OR openrouter]
            5. spawn() with input { intent_draft, candidates }
            6. LLM picks ≤ 5, scores 0.3-1.0, writes ≤ 30-word reason each
            7. validation.ts guards: ref-in-candidates, score-in-range, reason-non-empty
            8. return PriorArt[] with relevance_reason populated
```

### File-level deltas

| File | Change | LOC est. |
|---|---|---|
| `src/dispatcher/agents/researcher-history.ts` | add `PriorArtCandidate` type; widen `PriorArt` with optional `relevance_reason`; rename heuristic + alias; reuse `dedup.ts:tokenize`; export `preFilterSolutions()`; add `coerceLlmOutput()` (5 guards) | ~150 changed |
| `src/commands/plan.ts:183-193` | call `preFilterSolutions()` before spawn; pass `candidates` in input; wrap spawn in try/catch (failure → empty `prior_art` + warning); render `relevance_reason` line in `## Prior art` body | ~30 changed |
| `prompts/researcher-history.md` (new) | system: purpose + scope + steps + anti-patterns + reply format. user: `## Input` placeholder | ~120 |
| `contracts/sgc-capabilities.yaml:295-311` | rewrite `researcher.history` block: `prompt_path` + `inputs.candidates` + reformat `outputs` | ~10 changed |
| `tests/fixtures/solutions/` (new dir) | 6-7 hand-written fixture solutions across 4 categories | new |
| `tests/dispatcher/researcher-history.test.ts` | preserve existing 5 heuristic asserts; add R1-R3 (Unicode fix) + L1-L7 (LLM mock branch via `anthropicClientFactory`) | ~150 added |
| `tests/eval/researcher-history-llm.test.ts` (new) | 4 scenarios e1-e4, CI-skip via `test.skipIf(no key)`, inline `BANNED_VOCAB_RE` mirroring G.2.a/b | ~100 |
| `docs/superpowers/specs/2026-04-28-phase-h-design.md` (this) | the spec | this file |

Total: ~8 files, ~560 LOC including fixtures + tests; source net change ~190 LOC. Single-PR ship — Phase G.2.a/b pattern (~300 LOC each) confirms scale. No sub-phase split.

**r2 correction notes (2026-04-28)**: r1 erroneously assumed (a) `PriorArt`/`ResearcherHistoryInput` live in `types.ts` — they actually live in `src/dispatcher/agents/researcher-history.ts`; (b) `validation.ts` accepts custom per-agent validators — it's manifest-driven and only handles enum/array-of-simple-type. The 5 guards (ref-in-candidates, score-range, reason-non-empty, prior_art-is-array, truncate-to-5) live as `coerceLlmOutput()` in `researcher-history.ts` and are called from `plan.ts` after `spawn()` returns. `validation.ts` unchanged. (c) `plan.ts` already wraps `researcher.history` in `spawn()` (with `inlineStub` for heuristic mode); the change is small — pre-filter helper call + pass `candidates` in input + try/catch + render. PR file count drops 10 → 8.

### Architecture decisions (key)

- **Pre-filter lives in `plan.ts` before `spawn()`.** Reasons: (a) zero candidates short-circuits the entire spawn + Invariant §13 paired-event cost; (b) keyword scan is local IO, doesn't belong in an LLM-only agent; (c) explicit `candidates` in `SpawnInput` is mockable in unit tests without filesystem setup.
- **`candidates` flows as input field; heuristic mode (`inlineStub`) re-scans corpus.** Backwards-compat for the in-process `researcherHistory(intent)` call shape that older tests assume; LLM-mode reads `candidates` from `## Input` YAML directly.
- **LLM returns only `solution_ref` + score + reason — `excerpt` is back-filled by `plan.ts` from candidate map.** Reasons: (a) prevents LLM from inventing `solution_ref` strings (`coerceLlmOutput` rejects ref-not-in-candidates); (b) saves output tokens (no need to re-emit ~500-char excerpts for 5 entries).
- **Custom output guards live in `researcher-history.ts:coerceLlmOutput()`, called from `plan.ts` after `spawn()` returns.** `validation.ts:validateOutputShape` is manifest-driven and only handles `enum[...]` / `array[<simple>]` per the comment at validation.ts:55 — composite `array[{...}]` is deferred to per-agent code. Mirrors how `compound.context` and `planner.eng` rely on prompt-level constraints + post-spawn handling for nested shapes.
- **Heuristic fallback trigger is identical to G.2.a/b.** Manifest `prompt_path` set + (`ANTHROPIC_API_KEY` OR `OPENROUTER_API_KEY` in env) → LLM mode. Otherwise heuristic via `inlineStub`. `SGC_FORCE_INLINE=1` forces heuristic regardless (CI path).
- **Empty corpus + heuristic mode keeps current stub behavior** (`prior_art: []` + warning). No regression.

---

## 3. Data flow + contracts (types + I/O)

### Input contract

```typescript
// src/dispatcher/agents/researcher-history.ts
import type { SolutionCategory } from "../types"

export interface ResearcherHistoryInput {
  intent_draft: string
  candidates?: PriorArtCandidate[]  // NEW; LLM mode requires; heuristic ignores
}

export interface PriorArtCandidate {
  solution_ref: string              // "<category>/<slug>"
  category: SolutionCategory        // existing enum from types.ts
  excerpt: string                   // ≤ 500 chars (frontmatter intent + body prefix, NFC normalized, whitespace folded)
  keyword_hits: number              // transparent to LLM, advisory only
}
```

### Output contract (additive)

```typescript
// src/dispatcher/agents/researcher-history.ts
export interface PriorArt {
  source: "solutions" | "git"
  relevance_score: number           // 0-1
  excerpt: string                   // back-filled by plan.ts from candidate map
  solution_ref?: string
  relevance_reason?: string         // NEW; LLM mode required, heuristic omits
}
```

`relevance_reason?` optional → `plan.ts` renders inline `Reason: <text>` line when present, omits when absent. Old tests with no `relevance_reason` field zero-regression.

### LLM output YAML shape (prompt-enforced)

```yaml
prior_art:
  - solution_ref: auth/oauth-token-refresh-2026-04-12
    relevance_score: 0.85
    relevance_reason: |
      Past task fixed silent token-refresh failure on 401 by adding retry-with-backoff;
      current intent's rate-limit middleware hits the same failure-then-retry pattern.
warnings:
  - <optional warning string>
```

### `coerceLlmOutput()` — 5 guards in `researcher-history.ts`

Lives in `researcher-history.ts` (NOT `validation.ts` — manifest validator only handles `enum[...]` / `array[<simple>]` per validation.ts:55 comment). Imports `OutputShapeMismatch` from `../validation`. Called from `plan.ts` after `spawn()` returns. On any failure → `OutputShapeMismatch` with the violating field cited:

```typescript
// researcher-history.ts
import { OutputShapeMismatch } from "../validation"

export function coerceLlmOutput(
  raw: unknown,
  candidates: PriorArtCandidate[],
): ResearcherHistoryOutput {
  // Guard 1: prior_art is array
  // Guard 2: each entry's solution_ref ∈ candidates set
  // Guard 3: each relevance_score ∈ [0.3, 1.0]
  // Guard 4: each relevance_reason non-empty
  // Guard 5: truncate prior_art > 5 to first 5 (tolerant — mirrors G.2.b tag overflow)
  // back-fill excerpt + source from candidates map
  // return { prior_art, warnings }
}
```

1. `prior_art` is array — else throw.
2. Each entry's `solution_ref` exists in input candidates set — else throw `"ref X not in input candidates"` (LLM hallucination defense).
3. Each `relevance_score ∈ [0.3, 1.0]` — else throw (0.3 floor enforces "drop low-relevance" rather than "pad to 5").
4. Each `relevance_reason` non-empty string — else throw.
5. `prior_art.length > 5` → silently truncate to first 5 (tolerant; mirrors G.2.b tag-overflow handling — better than throwing on a "too eager" but otherwise valid response).

### Excerpt-truncation rule (pre-filter side)

- Read `<category>/<slug>.md` full text.
- Prefer frontmatter `intent:` field + ~80 chars; if absent, body prefix only.
- Total cap 500 chars after NFC normalization + whitespace fold.
- Excerpt is what LLM sees AND what `plan.ts` renders in `## Prior art`.

### Token budget

- `token_budget: 1500` (output; 5 entries × ~250 tokens incl. reason fits comfortably).
- `timeout_s: 60` (matches existing LLM agents).
- Input side: top-N=20 candidates × ~500 chars ≈ 10KB ≈ ~2.5K input tokens; system prefix ~1K → ~3.5K total input. ~$0.05/call estimated; dogfood tolerable.

---

## 4. Prompt template + cache_control split

### `prompts/researcher-history.md`

````markdown
# Purpose
Rerank prior solutions by semantic relevance to the current intent_draft.
Your job is NOT to write the plan, propose new solutions, or critique the
intent — that work belongs to planner.eng / planner.ceo / sp:brainstorming.
Your job IS to look at past solutions and tell the user which 0-5 of them
are actually worth reading before they start.

## Scope
- Token scope: read:progress, read:decisions, read:solutions
- Forbidden: write anywhere; invent solution_ref values not in candidates

## Your analysis
1. Read intent_draft and the candidates list (each has solution_ref +
   category + excerpt + keyword_hits).
2. For each candidate, decide: would reading this past solution change
   how the user approaches the new intent?
   - YES, strong overlap (same failure mode, same module, transferable fix)
     → score 0.7-1.0
   - YES, partial (adjacent system, similar pattern, useful context)
     → score 0.3-0.6
   - NO, only keyword coincidence (e.g., both mention "auth" but unrelated
     concerns) → DROP from output
3. Pick at most 5 candidates ranked highest. If fewer than 5 clear the
   0.3 floor, return fewer (zero is valid).
4. For each kept candidate, write ONE sentence (≤ 30 words) explaining
   the specific transferable insight. Generic ("touches auth", "similar
   topic") is rejected — name the concrete pattern.

## Anti-patterns
- DO NOT invent solution_ref values. Only reference refs from the input
  candidates list.
- DO NOT reproduce the excerpt — caller has it.
- DO NOT propose new solutions or rewrite the intent.
- DO NOT use banned vocabulary in relevance_reason: significantly,
  robust, comprehensive, presumably, likely, seems (per spec §10
  banned-vocab list).
- DO NOT pad to 5 entries if only 2 are actually relevant.

## Reply format

```yaml
prior_art:
  - solution_ref: <one of the input candidate refs>
    relevance_score: <float 0.3-1.0>
    relevance_reason: <one sentence, ≤ 30 words, names the transferable pattern>
warnings:
  - <optional string per warning>
```

If zero candidates clear the 0.3 floor, return:
```yaml
prior_art: []
warnings:
  - "no candidate cleared 0.3 relevance floor"
```

## Input

<input_yaml/>

## Submit
Write only the YAML above. No prose outside the YAML block.
````

### Cache_control split

`splitPrompt()` (existing, `anthropic-sdk-agent.ts`) splits on `## Input` heading:

| Block | Content | Cached | Per-call delta |
|---|---|---|---|
| **System** | Purpose + Scope + Analysis steps + Anti-patterns + Reply format | ✓ ephemeral | 0 — byte-identical |
| **User** | `## Input` heading + spawn frontmatter + intent_draft + candidates YAML | ✗ | candidates differ each call |

**Parent spec §11 design issue resolution**: the question "how to pass N solutions into prompt without breaking cache_control prefix" resolves to "candidates go in the user block." The system block stays cached on its purpose+schema bytes; the user-block cache miss on per-call candidates is expected and not a defect. No new cache mechanism needed.

### Manifest entry

Replaces existing `contracts/sgc-capabilities.yaml:295-311` block. Note `outputs` uses composite `array[{...}]` form per planner.eng convention (validateValueAgainstDecl skips composite per validation.ts:56-63):

```yaml
researcher.history:
  version: "0.2"
  source: CE /ce:plan research spawner (Phase H LLM swap)
  purpose: Mine solutions/ for prior art, LLM-rerank by semantic relevance
  prompt_path: prompts/researcher-history.md
  inputs:
    intent_draft: markdown
    candidates: array[{solution_ref, category, excerpt, keyword_hits}]
  outputs:
    prior_art: array[{source, relevance_score, excerpt, solution_ref?, relevance_reason?}]
    warnings: array[string]
  scope_tokens:
    - "read:decisions:*"
    - "read:solutions"
    - "exec:git:read"
  token_budget: 1500
  timeout_s: 60
```

(Existing `token_budget: 8000` and `timeout_s: 240` from r1 dropped — researcher.history is a quick rerank, not a deep mining pass; rationale per §3 "Token budget".)

### Heuristic mode behavior

`researcherHistoryHeuristic` (renamed from `researcherHistory`):

- Same body as today (keyword scan, top-5 by `hits / keywords.length` score).
- `extractKeywords` swapped to use `dedup.ts:tokenize` (NFC + Intl.Segmenter) instead of the current `split(/[^a-z0-9]+/)`. Fixes the same Unicode bug that dedup hotfix fixed; CJK intents stop returning empty token sets.
- `relevance_reason` field omitted on output. `plan.ts` renders fallback `(keyword overlap: 0.NN)` line.

---

## 5. Error handling + integration + testing

### 5.1 Failure matrix

| Failure | Detection | Behavior | spawn outcome |
|---|---|---|---|
| `.sgc/solutions/` missing | pre-filter (plan.ts) | candidates=[], skip spawn, warning="solutions dir missing" | (no spawn) |
| corpus exists but 0 files | pre-filter | same, warning="solutions dir empty" | (no spawn) |
| pre-filter 0 keywords | pre-filter | same, warning="intent_draft produced no keywords" | (no spawn) |
| pre-filter hits 0 files | pre-filter | candidates=[], skip spawn, warning="no candidate matches" | (no spawn) |
| LLM timeout | spawn try/finally | `SpawnTimeout` thrown | timeout |
| LLM API error (429/500) | anthropic-sdk-agent | `AnthropicSdkError` thrown | error |
| LLM returns invalid YAML | anthropic-sdk-agent | `OutputShapeMismatch` thrown | schema_violation |
| LLM invents `solution_ref` | `coerceLlmOutput` guard #2 | `OutputShapeMismatch("ref X not in input candidates")` | schema_violation |
| `relevance_score` out of range | guard #3 | `OutputShapeMismatch` | schema_violation |
| `relevance_reason` empty | guard #4 | `OutputShapeMismatch` | schema_violation |
| `prior_art.length > 5` | guard #5 | silent truncate to 5 | success |
| no API key + `SGC_FORCE_INLINE`=1 | resolveMode | heuristic path | (mode=inline) |

### 5.2 plan.ts fallback

`researcher.history` failure does NOT block `sgc plan`:
- On any thrown error from spawn: catch in `plan.ts`, set `prior_art=[]`, `warnings=["researcher.history failed: <err.name>"]`.
- `plan.md`'s `## Prior art` section renders `(researcher.history failed — see events.ndjson)`.
- The failure is already audited via Invariant §13 Tier-2 (`llm.response.outcome=error|schema_violation`); operator queries via `sgc tail --agent researcher.history`.
- Same posture as G.2.b `compound.context` on the ship path: LLM failure must not block primary command flow.

### 5.3 Integration into `plan.ts`

Current shape (`src/commands/plan.ts:183-193` — already in spawn framework with `inlineStub` for heuristic):

```typescript
spawn<unknown, ResearcherHistoryOutput>(
  "researcher.history",
  { intent_draft: taskDescription },
  {
    stateRoot,
    inlineStub: (i) => researcherHistory(i as { intent_draft: string }, { stateRoot }),
    logger,
    taskId,
  },
),
```

Post-Phase-H — pre-filter, pass `candidates`, post-spawn coerce, try/catch fallback:

```typescript
const candidates = preFilterSolutions(taskDescription, stateRoot)
let researcherSpawnPromise: Promise<{ output: ResearcherHistoryOutput }>
if (candidates.length === 0) {
  researcherSpawnPromise = Promise.resolve({
    output: { prior_art: [], warnings: ["no candidates from pre-filter"] },
  })
} else {
  researcherSpawnPromise = spawn<unknown, unknown>(
    "researcher.history",
    { intent_draft: taskDescription, candidates },
    {
      stateRoot,
      inlineStub: (i) => researcherHistory(i as ResearcherHistoryInput, { stateRoot }),
      logger,
      taskId,
    },
  ).then((r) => ({ output: coerceLlmOutput(r.output, candidates) }))
   .catch((err) => ({
     output: {
       prior_art: [],
       warnings: [`researcher.history failed: ${err instanceof Error ? err.name : "unknown"}`],
     },
   }))
}
tasks.push(researcherSpawnPromise)
```

`preFilterSolutions` is a new export from `src/dispatcher/agents/researcher-history.ts` that:
- imports `tokenize` from `src/dispatcher/dedup.ts` directly (single source of NFC + Intl.Segmenter truth);
- scans `<stateRoot>/solutions/<cat>/*.md`;
- returns `PriorArtCandidate[]` (top-N=20 by hit count, or all if corpus ≤ 20).

`coerceLlmOutput` is heuristic-mode safe — when `inlineStub` runs, `researcherHistory()` returns the legacy shape (no `relevance_reason`); coerce passes it through unchanged (Guard 4 only enforces non-empty when present, not "must exist").

### 5.4 Test strategy

Mirror G.2.a/b layered approach:

#### `tests/dispatcher/researcher-history.test.ts` (expand, ~150 LOC added)

Existing heuristic asserts preserved (`SGC_FORCE_INLINE=1` path).

**New heuristic / Unicode tests R1-R3**:
- R1: `extractKeywords("修复 spawn 超时")` returns non-empty Set (NFC + Segmenter).
- R2: `mineSolutions` over fixture corpus with Chinese intent finds matching files.
- R3: `relevance_reason` field absent in heuristic output (`undefined`).

**New LLM-branch tests L1-L7** (mock `anthropicClientFactory`):
- L1: mock returns valid YAML → output parsed correctly, `relevance_reason` populated.
- L2: mock returns `solution_ref: "ghost/missing"` not in candidates → `OutputShapeMismatch`.
- L3: mock returns `relevance_score: 1.5` → `OutputShapeMismatch`.
- L4: mock returns `relevance_reason: ""` → `OutputShapeMismatch`.
- L5: mock returns 6 entries → first 5 kept, no throw (tolerant).
- L6: pre-filter returns 0 candidates → spawn skipped; assert `client.messages.create` call count = 0.
- L7: LLM throws → `plan.ts` produces empty `prior_art` with warning, does not crash plan flow.

#### `tests/fixtures/solutions/` (new directory, 6-7 files)

```
tests/fixtures/solutions/
├── auth/oauth-token-refresh-2026-04-12.md
├── auth/api-key-rotation-2026-04-15.md
├── data/sqlite-migration-from-yaml-2026-04-18.md
├── infra/proxy-env-bun-vs-npm-2026-04-10.md
├── runtime/spawn-timeout-retry-2026-04-13.md
├── runtime/api-throttle-leaky-bucket-2026-04-19.md
└── ui/  (empty — verifies empty-category path doesn't crash)
```

Each file: ~300-500 chars, frontmatter `intent:` + body. Calibrated empirically during plan execution to make e1-e4 distinguishable (see §7 open question 2).

#### `tests/eval/researcher-history-llm.test.ts` (new, CI-skip)

`test.skipIf(!process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY)`.

Four scenarios:

| ID | Lang | Level | Intent | Expected |
|----|------|-------|--------|----------|
| e1 | EN | L2 | "add rate limiting middleware to public API" | non-empty; reason mentions "rate limit" or "throttle"; ref ∈ {auth/*, runtime/api-throttle-*} |
| e2 | EN | L3 | "migrate .sgc/state from YAML to SQLite" | non-empty; reason mentions schema/migration; ref ∈ {data/sqlite-migration-*} |
| e3 | 中文 | L2 | "给 dispatcher 的 spawn() 增加重试超时的结构化日志" | non-empty (validates NFC tokenize end-to-end); ref ∈ {runtime/spawn-timeout-retry-*} |
| e4 | EN | L2 | "rename a CLI flag from --foo to --bar" | empty `prior_art` (rigor: LLM rejects when no candidate clears 0.3) |

Assertions (stricter than G.2.a):
- ≥3 of 4 scenarios return non-empty `prior_art`.
- All non-empty `relevance_reason` are ≤ 30 words.
- All `relevance_reason` pass banned-vocab regex (reuse `tests/lib/check-banned-vocab.ts` from G.2.a).
- All returned refs exist in the input candidates set.
- e4 specifically returns empty (rigor check — LLM not just keyword-matching).

### 5.5 PR scope (single PR)

```
H PR files (8 total — r2 dropped types.ts + validation.ts):
  src/dispatcher/agents/researcher-history.ts   (PriorArtCandidate + relevance_reason + heuristic rename + Unicode reuse + preFilterSolutions + coerceLlmOutput)
  src/commands/plan.ts                          (preFilter + candidates input + post-spawn coerce + try/catch + render reason)
  prompts/researcher-history.md                 (new)
  contracts/sgc-capabilities.yaml               (researcher.history block rewrite)
  tests/fixtures/solutions/<6 .md files>        (new)
  tests/dispatcher/researcher-history.test.ts   (R1-R3 + L1-L7)
  tests/eval/researcher-history-llm.test.ts     (new, CI-skip, e1-e4)
  docs/superpowers/specs/2026-04-28-phase-h-design.md  (r2 spec)
```

Estimate: ~560 LOC change including fixtures + tests; source net change ~190 LOC. Phase G.2.a/b (~300 LOC each, single PR) confirmed this scale is reviewable in one pass.

---

## 6. Locked decisions (brainstorm audit)

Documented so future readers see what was considered and why.

| # | Decision | Rejected | Why |
|---|---|---|---|
| 1 | Plumbing-first (fixture validation) | Bootstrap-first (seed corpus first) / split (Unicode fix only, push RAG to Phase I) | user pick (2026-04-28); 6-day window + corpus growth is incremental; ship architecture, accumulate value as ships happen |
| 2 | Two-stage keyword + LLM rerank | All-context to LLM / embeddings + cosine | user pick; corpus ceiling ~100, 6-day deadline; embeddings adds dep + cold-start; two-stage keeps zero new deps and stays extensible |
| 3 | LLM emits `relevance_reason` | rerank-only (no field) / overall digest paragraph | user pick; per-item reason surfaces semantic value at the point of use, doesn't trespass into planner.eng's structural_risks or sp:brainstorming's design space |
| 4 | Pre-filter in plan.ts, not in spawn | spawn rescans corpus | zero candidates short-circuits spawn + Invariant §13 paired-event cost; explicit `candidates` is mockable in unit tests without filesystem setup |
| 5 | LLM returns only `solution_ref`, excerpt back-filled by plan.ts | LLM repeats excerpt in output | hallucination defense (ref must be from candidates) + token saving (no re-emitting ~500-char excerpts × 5) |
| 6 | `relevance_reason?` optional field | required | heuristic fallback omits without breaking older callers; plan.ts uses `?? "(keyword overlap: ...)"` fallback |
| 7 | 0.3 score floor + LLM may return < 5 | force top-5 always | counters "polite padding" — rigor verified by e4 distractor scenario (rename CLI flag → must return empty) |
| 8 | Pre-filter reuses dedup `tokenize` / `normalizeText` | researcher writes its own tokenize | one source of NFC + Intl.Segmenter truth; dedup hotfix already lands ICU; zero duplication |
| 9 | candidates flows as `ResearcherHistoryInput` field | spawn rescans corpus from disk | spawn is pure LLM call, shouldn't IO; explicit input enables unit-test mocking; trace clarity |
| 10 | fixture corpus at `tests/fixtures/solutions/` | write to real `.sgc/solutions/` | test isolation — `.sgc/solutions/` is the real corpus, must not be polluted; `stateRoot` override injects fixture path |
| 11 | single PR, no sub-phase split | H.1 Unicode hotfix / H.2 LLM swap / H.3 dogfood | G.2.a/b ~300 LOC single PR pattern works; Unicode work is reuse of dedup, not a fresh hotfix |
| 12 | heuristic preserved + alias rename | delete heuristic, force LLM mode | matches G.2.a/b/F pattern; CI lacks API key, must fallback; `SGC_FORCE_INLINE=1` is escape hatch |
| 13 | "N solutions / cache_control" treated as solved | new cache split mechanism | `splitPrompt` already separates system (cached purpose+schema) from user (per-call); solutions belong in user block, miss is expected |
| 14 | no git log mining | add git log as `source: "git"` | stub comment defers it until corpus grows; `PriorArt.source` enum still reserves `"git"` slot |
| 15 | no overall digest paragraph | LLM emits 2-4 sentence design summary | §13 Delegate boundary: planner.eng owns structural_risks (sgc), design summary is sp:brainstorming territory; researcher stays inside sgc |
| 16 | failure fallback: plan does not crash | require LLM success to produce plan | compound.context same posture; Invariant §13 Tier-2 audit captures the failure; `sgc tail` operator surface; blocking primary flow contradicts G.3 dogfooding stability requirement |

---

## 7. Open questions / deferred to plan or ship

These are NOT spec-locked; they resolve empirically during plan execution or first ship.

1. **Bun ICU CJK segmentation quality on fixtures.** Reuses dedup's `Intl.Segmenter`, but e3 fixture-match accuracy depends on Bun's bundled ICU dictionary. Plan-stage 5-min smoke: run `tokenize` on the e3 Chinese intent, confirm non-empty + semantically usable. Fallback to bigram split if degraded (mirrors dedup hotfix Appendix A.5 fallback strategy).
2. **Fixture wording calibration.** e4 (distractor) must come back empty, e1-e3 must come back non-empty with right refs. Too-broad fixtures over-match e4; too-narrow fixtures under-match e1-e3. Plan-stage iterate fixtures 1-2 times against eval output until separation holds.
3. **Author actually reads `relevance_reason`?** Phase H dogfood ship will run `sgc plan` 1-2 times against a real intent. Signal that the field is useful: author cites it in `sgc plan` output discussion. Useless signals: ignored, too short to be actionable. Adjust prompt (max words, leading verbs) post-ship without re-shipping the architecture.
4. **`token_budget: 1500` correct?** Estimate: 5 × ~250 tokens per entry. Eval e1-e4 captures `usage.output_tokens`; raise to 2000 if persistently > 1200, drop to 1000 if persistently < 800.
5. **0.3 floor too high or low?** If LLM persistently scores ~0.4 on candidates that aren't actually relevant (failed to drop), raise to 0.5. If LLM persistently scores ~0.25 on actually relevant items (over-strict), drop to 0.2 + adjust prompt phrasing. Eval distribution informs one calibration pass.
6. **Which dogfood ship to use first.** F-4 (sgc ship --pr auto-push) and F-5 (sgc review --append-as) remain deferred from Phase G.3; either can be DF-1 in Phase H window. Or pick a freshly discovered ergonomics fix at plan-stage.
7. **Whether to seed real `.sgc/solutions/` after ship.** Plumbing-first explicitly says "fixture-only, real corpus grows organically." If post-ship the author observes real corpus stays empty for weeks, a follow-up task seeds 5-10 entries from sgc's own session learnings (npm vs HTTP_PROXY, citty consola CI mode, ssh-agent isolation, etc.). Out of Phase H scope.

### Out of scope (hard boundary)

- Embeddings + vector store (Phase I candidate; trigger: corpus ≥ 50 + measurable retrieval miss rate).
- git log mining (defer until corpus has real entries + author asks).
- LLM overall digest output (per §13 Delegate boundary; planner.eng owns risks).
- `compound.solution` LLM swap (separate phase; Phase H upgrades only `researcher.history`).
- Real `.sgc/solutions/` seeding (independent task; Phase H validates with fixtures, real corpus grows organically).
- `relevance_reason` multilingual prompt tuning (Chinese intent → reason language: empirical post-ship, not spec-locked).

---

## 8. Phase-level evidence gates (recap)

Before merge, the Phase H PR meets:

1. All existing 547 unit tests + 8 CI-skip eval tests stay green.
2. New heuristic asserts R1-R3 + LLM mock asserts L1-L7 pass.
3. Heuristic-branch behavior diff vs pre-PR golden: single-direction change ONLY (CJK intents now produce non-empty token sets that previously returned empty); English-path output unchanged.
4. LLM-branch eval tests e1-e4 pass when `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY` set; output pasted into PR description.
5. PR description references this spec by §-section per Phase G convention.
6. `EventRecord` schema unchanged (verified via `tests/dispatcher/logger.test.ts` baseline assertions).
7. ≥1 dogfood `sgc ship` during Phase H window goes through LLM `researcher.history`; events.ndjson extract pasted into `docs/experiments/h-e2e.md`.

---

## 9. Deliverables summary

**New files (5)**:
- `prompts/researcher-history.md`
- `tests/fixtures/solutions/<6 .md files>`
- `tests/eval/researcher-history-llm.test.ts`
- `docs/superpowers/specs/2026-04-28-phase-h-design.md` (this)
- `docs/experiments/h-e2e.md` (post-ship dogfood evidence)

**Modified files (4)**:
- `src/dispatcher/agents/researcher-history.ts` (PriorArtCandidate + relevance_reason + heuristic rename + tokenize reuse + preFilterSolutions + coerceLlmOutput)
- `src/commands/plan.ts` (preFilter + candidates input + post-spawn coerce + try/catch + render)
- `contracts/sgc-capabilities.yaml` (researcher.history block rewrite)
- `tests/dispatcher/researcher-history.test.ts` (R1-R3 + L1-L7)

**Plans next** (generated via sp:writing-plans after this spec is approved):
- `docs/superpowers/plans/2026-04-??-phase-h.md`

---

## Change log

- 2026-04-28 r1: draft from sp:brainstorming session; user-approved 7 sections (goal/non-goals, architecture, contracts, prompt+cache, errors+tests, locked decisions, open questions).
- 2026-04-28 r2: pre-plan codebase verification corrections — (a) `PriorArt` / `ResearcherHistoryInput` / `PriorArtCandidate` all live in `src/dispatcher/agents/researcher-history.ts` (NOT `types.ts`); (b) `validation.ts` is manifest-driven (handles `enum[...]` / `array[<simple>]` only); custom guards live in `researcher-history.ts:coerceLlmOutput()`, called from `plan.ts` after `spawn()` returns; (c) `plan.ts` already wraps `researcher.history` in `spawn()` with `inlineStub` for heuristic — change is small (pre-filter helper + `candidates` in input + try/catch + render); (d) PR file count 10 → 8 (drop types.ts + validation.ts); (e) manifest format aligned to existing `array[{...}]` composite-shape convention from planner.eng. No goal/success-criteria changes.
