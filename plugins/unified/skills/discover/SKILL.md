---
name: discover
description: "Use when requirements are unclear, before planning - clarifies goals, constraints, and acceptance criteria through structured questioning"
---

# Discover

Clarify requirements before planning. Turn vague intent into a concrete, actionable spec through structured questioning.

**Core principle:** Ambiguity in requirements multiplies into bugs in code. Eliminate ambiguity before writing a single line.

## When to Use

- User says "I want to build..." but details are vague
- Requirements have obvious gaps or contradictions
- Multiple valid interpretations exist for the same request
- Before `/plan` when the task is L2+ and scope is unclear
- User explicitly asks to clarify or discover requirements

## Permission

| Directory | Access |
|-----------|--------|
| decisions | -- |
| progress | R |
| solutions | -- |
| reviews | -- |

## Process

### Phase 1: Context Scan

Before asking any questions, gather context silently:

1. Read `progress/current-task.md` if it exists — understand what's already in flight.
2. Scan the project structure — understand the codebase shape.
3. Check recent git history — understand what's been changing.
4. Identify the domain — what kind of project is this?

### Phase 2: Forcing Questions

Ask questions one at a time. Do not batch. Wait for an answer before proceeding.

Use this framework (adapted from gstack office-hours methodology):

**1. Goal Question**
> "What does success look like? When this is done, what can the user do that they can't do now?"

**2. Constraint Questions** (ask only the relevant ones)
- "Are there performance requirements? (latency, throughput, data volume)"
- "Are there compatibility constraints? (browsers, APIs, existing systems)"
- "What's the timeline? Is this blocking something?"
- "Are there security considerations? (auth, PII, public exposure)"

**3. Scope Questions**
- "What's explicitly OUT of scope? What should this NOT do?"
- "Is this a standalone feature or does it modify existing behavior?"
- "Who are the users? Internal team, end users, API consumers?"

**4. Edge Case Questions**
- "What happens when [obvious failure mode]?"
- "What if the input is empty / malformed / enormous?"
- "What if the user does [unexpected but plausible action]?"

**5. Acceptance Criteria**
- "How will we verify this works? What tests prove it's correct?"
- "Is there a UI to check, an API to call, a log to read?"

### Phase 3: Draft Spec

After sufficient answers (typically 4-8 questions), produce a draft spec:

```markdown
## Draft Spec: [Title]

### Goal
[One sentence: what the user can do after this ships]

### Constraints
- [Constraint 1]
- [Constraint 2]

### Scope
- IN: [what's included]
- OUT: [what's excluded]

### Acceptance Criteria
1. [Criterion 1 — verifiable]
2. [Criterion 2 — verifiable]
3. [Criterion 3 — verifiable]

### Open Questions
- [Anything still unclear]
```

Present the draft to the user. Ask: "Does this capture what you want? Anything to add or change?"

### Phase 4: Handoff

Once the user confirms the spec:

1. Save the spec to `progress/current-task.md` as context for `/plan`.
2. Suggest: "Requirements are clear. Run `/plan <task>` to classify and plan."

## Important Rules

- **One question at a time.** Never batch multiple questions in a single message.
- **Prefer multiple choice** when the options are knowable. Open-ended only when necessary.
- **Do not assume.** If you think you know the answer, ask anyway. Wrong assumptions compound.
- **Do not plan.** Discovery is about WHAT, not HOW. Implementation details belong in `/plan`.
- **Stop when clear.** If requirements are already specific and complete, skip to Phase 3 immediately. Do not force unnecessary questions.
- **Respect the user's time.** If they say "just do it" with enough context, produce the spec and move on.
