---
name: compound
description: "Use to capture knowledge from solved problems - extracts structured solution documents via 4 specialized agents with dedup enforcement"
---

# Compound

Extract structured knowledge from solved problems and store it for future reuse. Uses 4 specialized agents with dedup enforcement and transaction semantics.

**Core principle:** Knowledge not captured is knowledge lost. But polluted knowledge is worse than no knowledge. Quality and dedup are non-negotiable.

## When to Use

- Automatically triggered by `unified:janitor:compound` after `/ship`
- User runs `/compound` manually to extract knowledge from the current task
- User runs `/compound --force` to override janitor skip decision

## Permission

| Directory | Access |
|-----------|--------|
| decisions | R |
| progress | R |
| solutions | RW |
| reviews | R |

## Process

### Step 1: Gather Context

Collect all available context for the solved problem:

1. Read `decisions/{task_id}/intent.md` — what was planned
2. Read `progress/feature-list.md` — what was implemented
3. Read `progress/current-task.md` — evidence and notes
4. Read `reviews/{task_id}/` — reviewer findings
5. Read the git diff — actual code changes

### Step 2: Dispatch 4-Agent Cluster

Dispatch four specialized agents. All four must complete successfully for the solution to be written (transaction semantics).

#### Agent 1: `unified:compound:context`

**Purpose**: Extract the problem context — what went wrong, why, and what made it hard.

Output:
```markdown
## Problem Context
- Symptom: [what the user/system observed]
- Root Cause: [underlying technical cause]
- Difficulty: [what made this non-obvious]
- Environment: [relevant tech stack, versions, constraints]
```

#### Agent 2: `unified:compound:solution`

**Purpose**: Extract the solution — what was done and why it works.

Output:
```markdown
## Solution
- Approach: [high-level description]
- Key Changes: [specific files and code changes]
- Why It Works: [technical explanation]
- Alternatives Considered: [other approaches and why they were rejected]
```

#### Agent 3: `unified:compound:related`

**Purpose**: Search `solutions/` for similar existing knowledge. Enforce dedup.

Process:
1. Scan all existing solutions in `solutions/`.
2. Compare the current problem against each by: symptom, root cause, tech stack, approach.
3. Compute similarity score (conceptual, not string matching).
4. Report:

```markdown
## Related Solutions
- [solutions/category/slug.md] — similarity: 0.72 — [brief description]
- [solutions/category/slug.md] — similarity: 0.45 — [brief description]

## Dedup Decision
- Highest similarity: {score}
- Threshold: 0.85
- Verdict: NEW | UPDATE_EXISTING | DUPLICATE
```

If similarity >= 0.85: mark as DUPLICATE or UPDATE_EXISTING. Do NOT create a new solution.

**CRITICAL**: This agent MUST run before any write to `solutions/`. This is Invariant #3.

#### Agent 4: `unified:compound:prevention`

**Purpose**: Extract prevention rules — how to avoid this problem in the future.

Output:
```markdown
## Prevention
- Early Detection: [how to catch this earlier — linting, testing, monitoring]
- Code Pattern: [anti-pattern to avoid, with example]
- Review Hint: [what reviewers should look for in related code]
```

### Step 3: Synthesize and Validate

After all 4 agents complete:

1. **Check dedup verdict** from `unified:compound:related`:
   - DUPLICATE → abort write, log "skipped: duplicate of {existing}" to janitor log.
   - UPDATE_EXISTING → update the existing solution file with new information.
   - NEW → proceed to write new solution.

2. **Assemble solution document** from agent outputs.

3. **Determine category** based on the problem domain:
   - `debugging/` — bug fixes and error resolution
   - `architecture/` — design decisions and patterns
   - `performance/` — optimization and profiling
   - `security/` — auth, encryption, access control
   - `testing/` — test strategies and patterns
   - `infrastructure/` — deployment, CI/CD, configuration
   - `integration/` — third-party services, APIs

4. **Generate slug** from the problem description: lowercase, hyphens, max 60 chars.

### Step 4: Write Solution

Write to `solutions/{category}/{slug}.md`:

```markdown
# {Title}

## Problem Context
[from unified:compound:context]

## Solution
[from unified:compound:solution]

## Prevention
[from unified:compound:prevention]

## Related
[from unified:compound:related — links to similar solutions]

## Metadata
- Task: {task_id}
- Level: L{n}
- Date: {timestamp}
- Files Changed: [list]
```

### Step 5: Transaction Semantics

The write to `solutions/` is all-or-nothing:

- If ANY of the 4 agents fails → abort the entire compound. Log failure to janitor.
- If dedup check fails (agent 3 did not run) → refuse to write. Invariant #3.
- If schema validation fails → refuse to write. Invariant #7.

On abort, no partial solution is left in `solutions/`. Clean up any temp files.

### Step 6: Log Decision

Write to `reviews/{task_id}/janitor/decision.md`:

```markdown
# Janitor Decision
Task: {task_id}
Action: COMPOUNDED | SKIPPED | UPDATED | FAILED
Reason: [why this action was taken]
Solution Path: [path if written, "N/A" if skipped]
Date: {timestamp}
```

This log is mandatory for all outcomes, including skips and failures (Invariant #6).

## Important Rules

- **All 4 agents must succeed.** Partial extraction is worse than no extraction. All-or-nothing.
- **Dedup before write.** `unified:compound:related` must run before any write to `solutions/`. No exceptions. Threshold is 0.85, not tunable.
- **Categories are fixed.** Use the defined categories. Do not create new ones without updating this list.
- **Schema validation.** Every write is validated before commit. No lenient mode.
- **Log everything.** Every janitor decision is logged, including skips and failures.
- **Conservative default.** When in doubt, skip. Missing knowledge is recoverable. Polluted knowledge is not.
