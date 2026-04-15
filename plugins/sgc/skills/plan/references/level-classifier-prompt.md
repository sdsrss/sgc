# Level Classifier Prompt

Classify the following task into one of four levels based on scope, risk, and blast radius.

## Classification Criteria

### L0 — Trivial
- Documentation typo, comment fix, formatting
- Config value change with no behavior impact
- Single file, < 10 lines, zero risk
- **Signal**: No code logic changes whatsoever

### L1 — Simple
- Single file, < 50 lines
- No externally observable behavior change
- Bug fix where root cause is clear
- **Signal**: Can name at least one affected reader/consumer
- **Required**: `affected_readers` field must list at least 1 reader

### L2 — Standard
- Multi-file changes OR behavior change OR test changes needed
- New API endpoint, UI component, or integration
- Refactoring that changes internal architecture
- **Signal**: Changes cross module boundaries or affect external contracts
- **Hard escalation**: Any change to public API, auth, or payment → minimum L2

### L3 — Complex
- Architecture decisions, database schema changes
- Production infrastructure, deployment pipeline
- Irreversible changes (data migration, API deprecation)
- **Signal**: Cannot be rolled back easily
- **Hard escalation**: Any migration or infra change → minimum L3

## Output Format

```yaml
level: L0|L1|L2|L3
rationale: |
  [Must reference at least one concrete feature: file count, risk keyword, blast radius, etc.]
  [Generic rationales like "seems simple" are rejected]
affected_readers:
  - [List consumers/readers affected by this change]
  - [Required for L1+; if you cannot name any, escalate to L2]
```

## Rules

- When uncertain, escalate UP (L1→L2, not L2→L1)
- User can request re-classification upward but NEVER downward
- L3 tasks FORBID --auto at all stages
