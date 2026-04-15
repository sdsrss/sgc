---
name: review
description: "Use after implementation to run independent code review - dispatches reviewer agents based on task level, ensures author-reviewer separation"
---

# Review

Dispatch independent reviewer agents to evaluate completed work. Reviewers operate in separate contexts and MUST NOT access historical solutions.

**Core principle:** The author cannot review their own work. Reviewers must judge independently, without confirmation bias from past solutions.

## When to Use

- User runs `/review` after `/work` is complete
- Before `/ship` — review is a prerequisite for shipping

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | **FORBIDDEN** |
| reviews | W |

**CRITICAL**: This skill MUST NOT read `solutions/`. This is Invariant #1 — Generator-Evaluator Separation. Violation is a hard error, not a warning.

## Process

### Step 1: Read Context

1. Read `decisions/{task_id}/intent.md` — understand what was planned.
2. Read `progress/feature-list.md` — understand what was implemented.
3. Read `progress/current-task.md` — check evidence collected during work.
4. Run `git diff` against the base branch — this is what reviewers evaluate.

### Step 2: Dispatch Reviewers

Dispatch reviewer agents based on task level. Each reviewer runs in an independent context with ONLY the diff, intent, and feature list. Reviewers do NOT share context with each other or with the author session.

#### Reviewer Dispatch Table

| Level | Reviewers | Count |
|-------|-----------|-------|
| L0 | `sgc:reviewer:correctness` | 1 |
| L1 | `sgc:reviewer:correctness`, `sgc:reviewer:tests` | 2 |
| L2 | `sgc:reviewer:correctness`, `sgc:reviewer:security`, `sgc:reviewer:performance`, `sgc:reviewer:tests`, `sgc:reviewer:maintainability`, `sgc:reviewer:adversarial` | 6 |
| L3 | L2 base + diff-conditional expansion | 6 + N (max 10) |

#### Diff-Conditional Triggers (L3 Only) — Phase 2

**Status: not yet implemented.** L3 tasks currently run the same 6-reviewer cluster as L2. Specialist variants (security-specialist, migration, performance-specialist, infra) are deferred until the dispatcher and agent manifests exist. Intended design below is preserved as a forward reference; do **not** dispatch these names — they have no backing `agents/reviewer/*.md`.

| Diff Pattern | Intended Reviewer (Phase 2) |
|--------------|-----------------------------|
| `crypto`, `auth`, `jwt`, `token`, `session` | security-specialist |
| `migration`, `ALTER`, `DROP`, `CREATE TABLE` | migration |
| `perf`, `benchmark`, `cache`, `O(n)`, `index` | performance-specialist |
| `deploy`, `Dockerfile`, `k8s`, `terraform` | infra |

Maximum total reviewers when implemented: 10. Priority on overflow: security > migration > performance > infra.

### Step 3: Reviewer Context

Each reviewer agent receives:

```
You are sgc:reviewer:{type}.
Review the following diff independently.
You MUST NOT access solutions/ or any historical knowledge base.

## Intent
[contents of intent.md]

## Feature List
[contents of feature-list.md]

## Diff
[git diff output]

## Your Focus
[specific focus area for this reviewer type]

Report: pass/fail, severity (low/medium/high/critical), findings with file:line references.
```

### Step 4: Collect Reports

Each reviewer writes its report to `reviews/{task_id}/review/{reviewer_type}.md`:

```markdown
# Review: {reviewer_type}
Task: {task_id}
Verdict: PASS | FAIL
Severity: low | medium | high | critical

## Findings
### [Finding Title]
- File: path/to/file.ts:42
- Severity: medium
- Description: [what's wrong]
- Suggestion: [how to fix]

## Summary
[One paragraph overall assessment]
```

### Step 5: Synthesize

After all reviewers complete, produce a summary:

```markdown
## Review Summary
- Total reviewers: {n}
- Pass: {n}
- Fail: {n}
- Critical findings: {n}
- High findings: {n}

### Action Required
[List of findings that must be addressed before shipping]

### Recommendations
[List of findings that are optional improvements]
```

Present the summary to the user.

### Step 6: Route

- **All pass, no critical/high findings**: "Review passed. Run `/ship` when ready."
- **Any fail or critical finding**: "Review found issues. Address the findings, then re-run `/review`."
- **Fail with user override**: User can force-proceed, but only with human signature + reason (>=40 chars). This override is logged to `reviews/{task_id}/review/override.md`.

## Important Rules

- **Independent context.** Each reviewer runs in a separate agent context. No shared state between reviewers.
- **No solutions/ access.** Reviewers must judge the code on its own merits, not by comparison to past solutions. This prevents confirmation bias.
- **Author-reviewer separation.** The same Claude session that wrote the code cannot be a reviewer. Reviewers are dispatched as subagents.
- **Immutable reports.** Once a reviewer writes its report, the report cannot be edited. Re-review creates a new report.
- **Override requires human.** If a reviewer fails and the user wants to proceed, they must provide a reason of at least 40 characters. This is logged permanently.
