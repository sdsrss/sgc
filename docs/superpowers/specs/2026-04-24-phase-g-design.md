<!-- /autoplan restore point: ~/.gstack/projects/sdsrss-sgc/main-autoplan-restore-20260424-135339.md -->
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

Revised after autoplan Phase 1 CEO review (2026-04-24). Original shape had G.1 = logs + Unicode dedup bundled; CEO voice correctly flagged Unicode as a 15-LOC author-blocking hotfix that shouldn't wait for spec negotiation. Also flagged `repo_map` as strategic dead-end and `sgc tail` missing as read-surface gap.

```
(PRE-PHASE-G)  Unicode dedup hotfix         — ship this week, standalone PR
─────────────────────────────────────────────────────────────────────────
Phase G
├── G.1 observability  (serial: G.1.a → G.1.b; 2 PRs)
│   ├── G.1.a  events.ndjson + Logger + Invariant §13
│   └── G.1.b  `sgc tail` read surface
├── G.2 LLM swap  (serial: G.2.a → G.2.b; 2 PRs)
│   ├── G.2.a  planner.eng LLM swap (NO repo_map — works from intent_draft alone)
│   └── G.2.b  compound.context LLM swap
└── G.3 E2E validation + dogfooding  (depends on G.1+G.2 merged; 1 PR)
─────────────────────────────────────────────────────────────────────────
(POST-PHASE-G, COMMITTED)  Phase H = researcher.history RAG
   Phase H brainstorm MUST start within 7 days of Phase G closing.
```

PR dependency:

```
(hotfix) Unicode dedup ─► merged (independent)

G.1.a (logs) ─► G.1.b (sgc tail) ─► G.2.a (planner.eng) ─► G.2.b (compound.context) ─► G.3 (E2E + dogfooding)
```

G.1 serialized (not parallel like original draft) because G.1.b `sgc tail` consumes the events.ndjson schema G.1.a introduces; writing tail without the writer merged invites drift.

### Out of scope (hard boundary)

- **Unicode dedup** is now a **separate hotfix PR** (pre-Phase-G). See Appendix A — it is not a Phase G deliverable.
- `researcher.history` LLM swap — deferred to **Phase H**, but Phase H is now a committed next-phase with a 7-day brainstorm trigger after Phase G closes. Not "eventual."
- Chinese stopword expansion (YAGNI — Jaccard is robust enough to noise).
- `events.ndjson` rotation / truncation / compression (deferred until `sgc janitor` actually needs it; `sgc tail` in G.1.b does NOT require rotation to be useful).
- Event schema v2 or backwards-incompatible evolution (this spec defines v1 + forward-compat rules only).
- Cross-spawn trace/span semantics (OpenTelemetry-style). Flat event stream for this phase.
- LLM cost aggregation / billing. Per-event `token_count` in payload is fine; no aggregation or dashboard.
- `planner.eng` tool-use loop (autonomous Read/Grep from inside the agent). If the no-repo_map version underperforms in G.2.a eval, this becomes its own design problem — not a Phase G scope expansion.
- All of modes B, C for logs (single-channel, pure-NDJSON stdout); CJK bigram tokenization (Intl.Segmenter is sufficient per hotfix).

---

## 3. Invariant §13 — spawn + LLM event audit completeness (layered, expanded)

Revised after CEO-3 finding: original §13 guaranteed only `spawn.start` / `spawn.end` — the cheap part. The events that would have let F-1 reconstruct failure chains without per-spawn YAML archaeology (`llm.request`, `llm.response`) were voluntary. Fixed here by expanding §13 to cover LLM-mode spawns.

Added to `contracts/sgc-capabilities.yaml`:

> **§13 Spawn + LLM event audit completeness** — Every call to `spawn()` MUST emit a paired `spawn.start` and `spawn.end` event to `.sgc/progress/events.ndjson`. The `end` event's `payload.outcome` MUST be one of `success | timeout | error`. Additionally, when the resolved mode is `anthropic-sdk` / `openrouter` / `claude-cli` (any LLM-backed mode), the agent MUST also emit a paired `llm.request` and `llm.response` event. The `llm.response.payload.outcome` MUST be one of `success | timeout | error | schema_violation`. Emission is guaranteed by try/finally in `spawn.ts` for the spawn pair, and by try/finally in the per-mode agent file (`anthropic-sdk-agent.ts`, `openrouter-agent.ts`, `claude-cli-agent.ts`) for the LLM pair. Other event types (`dedup.scored`, `review.verdict_emitted`, etc.) remain voluntary during Phase G; their schemas evolve freely.

**Layered design**:
- **Hard (Invariant §13)**:
  - Tier 1 — every spawn: `spawn.start` + `spawn.end` (all modes including inline/file-poll).
  - Tier 2 — every LLM-mode spawn: `llm.request` + `llm.response` (additional pair on top of Tier 1).
- **Soft (convention, no enforcement)**: every command emits at least one high-level event (`plan.classified`, `ship.gate_passed`, `compound.dedup_decided`, ...). Smoke-tested.

**Runtime enforcement points** (three try/finally guards):
1. `src/dispatcher/spawn.ts` → Tier 1 pair (see §4.3).
2. `src/dispatcher/anthropic-sdk-agent.ts:runAnthropicSdkAgent` → Tier 2 pair.
3. `src/dispatcher/openrouter-agent.ts:runOpenRouterAgent` → Tier 2 pair.
4. `src/dispatcher/claude-cli-agent.ts:runClaudeCliAgent` → Tier 2 pair.

**Exemption**: event-sink failure (disk full, permission error) does NOT fail the spawn. Logs to stderr and continues. Invariant §13 is waived for infra-level write failures (the stderr line is itself the audit trail).

**LLM event payload schema (v1)**:

```typescript
// llm.request
payload: {
  model: string                   // e.g. "claude-sonnet-4-6"
  prompt_chars: number            // post-render prompt size
  cached_prefix_chars?: number    // when cache_control active
  mode: "anthropic-sdk" | "openrouter" | "claude-cli"
}

// llm.response
payload: {
  outcome: "success" | "timeout" | "error" | "schema_violation"
  latency_ms: number
  input_tokens?: number           // provider-reported, when available
  output_tokens?: number          // provider-reported, when available
  cache_read_tokens?: number      // anthropic-sdk only
  cache_creation_tokens?: number  // anthropic-sdk only
  error_class?: string            // e.g. "OutputShapeMismatch", "429", "auth_failed"
}
```

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

## 5. G.1.b — `sgc tail` read surface

Rationale: CEO-5 flagged events.ndjson as write-only shelfware risk. `sgc tail` provides the operator-facing read surface. ~100 LOC.

Unicode dedup (previously §5) is MOVED to Appendix A — shipped as a separate hotfix PR before Phase G proper. See Appendix A for that technical spec.

### 5.1 Command signature

```
sgc tail [--task <id>] [--agent <name-glob>] [--event-type <pattern>] [--since <ts>] [--follow] [--json]
```

- `--task <id>`: filter by task_id.
- `--agent <name-glob>`: glob-match agent name (e.g., `planner.*`, `reviewer.correctness`).
- `--event-type <pattern>`: substring match (`spawn.*`, `llm.*`, `ship.`).
- `--since <ts>`: ISO-8601 timestamp; only events at/after this moment.
- `--follow`: tail -f behavior; block and print new events as they arrive. Polls `events.ndjson` every 500ms.
- `--json`: emit raw NDJSON (default is human-readable).

Multiple filters AND together.

### 5.2 Human-readable output format

One event per line, columns:

```
HH:MM:SS.mmm  level  event_type        spawn_id(last8)  agent         payload_brief
14:32:17.123  info   spawn.start       …7-planr-eng      planner.eng   mode=anthropic-sdk
14:32:17.140  info   llm.request       …7-planr-eng      planner.eng   model=claude-sonnet-4-6 chars=1842
14:32:19.384  info   llm.response      …7-planr-eng      planner.eng   success 2244ms in=412 out=318
14:32:19.395  info   spawn.end         …7-planr-eng      planner.eng   success 2272ms
```

`payload_brief` picks 2-3 high-signal fields per `event_type` (hardcoded mapping). Unknown event types print `…` and payload key count. `--json` bypasses all formatting.

### 5.3 Implementation

New file `src/commands/tail.ts`. Wired into `src/sgc.ts` citty command table as `tail`.

Reads `.sgc/progress/events.ndjson` line-by-line. In `--follow` mode: remember last-read byte offset, open file, seek, read to EOF, print, sleep 500ms, loop. Handle rotation (if file shrinks) by resetting offset to 0.

Filters applied post-parse (fast enough for Phase G traffic; rotation/compression is out-of-scope per §2).

### 5.4 Test strategy

**New file: `tests/dispatcher/tail.test.ts`** (unit-level):

- Empty events.ndjson → exits cleanly with no output.
- Single event → printed in default format with correct columns.
- Multiple filters AND correctly (`--task X --agent planner.*` returns intersection, not union).
- `--json` emits raw NDJSON unchanged.
- `--follow` in background picks up new appended lines within 1-2s.
- Malformed line → skip with stderr warning, continue.

### 5.5 What does NOT change

- `.sgc/progress/events.ndjson` schema — whatever G.1.a defined. `sgc tail` is a reader, not schema authority.
- No sub-agent spawn; no LLM path. Pure local-file processing.
- No rotation / truncation handling (out-of-scope).

---

## 6. G.2.a — planner.eng LLM swap

### 6.1 Current state

`src/dispatcher/agents/planner-eng.ts:plannerEng()` checks `input.intent_draft.length < 20`, returns one stock "approve" + a throwaway concern if short. `structural_risks: []` always. Zero value beyond length gating.

### 6.2 Post-swap behavior

LLM version: given `intent_draft` alone (no repo_map — see §6.3), produce substantive `structural_risks` flagging which *kinds* of modules a task like this typically touches, where test coverage thinness is common, what contract implications are unstated, and which parallel-path concerns to raise (§9 parallel-path completeness). The LLM reasons from intent text; concrete file-level claims require a follow-up retrieval step, deferred.

### 6.3 Contract — `repo_map` REMOVED (was: contract extension)

Original spec planned a pre-generated `git ls-files`-based `repo_map` written to `.sgc/decisions/{taskId}/repo-map.txt`. CEO-2 finding (2026-04-24 autoplan review) argued this is strategic dead-end:

1. Claude in `anthropic-sdk` / `openrouter` / `claude-cli` modes has tool access (Read, Grep) — a frozen 2KB filename snapshot is strictly worse than the LLM's own exploration.
2. Snapshot rots within the same task (files get modified during /work).
3. The "middle-ground" frozen file produces prompt bloat without useful signal.

**Resolution**: `PlannerEngInput.repo_map` field is **removed**. `planner.eng` runs on `intent_draft` alone, same shape as `classifier.level` and `reviewer.correctness`. If LLM eval in G.2.a's execution plan shows the no-context version underperforms (structural_risks are too generic, don't reference specific subsystems), the next step is NOT to revive frozen repo_map — it's to add a tool-use loop (agent autonomously Read/Grep as needed) as a follow-on phase. That's scoped out here.

**Contract**: `PlannerEngInput` is `{ intent_draft: string }`. Nothing else.

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
- Token scope: read:progress, read:decisions
- Forbidden: read:solutions (planner-adjacent isolation — do not consult past answers)

## Your analysis
1. Reason from intent_draft alone. You do NOT have a repo map. Do not invent specific file paths.
2. Flag structural risks in terms of module types / patterns:
   - Missing test coverage typical for changes of this shape (e.g., "a schema change like this usually lacks migration rollback tests")
   - Cross-module coupling hints (e.g., "auth + payment tasks usually touch ≥ 3 boundaries")
   - Schema / API contract implications not mentioned in intent
   - Parallel paths / fallbacks that would need matching updates (fallback arms, feature flags, SQL ORDER BY + LIMIT pairs)
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
- `tests/eval/planner-eng-llm.test.ts` (new, CI-skip / manual): real API key + 4 fixture intents (matching G.3 scenarios). **Assertion stronger than F-phase agents**: across the 4 scenarios, `structural_risks` must be non-empty in ≥ 3 scenarios AND at least 1 risk per scenario must reference a plausible module category (auth, migration, infra, test coverage, schema, etc. — not generic "could break things"). This is a rigor check — if it fails, planner.eng needs the tool-use upgrade out-of-scope here.

### 6.8 PR scope

```
G.2.a PR files:
  contracts/sgc-capabilities.yaml         (add planner.eng.prompt_path)
  prompts/planner-eng.md                  (new)
  src/dispatcher/agents/planner-eng.ts    (rename export; DROP repo_map from PlannerEngInput)
  src/commands/plan.ts                    (no change — repo_map no longer threaded through)
  tests/dispatcher/planner-eng.test.ts    (expand)
  tests/eval/planner-eng-llm.test.ts      (new, CI-skip)
```

**Diff vs original spec**: `src/dispatcher/repo-map.ts` NOT created. `tests/dispatcher/repo-map.test.ts` NOT created. `src/commands/plan.ts` change is a DELETE of the `generateRepoMap()` call that was planned but hadn't been added. PR is smaller (~6 files instead of 8).

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

1. All 4 scenarios run at least once successfully (structured log complete; `spawn.start` + `spawn.end` paired for every spawn; `llm.request` + `llm.response` paired for every LLM-mode spawn per Invariant §13 Tier 2).
2. `scripts/g3-analyze-events.ts` output pasted into `docs/experiments/g3-e2e.md`.
3. **Honesty, not iteration count** (rewritten per CEO-8): for each of the 4 scenarios, record `observed` vs `expected` verdicts. Three outcomes are all valid:
   - **First-try match (all 4)**: valid outcome. Log "4/4 first-try match — experiment scope may be insufficient; consider harder scenarios in a follow-up." No manufactured iteration required.
   - **Partial match (1-3 mismatches)**: natural prompt iteration — record each revision + rationale. This is the expected case.
   - **All mismatch**: escalate — prompts are not working; flag as Phase G blocker, not "one iteration logged."
4. Phase G cumulative test suite green (G.1 + G.2 + G.3 combined).
5. `EventRecord` schema unchanged since G.1.a merge (proves v1 is stable).
6. **Dogfooding** (new per CEO-4): between G.1.a merge and G.3 merge, ≥ 3 real code changes on the sgc repo itself went through full `sgc plan` → `sgc review` → `sgc ship` flow. Each change's `events.ndjson` extract pasted into `docs/experiments/g3-e2e.md` under "Dogfooding Evidence." **Softening clause**: if fewer than 3 organic code changes arise during Phase G's window, the Phase G sub-PRs themselves count (G.1.a, G.1.b, G.2.a, G.2.b) — provided each was actually shipped via `sgc ship` (not `git push` directly bypassing the tool). Gaming check: the Phase G sub-PRs don't count if they all shipped before G.3 started; the point is dogfooding *during* Phase G's lifetime, not retrofit.

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

**Pre-Phase-G hotfix** (separate, standalone PR — ships this week):

- `src/dispatcher/dedup.ts` (NFC + Intl.Segmenter)
- `tests/dispatcher/dedup-unicode.test.ts` (new)
- `tests/eval/dedup.test.ts` (expand for 中文 scenario)

See Appendix A for hotfix technical details.

**Phase G code** (3 new + 4 modified):

- `src/dispatcher/logger.ts` (new; G.1.a)
- `src/commands/tail.ts` (new; G.1.b)
- `scripts/g3-analyze-events.ts` (new; G.3)
- `src/dispatcher/spawn.ts` (try/finally + Tier-1 event emission; G.1.a)
- `src/dispatcher/anthropic-sdk-agent.ts` + `openrouter-agent.ts` + `claude-cli-agent.ts` (try/finally + Tier-2 `llm.request` / `llm.response` emission; G.1.a)
- `src/dispatcher/agents/planner-eng.ts` + `compound.ts` (heuristic rename + LLM path via manifest; G.2.a / G.2.b)
- `src/sgc.ts` (register `tail` command in citty table; G.1.b)

Note: `src/dispatcher/repo-map.ts` is **NOT** in the deliverable list (removed per CEO-2 finding).

**Prompts** (2 new):

- `prompts/planner-eng.md` (G.2.a; no repo_map)
- `prompts/compound-context.md` (G.2.b)

**Contracts** (1 modified):

- `contracts/sgc-capabilities.yaml` — add Invariant §13 (with Tier-2 LLM events), add `prompt_path` for planner.eng + compound.context.

**Tests** (~10 new files, several expanded):

- `tests/dispatcher/logger.test.ts` (new; G.1.a)
- `tests/dispatcher/tail.test.ts` (new; G.1.b)
- `tests/dispatcher/commands-event-emission.test.ts` (new; G.1.a)
- `tests/eval/planner-eng-llm.test.ts` (new, CI-skip; G.2.a)
- `tests/eval/compound-context-llm.test.ts` (new, CI-skip; G.2.b)
- `tests/dispatcher/spawn.test.ts` (expand for §13 Tier-1; G.1.a)
- `tests/dispatcher/anthropic-sdk-agent.test.ts` (expand for §13 Tier-2)
- `tests/dispatcher/openrouter-agent.test.ts` (expand for §13 Tier-2)
- `tests/dispatcher/claude-cli-agent.test.ts` (expand for §13 Tier-2)
- `tests/eval/invariants.test.ts` (expand for §13 both tiers)
- `tests/dispatcher/planner-eng.test.ts` (expand for LLM branch)
- `tests/dispatcher/compound.test.ts` (expand for LLM branch)

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

- Bun ICU segmentation quality for 中文 — smoke test in the **Unicode hotfix plan** (Appendix A), fallback to bigram if unacceptable.
- Whether prompt-only constraint on tag count/length holds — empirical, revisit during G.3 E2E if violations surface (§7.7).
- Whether `planner.eng` without repo_map produces sufficiently specific `structural_risks` — decided empirically by G.2.a's eval harness (§6.7). If it fails the ≥3/4 non-generic threshold, the follow-up is a tool-use loop design, NOT a revival of frozen repo_map.
- **Phase H (researcher.history RAG)** — brainstorm MUST start within 7 days of Phase G G.3 merge. Design issues to resolve in Phase H brainstorm: how to pass N solutions into prompt without breaking anthropic-sdk cache_control prefix; whether to use embeddings + top-K or LLM-based re-ranking; how to handle solutions/ being empty.

---

## 12. Locked decisions (audit log of brainstorming)

Captured here so future readers can see what was considered and rejected, and WHY.

**Original decisions (from brainstorming 2026-04-24)**:

- **Execution shape**: single Phase G vs split G.1/G.2/G.3 vs fully dynamic. Chose **split with shared spec** — F-1 E2E showed "finish feature + no observability" makes debugging expensive; splitting lets infra land first so G.2 debugs cleanly.
- **Log format**: double-channel (A) vs structured-primary (B) vs pure-NDJSON (C). Chose **A** — zero-break CLI UX, minimum 9-command migration friction; event stream is independent of human prose.
- **Invariant scope (original)**: full events-audit vs no Invariant vs layered (spawn-only hard). Chose **layered** — see REVISED below; this was the wrong layer per CEO-3.
- **events.ndjson location**: single file vs per-task shard. Chose **single file** — append-only POSIX-atomic semantics; `jq '.task_id == X'` is trivial; avoids "where does pre-task event go?" awkwardness.
- **schema_version**: on every line (v1), additive forward-compat. Confirmed — cost near-zero, breakage cost huge.
- **Unicode dedup technical path**: minimal NFC (A) vs NFC+CJK bigram (B) vs Intl.Segmenter (C) vs C + stopwords (D). Chose **C** — native API, zero new dep, handles CJK/Thai/Arabic via ICU; bigrams are 20-year-old trick but ICU standard is cleaner.
- **Locale strategy**: empty locale (ICU auto) vs fixed `zh-CN` vs multi-locale. Chose **empty** — simplest config, ICU picks correctly based on input for mixed EN/中文 corpus.
- **G.2 ordering**: compound first vs planner first vs parallel. Chose **planner first** — planner.eng is currently the emptiest stub (highest value), and landing planner first stress-tests structured logs on the highest-frequency agent.
- **Stopword expansion**: English-only vs extended 中文. Chose **English-only (YAGNI)** — Jaccard is robust to stopword noise; extending STOPWORDS is taste work with no clear win on short intent text.
- **compound tags**: free-form + prompt limit vs fixed whitelist. Chose **free-form** — whitelist (13 candidates) was too restrictive; LLM semantic judgment beats static list. Prompt hints cap (≤8 items, ≤20 chars) to prevent runaway.
- **Logger API surface**: `say + event` vs add `debug/warn/error` sugar. Chose **`say + event` only** — level is a field, not a method; minimal API surface reduces maintenance.
- **Command migration**: backwards-compat wrap vs force signature change. Chose **backwards-compat wrap** — 9 commands use `opts.log`; forcing signature change = 9 PR-unrelated diffs; wrapping preserves zero-break.
- **Per-command event-emission smoke test**: keep vs drop. Chose **keep** — soft contract; without a smoke test, commands silently stop emitting over time.
- **G.3 scenarios**: 4 (L1 EN, L2 EN, L2 中文, L3 EN) vs add L0 vs add adversarial. Chose **4** — L0 already validated in F-1; adversarial intent is planner.adversarial's job (out of scope here).
- **Invariant §13 landing (original)**: G.1.a PR vs defer. Chose **G.1.a PR** — "regulate before validating"; enforcement via try/finally is cheap to land in the same PR.

**Revised decisions (after autoplan Phase 1 CEO review, 2026-04-24)**:

- **Invariant §13 scope (REVISED)**: original layered design (spawn-only hard, other events voluntary) regulated the cheap guarantee. Changed to **two-tier hard**: Tier 1 (spawn.start/end for all modes) + Tier 2 (llm.request/llm.response for LLM modes). Tier 2 is the telemetry F-1 actually needed. See §3.
- **Unicode dedup (REVISED)**: from "G.1.b sub-PR" to **separate pre-Phase-G hotfix**. Reason: 15 LOC author-blocking correctness fix should not wait for spec negotiation. See Appendix A.
- **repo_map (REVISED)**: from "pre-generate via git ls-files into `.sgc/decisions/{id}/repo-map.txt`" to **removed entirely**. Reason: frozen filename snapshot is strictly worse than LLM's own Read/Grep in anthropic-sdk/openrouter modes; rots within same task. If quality insufficient, tool-use loop is the next step (out of this phase's scope). See §6.3.
- **G.1.b (REVISED)**: from "Unicode dedup" to **`sgc tail` read surface**. Reason: events.ndjson without read tooling is shelfware; `sgc tail` is ~100 LOC, operator-facing, completes the write/read loop. See §5.
- **G.3 evidence gate #3 (REVISED)**: from "≥1 prompt iteration" to **"honesty recording (observed vs expected); first-try match is a valid outcome, don't manufacture iteration"**. Reason: counting iterations encourages ritual over signal per Iron Law #2.
- **G.3 evidence gate +1 (NEW)**: **dogfooding** — ≥3 real sgc-on-sgc ships during Phase G window, with softening clause. Reason: F-1 was empty-feature smoke test; real compounding only materializes if we use sgc for sgc.
- **Phase H commitment (NEW)**: from "deferred to Phase H, separate spec" to **"Phase H brainstorm must start within 7 days of Phase G closing"**. Reason: CEO flagged "无期限延期" ambiguity; explicit time commitment removes indefinite-deferral risk. researcher.history is the POSITIONING.md thesis; not shipping it leaves "knowledge engine" claim empty.
- **§13 section (NEW)**: "Delegate boundary — what sgc owns vs sp/gs" — see new §13 below. Reason: CEO-7 flagged absent competitive framing; planner.eng purpose needs to be crisp against sp:brainstorming.

---

## 13. Delegate boundary — what sgc owns vs sp / gs

Per POSITIONING.md, sgc is a **规范层 + 知识引擎** that coexists with `superpowers (sp)` and `gstack (gs)`. Phase G's LLM agents must stay within sgc's boundary and not duplicate capability that sp/gs already provide.

**sp:brainstorming vs planner.eng** (the closest overlap):

- **sp:brainstorming** — interactive, pre-spec. Produces a design doc. User is in the loop answering multiple-choice questions. Output is a specification.
- **planner.eng** — non-interactive, post-spec, pre-implementation. Input is already-decided `intent_draft`. Output is `structural_risks` — a *risk checklist* the user reviews in `sgc plan` output. Used for fast sanity-check, not design exploration.

They are **not substitutes**. If planner.eng's output looks like "here are 5 design alternatives to consider," it has drifted into brainstorming territory and should be tightened. The prompt in `prompts/planner-eng.md` explicitly tells the agent: "Your job is NOT to write the plan — that's the user's job during /work. Your job IS to flag risks..."

**gs review skills vs reviewer.correctness** (adjacent, Phase F already shipped):

- **gs:review** — interactive, diff-scoped, analyzes PR/branch structural issues (SQL safety, LLM trust boundaries, side effects).
- **reviewer.correctness** — non-interactive, automated in `sgc review`, scans diff for markers (TODO/FIXME) + LLM-based semantic analysis when prompt_path is set. Runs on every `sgc review` invocation, not user-triggered.

These overlap more than brainstorming/planner.eng. Explicit boundary: reviewer.correctness is a pre-merge gate running automatically; gs:review is a user-invoked deeper review. Parallel ok.

**Capabilities sgc will NEVER claim (delegated to sp/gs)**:

- Interactive brainstorming / design exploration → `sp:brainstorming` (primary), `sp:writing-plans` (execution plan), `sp:office-hours` (earliest idea stage).
- Live site QA, browser testing → `gs:browse`, `gs:qa`.
- Ship pipeline (PR creation, deploy verification) → `gs:ship`, `gs:land-and-deploy`.
- Performance/security/design audits → `gs:benchmark`, `gs:cso`, `gs:design-review`.
- Post-deploy monitoring → `gs:canary`.

sgc's CLI commands (`sgc plan / work / review / qa / ship / compound / discover`) are automation thin-wrappers that route into the sp/gs ecosystem for the heavy lifting, AND maintain sgc's invariants (spawn scope tokens, compound dedup, event audit). Phase G reinforces this boundary — structured logs track sgc-dispatched spawns, but the actual agent-intelligence decisions remain in the hands of whichever LLM/skill the manifest dispatches to.

---

## Appendix A — Unicode dedup hotfix (pre-Phase-G, standalone PR)

Not a Phase G deliverable. Ship this week, independent commit on main, own PR.

### A.1 Scope

Fix two bugs in `src/dispatcher/dedup.ts`:

1. **`normalizeText` misses NFC**: `café` (NFD: `e` + U+0301 combining accent) and `café` (NFC: U+00E9 precomposed) currently produce divergent SHA-256 signatures. Same visible text → different dedup identity. Breaks dedup for any pasted/OS-dependent input.
2. **`tokenize` zeros out non-ASCII**: current `split(/[^a-z0-9]+/)` strips all CJK / accented characters. Chinese `motivation` text returns empty token set → Jaccard over `problem_tokens` is 0 → dedup falls back to tags alone → effectively random for Chinese workflow.

### A.2 Fix (~15 LOC)

```typescript
// normalizeText — add NFC
export function normalizeText(text: string): string {
  return text.normalize("NFC").toLowerCase().trim().replace(/\s+/g, " ")
}

// tokenize — replace split with Intl.Segmenter
const SEGMENTER = new Intl.Segmenter([], { granularity: "word" })

export function tokenize(text: string): Set<string> {
  const normalized = text.normalize("NFC").toLowerCase()
  const tokens = new Set<string>()
  for (const seg of SEGMENTER.segment(normalized)) {
    if (!seg.isWordLike) continue
    const w = seg.segment
    if (w.length <= 2) continue
    if (STOPWORDS.has(w)) continue
    tokens.add(w)
  }
  return tokens
}
```

Empty-locale `Intl.Segmenter` lets ICU auto-select based on input — handles EN + CJK + Thai + Arabic. No new dep; Bun has ICU built in.

### A.3 What does NOT change

- `DEDUP_THRESHOLD = 0.85` (Invariant §3).
- `STOPWORDS` English-only (YAGNI for Chinese expansion).
- `similarity()`, `findBestMatch()`, `isDuplicate()`, `computeSignature()` signatures unchanged.
- All callers (`compoundRelated`, `compoundContext`) zero-diff.

### A.4 Behavior changes

- NFC normalization: NFD + NFC inputs produce identical signatures.
- CJK tokenization: `修复空指针崩溃` returns non-empty Set (ICU segments into meaningful units; exact output depends on Bun's ICU version).
- English backwards compat: `refactor the auth middleware` → `{refactor, auth, middleware}` identical to pre-hotfix behavior.

### A.5 Known unknown — Bun ICU version

CJK segmentation quality depends on Bun's bundled ICU version (word dictionary coverage varies across ICU releases). Plan step: 5-minute smoke test on current Bun version against 3-5 Chinese intent samples, record in PR description. If unacceptably coarse, fallback is CJK bigram splitting (~30 LOC addendum to tokenize). Capture as known limitation, not blocker.

### A.6 Tests

New file `tests/dispatcher/dedup-unicode.test.ts`:

- NFC normalization: NFD + NFC inputs produce identical `computeSignature` output.
- CJK tokenization: `tokenize("修复空指针崩溃")` returns non-empty Set.
- CJK Jaccard identity: `jaccard(t, t) === 1` for CJK input.
- CJK Jaccard overlap: two related Chinese intents produce `jaccard > 0`.
- English backwards-compat: `tokenize("refactor the auth middleware")` matches pre-hotfix golden.
- Mixed CN/EN: both scripts produce tokens.

Existing `tests/eval/dedup.test.ts` (expand):

- "dedup match — 中文 intent 相同文本 → `update_existing`": two `runPlan` calls with identical Chinese motivation produce exactly one solution entry with merged `source_task_ids`.

### A.7 PR criteria

- All 462 existing tests still pass.
- New tests pass.
- Bun ICU smoke-test output pasted into PR description.
- English-path Jaccard golden test shows byte-identical behavior.

---

## GSTACK REVIEW REPORT

### Phase 1 — CEO Review (autoplan v1.10.1.0, single-voice mode; Codex unavailable)

**CEO DUAL VOICES — CONSENSUS TABLE:**

| Dimension | Claude primary | Claude subagent | Consensus |
|---|---|---|---|
| 1. Premises valid? | WEAK | WEAK | WEAK (both agree premises assumed, not argued) |
| 2. Right problem to solve? | WEAK | DISAGREE | DISAGREE (researcher.history deferral = product thesis hole) |
| 3. Scope calibration correct? | WEAK | DISAGREE | DISAGREE (Unicode hotfix ≠ infra bundle; three unrelated workstreams) |
| 4. Alternatives explored? | WEAK | WEAK | WEAK (§12 one-word rejections; no sp:brainstorming comparison) |
| 5. Competitive/market risks? | WEAK | DISAGREE | DISAGREE (no sp/gs overlap analysis; zero dogfooding evidence) |
| 6. 6-month trajectory? | WEAK | WEAK | WEAK (events.ndjson likely unread; researcher still unshipped) |

**Source: [subagent-only] — Codex unavailable (no auth).**

**Findings (8 total, severity-ranked):**

| # | Title | Severity |
|---|---|---|
| CEO-1 | LLM-everywhere bundles two unrelated goals (planner vs compound) | high |
| CEO-2 | repo_map via git ls-files is strategic dead-end (frozen snapshot rots) | high |
| CEO-3 | Invariant §13 regulates cheap thing, leaves valuable telemetry voluntary | medium |
| CEO-4 | Dogfooding gap — F-1 was empty feature test, no real sgc-on-sgc usage | medium |
| CEO-5 | events.ndjson has no read surface; shelfware risk in 6 months | medium |
| CEO-6 | §12 locked decisions list rejections without rationale | medium |
| CEO-7 | Competitive overlap with sp:brainstorming / gs skills unexamined | low |
| CEO-8 | G.3 evidence gate #3 ("≥1 iteration") creates ritual, not honesty | low |

**User Challenges (both voices would change user-stated direction):**

- **UC-1 — Bring researcher.history forward**: User chose β (defer to Phase H); both voices say RAG IS the sgc thesis per POSITIONING.md. Phase G without researcher.history leaves "knowledge engine" unproven.
- **UC-2 — Replace frozen repo_map**: User chose α (pre-generate `.sgc/decisions/{id}/repo-map.txt`); both voices say Claude has Read/Grep tools in LLM mode, frozen 2KB filename list rots within same task. Options: (a) let planner.eng work from intent alone, (b) add retrieval loop, (c) drop repo_map entirely.
- **UC-3 — Ship Unicode dedup as hotfix, not as G.1.b**: User chose "G.1 = logs + dedup bundle"; both voices say Unicode is 15 LOC, primary-author-blocking, should ship this week regardless of spec negotiation.

**Mandatory outputs below:**
