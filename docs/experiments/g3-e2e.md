# Phase G.3 — E2E experiment log

**Date**: 2026-04-27
**Spec**: `docs/superpowers/specs/2026-04-24-phase-g-design.md` §8
**Stack at start**: head `647e53e` (G.2.b merged); Phase G test surface 533 unit + 8 CI-skip eval; LLM mode = OpenRouter (`anthropic/claude-sonnet-4`).

This experiment exercises the full `sgc plan` pipeline under real LLM for the four agents that were swapped during Phase G:

- `classifier.level` (Phase F)
- `reviewer.correctness` (Phase F)
- `planner.eng` (Phase G.2.a)
- `compound.context` (Phase G.2.b)

`sgc plan` covers `classifier.level` + `planner.{eng,ceo}` + `researcher.history` + (L3) `planner.adversarial`. `compound.context` evidence is in `tests/eval/compound-context-llm.test.ts` (run during G.2.b; output captured in commit `647e53e` PR description); not re-run here. `reviewer.correctness` is exercised end-to-end during Track 2 dogfooding.

---

## Track 1 — fixed scenarios (spec §8.2)

### s1 — L1 EN typo

| | |
|--|--|
| **Intent** | `fix typo in README.md plan section` |
| **Expected (spec §8.2)** | `classifier=L1`, `planner=approve` (low risk), `compound.category ∈ {build, other}` |
| **Observed** | `classifier=L0` (short-circuit before planners) |
| **Match** | partial — classifier returned L0 not L1 |
| **Events** | `docs/experiments/g3-data/s1-events.ndjson` (4 records: classifier spawn + LLM pair) |

**Classifier rationale (verbatim)**:

> This is a documentation typo fix with no code behavior change. README.md changes are purely informational and require no testing or validation beyond basic proofreading.

**Verdict drift**: spec said L1; LLM said L0. The L0 reasoning is internally consistent — the classifier prompt's L0 examples include "doc typo / formatting" and the L0 path correctly skips intent.md per `sgc-state.schema.yaml:31`. Per spec §8.5 evidence gate #3, this is a valid first-try outcome (the spec example was conservative, not authoritative); recording the drift rather than manufacturing a prompt iteration.

**Iteration**: none. Scope drift is in spec expectation, not in classifier output.

---

### s2 — L2 EN rate-limit middleware

| | |
|--|--|
| **Intent** | `add rate limiting middleware to public API endpoints` |
| **Expected (spec §8.2)** | `classifier=L2`, `planner` flags auth/API risks, `compound.category=auth`, tags include `api` / `rate-limit` |
| **Observed** | `classifier=L2` ✓, `planner.eng=revise` (4 specific concerns), `planner.ceo=approve`, `researcher.history=0 prior art` |
| **Match** | full match for the plan stage |
| **Events** | `docs/experiments/g3-data/s2-events.ndjson` (12 records: 4 spawns paired) |

**planner.eng concerns (verbatim)**:

- No specification of rate limit thresholds (requests per minute/hour)
- Missing definition of which endpoints qualify as "public API"
- No strategy for rate limit key generation (IP, user ID, API key)
- No handling strategy when limits are exceeded (block, queue, graceful degradation)

All four are concrete, none hit `BANNED_VOCAB_RE`, all reference real module-level concerns. G.2.a anti-pattern #1 ("no design alternatives") is respected — the LLM stays on risks, not solutions.

**Iteration**: none. First-try match.

---

### s3 — L2 中文 spawn structured logging

| | |
|--|--|
| **Intent** | `给 dispatcher 的 spawn() 增加重试超时的结构化日志` |
| **Expected (spec §8.2)** | classifier+planner+compound succeed end-to-end on Chinese intent; minimum gate: no crash + non-empty tokenization |
| **Observed (run 1)** | rejected by `plan.ts:300` — "motivation must be ≥20 words; got 19" |
| **Observed (run 2 with English motivation)** | `classifier=L1` (single-method log addition), `planner.eng=revise` BUT concerns rendered as `[object Object]` × 3 |
| **Match** | runs end-to-end (no crash, no empty tokens) but exposes two integration bugs |
| **Events** | `docs/experiments/g3-data/s3-events.ndjson` (8 records: classifier + planner.eng paired) |

**Findings**:

1. **CJK word-count rejection** — `src/commands/plan.ts:300` uses `motivation.trim().split(/\s+/).filter(Boolean).length` which collapses CJK runs to a single token. A 28-character Chinese motivation tokenizes to 19 "words" by ASCII-whitespace splitting. Pre-Phase-G Unicode hotfix (`src/dispatcher/dedup.ts`) already adopted `Intl.Segmenter` for the dedup tokenizer — `plan.ts:300` did not get the same treatment. **Tracked as dogfood candidate F-1 below.**

2. **planner.eng concerns rendered as `[object Object]`** — `src/commands/plan.ts:250` does `log(\`  concern: ${c}\`)` over `plannerEngOut.concerns`, declared as `string[]`. The LLM stochastically returns `concerns: [{...}, {...}, {...}]` (object array) for some intents — s2 returned strings, s3 returned objects, s4 returned strings. The G.2.a unit test U5b only validates the `verdict` enum; `validateOutputShape` does not assert each `concerns[]` element is a primitive string. **Tracked as dogfood candidate F-2 below.**

**Iteration**: workaround for run 2 (English motivation). No prompt edit yet — the bug fixes are deferred to Track 2 dogfooding so the fixes themselves dogfood the `sgc ship` pipeline.

---

### s4 — L3 EN SQLite migration

| | |
|--|--|
| **Intent** | `migrate .sgc/state from YAML to SQLite` |
| **Expected (spec §8.2)** | `classifier=L3`, `planner` flags migration + schema + rollback risks, `compound.category=data`, events.ndjson captures L3 upgrade |
| **Observed** | `classifier=L3` ✓, `planner.eng=revise` (3 string concerns), `planner.ceo=approve` (1 concern + 2 hints), `planner.adversarial=1 failure mode (medium/medium)`, L3 stdin confirmation gate fired |
| **Match** | full match |
| **Events** | `docs/experiments/g3-data/s4-events.ndjson` (14 records: 5 spawns paired; classifier + 4-way cluster including adversarial) |

**planner.eng concerns (verbatim)**:

- No motivation provided for why migration from YAML to SQLite is needed
- Missing scope definition - unclear which state components are included
- No success criteria specified for when migration is complete

**planner.adversarial failure mode (verbatim)**:

> [medium/medium] insufficient test coverage masks a behavioral change; the bug ships because the regression test did not fire

Concrete, names a mechanism, scoped to the change shape — passes G.2.a anti-pattern bar.

**Iteration**: none. First-try match. L3 stdin confirmation behaved correctly (`--auto` rejected per Invariant §4; `--signed-by` required; `printf "yes\n" | …` accepted).

---

## Track 1 — analyze-events output (spec §8.4)

```
$ bun run scripts/g3-analyze-events.ts \
    docs/experiments/g3-data/s1-events.ndjson \
    docs/experiments/g3-data/s2-events.ndjson \
    docs/experiments/g3-data/s3-events.ndjson \
    docs/experiments/g3-data/s4-events.ndjson

# G.3 events analysis — 38 events from 4 file(s)

## 1. Spawn-latency histogram (n=12)
  0-1s     5  ██████████████████████████████
  1-5s     4  ████████████████████████
  5-30s    3  ██████████████████
  30s+     0
  median=4593ms  mean=3219ms  max=7974ms

## 2. LLM failure rate
  total=7  failed=0  rate=0.0%

## 3. Per-agent spawn outcomes
  classifier.level             4/4 success
  planner.adversarial          1/1 success
  planner.ceo                  2/2 success
  planner.eng                  3/3 success
  researcher.history           2/2 success

## 4. Prompt-chars vs latency (n=7)
  mean_chars=2357  mean_latency_ms=5512  pearson_r=0.891
    chars= 1499  ms=3161
    chars= 1500  ms=4746
    chars= 1503  ms=4875
    chars= 1517  ms=4588
    chars= 3487  ms=6255
    chars= 3490  ms=6988
    chars= 3504  ms=7971
```

**Read of the data**:

- Pearson `r=0.891` confirms prompt size dominates round-trip latency at this scale (cluster runs roughly twice as long as classifier-alone calls because the L2/L3 prompts include `intent_draft` + classifier rationale).
- Zero LLM failures across 7 calls. spawn-side success 12/12. Invariant §13 Tier-1 + Tier-2 paired emission verified across 4 modes (L0 short-circuit / L1 single-eng / L2 cluster / L3 cluster + adversarial).
- Latencies are well below manifest `timeout_s` ceilings (`classifier.level` 30s, planners 120-180s); F-3 retry-with-backoff path was not exercised.

---

## Findings — bugs surfaced by Track 1

### F-1 — `plan.ts:300` motivation word-count is ASCII-whitespace-only

**Symptom**: Chinese `--motivation` of 28+ characters is rejected as < 20 words.
**Root cause**: `motivation.trim().split(/\s+/).filter(Boolean).length` collapses CJK runs to a single token. `Intl.Segmenter` is already adopted in `src/dispatcher/dedup.ts:tokenize` for exactly this reason; `plan.ts:300` is the second instance of the same problem.
**Fix shape**: replace `\s+` split with the same `Intl.Segmenter({}, { granularity: "word" })` pattern as `dedup.ts`. ~10 LOC. L1.
**Dogfood vehicle**: candidate ship #1 (Track 2 below).

### F-2 — planner.eng `concerns` rendered as `[object Object]`

**Symptom**: For some intents, `sgc plan` prints `concern: [object Object]` × N.
**Root cause**: `prompts/planner-eng.md` reply-format block shows `concerns: \n  - <concern 1, specific>` but does not explicitly say "each concern is a plain string". The LLM stochastically returns `concerns: [{area, risk, mitigation}, ...]` (matching the `structural_risks` shape) for short / ambiguous intents (observed in s3; not in s2/s4). `validateOutputShape` validates the `verdict` enum but does not assert each `concerns[]` element is a string.
**Fix shape**: (a) prompt-level — add explicit "concerns is an array of plain strings; structural objects only go in `structural_risks`" line in the reply-format section; (b) validation-level — extend `validateOutputShape` for `planner.eng` to assert `concerns[i] typeof === "string"` and throw `OutputShapeMismatch` on violation; (c) renderer-level — `plan.ts:219/250` should detect non-string and `JSON.stringify` rather than blind `${c}`. Combined ~30 LOC, L2 (touches manifest validation + renderer + prompt). Pick (a)+(b) for defense-in-depth; (c) is a band-aid that masks the real shape violation.
**Dogfood vehicle**: candidate ship #2 (Track 2 below).

### F-3 — verdict-vs-spec drift on s1 / s3

**Status**: not a bug; spec §8.2 examples are illustrative, classifier reasoning is sound.
**Action**: none beyond recording observed-vs-expected here per spec §8.5 #3.

---

## Track 2 — dogfooding (spec §8.5 #6)

**Softening clause status**: Phase G sub-PRs (G.1.a / G.1.b / G.2.a / G.2.b) all shipped via `git push` not `sgc ship`, so they do **not** count toward the ≥3 dogfood requirement. Track 2 must produce ≥3 fresh `sgc ship` runs during Phase G.3's window.

### Candidate ships (in priority order)

| # | Title | Level | Source | LOC est. |
|---|-------|-------|--------|----------|
| **DF-1** | Fix `plan.ts:300` CJK word-count via `Intl.Segmenter` | L1 | F-1 above | ~10 |
| **DF-2** | Fix `planner.eng` concerns shape (prompt + validation) | L2 | F-2 above | ~30 |
| **DF-3** | Add `--limit N` flag to `sgc tail` for capped historical view | L1 | brainstorm | ~15 |

DF-1 and DF-2 are findings from Track 1 — natural dogfood (the bug-fix work itself goes through `sgc plan` → `sgc work` → `sgc review` → `sgc ship`, which exercises `reviewer.correctness` and `compound.{context,solution,related,prevention}` end-to-end). DF-3 is an independent sgc-ergonomics gap surfaced during Track 1 (would have helped scrape the last N events of each `events.ndjson` without `tail -n` over the file).

**Dogfood plan**: execute DF-1 → DF-2 → DF-3 sequentially. Each ships via `sgc ship` (real `gh pr` not bypassed). Per-ship event extracts will be appended to this document under "Dogfooding Evidence" sections after each ship completes.

---

## Status snapshot

- **Track 1**: complete (4/4 scenarios run; analyze script written + self-checked; F-1 + F-2 + F-3 documented).
- **Track 2**: planned, not started.
- **Evidence gate (spec §8.5)**:
  - #1 — 4 scenarios run successfully ✓
  - #2 — analyze-events output pasted ✓
  - #3 — observed vs expected recorded honestly (s1 / s3 drift recorded, s2 / s4 first-try match) ✓
  - #4 — Phase G cumulative test suite green: 541 unit + 8 CI-skip eval at HEAD `647e53e` (verified during G.2.b ship) ✓
  - #5 — `EventRecord` schema unchanged since G.1.a merge: ✓ (spot-check of s1-s4 events.ndjson confirms `schema_version: 1` + same field set)
  - #6 — Dogfooding ≥3 real `sgc ship` runs: PENDING (Track 2 in flight)
