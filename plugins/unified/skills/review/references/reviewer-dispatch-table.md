# Reviewer Dispatch Table

## Fixed Reviewers by Level

| Level | Count | Reviewers |
|-------|-------|-----------|
| L0 | 1 | correctness |
| L1 | 2 | correctness, tests |
| L2 | 6 | correctness, security, performance, tests, maintainability, adversarial |
| L3 | 6+N | L2 base + diff-conditional (max 10 total) |

## Diff-Conditional Triggers (L3 only)

| Pattern in diff | Additional reviewer |
|-----------------|-------------------|
| `crypto\|auth\|jwt\|session\|token` | security (specialist variant) |
| `migration\|ALTER\|DROP\|schema` | migration specialist |
| `perf\|benchmark\|cache\|index` | performance (specialist variant) |
| `deploy\|infra\|docker\|k8s` | infrastructure specialist |

## Hard limit: 10 reviewers maximum

Beyond 10, marginal review value turns negative (review theater).

## All Reviewers Must

- Output verdict: pass / concern / fail
- Output severity: none / low / medium / high / critical
- Output findings array with location + description + suggestion
- **NEVER read .unified/solutions/** — judge independently
