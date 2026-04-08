---
name: plan
description: "Use when starting any non-trivial task - classifies task level (L0-L3), runs appropriate planning agents, produces intent document and execution plan"
---

# Plan

Classify the task, dispatch planning agents, and produce an intent document with a concrete execution plan.

**Core principle:** Every step in the plan must specify concrete code changes — no placeholders, no "implement the logic here."

## When to Use

- User runs `/plan <task>`
- Starting any new task that requires implementation
- After `/discover` confirms requirements

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R+W |
| progress | RW |
| solutions | R |
| reviews | R |

## Process

### Step 1: Level Classification

Dispatch `unified:classifier:level` to classify the task. The classifier evaluates:

| Level | Criteria |
|-------|----------|
| L0 | Trivial: typo, formatting, config-only, no behavior change |
| L1 | Single file, <50 lines, no behavior change |
| L2 | Multi-file OR behavior change OR tests needed |
| L3 | Architecture, DB schema, production infrastructure |

**Hard escalation rules** (classifier cannot override):
- Uncertain level → escalate up
- Public API / auth / payment → minimum L2
- Migration / infrastructure → minimum L3

Present the classification to the user: "Classified as **L{n}** because: {reason}. Agree?"

If the user disagrees, re-classify with their input.

### Step 2: Route by Level

#### L0 — Direct to Work

No planning needed. Write a minimal `intent.md` and route directly to `/work`.

```markdown
# Intent: [task]
Level: L0
Decision: Direct execution, no plan required.
```

Save to `decisions/{task_id}/intent.md` and invoke `/work`.

#### L1 — Light Planning

Dispatch `unified:planner:eng` for a lightweight engineering review:

1. Identify the file to change.
2. Describe the change in concrete terms.
3. List any tests to add or update.

Output the plan to `progress/feature-list.md` as a checklist.

#### L2 — Full Planning

Dispatch three planning agents in parallel:

- **`unified:planner:ceo`** — Business context: why this matters, success metrics, user impact.
- **`unified:planner:eng`** — Engineering plan: files to change, implementation steps, test strategy.
- **`unified:researcher:history`** — Historical context: search `solutions/` for related past work, check git history for prior attempts.

Synthesize their outputs into a unified plan.

#### L3 — Full Planning + Adversarial

Dispatch all L2 agents plus:

- **`unified:planner:adversarial`** — Attack the plan: what can go wrong, what's missing, what assumptions are wrong.

After synthesis, present the plan and **require human signature** before proceeding:

> "This is an L3 task. Plan requires your explicit approval before execution. Review the plan above and confirm with 'approved' to proceed."

L3 **forbids --auto** at all stages. Do not proceed without human confirmation.

### Step 3: Write Intent Document

Create `decisions/{task_id}/intent.md`:

```markdown
# Intent: [Task Title]

## Classification
- Level: L{n}
- Reason: [why this level]
- Task ID: [generated]

## Goal
[What success looks like — one paragraph]

## Plan
1. [Concrete step with specific files and changes]
2. [Concrete step with specific files and changes]
3. [Concrete step with specific files and changes]

## Test Strategy
- [What tests to write]
- [What existing tests to verify]

## Risks
- [Risk 1 and mitigation]
- [Risk 2 and mitigation]

## Agent Reports
### planner.eng
[Summary of engineering plan]

### planner.ceo (L2+)
[Summary of business context]

### researcher.history (L2+)
[Summary of historical findings]

### planner.adversarial (L3)
[Summary of adversarial review]
```

**CRITICAL**: Once written, `intent.md` is immutable. If intent changes, create a new task with a new ID.

### Step 4: Write Feature List

Create `progress/feature-list.md` as a task checklist for `/work`:

```markdown
# Feature List: [Task Title]
Task ID: [id]
Level: L{n}

## Tasks
- [ ] [Step 1 description]
- [ ] [Step 2 description]
- [ ] [Step 3 description]
- [ ] [Step N description]

## Verification
- [ ] All tests pass
- [ ] Lint clean
- [ ] Build succeeds (L2+)
```

### Step 5: Handoff

Inform the user:

> "Plan written to `decisions/{task_id}/intent.md`. Feature list at `progress/feature-list.md`. Run `/work` to begin execution."

## Important Rules

- **Concrete steps only.** Every plan step must name specific files, functions, and changes. "Implement the feature" is not a step.
- **Reuse first.** `unified:researcher:history` checks `solutions/` before planning from scratch. If a similar problem was solved before, reference it.
- **No code in planning.** The plan describes WHAT to change, not the actual code. Code belongs in `/work`.
- **Immutable intent.** Once `intent.md` is written, it cannot be edited. Changed requirements = new task, new intent.
- **Level gates.** Do not skip planning steps based on confidence. L2 always gets 3 agents. L3 always gets 4 agents + human approval.
