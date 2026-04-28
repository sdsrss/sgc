# Phase H E2E + Dogfooding Evidence

**Spec**: `docs/superpowers/specs/2026-04-28-phase-h-design.md` (r3)
**Plan**: `docs/superpowers/plans/2026-04-28-phase-h.md`
**Window opened**: 2026-04-28
**Window deadline**: 2026-05-04

---

## Track 1 — Eval scenarios (e1-e4)

### e1 — L2 EN: rate limiting middleware

**Intent**: `add rate limiting middleware to public API endpoints`

**Pre-filter candidates**: <fill in from `preFilterSolutions` output>

**LLM rerank output**:
```yaml
<paste prior_art YAML here>
```

**Latency**: <ms>
**Tokens**: input <N>, output <N>
**Outcome**: <pass / iterated prompt / failed>

### e2 — L3 EN: SQLite migration

(populate after eval run)

### e3 — L2 中文: 重试超时日志

(populate after eval run)

### e4 — L2 EN: rename CLI flag (rigor distractor)

(populate after eval run; expected `prior_art: []`)

---

## Track 2 — Dogfooding ships

### DF-1 (placeholder)

Pick from F-4 (`sgc ship --pr` auto-push) / F-5 (`sgc review --append-as`)
or freshly discovered ergonomics fix.

`sgc plan` events.ndjson extract:

```json
<paste relevant events here, especially llm.request / llm.response for researcher.history>
```

---

## Findings

(populate as window proceeds)

---

## Spec calibration outcomes

- Open Question #1 (Bun ICU CJK quality on e3): <answer>
- Open Question #2 (fixture wording): <iterations needed>
- Open Question #4 (token_budget 1500 sufficiency): <observed output_tokens>
- Open Question #5 (0.3 floor calibration): <distribution observed>
