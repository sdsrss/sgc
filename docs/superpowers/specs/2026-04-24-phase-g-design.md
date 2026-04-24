# Phase G — Design Spec

**Status**: Draft (pending execution)
**Date**: 2026-04-24
**Depends on**: Phase F (LLM swap pattern for classifier.level + reviewer.correctness)
**Blocks**: Phase H (researcher.history RAG)

---

## 1. Drivers (why Phase G)

Three simultaneous drivers, all committed:

1. **Complete LLM-everywhere migration** — two agents still on stubs: `planner.eng` (only checks intent length), `compound.context` (regex-driven category). Finish swapping them to real LLM so the stub fallbacks become true fallbacks, not the main path.
2. **System observability to debug real failures** — current logging is 9 `opts.log ?? console.log` sinks emitting human strings. Zero structured correlation across spawns. F-1 E2E experiment had to reconstruct failure chain by hand from per-spawn YAML files. Structured event stream needed.
3. **Multilingual (Chinese) workflow unblock** — `src/dispatcher/dedup.ts:tokenize` uses `split(/[^a-z0-9]+/)`, which zeros out all CJK/accented input. Every Chinese `motivation` currently produces an empty token set, collapsing Jaccard to tags-only and breaking compound dedup for the project's primary author.

## 2. Phase shape

Split into three sub-phases, one spec (this doc) governs all three, three separate execution plans.

```
Phase G spec (this doc)
├── G.1 infrastructure  (parallel OK within G.1; 2 PRs)
│   ├── G.1.a structured logs
│   └── G.1.b Unicode dedup
├── G.2 LLM swap  (serial: G.2.a → G.2.b; 2 PRs)
│   ├── G.2.a planner.eng + repo_map contract extension
│   └── G.2.b compound.context
└── G.3 E2E validation  (depends on G.1+G.2 merged; 1 PR)
```

PR dependency:

```
G.1.a ──┐
        ├─► merged to main ──► G.2.a ──► G.2.b ──► G.3
G.1.b ──┘
```

### Out of scope (hard boundary)

- `researcher.history` LLM swap — deferred to Phase H (RAG architecture, retrieval over `.sgc/solutions/`, needs embeddings + top-K re-rank; separate design doc).
- Chinese stopword expansion (YAGNI — Jaccard is robust enough to noise).
- `events.ndjson` rotation / truncation / compression (deferred until janitor actually needs it).
- Event schema v2 or backwards-incompatible evolution (this spec defines v1 + forward-compat rules only).
- Cross-spawn trace/span semantics (OpenTelemetry-style). Flat event stream for this phase.
- LLM cost aggregation / billing. Per-event `token_count` in payload is fine; no aggregation or dashboard.
- `sgc tail` or dashboard command.
- All of modes B, C for logs (single-channel, pure-NDJSON stdout); CJK bigram tokenization (A-option simple fix with `Intl.Segmenter` is sufficient); researcher handling options α, γ (chose β — independent Phase H).

---

## 3. Invariant §13 — spawn event audit completeness (layered)

Added to `contracts/sgc-capabilities.yaml`:

> **§13 Spawn event audit completeness** — Every call to `spawn()` MUST emit a paired `spawn.start` and `spawn.end` event to `.sgc/progress/events.ndjson`. The `end` event's `payload.outcome` MUST be one of `success | timeout | error`. Emission is guaranteed by a single `try/finally` in `src/dispatcher/spawn.ts`. Other event types (`llm.request`, `dedup.scored`, `review.verdict_emitted`, etc.) are voluntary during Phase G; their schemas evolve freely.

**Layered design**:
- **Hard** (Invariant §13): `spawn.start` + `spawn.end` for every `spawn()` call. Enforced at a single chokepoint in `spawn.ts`. Test-enforced.
- **Soft** (convention, no enforcement): every command emits at least one high-level event (`plan.classified`, `ship.gate_passed`, `compound.dedup_decided`, ...). Smoke-tested.

**Runtime enforcement**: try/finally in `spawn()` — see §4.3 below.

**Exemption**: event-sink failure (disk full, permission error) does NOT fail the spawn. Logs to stderr and continues. Invariant §13 is waived for infra-level write failures (the stderr line is itself the audit trail).

---

## 4. G.1.a — Structured logs

### 4.1 Logger module (new: `src/dispatcher/logger.ts`)

```typescript
export interface EventRecord {
  schema_version: 1
  ts: string                       // ISO 8601 UTC, millisecond precision
  task_id: string | null           // null for pre-task events
  spawn_id: string | null          // null for non-spawn events
  agent: string | null             // manifest.name or null
  event_type: string               // "<domain>.<verb_past>" (dot notation)
  level: "debug" | "info" | "warn" | "error"
  payload: Record<string, unknown>
}

export interface Logger {
  say(msg: string): void           // human CLI text (backwards-compat with opts.log)
  event(e: Omit<EventRecord, "schema_version" | "ts">): void
}

export function createLogger(opts: {
  stateRoot?: string               // .sgc/ root
  say?: (m: string) => void        // defaults to console.log
  eventSink?: (e: EventRecord) => void  // defaults to ndjson append
}): Logger
```

**API surface deliberately minimal**: only `say` + `event`. Level is a field on the event, not separate methods. No `debug()`/`warn()`/`error()` sugar methods.

### 4.2 `events.ndjson` write semantics

- Path: `.sgc/progress/events.ndjson` (single file, task-shared, append-only).
- Format: one JSON object per line, newline-terminated.
- Write mechanism: `fs.appendFileSync` (POSIX O_APPEND is atomic for writes ≤ PIPE_BUF/4KB; event records fit easily).
- Directory creation: `ensureSgcStructure` extended to create `.sgc/progress/` if missing.
- No rotation, no truncation (out of scope).
- `schema_version: 1` on every line; forward-compat rule: new fields additive + optional; breaking change → bump to 2.

**Example line**:

```json
{"schema_version":1,"ts":"2026-04-24T14:32:17.123Z","task_id":"01JKZ7...","spawn_id":"01JKZ7...-classifier.level","agent":"classifier.level","event_type":"spawn.start","level":"info","payload":{"mode":"anthropic-sdk","manifest_version":"1.0","timeout_ms":60000}}
```

### 4.3 Invariant §13 enforcement in `spawn()`

**`SpawnOptions` contract extension** (additive, backwards-compat):

```typescript
export interface SpawnOptions {
  // ...existing fields: stateRoot, inlineStub, timeoutMs, pollIntervalMs, ulid,
  //    mode, claudeCliRunner, anthropicClientFactory, openRouterFetch,
  //    hasClaudeCli, maxRetries, forceError...
  taskId?: string                   // NEW — threaded into events for correlation
  logger?: Logger                   // NEW — injectable sink; defaults to createLogger({})
}
```

**Wrapping** — `src/dispatcher/spawn.ts` `spawn()` function, illustrative skeleton:

```typescript
export async function spawn<I, O>(agentName, input, opts): Promise<SpawnResult<O>> {
  const manifest = getSubagentManifest(agentName)
  // Pre-start Invariant-§8/§1 failures (scope violation, manifest not found)
  // may throw here — those are audited by their own Invariants, not §13.
  // ... existing scope-token computation, ensureSgcStructure, ULID, prompt write ...

  const logger = opts.logger ?? createLogger({ stateRoot: opts.stateRoot })
  const startTs = Date.now()
  const mode = resolveMode(opts, manifest)

  logger.event({
    task_id: opts.taskId ?? null,
    spawn_id, agent: agentName,
    event_type: "spawn.start", level: "info",
    payload: { mode, manifest_version: manifest.version }
  })

  let outcome: "success" | "timeout" | "error" = "error"
  try {
    // ... existing mode dispatch (inline / claude-cli / anthropic-sdk / openrouter / file-poll) ...
    outcome = "success"
    return { spawnId, output, promptPath, resultPath }
  } catch (e) {
    outcome = e instanceof SpawnTimeout ? "timeout" : "error"
    throw e
  } finally {
    logger.event({
      task_id: opts.taskId ?? null,
      spawn_id, agent: agentName,
      event_type: "spawn.end",
      level: outcome === "success" ? "info" : "warn",
      payload: { outcome, elapsed_ms: Date.now() - startTs }
    })
  }
}
```

**Invariant §13 scope clarification**: the paired-event requirement applies from `spawn.start` emission onward. If pre-emission setup (scope-token computation, manifest lookup, prompt-write) throws, neither event fires — those failures are audited by Invariants §1 / §8, not §13.

### 4.4 Command migration strategy (backwards-compat)

Nine commands use `opts.log` today. We keep that contract:

- Commands accept optional `opts.logger?: Logger` in addition to existing `opts.log?: (m: string) => void`.
- When only `log` is passed: internally wrap as `createLogger({ say: log, eventSink: defaultNdjsonSink })`. Double-channel engages automatically; callers see zero breakage.
- When `logger` is passed: use directly.
- When both are passed: `logger` wins (its internal `say` is used).
- When neither: default `createLogger({})` — `console.log` + `defaultNdjsonSink`.

**Plumbing into `spawn()`**: commands forward the resolved logger via `SpawnOptions.logger` (see §4.3). Commands that know the current task forward `SpawnOptions.taskId` for event correlation; pre-task spawns (e.g. classifier before `taskId` exists) pass `null`.

**No command signature breaks.** All existing tests continue to pass with their mock `log` sinks.

### 4.5 Event sink error handling

Event writes must never cascade into spawn failures. `defaultNdjsonSink` catches write errors and logs to `console.error("[sgc] event sink failed:", err)`, then continues. Invariant §13 is structurally "best-effort with try/finally guarantee" — if the disk can't be written, the spawn still completes (the stderr line is the audit).

### 4.6 Test strategy

- `tests/dispatcher/logger.test.ts` (new): EventRecord serialization, ndjson append atomicity, default sink behavior, mock eventSink injection.
- `tests/dispatcher/spawn.test.ts` (expand): assert `events.ndjson` contains paired `spawn.start` + `spawn.end` for every spawn path (success, timeout, throw, forceError).
- `tests/eval/invariants.test.ts` (expand): §13 scenario — inject `forceError` and assert `spawn.end{outcome:"error"}` is still emitted.
- `tests/dispatcher/commands-event-emission.test.ts` (new): each of the 9 commands emits at least one high-level event (soft-contract smoke test).

### 4.7 Event naming convention

- Pattern: `<domain>.<verb_past>` — e.g. `spawn.start`, `spawn.end`, `llm.request`, `llm.response`, `llm.fallback`, `dedup.scored`, `review.verdict_emitted`, `plan.classified`, `ship.gate_passed`.
- Only `spawn.*` is enforced (Invariant §13). Others follow this convention by discipline; if drift forms a pattern, formalize in a later phase.

---

## 5. G.1.b — Unicode dedup

### 5.1 Modifications to `src/dispatcher/dedup.ts`

Approximately 15 lines changed.

**`normalizeText` — add NFC**:

```typescript
export function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ")
}
```

**`tokenize` — replace split with `Intl.Segmenter`**:

```typescript
const SEGMENTER = new Intl.Segmenter([], { granularity: "word" })

export function tokenize(text: string): Set<string> {
  const normalized = text.normalize("NFC").toLowerCase()
  const tokens = new Set<string>()
  for (const seg of SEGMENTER.segment(normalized)) {
    if (!seg.isWordLike) continue          // ICU filters punctuation / whitespace
    const w = seg.segment
    if (w.length <= 2) continue            // preserve existing > 2-char filter
    if (STOPWORDS.has(w)) continue
    tokens.add(w)
  }
  return tokens
}
```

### 5.2 Locale strategy

`new Intl.Segmenter([], { granularity: "word" })` — empty locale array lets ICU select based on input. For sgc's mixed EN/中文 corpus this is sufficient; both English and CJK segment correctly under ICU defaults.

### 5.3 What does NOT change

- `DEDUP_THRESHOLD = 0.85` (Invariant §3, hardcoded).
- `STOPWORDS` remains English-only (YAGNI — Chinese stopwords dropped from scope).
- `similarity()`, `findBestMatch()`, `isDuplicate()`, `computeSignature()` signatures unchanged.
- All callers (`compoundRelated`, `compoundContext`) zero-diff.

### 5.4 Behavior changes

- **NFC normalization**: `café` (NFD: `café`) and `café` (NFC: `café`) now produce identical signatures (previously divergent hashes).
- **CJK tokenization**: `修复空指针崩溃` no longer returns empty; ICU segments into meaningful units (exact output depends on Bun's ICU version — see §5.6).
- **English backwards compat**: `refactor the auth middleware` → `{refactor, auth, middleware}` — identical to pre-G.1.b behavior (ICU segments English by whitespace/punctuation, `isWordLike` filter strips non-words, STOPWORDS drops `the`).

### 5.5 Performance

`Intl.Segmenter` constructed once at module load; reused across `tokenize` calls. Each call is O(n). Text sizes in sgc (intent ≤ a few KB) are trivially below any performance concern. No memoization.

### 5.6 Known unknown — Bun ICU version

Bun ships with a bundled ICU. CJK segmentation quality depends on the ICU version bundled (word dictionary coverage varies across releases). **Plan-stage action**: a 5-minute smoke test in G.1.b's execution plan — run `Intl.Segmenter` against 3-5 Chinese intent samples on the current Bun version, record outputs in the plan doc. If segmentation is unacceptably coarse, fall back to option B (CJK bigrams) as a scoped addendum. This is captured as a Known Limitation here, not a blocker.

### 5.7 Test strategy

**New file: `tests/dispatcher/dedup-unicode.test.ts`** (unit-level):

- NFC normalization: NFD + NFC inputs produce identical `computeSignature` output.
- CJK tokenization: `tokenize("修复空指针崩溃")` returns non-empty Set.
- CJK Jaccard identity: `jaccard(t, t) === 1` for CJK input.
- CJK Jaccard overlap: two related Chinese intents produce `jaccard > 0`.
- English backwards-compat: `tokenize("refactor the auth middleware")` matches pre-G.1.b golden.
- Mixed CN/EN: both scripts produce tokens.

**Existing file: `tests/eval/dedup.test.ts`** (add e2e scenario):

- "dedup match — 中文 intent 相同文本 → `update_existing`": two `runPlan` calls with identical Chinese motivation produce exactly one solution entry with merged `source_task_ids`.

### 5.8 Error handling

`Intl.Segmenter` is native and does not throw at runtime. `text.normalize()` only throws on invalid UTF-16 (lone surrogates), which is not produced by normal code. No additional try/catch (YAGNI).

---

## 6. G.2.a — planner.eng LLM swap

### 6.1 Current state

`src/dispatcher/agents/planner-eng.ts:plannerEng()` checks `input.intent_draft.length < 20`, returns one stock "approve" + a throwaway concern if short. `structural_risks: []` always. Zero value beyond length gating.

### 6.2 Post-swap behavior

LLM version: given `intent_draft` + `repo_map`, produce substantive `structural_risks` — which modules get touched, where test coverage is thin, which contracts are implicated, which parallel paths need matching edits (§9 parallel-path completeness).

### 6.3 Contract extension — `repo_map`

`PlannerEngInput.repo_map` changes from "declared but unused" to "actively consumed by prompt".

**Generation strategy (chosen: α, pre-generate into decisions)**:

New file `src/dispatcher/repo-map.ts` exports:

```typescript
export function generateRepoMap(stateRoot: string, taskId: string): string
```

Generation algorithm:
1. `git ls-files` from repo root.
2. Group by directory, depth 2 (root + one nested level). Deeper paths collapse to count.
3. For each directory, list first 10 files by name.
4. Include repo root README.md first paragraph if present (≤ 5 lines).
5. Target output ≤ 2 KB.

**Format (stable; future agents may reuse)**:

```
# repo map (HEAD)
total files: 127

src/
  sgc.ts
  commands/  (8 files)
    plan.ts, work.ts, review.ts, qa.ts, ship.ts, compound.ts, agent-loop.ts, discover.ts
  dispatcher/  (15 files)
    spawn.ts, state.ts, types.ts, schema.ts, validation.ts, ...

tests/
  dispatcher/  (28 files)
  eval/  (6 files)

prompts/
  classifier-level.md
  reviewer-correctness.md
  planner-eng.md
  compound-context.md

contracts/
  sgc-capabilities.yaml
```

**Storage**: `.sgc/decisions/{taskId}/repo-map.txt`. Written by `runPlan` before invoking `planner.eng`. Snapshot is stable across multiple planner calls within one task.

**Consumption**: `runPlan` reads the file (or passes content) into `PlannerEngInput.repo_map`, which feeds `<input_yaml/>`.

### 6.4 Manifest change (`contracts/sgc-capabilities.yaml`)

Add under the `planner.eng` subagent entry:

```yaml
prompt_path: prompts/planner-eng.md
```

`resolveMode` already auto-selects LLM when `prompt_path` is set and API key exists; heuristic fallback engages when no key (or `SGC_FORCE_INLINE=1`).

### 6.5 Prompt template (`prompts/planner-eng.md`)

Structure mirrors `prompts/classifier-level.md`:

```markdown
# Purpose
Assess the intent_draft for structural risks before implementation begins.
Your job is NOT to write the plan — that's the user's job during /work.
Your job IS to flag risks the user should know before committing to this task.

## Scope
- Token scope: read:progress, read:decisions, read:code (via repo_map)
- Forbidden: read:solutions (planner-adjacent isolation — do not consult past answers)

## Your analysis
1. Identify likely code areas this intent would touch (use repo_map).
2. Flag structural risks in those areas:
   - Missing test coverage in module X that touches behavior Y
   - Cross-module coupling that makes the change wider than it appears
   - Schema / API contract implications not mentioned in intent
   - Parallel paths / fallbacks that would need matching updates
3. Return verdict:
   - `approve` — intent is well-scoped, risks are tractable
   - `revise` — intent is missing motivation/scope clarity
   - `reject` — intent is fundamentally off-target

## Reply format
  ```yaml
  verdict: approve | revise | reject
  concerns:
    - <concern 1, specific with file:line or module:area>
  structural_risks:
    - area: <module or subsystem>
      risk: <what could break or be missed>
      mitigation: <concrete action the user should take>
  ```

## Input
<input_yaml/>

## Submit
Write only the YAML above. No prose outside the YAML block.
```

### 6.6 Heuristic fallback

`src/dispatcher/agents/planner-eng.ts`:

- Rename current `plannerEng` → `plannerEngHeuristic`.
- `export const plannerEng = plannerEngHeuristic` for backwards-compat.
- `spawn.ts`'s `resolveMode` handles the LLM path automatically (manifest has `prompt_path` + API key present).

### 6.7 Tests

- `tests/dispatcher/planner-eng.test.ts` (expand): preserve existing heuristic-branch assertions (`SGC_FORCE_INLINE=1`).
- Add LLM-branch unit tests with mock `anthropicClientFactory` returning canned YAML → assert parsed output shape.
- Add schema-violation test: LLM returns `verdict: "invalid"` → `OutputShapeMismatch` thrown (Invariant §9 guards).
- `tests/dispatcher/repo-map.test.ts` (new): `generateRepoMap` output is deterministic for a fixture repo, ≤ 2 KB, structure matches golden.
- `tests/eval/planner-eng-llm.test.ts` (new, CI-skip / manual): real API key + fixture intent → `structural_risks` non-empty.

### 6.8 PR scope

```
G.2.a PR files:
  contracts/sgc-capabilities.yaml         (add planner.eng.prompt_path)
  prompts/planner-eng.md                  (new)
  src/dispatcher/agents/planner-eng.ts    (rename export, keep heuristic)
  src/dispatcher/repo-map.ts              (new)
  src/commands/plan.ts                    (call generateRepoMap, pass repo_map)
  tests/dispatcher/planner-eng.test.ts    (expand)
  tests/dispatcher/repo-map.test.ts       (new)
  tests/eval/planner-eng-llm.test.ts      (new, CI-skip)
```

---

## 7. G.2.b — compound.context LLM swap

### 7.1 Current state

`src/dispatcher/agents/compound.ts:compoundContext()` uses 7 regex patterns for category, 13 hardcoded tag candidates, and a 400-char slice for `problem_summary`. Regex misclassifies semantic nuance (e.g. "authorize the user to read docs" → `auth` category incorrectly).

### 7.2 Post-swap behavior

LLM version produces:

- **`category`** — semantically correct classification (one of `auth | data | infra | perf | ui | build | runtime | other`).
- **`tags`** — free-form lowercase strings (prompt constrains: ≤ 8 items, ≤ 20 chars each); LLM names tags semantically instead of filtering from a fixed list.
- **`problem_summary`** — 2-4 sentences distilling the problem essence (not a 400-char slice of intent).
- **`symptoms`** — actual symptoms extracted from diff + ship_outcome, not a placeholder.

### 7.3 Contract — unchanged

`CompoundContextInput` / `CompoundContextOutput` type shapes are identical pre- and post-swap. The `category` enum is still enforced at the type level (`SolutionCategory`). LLM output that fails the enum → `OutputShapeMismatch` (Invariant §9 guards; schema-violation test covers).

### 7.4 Manifest change

Add to `contracts/sgc-capabilities.yaml` under `compound.context`:

```yaml
prompt_path: prompts/compound-context.md
```

### 7.5 Prompt template (`prompts/compound-context.md`)

Structure mirrors `prompts/classifier-level.md`. Reply format:

```yaml
category: auth | data | infra | perf | ui | build | runtime | other
tags:
  - <lowercase tag 1>     # ≤ 8 items total
  # Each tag ≤ 20 chars, lowercase, no spaces (use hyphens/underscores)
problem_summary: |
  <2-4 sentences describing the problem essence, not a recap of intent>
symptoms:
  - <observable symptom 1>
  - <observable symptom 2>
```

### 7.6 Heuristic fallback

Same pattern as G.2.a: rename `compoundContext` → `compoundContextHeuristic`, alias for backwards-compat, resolveMode dispatches on `prompt_path` + API key. Compound runs on the ship path — API key missing or LLM timeout MUST NOT block ship.

### 7.7 Tests

- `tests/dispatcher/compound.test.ts` (expand): preserve heuristic-branch assertions.
- Add LLM-branch tests with mock client returning valid + invalid YAML.
- Assert: LLM returns `category: "malformed"` → `OutputShapeMismatch` (enum violation, Invariant §9).
- Assert: LLM returns 12 tags → **accepted as-is** (no truncation, no rejection). Prompt-only constraint for G.2.b; if drift becomes a real problem during G.3 E2E, revisit with a post-parse cap then.
- `tests/eval/compound-context-llm.test.ts` (new, CI-skip): real API key + fixture intent + diff → assert semantic category correctness on ambiguous inputs the regex currently mis-labels.

### 7.8 PR scope

```
G.2.b PR files:
  contracts/sgc-capabilities.yaml         (add compound.context.prompt_path)
  prompts/compound-context.md             (new)
  src/dispatcher/agents/compound.ts       (rename compoundContext export)
  tests/dispatcher/compound.test.ts       (expand)
  tests/eval/compound-context-llm.test.ts (new, CI-skip)
```

---

## 8. G.3 — E2E validation

### 8.1 Goal

With G.1 + G.2 merged, run the full sgc workflow under real LLM for `planner.eng` + `compound.context` (F already covered `classifier.level` + `reviewer.correctness`). Use `events.ndjson` for automated analysis — this is the capability F-1 lacked.

### 8.2 Scenarios

Four scenarios cover levels and languages:

| ID | Level | Lang | Intent |
|----|-------|------|--------|
| s1 | L1 | EN | fix typo in README.md plan section |
| s2 | L2 | EN | add rate limiting middleware to public API endpoints |
| s3 | L2 | 中文 | 给 dispatcher 的 spawn() 增加重试超时的结构化日志 |
| s4 | L3 | EN | migrate .sgc/state from YAML to SQLite |

**Expected outcomes (from specs)**:

- s1: `classifier=L1`, `planner=approve` (low risk), `compound.category ∈ {build, other}`.
- s2: `classifier=L2`, `planner` flags auth/API risks, `compound.category=auth`, tags include `api` / `rate-limit`.
- s3: Chinese intent classifies + planner + compound succeed end-to-end; dedup using new Unicode tokenize finds spawn-related prior solutions (if any exist). At minimum: Chinese intent does not crash or produce empty tokens.
- s4: `classifier=L3`, `planner` flags migration + schema + rollback risks, `compound.category=data`, `events.ndjson` captures the L3 upgrade path.

### 8.3 Deliverable: `docs/experiments/g3-e2e.md`

Mirrors F-1 format. Per-scenario record:

- Scenario ID + intent text.
- Observed event flow (exported subset of `events.ndjson`).
- Prompt quality issues encountered (wrong classification / missed risks / over-flagging).
- Prompt file diffs + rationale for each change.
- Re-run outcome after prompt iteration.

### 8.4 Analysis script: `scripts/g3-analyze-events.ts`

Reads `.sgc/progress/events.ndjson`; outputs:

- Spawn latency histogram (start→end delta, bucketed 0-1s / 1-5s / 5-30s / 30s+).
- LLM failure rate (`spawn.end.outcome != "success"` ratio).
- Verdict distribution (`classifier.level`, `planner.verdict`, `reviewer.verdict`).
- Prompt-length vs latency correlation (if `llm.request` events carry token counts).

Script itself is a G.3 deliverable — demonstrates events.ndjson has operational value.

### 8.5 Evidence gate (G.3 merge)

1. All 4 scenarios run at least once successfully (structured log complete; `spawn.start` + `spawn.end` paired for every spawn).
2. `scripts/g3-analyze-events.ts` output pasted into `docs/experiments/g3-e2e.md`.
3. At least one round of prompt iteration recorded (for either `planner.eng` or `compound.context`) — proves feedback loop is operational. If no iteration happened, experiment scope was insufficient.
4. Phase G cumulative test suite green (G.1 + G.2 + G.3 combined).
5. `EventRecord` schema unchanged since G.1.a merge (proves v1 is stable).

---

## 9. Phase-level evidence gates (each PR, recap)

Every Phase G PR meets these before merge:

- All existing tests (current baseline: 462) remain green.
- New unit tests added in the same PR pass.
- Heuristic-branch behavior (`SGC_FORCE_INLINE=1`) is byte-identical to pre-PR output (diff existing tests shows no change).
- LLM-branch: at least one manual run, output pasted in PR description following F-1 experiment log convention.
- PR description explicitly references the §-section of this spec being executed.

---

## 10. Deliverables summary

**Code** (3 new + 3 modified):

- `src/dispatcher/logger.ts` (new)
- `src/dispatcher/repo-map.ts` (new)
- `scripts/g3-analyze-events.ts` (new)
- `src/dispatcher/spawn.ts` (try/finally + event emission)
- `src/dispatcher/dedup.ts` (NFC + Intl.Segmenter)
- `src/dispatcher/agents/planner-eng.ts` + `compound.ts` (heuristic rename + LLM path via manifest)
- `src/commands/plan.ts` (invoke `generateRepoMap` before planner.eng)

**Prompts** (2 new):

- `prompts/planner-eng.md`
- `prompts/compound-context.md`

**Contracts** (1 modified):

- `contracts/sgc-capabilities.yaml` — add Invariant §13, add `prompt_path` for planner.eng + compound.context.

**Tests** (~10 new files, several expanded):

- `tests/dispatcher/logger.test.ts`
- `tests/dispatcher/dedup-unicode.test.ts`
- `tests/dispatcher/repo-map.test.ts`
- `tests/dispatcher/commands-event-emission.test.ts`
- `tests/eval/planner-eng-llm.test.ts` (CI-skip)
- `tests/eval/compound-context-llm.test.ts` (CI-skip)
- `tests/dispatcher/spawn.test.ts` (expand for §13)
- `tests/eval/invariants.test.ts` (expand for §13)
- `tests/dispatcher/planner-eng.test.ts` (expand for LLM branch)
- `tests/dispatcher/compound.test.ts` (expand for LLM branch)
- `tests/eval/dedup.test.ts` (expand for 中文 scenario)

**Docs** (2 new):

- `docs/superpowers/specs/2026-04-24-phase-g-design.md` (this doc)
- `docs/experiments/g3-e2e.md` (G.3 deliverable)

**Plans** (3, generated next via sp:writing-plans):

- `docs/superpowers/plans/2026-04-??-phase-g1.md`
- `docs/superpowers/plans/2026-04-??-phase-g2.md`
- `docs/superpowers/plans/2026-04-??-phase-g3.md`

---

## 11. Open questions / deferrals

None blocking spec approval. Items intentionally pushed to plans or later phases:

- Bun ICU segmentation quality for 中文 — smoke test in G.1.b plan, fallback to bigram if unacceptable (Known Limitation in §5.6).
- Whether prompt-only constraint on tag count/length holds — empirical, revisit during G.3 E2E if violations surface (§7.7).
- researcher.history RAG design — Phase H, separate spec.

---

## 12. Locked decisions (audit log of brainstorming)

Captured here so future readers can see what was considered and rejected:

- **Execution shape**: single Phase G vs split G.1/G.2/G.3 (+ shared spec) vs fully dynamic. Chose **split with shared spec**.
- **Log format**: double-channel (A) vs structured-primary (B) vs pure-NDJSON (C). Chose **A**.
- **Invariant scope**: full events-audit Invariant §13 vs no Invariant vs layered (spawn-only hard, others voluntary). Chose **layered**.
- **events.ndjson location**: single file vs per-task shard. Chose **single file** (append-only stable).
- **schema_version**: on every line (v1), additive forward-compat. Confirmed.
- **Unicode dedup**: minimal NFC-only (A) vs NFC+CJK bigram (B) vs Intl.Segmenter (C) vs C + stopwords (D). Chose **C**.
- **Locale strategy**: empty locale (ICU auto) vs fixed `zh-CN` vs multi-locale. Chose **empty**.
- **G.2 ordering**: compound first vs planner first vs parallel. Chose **planner first**.
- **researcher.history handling**: α (G.3 combined) vs β (Phase H) vs γ (defer indefinitely). Chose **β**.
- **Stopword expansion**: English-only vs extended 中文. Chose **English-only** (YAGNI).
- **compound tags**: free-form + prompt limit vs fixed whitelist. Chose **free-form + prompt limit**.
- **Logger API surface**: `say + event` vs add `debug/warn/error` sugar. Chose **`say + event` only**.
- **Command migration**: backwards-compat wrap vs force signature change. Chose **backwards-compat wrap**.
- **Per-command event-emission smoke test**: keep vs drop. Chose **keep**.
- **G.3 scenarios**: 4 (L1 EN, L2 EN, L2 中文, L3 EN) vs add L0 vs add adversarial. Chose **4**.
- **Invariant §13 landing**: G.1.a PR vs defer to after G.3 validation. Chose **G.1.a PR** (regulate before validating).
