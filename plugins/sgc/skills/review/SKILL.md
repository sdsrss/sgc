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
- **Reviewer**: [`src/dispatcher/agents/reviewer-correctness.ts`](../../../../src/dispatcher/agents/reviewer-correctness.ts) (MVP; `reviewer.security` / `reviewer.performance` / `reviewer.adversarial` manifested in [`contracts/sgc-capabilities.yaml`](../../../../contracts/sgc-capabilities.yaml) but stubbed pending E-phase)
- **Scope pin**: `spawn.ts` emits `scope_tokens:` + `FORBIDDEN from: read:solutions` in every reviewer prompt (holistically verified by [`tests/eval/reviewer-isolation.test.ts`](../../../../tests/eval/reviewer-isolation.test.ts))
- **Invariants**: §1 reviewer no-solutions · §5 override reason ≥40 · §6 append-only per (task, stage, reviewer)

## Invocation

```bash
sgc review                       # auto-detect diff vs git HEAD~1
sgc review --base <ref>          # diff against explicit base
```

Re-running `review` for the same task throws `AppendOnly` — reviews are an audit trail, not a retry loop. To ship despite a `fail` verdict, supply `--override "<≥40-char reason>"` at `sgc ship`.

## Planned (Phase 2)

L3 diff-conditional expansion (security-specialist / migration / performance-specialist / infra variants) to max 10 reviewers. Not implemented — current L3 runs the L2 cluster. Dispatching unmanifested names fails `computeSubagentTokens`, which is intended.
