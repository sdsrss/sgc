# E-Phase Demo: End-to-End L2 Walkthrough

Full `sgc` pipeline with real output:
`discover → plan → work → review → qa → ship → compound → status`.

Reproduced against the MVP inline-stub dispatcher (no API key required).
All output below was captured from a live run on 2026-04-16, tagged at
commit `9912b78` (discover implementation + contract).

## Setup

```bash
unset NODE_ENV                        # bun test propagates this; citty silences stdout if set
export SGC_STATE_ROOT=/tmp/sgc-e-demo
rm -rf $SGC_STATE_ROOT && mkdir -p $SGC_STATE_ROOT
```

## Step 1 — Discover

Start from a vague topic. `sgc discover` emits structured forcing-questions
and a ready-to-run `sgc plan` follow-up. No state writes beyond the spawn
audit trail.

```bash
$ bun src/sgc.ts discover "add per-user rate limit to the public API"
topic: add per-user rate limit to the public API

Goal:
  When "add per-user rate limit to the public API" is done, what can the user do that they can't do today?

Constraints:
  - Are there performance requirements (latency, throughput, data volume)?
  - What platforms / browsers / runtimes must this support?
  - Is there a deadline or release window this is blocking?

Scope:
  - What is explicitly OUT of scope — the closest adjacent feature we are NOT building?
  - Does this replace existing behavior, or add alongside it?
  - Is this a breaking change to any consumer, or purely additive (new endpoint / optional field / new status)?

Edge cases:
  - What happens if the input is empty, malformed, or enormous?
  - What happens under concurrent access — two users / tabs / requests at once?
  - What's the failure mode if a dependency (network, DB, third-party) is down?

Acceptance:
  - What test or observation proves this works — a specific command, URL, or log line?
  - What's the smallest user-visible change that would tell us it's done?
  - Is there a screenshot, curl invocation, or integration test that would serve as evidence?

Next:
  sgc plan "add per-user rate limit to the public API" --motivation "<your consolidated answers as one paragraph, ≥20 words>"
```

The keyword `API` triggered the "breaking vs additive" scope question and the "screenshot / curl / integration test" acceptance hint — a small keyword-tuned stub today; a real LLM via `SGC_AGENT_MODE=claude-cli` or `anthropic-sdk` picks up on much more.

## Step 2 — Plan (L2)

Consolidate the answers into a `--motivation` paragraph, hand back to `sgc plan`:

```bash
$ bun src/sgc.ts plan "add per-user rate limit to the public API" \
    --motivation "We need to protect the public API from abuse while preserving headroom for legitimate bursts; rate-limit per-user at 100 req/min rolling window returning 429 with rate-limit headers, and fail open if Redis is unavailable."

task_id = FBC97523F1BE4F96BA62DD4BF1
classifier verdict: L2 — request involves public API/auth/payment surface; minimum L2 per HARD escalation rule
planner.eng verdict: approve
planner.ceo verdict: approve
  ceo concern: intent is short; business context may not be clear to later reviewers
  ceo hint: expand the motivation to describe user impact and a success metric
researcher.history: 0 prior art entries, 1 warning(s)
  research warning: no relevant prior solutions found in .sgc/solutions/
wrote /tmp/sgc-e-demo/decisions/FBC97523F1BE4F96BA62DD4BF1/intent.md

Plan complete. Run `sgc work` to begin execution.
```

Classifier escalated to L2 on the "public API" keyword (§11 HARD rule). L2 runs the 3-way planner cluster (eng + ceo + researcher). The CEO stub still flags business-context thinness — that's the heuristic doing its job.

Generated `intent.md`:

```yaml
---
task_id: FBC97523F1BE4F96BA62DD4BF1
level: L2
created_at: '2026-04-16T05:47:07.606Z'
title: add per-user rate limit to the public API
motivation: We need to protect the public API from abuse while preserving headroom for legitimate bursts; rate-limit per-user at 100 req/min rolling window returning 429 with rate-limit headers, and fail open if Redis is unavailable.
affected_readers:
  - dispatcher
  - downstream callers
scope_tokens:
  - read:decisions:*
  - write:decisions
  - write:progress
  - read:solutions
  - read:reviews
  - spawn:planner.*
  - spawn:researcher.*
---

## Classifier rationale

request involves public API/auth/payment surface; minimum L2 per HARD escalation rule

## Planner.eng verdict    |   ## Planner.ceo verdict    |   ## Prior art (researcher.history)
(approve + concerns + rewrite hints + research warnings)
```

From here, `intent.md` is immutable (Invariant §2). Changed requirements = new task.

## Step 3 — Work

Track features as you implement. `sgc work` only mutates `progress/` —
it cannot read `reviews/` (prevents self-selecting based on pending verdicts).

```bash
$ bun src/sgc.ts work --add "define RateLimiter with rolling-window counter"
added feature f2: define RateLimiter with rolling-window counter
task FBC97523F1BE4F96BA62DD4BF1 (level L2):
  [>] f1: add per-user rate limit to the public API (pending)
  [ ] f2: define RateLimiter with rolling-window counter (pending)

$ bun src/sgc.ts work --done f1
marked f1 done

$ bun src/sgc.ts work --done f2
marked f2 done
task FBC97523F1BE4F96BA62DD4BF1 (level L2):
  [x] f1: add per-user rate limit to the public API
  [x] f2: define RateLimiter with rolling-window counter

All features done. Run `sgc review` for independent code review.
```

(The actual `RateLimiter` implementation happens in your editor — `sgc work` is bookkeeping, not code generation.)

## Step 4 — Review

Spawns `reviewer.correctness` on the git diff (against `HEAD` by default).
Reviewer manifest forbids `read:solutions` at both the token and spawn-prompt
level (Invariant §1). Report is append-only per (task, stage, reviewer).

```bash
$ bun src/sgc.ts review
reviewer.correctness: pass (severity: none, 0 finding(s))
wrote /tmp/sgc-e-demo/reviews/FBC97523F1BE4F96BA62DD4BF1/code/reviewer.correctness.md
```

Stub output on a clean no-TODO diff. Injecting a `+TODO` on an added line
flips the verdict to `concern` with one finding.

## Step 5 — QA (L2+ gate)

`sgc qa` spawns `qa.browser`, which in production drives the `browse`
binary (Playwright/Chromium). For this demo the inline stub accepts the
target + flows without launching a browser. `hasQaEvidence` becomes true,
unblocking the ship gate.

```bash
$ bun src/sgc.ts qa "http://localhost:3000" \
    --flows "burst-to-429,headers-present,fail-open-on-redis-down"
qa.browser: pass (severity: none, 0 failed flow(s), 0 evidence ref(s))
wrote /tmp/sgc-e-demo/reviews/FBC97523F1BE4F96BA62DD4BF1/qa/qa.browser.md
```

Real browser run (sandbox permitting) captures screenshots + console
errors into `evidence_refs`. See [`plugins/sgc/browse/`](../plugins/sgc/browse/).

## Step 6 — Ship

The ship gate verifies in order: active task · all features done · ≥1
code review · qa evidence (L2+) · no `fail` verdicts without ≥40-char
`--override`. On success, writes immutable `decisions/{id}/ship.md` and
auto-triggers `janitor.compound`.

```bash
$ bun src/sgc.ts ship --auto
wrote /tmp/sgc-e-demo/decisions/FBC97523F1BE4F96BA62DD4BF1/ship.md
janitor.compound: compound (L2_plus_success)
  logged to: /tmp/sgc-e-demo/reviews/FBC97523F1BE4F96BA62DD4BF1/janitor/compound-decision.md
compound: action=compound
shipped FBC97523F1BE4F96BA62DD4BF1 (L2)
```

`--auto` is refused at L3 (§4); this is L2 so it's allowed. The janitor
decided `compound` on the `L2_plus_success` branch, and `runCompound`
executed inline — writing a solution entry atomically (§10 transaction).

## Step 7 — Compound artefacts

```bash
$ ls $SGC_STATE_ROOT/solutions/
other

$ cat $SGC_STATE_ROOT/reviews/*/janitor/compound-decision.md
```
```yaml
---
task_id: FBC97523F1BE4F96BA62DD4BF1
decision: compound
reason_code: L2_plus_success
reason_human: L2 shipped successfully; multi-file/cross-context work is worth indexing
inputs_hash: 0a9b0c88bdb8a00d56323e5daa8e1fefd011623ad1aee845b5ca63cd761972f7
created_at: '2026-04-16T05:47:28.602Z'
---
```

The solution landed under `other/` because the `compound.context` stub's
keyword set doesn't match "rate limit" strongly enough for a narrower
category. A real LLM classifies this as `perf` or `infra`. Stub
limitation; the category is a string field — re-categorizing is a single
file move + `source_task_ids` merge.

## Step 8 — Status

Read-only dashboard across `.sgc/`:

```bash
$ bun src/sgc.ts status
Active task (state root: /tmp/sgc-e-demo):
  task_id         FBC97523F1BE4F96BA62DD4BF1
  level           L2
  active_feature  (none)           # cleared on ship
  session_start   2026-04-16T05:47:07.606Z
  last_activity   2026-04-16T05:47:28.598Z
```

## Final state layout

```
/tmp/sgc-e-demo/
├── decisions/FBC97523F1BE4F96BA62DD4BF1/
│   ├── intent.md          (immutable, §2)
│   └── ship.md            (immutable)
├── progress/
│   ├── current-task.md
│   ├── feature-list.md
│   ├── agent-prompts/     (audit trail: 1 per spawn)
│   └── agent-results/     (mirror)
├── reviews/FBC97523F1BE4F96BA62DD4BF1/
│   ├── code/reviewer.correctness.md    (append-only, §6)
│   ├── qa/qa.browser.md                (append-only)
│   └── janitor/compound-decision.md    (append-only; §6 never silent)
└── solutions/other/add-per-user-rate-limit-to-the-public-ap.md
```

## Trust model

Everything above ran on inline heuristic stubs (`SGC_AGENT_MODE` unset →
priority chain picks `inline` because `ANTHROPIC_API_KEY` absent and no
explicit `inlineStub=false`). Stubs are keyword-driven and deterministic —
useful for tests, bootstrap, and shape validation, but they do not
produce genuine reasoning.

For real reasoning, set one of:

```bash
export ANTHROPIC_API_KEY=...                # → anthropic-sdk
# or
export SGC_AGENT_MODE=claude-cli             # requires `claude` on PATH
# or
export SGC_USE_FILE_AGENTS=1                 # manual file-poll submission
```

The dispatcher API is identical across modes — the same `runPlan`,
`runReview`, etc. Only the agent output changes.

See [`contracts/sgc-invariants.md`](../contracts/sgc-invariants.md) for
the 12 rules enforced at every spawn, [`contracts/sgc-capabilities.yaml`](../contracts/sgc-capabilities.yaml)
for per-agent scope, and [`plugins/sgc/CLAUDE.md`](../plugins/sgc/CLAUDE.md)
for the full command + permission matrix.
