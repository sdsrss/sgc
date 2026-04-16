---
name: discover
description: "Use when requirements are unclear, before planning - clarifies goals, constraints, and acceptance criteria through structured questioning"
---

# Discover

Take a vague topic; emit structured forcing-questions (goal / constraints / scope / edge cases / acceptance) plus a concrete `sgc plan` follow-up. The user answers the questions inline, then carries the consolidated answer into `sgc plan --motivation`.

**Core principle:** ambiguity in requirements multiplies into bugs in code. Eliminate it before writing a single line.

## When to Use

- User says "I want to build..." but details are vague
- Requirements have obvious gaps or contradictions
- Multiple valid interpretations exist for the same request
- Before `/plan` when the task is L2+ and scope is unclear

## Permission

| Directory | Access |
|-----------|--------|
| decisions | — |
| progress | R |
| solutions | — |
| reviews | — |

Plus `spawn:clarifier.*`. No writes — `discover` cannot mutate `.sgc/` state beyond the spawn audit trail under `progress/agent-prompts/` and `agent-results/`.

## Routing

- **Behavior**: [`src/commands/discover.ts`](../../../../src/commands/discover.ts) (`runDiscover`)
- **Agent**: [`src/dispatcher/agents/clarifier-discover.ts`](../../../../src/dispatcher/agents/clarifier-discover.ts) — heuristic stub keys off auth / data / ui / perf / api keywords to tune the question set
- **Contract**: `clarifier.discover` manifest in [`contracts/sgc-capabilities.yaml`](../../../../contracts/sgc-capabilities.yaml)

## Invocation

```bash
sgc discover "<vague topic>"
```

Output is structured text with sections Goal / Constraints / Scope / Edge cases / Acceptance / Next. The last section contains the exact `sgc plan ...` command to run after answering.

## Pattern (what the agent emits)

1. **Goal**: "When X is done, what can the user do that they can't do today?"
2. **Constraints** (3-4): performance / platform / timeline + domain-tuned (threat-model for auth, rollback plan for migrations, baseline+target for perf).
3. **Scope** (2-3): what's explicitly OUT, breaking vs additive, replace vs augment.
4. **Edge cases** (3-4): empty/malformed/enormous input, concurrency, dependency failure, token lifecycle (auth).
5. **Acceptance** (2-3): test / URL / log line that proves done; smallest user-visible change.

If an active task exists (`progress/current-task.md`), its id + level show up in the suggested-next hint as context.
