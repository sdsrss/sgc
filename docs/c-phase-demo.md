# C-Phase Demo: L1 Closed Loop

End-to-end run of `sgc plan → work → review` against the MVP dispatcher.
Reproducible from any clean checkout.

## Setup

```bash
unset NODE_ENV   # bun test sets this; child citty silences stdout if propagated
export SGC_STATE_ROOT=/tmp/sgc-demo
rm -rf $SGC_STATE_ROOT && mkdir -p $SGC_STATE_ROOT
```

## Run

```bash
$ bun src/sgc.ts plan "add an Example section to plan/SKILL.md"
task_id = FA04331266A0434A8C8B851FA7
classifier verdict: L1 — default classification — single-file or simple change with no keyword hits for L0/L2/L3
planner.eng verdict: approve
wrote /tmp/sgc-demo/decisions/FA04331266A0434A8C8B851FA7/intent.md

Plan complete. Run `sgc work` to begin execution.

$ bun src/sgc.ts status
Active task (state root: /tmp/sgc-demo):
  task_id         FA04331266A0434A8C8B851FA7
  level           L1
  active_feature  f1
  session_start   2026-04-15T07:52:09.019Z
  last_activity   2026-04-15T07:52:09.019Z

$ bun src/sgc.ts work
task FA04331266A0434A8C8B851FA7 (level L1):
  [>] f1: add an Example section to plan/SKILL.md (pending)

Active: f1 — add an Example section to plan/SKILL.md
When implemented, run: `sgc work --done f1`

$ bun src/sgc.ts work --add "verify rendered output"
added feature f2: verify rendered output
task FA04331266A0434A8C8B851FA7 (level L1):
  [>] f1: add an Example section to plan/SKILL.md (pending)
  [ ] f2: verify rendered output (pending)
…

$ bun src/sgc.ts work --done f1
marked f1 done
…
  [x] f1: add an Example section to plan/SKILL.md
  [>] f2: verify rendered output (pending)
…

$ bun src/sgc.ts work --done f2
marked f2 done
…
  [x] f1: add an Example section to plan/SKILL.md
  [x] f2: verify rendered output

All features done. Run `sgc review` for independent code review.

$ bun src/sgc.ts review
reviewer.correctness: concern (severity: low, 1 finding(s))
  - no diff to review (empty change)
wrote /tmp/sgc-demo/reviews/FA04331266A0434A8C8B851FA7/code/reviewer.correctness.md
```

`review` correctly reports `concern` because we never modified working-tree
files in this demo — `git diff HEAD` returned empty. Repeat the demo with an
actual code edit before `sgc review` to see the `pass` path.

## State files written

```
/tmp/sgc-demo/
├── decisions/FA04331266A0434A8C8B851FA7/intent.md      ← immutable, written by /plan
├── progress/
│   ├── current-task.md                                 ← mutable, updated by /plan + /work
│   ├── feature-list.md                                 ← mutable, updated by /plan + /work
│   ├── agent-prompts/                                  ← audit trail, append-only
│   │   ├── 2152BE5F…-classifier.level.md
│   │   ├── 9F8A421D…-planner.eng.md
│   │   └── 0B123AFF…-reviewer.correctness.md
│   └── agent-results/                                  ← audit trail, mirrors prompts
│       ├── 2152BE5F…-classifier.level.md
│       ├── 9F8A421D…-planner.eng.md
│       └── 0B123AFF…-reviewer.correctness.md
└── reviews/FA04331266A0434A8C8B851FA7/code/
    └── reviewer.correctness.md                         ← append-only per (task,stage,reviewer)
```

### intent.md (immutable)

```yaml
---
task_id: FA04331266A0434A8C8B851FA7
level: L1
created_at: '2026-04-15T07:52:09.019Z'
title: add an Example section to plan/SKILL.md
motivation: add an Example section to plan/SKILL.md
affected_readers:
  - dispatcher
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
default classification — single-file or simple change with no keyword hits for L0/L2/L3

## Planner.eng verdict
approve
```

### reviewer.correctness.md (append-only)

```yaml
---
report_id: EC1246A122804D189232316D8D
task_id: FA04331266A0434A8C8B851FA7
stage: code
reviewer_id: reviewer.correctness
reviewer_version: '0.1'
verdict: concern
severity: low
findings:
  - description: no diff to review (empty change)
created_at: '2026-04-15T07:52:09.278Z'
---
```

### Sample agent prompt (audit trail)

```yaml
---
spawn_id: 2152BE5F020E47E2A66635F010-classifier.level
agent: classifier.level
version: '0.1'
scope_tokens:
  - read:progress
timeout_s: 30
expected_outputs:
  level: enum[L0, L1, L2, L3]
  rationale: markdown
  affected_readers_candidates: array[string]
---

## Purpose
Classify incoming task into L0 / L1 / L2 / L3

## Input
```yaml
user_request: add an Example section to plan/SKILL.md
```

## Instructions
Write your response to: `/tmp/sgc-demo/progress/agent-results/2152BE5F…-classifier.level.md`
Format: YAML frontmatter matching expected_outputs above, plus optional markdown body.
```

## Invariant runtime check

What the demo proves about each non-negotiable rule:

| Inv. | Rule | Demo evidence |
|------|------|---------------|
| §1 | Reviewers/QA cannot read solutions/ | reviewer.correctness manifest declares no `read:solutions`; `computeSubagentTokens` would throw `ScopeViolation` if it did (covered by `capabilities.test.ts`); spawn audit prompt confirms only `read:decisions`, `read:progress`, `write:reviews`, `exec:git:read` are pinned |
| §2 | Decisions immutable | `intent.md` written once; second `writeIntent` for same task_id throws `IntentImmutable` (state.test.ts) |
| §4 | L3 forbids --auto / requires user signature | `runPlan` refuses L3 without `--signed-by`; demo task classified L1 so signature not required |
| §5 | Reviewer override needs human + reason ≥40 | `appendReview` validates `override.reason.length >= 40` (state.test.ts); demo verdict was `concern` not `fail`, no override needed |
| §6 | Every review/janitor decision logged | `appendReview` enforces append-only per (task,stage,reviewer); second invocation throws `AppendOnly` (sgc-review.test.ts) |
| §7 | Schema validation precedes write | `writeIntent`, `writeShip`, `appendReview` all field-validate before atomic write |
| §8 | Scope tokens pinned at spawn | `spawn()` calls `computeSubagentTokens` first; pinned set written into prompt frontmatter; subagent cannot request more during execution (no API path exists) |
| §9 | Subagents output only declared shape | `validateOutputShape` after stub return; throws `OutputShapeMismatch` on missing fields (spawn.test.ts) |

§3 (solutions dedup), §10 (compound transaction), §11 (classifier rationale
required), §12 (eval framework authoritative) are deferred to D-phase since
they live above the L1 closed-loop scope.

## Known MVP limits

- **Stub agents**: classifier/planner/reviewer use hardcoded heuristics, not
  LLM. Quality of classification + review feedback is correspondingly limited.
- **No L2/L3 cluster**: planner.ceo, planner.adversarial, researcher.history
  not yet wired to /plan.
- **No compound**: solutions/ never written.
- **No qa.browser, ship, discover**: stubs only.
- **No real `Task()` spawn**: file-poll mode exists (`SGC_USE_FILE_AGENTS=1`)
  but waits for an external actor to write the result file.

## Reproducing from scratch

```bash
git clone <repo> sgc && cd sgc
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
unset NODE_ENV
SGC_STATE_ROOT=/tmp/sgc-demo bun src/sgc.ts plan "your task here"
SGC_STATE_ROOT=/tmp/sgc-demo bun src/sgc.ts work
# … iterate work --done
SGC_STATE_ROOT=/tmp/sgc-demo bun src/sgc.ts review
SGC_STATE_ROOT=/tmp/sgc-demo bun src/sgc.ts status
```

107 dispatcher unit tests cover each layer (`bun test tests/dispatcher/`).
