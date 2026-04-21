---
name: review
description: "Use after implementation to run independent code review - dispatches reviewer agents based on task level, ensures author-reviewer separation"
---

# Review

Dispatch reviewer agents (fresh context) against the current task's diff. Reviewers cannot read `solutions/` — this is Invariant §1, not a suggestion.

**Core principle:** the author cannot review their own work. Reviewers must judge without historical-solution bias.

## When to Use

- User runs `/review` after `/work` is complete
- Before `/ship` (a code review is required for L1+)

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | **FORBIDDEN** (§1) |
| reviews | W |

## Routing

- **Behavior**: [`src/commands/review.ts`](../../../../src/commands/review.ts) (`runReview`)
- **Base reviewer**: [`src/dispatcher/agents/reviewer-correctness.ts`](../../../../src/dispatcher/agents/reviewer-correctness.ts) — runs at every level
- **L3 specialists**: [`src/dispatcher/agents/reviewer-specialists.ts`](../../../../src/dispatcher/agents/reviewer-specialists.ts) — `reviewer.{security,migration,performance,infra}` spawn in parallel when the diff matches their trigger keywords. Aggregate verdict = worst-of (`pass < concern < fail`)
- **Manifest**: 9 reviewers in [`contracts/sgc-capabilities.yaml`](../../../../contracts/sgc-capabilities.yaml) (correctness/security/performance/tests/maintainability/adversarial/spec/migration/infra). `tests`/`maintainability`/`adversarial`/`spec` are manifested as forward-references — not yet wired into `runReview`
- **Scope pin**: `spawn.ts` emits `scope_tokens:` + `FORBIDDEN from: read:solutions` in every reviewer prompt (holistically verified by [`tests/eval/reviewer-isolation.test.ts`](../../../../tests/eval/reviewer-isolation.test.ts))
- **Invariants**: §1 reviewer no-solutions · §5 override reason ≥40 · §6 append-only per (task, stage, reviewer)

## Execution

When this skill is invoked, dispatch to the sgc CLI:

```bash
bun src/sgc.ts review $ARGUMENTS
```

Re-running `review` for the same task throws `AppendOnly` — reviews are an audit trail, not a retry loop. To ship despite a `fail` verdict, supply `--override "<≥40-char reason>"` at `sgc ship`.

## Delegation hint

For broader static analysis beyond sgc's reviewer cluster:
- `gs:/review` — pre-landing PR review with SQL safety, LLM trust boundary, and structural checks

## L3 specialist trigger table

At L3 the dispatcher scans the diff and spawns matching specialists alongside `reviewer.correctness`:

| Specialist | Trigger keywords (loose match, identifier-friendly) | Severity on hit |
|------------|-----------------------------------------------------|-----------------|
| `reviewer.security` | auth · jwt · token · session · crypto · password · secret · signature · encrypt/decrypt | medium |
| `reviewer.migration` | migration · ALTER/DROP/CREATE TABLE · ALTER/RENAME COLUMN · backfill | high |
| `reviewer.performance` | perf · cache · memoize · index · benchmark · n+1 · O(n) · p95/p99 | medium |
| `reviewer.infra` | Dockerfile · FROM · kubectl · k8s · terraform · helm · fly.toml · vercel.json · render.yaml · github/workflows | high |

Patterns are deliberately loose (no word boundaries) so camelCase / snake_case identifiers like `signJwt` or `auth_token` still match — false positives are acceptable for a keyword stub; precision is the LLM path's job.
