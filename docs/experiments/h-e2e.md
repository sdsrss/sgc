# Phase H E2E + Dogfooding Evidence

**Spec**: `docs/superpowers/specs/2026-04-28-phase-h-design.md` (r3)
**Plan**: `docs/superpowers/plans/2026-04-28-phase-h.md`
**Window opened**: 2026-04-28
**Window deadline**: 2026-05-04

**Run env**: `OPENROUTER_API_KEY` set; `tests/eval/researcher-history-llm.test.ts`
routes through `prompt_path: prompts/researcher-history.md` via OpenRouter
(default model per `contracts/sgc-capabilities.yaml`). Bun v1.3.5 on Linux x64.

---

## Track 1 — Eval scenarios (e1-e4)

**Baseline run** (2026-04-29, head `b5a10b4`): `bun test tests/eval/researcher-history-llm.test.ts`
→ 4 pass / 0 fail / 30 expects / 12.93s wall. No banned-vocab matches; all
shape + score-floor + word-count assertions clean on first run, no fixture
or regex tuning required.

Per-scenario captures via `.tmp/capture-h-eval.ts` (one-shot script that
reuses `preFilterSolutions` + `spawn` + `coerceLlmOutput`; persists state
root long enough to read `progress/events.ndjson`, then disposes).

### e1 — L2 EN: rate limiting middleware

**Intent**: `add rate limiting middleware to public API endpoints`

**Pre-filter candidates** (5):
- `runtime/api-throttle-leaky-bucket-2026-04-19`
- `auth/api-key-rotation-2026-04-15`
- `auth/oauth-token-refresh-2026-04-12`
- `runtime/spawn-timeout-retry-2026-04-13`
- `data/sqlite-migration-from-yaml-2026-04-18`

**LLM rerank output**:
```yaml
prior_art:
  - source: solutions
    solution_ref: runtime/api-throttle-leaky-bucket-2026-04-19
    relevance_score: 0.9
    relevance_reason: implements rate limiting via leaky-bucket for API protection with token deduction and fast-fail behavior
  - source: solutions
    solution_ref: auth/api-key-rotation-2026-04-15
    relevance_score: 0.4
    relevance_reason: handles concurrent request handling during API key changes, relevant for rate limiting state consistency
```

**Latency**: 3968ms (LLM round-trip) / 3978ms (total incl pre-filter + coerce)
**Tokens**: input 1639, output 133
**Outcome**: pass — `api-throttle-leaky-bucket` picked at 0.9 (top); secondary `api-key-rotation` at 0.4 (borderline-but-justified, clears 0.3 floor)

### e2 — L3 EN: SQLite migration

**Intent**: `migrate .sgc/state from YAML to SQLite`

**Pre-filter candidates** (2):
- `data/sqlite-migration-from-yaml-2026-04-18`
- `runtime/api-throttle-leaky-bucket-2026-04-19`

**LLM rerank output**:
```yaml
prior_art:
  - source: solutions
    solution_ref: data/sqlite-migration-from-yaml-2026-04-18
    relevance_score: 1.0
    relevance_reason: Direct template for YAML-to-SQLite migration including schema design, rollback strategy, and malformed data handling.
```

**Latency**: 3051ms / 3055ms total
**Tokens**: input 1108, output 82
**Outcome**: pass — clean 1-of-2 selection; LLM correctly rejected `api-throttle-leaky-bucket` despite shared `runtime/` cluster keywords from pre-filter

### e3 — L2 中文: 重试超时日志

**Intent**: `给 dispatcher 的 spawn() 增加重试超时的结构化日志`

**Pre-filter candidates** (2):
- `runtime/spawn-timeout-retry-2026-04-13`
- `runtime/api-throttle-leaky-bucket-2026-04-19`

**LLM rerank output**:
```yaml
prior_art:
  - source: solutions
    solution_ref: runtime/spawn-timeout-retry-2026-04-13
    relevance_score: 0.9
    relevance_reason: Direct match - implements retry-with-backoff for spawn() timeouts with structured logging patterns.
```

**Latency**: 3090ms / 3097ms total
**Tokens**: input 1119, output 75
**Outcome**: pass — CJK intent flowed end-to-end; `Intl.Segmenter` word-count cap (≤30) enforced on EN reason text without false positives

### e4 — L2 EN: rename CLI flag (rigor distractor)

**Intent**: `rename a CLI flag from --foo to --bar`

**Pre-filter candidates** (2):
- `infra/proxy-env-bun-vs-npm-2026-04-10`
- `auth/oauth-token-refresh-2026-04-12`

**LLM rerank output**:
```yaml
prior_art: []
```

**Latency**: 1873ms / 1878ms total
**Tokens**: input 1116, output 32
**Outcome**: pass — LLM correctly rejected both pre-filter candidates as
non-transferable (lowest output_tokens of the four scenarios — 32 — confirms
short-circuit on empty result; ~2× faster than non-empty cases)

---

## Track 2 — Dogfooding ships

### DF-1 — F-5 `sgc review --append-as <suffix>`

**Branch**: `phase-h.1/df-1-review-append-as`
**Date**: 2026-04-29
**Intent driven through `sgc plan`**: `add --append-as suffix flag to sgc review enabling follow-up reviewer reports on the same task without violating append-only Invariant 6`

**Pre-run setup**: `.sgc/solutions/runtime/` seeded with two real-history
entries derived from project commits:
- `runtime/review-strip-prior-art-back-channel-2026-04-29.md` (commit `ef972d8`)
- `runtime/review-specialist-fanout-append-only-2026-04-26.md` (G.1.b pattern)

**`sgc plan` outcome**:
- task_id: `7774FF61DA2D415AB74E6ACC54`
- classifier: L2 (CLI flag + arg parsing + review logic + invariant validation)
- planner.eng: approve · planner.ceo: approve
- researcher.history: 1 prior art entry (specialist-fanout @ 0.9, back-channel-strip rejected) — defensible: the fanout entry maps directly to the `--append-as` extension surface, while the back-channel-strip entry is about a *different* invariant boundary

**`sgc plan` events.ndjson extract** (researcher.history dispatch only,
4-event sequence per Invariant §13 Tier 1+2):

```json
{"schema_version":1,"ts":"2026-04-29T07:11:37.231Z","task_id":"7774FF61DA2D415AB74E6ACC54","spawn_id":"3A0E858D0F6C4FA49BE3975990-researcher.history","agent":"researcher.history","event_type":"spawn.start","level":"info","payload":{"mode":"openrouter","manifest_version":"0.2"}}
{"schema_version":1,"ts":"2026-04-29T07:11:37.231Z","task_id":"7774FF61DA2D415AB74E6ACC54","spawn_id":"3A0E858D0F6C4FA49BE3975990-researcher.history","agent":"researcher.history","event_type":"llm.request","level":"info","payload":{"model":"anthropic/claude-sonnet-4","prompt_chars":4011,"cached_prefix_chars":2396,"mode":"openrouter"}}
{"schema_version":1,"ts":"2026-04-29T07:11:40.442Z","task_id":"7774FF61DA2D415AB74E6ACC54","spawn_id":"3A0E858D0F6C4FA49BE3975990-researcher.history","agent":"researcher.history","event_type":"llm.response","level":"info","payload":{"outcome":"success","latency_ms":3210,"input_tokens":1136,"output_tokens":80}}
{"schema_version":1,"ts":"2026-04-29T07:11:40.444Z","task_id":"7774FF61DA2D415AB74E6ACC54","spawn_id":"3A0E858D0F6C4FA49BE3975990-researcher.history","agent":"researcher.history","event_type":"spawn.end","level":"info","payload":{"outcome":"success","elapsed_ms":3213}}
```

**`intent.md` Prior-art section** (post-strip, plan-side):

```
## Prior art (researcher.history)

- **runtime/review-specialist-fanout-append-only-2026-04-26** (score 0.90):
  structure sgc review specialist fanout so each reviewer writes its own
  append-only report. `sgc review` dispatches to `reviewer.correctness`
  (always) plus optional specialist reviewers ...
  Reason: Shows exact append-only file structure for multi-reviewer
  reports that --append-as would extend.
```

**F-5 implementation**:
- `src/dispatcher/state.ts:reviewPath` — optional `suffix?: string` arg; file
  is `<reviewer>.<suffix>.md` when present
- `src/dispatcher/state.ts:appendReview` — optional 4th `suffix?: string`;
  validates against `^[a-zA-Z0-9][a-zA-Z0-9._-]{0,30}$` at the write
  boundary (path traversal / reserved chars / empty rejected)
- `src/commands/review.ts:ReviewOptions.appendAs` — passed through to both
  the correctness append and each specialist append
- `src/sgc.ts` — `--append-as` citty arg on the `review` subcommand
- 4 new unit tests in `tests/dispatcher/sgc-review.test.ts` covering
  golden-path coexistence, same-suffix collision, validation rejection,
  and no-suffix regression

**Post-impl validation**: `SGC_FORCE_INLINE=1 bun test tests/` →
**588 pass / 0 fail / 1481 expects / 142.35s** (was 584 baseline; +4 F-5
tests). `tests/dispatcher/sgc-review.test.ts` alone: 20 pass / 49 expects /
81ms.

**Spec gate #8 status**: ✓ — events.ndjson extract above shows researcher.history
dispatched in `mode: openrouter` against `model: anthropic/claude-sonnet-4`,
with `outcome: success` on both `llm.response` (3210ms) and `spawn.end`
(3213ms). Phase H Track 2 closure evidence captured.

---

## Findings

**Bottom-line** (Track 1, 2026-04-29): real-LLM `researcher.history` is
behaving inside the spec envelope on the fixture corpus. Zero fixture
re-tuning, zero regex re-tuning, zero coerce throws across e1-e4. The 0.3
floor was binding once (e1 secondary pick @ 0.4) and never violated.

**Aggregate stats** (4 scenarios):
- LLM latency: min 1873ms, max 3968ms, mean ~2996ms
- Input tokens: min 1108, max 1639, mean ~1246
- Output tokens: min 32, max 133, mean ~80 — **token_budget 1500 has ~10× headroom**
- Pre-filter cardinality: 2-5 per intent on 6-fixture corpus

**Borderline observation (e1 #2)**: `api-key-rotation @ 0.4` is a soft pick
— the `relevance_reason` ("relevant for rate limiting state consistency")
stretches the connection. Defensible at 0.4 but a tighter LLM pass (or
0.5 floor) would reject it. Logged for spec calibration; not a Phase H
blocker because the assertion contract only requires *one* ref to clear
`expectRefSubstring`, which the 0.9 primary pick does decisively.

**Empty-result short-circuit (e4)**: output_tokens=32 vs mean ~80
demonstrates the LLM correctly emits `prior_art: []` rather than
hallucinating filler — the rigor case the fixture was designed to catch.

**`.sgc/` gitignore tension (Track 2 surfaced)**: `.sgc/` is gitignored,
so `.sgc/solutions/` entries seeded for DF-1 are **local-only** — they
are not part of the F-5 PR and won't propagate to a fresh clone or to
teammates. `researcher.history` works as designed within a single
operator's workspace, but the "accumulated prior art across the team"
story relies on solutions/ living somewhere tracked. Logged as a Phase
H.1 design question; possible resolutions: (a) move solutions/ to repo
root outside `.sgc/`; (b) un-ignore `.sgc/solutions/` specifically
while keeping `.sgc/{decisions,progress,reviews}` ignored;
(c) document the operator-local prior-art model and add a copy/sync
helper. Not a blocker for closing Phase H — the spec gate is
researcher.history dispatch evidence, which Track 2 captured.

---

## Spec calibration outcomes

- **Open Question #1** (Bun ICU CJK quality on e3): **answered — works**.
  `Intl.Segmenter` correctly tokenized the CJK intent during pre-filter
  match and the EN response during word-count cap. e3 passed shape +
  ref-substring + reason-substring + ≤30 word checks first try.
- **Open Question #2** (fixture wording iterations): **answered — zero**.
  All 4 fixtures generated correct LLM picks on the first eval run; no
  expectRefSubstring or fixture-text tuning was needed.
- **Open Question #4** (token_budget 1500 sufficiency): **answered —
  sufficient with ~10× headroom**. Max observed output_tokens = 133 (e1
  with 5 candidates → 2 picks). Even a worst-case 5-pick response fits
  in well under 500 tokens.
- **Open Question #5** (0.3 floor calibration): **observed scores: 0.9,
  0.4 (e1); 1.0 (e2); 0.9 (e3); n/a (e4)**. Floor never violated; one
  borderline pick at 0.4 (e1 secondary) suggests the floor is in the
  right zone — high enough to filter pre-filter false positives, low
  enough to surface defensible-but-soft transfer matches. Recommend
  keeping 0.3 through Phase H.1; revisit if dogfood shows operator
  noise complaints.
