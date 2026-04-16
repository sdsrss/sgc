---
name: discover
description: "Use when requirements are unclear, before planning - clarifies goals, constraints, and acceptance criteria through structured questioning"
---

# Discover

Clarify requirements before `/plan`. Turn vague intent into a concrete spec through structured questioning.

**Core principle:** ambiguity in requirements multiplies into bugs in code. Eliminate it before writing a single line.

## Status

**⏸ Not yet implemented.** `sgc discover` CLI stub throws `NotImplementedYet`; deferred to E-phase per [`docs/d-phase-plan.md`](../../../../docs/d-phase-plan.md) line 42.

Until implemented, apply the forcing-question pattern inline in conversation, then hand a concrete task to `/plan`.

## When to Use

- User says "I want to build..." but details are vague
- Requirements have obvious gaps or contradictions
- Multiple valid interpretations exist for the same request
- Before `/plan` when the task is L2+ and scope is unclear

## Permission (planned)

| Directory | Access |
|-----------|--------|
| decisions | — |
| progress | R |
| solutions | — |
| reviews | — |

## Routing (planned)

When implemented, this skill will invoke `sgc discover <topic>` and write a draft spec to `progress/current-task.md` as seed context for the subsequent `/plan` invocation. Forcing-question pattern derived from gstack `office-hours`.

## Forcing-question pattern (manual fallback)

Ask one at a time, wait for the answer, don't batch:

1. **Goal**: "When this is done, what can the user do that they can't do now?"
2. **Constraints**: performance / compatibility / timeline / security — only the relevant ones.
3. **Scope**: what's explicitly OUT? standalone or modifies existing?
4. **Edge cases**: empty / malformed / enormous input? unexpected but plausible user action?
5. **Acceptance**: how will we verify? test / API call / log?

Stop as soon as the spec is concrete. Don't force unnecessary questions.
